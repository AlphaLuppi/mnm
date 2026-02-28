/**
 * MnM POC - Web Dashboard Server
 *
 * Express + Chokidar + SSE for real-time Claude Code session monitoring.
 * Usage: node server.js
 */

import express from 'express';
import chokidar from 'chokidar';
import { readFile, readdir, stat } from 'fs/promises';
import { basename, join, relative, sep, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_DIR = join(homedir(), '.claude');
const PORT = 3005;
const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;
const CONTEXT_WINDOW_SIZE = 200_000;
const MAX_MESSAGES = 200;

// ─── In-Memory Store ────────────────────────────────────

const sessions = new Map();
const fileLineCounts = new Map();
const sseClients = new Set();

// ─── Helpers ────────────────────────────────────────────

function shortPath(fullPath) {
  return relative(CLAUDE_DIR, fullPath).replaceAll(sep, '/');
}

function extractProjectName(projectDir, projectPath) {
  if (projectPath) {
    const parts = projectPath.replace(/\\/g, '/').split('/');
    const idx = parts.findIndex(p => p === 'IdeaProjects' || p === 'Projects' || p === 'repos');
    if (idx >= 0) return parts.slice(idx + 1).join('/');
    return parts.slice(-2).join('/');
  }
  // projectDir is like "C--Users-andri-IdeaProjects-AlphaLuppi-mnm"
  // Reconstruct a path by replacing -- with / and - with /
  const asPath = projectDir.replace(/--/g, '/');
  const parts = asPath.split('/');
  // Find IdeaProjects segment
  for (let i = 0; i < parts.length; i++) {
    const sub = parts[i].split('-');
    const ipIdx = sub.indexOf('IdeaProjects');
    if (ipIdx >= 0) {
      const after = sub.slice(ipIdx + 1).join('/');
      const rest = parts.slice(i + 1).join('/');
      return after + (rest ? '/' + rest : '');
    }
  }
  // Fallback: take last 2 dash-segments
  const dashes = projectDir.split('-');
  return dashes.slice(-2).join('/');
}

function truncate(str, maxLen) {
  if (!str) return '';
  const oneLine = str.replace(/\n/g, ' ').trim();
  return oneLine.length > maxLen ? oneLine.slice(0, maxLen) + '...' : oneLine;
}

function cleanPrompt(str) {
  if (!str) return '';
  // Strip XML-like command tags from firstPrompt
  return str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function deriveStatus(session) {
  if (!session.lastRole) return 'idle';
  if (session.lastRole === 'user') return 'processing';
  if (session.lastRole === 'assistant') {
    if (session.lastStopReason === 'end_turn') return 'waiting';
    if (session.lastStopReason === 'tool_use') return 'working';
    return 'working';
  }
  return 'idle';
}

function computeContextPercent(usage) {
  if (!usage) return 0;
  const consumed = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0);
  return Math.min(100, Math.round((consumed / CONTEXT_WINDOW_SIZE) * 100));
}

function extractText(message) {
  if (!message?.content) return '';
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content.filter(b => b.type === 'text').map(b => b.text).join(' ');
  }
  return '';
}

function isActive(session) {
  if (!session.modified) return false;
  return (Date.now() - new Date(session.modified).getTime()) < ACTIVE_THRESHOLD_MS;
}

// ─── Session Store Operations ───────────────────────────

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      sessionId,
      projectDir: '',
      projectPath: '',
      projectName: '',
      jsonlPath: '',
      gitBranch: '',
      firstPrompt: '',
      messageCount: 0,
      created: '',
      modified: '',
      isSidechain: false,
      lastRole: null,
      lastStopReason: null,
      status: 'idle',
      contextPercent: 0,
      lastUsage: null,
      lastAssistantText: '',
      activeToolNames: [],
      contextIngested: [],
      messages: [],
      subagents: new Map(),
      tasks: [],
    });
  }
  return sessions.get(sessionId);
}

function processEntry(sessionId, entry) {
  const session = getOrCreateSession(sessionId);

  const role = entry.message?.role;
  const type = entry.type;

  // Skip progress/hook entries for message tracking
  if (type === 'progress' || type === 'hook_progress' || type === 'bash_progress' || type === 'agent_progress') {
    return;
  }

  // System entries
  if (type === 'system') {
    return;
  }

  // File history snapshots
  if (type === 'file-history-snapshot') {
    return;
  }

  // Summary/compaction
  if (type === 'summary') {
    session.messages.push({ type: 'summary', timestamp: entry.timestamp || new Date().toISOString() });
    if (session.messages.length > MAX_MESSAGES) session.messages = session.messages.slice(-MAX_MESSAGES);
    return;
  }

  if (!role) return;

  // Track metadata from first entries
  if (entry.gitBranch && !session.gitBranch) session.gitBranch = entry.gitBranch;
  if (entry.cwd && !session.projectPath) session.projectPath = entry.cwd;

  // Update last role for status derivation
  session.lastRole = role;
  session.modified = entry.timestamp || new Date().toISOString();
  session.messageCount++;

  if (role === 'user') {
    const text = extractText(entry.message);
    if (!session.firstPrompt && text) {
      session.firstPrompt = truncate(cleanPrompt(text), 200);
    }
    session.messages.push({
      role: 'user',
      text: truncate(text, 500),
      timestamp: entry.timestamp,
    });
  }

  if (role === 'assistant') {
    session.lastStopReason = entry.message?.stop_reason || null;

    // Usage tracking
    if (entry.message?.usage) {
      session.lastUsage = entry.message.usage;
      session.contextPercent = computeContextPercent(entry.message.usage);
    }

    const blocks = entry.message?.content;
    if (Array.isArray(blocks)) {
      const toolNames = [];
      let lastText = '';

      for (const block of blocks) {
        if (block.type === 'text' && block.text?.trim()) {
          lastText = block.text;
        }
        if (block.type === 'tool_use') {
          toolNames.push(block.name);

          // Context tracking
          const name = block.name;
          const input = block.input || {};
          if (name === 'Read' && input.file_path) {
            addContextEntry(session, 'file', input.file_path);
          } else if ((name === 'Glob' || name === 'Grep') && (input.pattern || input.path)) {
            addContextEntry(session, 'search', input.pattern || input.path);
          } else if (name === 'WebFetch' && input.url) {
            addContextEntry(session, 'url', input.url);
          } else if (name === 'WebSearch' && input.query) {
            addContextEntry(session, 'search', input.query);
          } else if (name === 'Agent') {
            addContextEntry(session, 'agent', input.description || input.subagent_type || 'subagent');
          }
        }
      }

      if (lastText) session.lastAssistantText = truncate(lastText, 500);
      session.activeToolNames = toolNames;

      session.messages.push({
        role: 'assistant',
        text: truncate(lastText, 300),
        tools: toolNames,
        timestamp: entry.timestamp,
      });
    }
  }

  session.status = deriveStatus(session);
  if (session.messages.length > MAX_MESSAGES) {
    session.messages = session.messages.slice(-MAX_MESSAGES);
  }
}

function addContextEntry(session, type, value) {
  const existing = session.contextIngested.find(c => c.type === type && c.value === value);
  if (existing) {
    existing.count++;
  } else {
    session.contextIngested.push({ type, value, count: 1 });
  }
}

// ─── JSONL Parser ───────────────────────────────────────

async function parseSessionJsonl(filePath, sessionId) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    const previousCount = fileLineCounts.get(filePath) || 0;

    if (lines.length <= previousCount) return [];

    const newLines = lines.slice(previousCount);
    fileLineCounts.set(filePath, lines.length);

    const newEntries = [];
    for (const line of newLines) {
      try {
        const entry = JSON.parse(line);
        if (!sessionId && entry.sessionId) sessionId = entry.sessionId;
        if (sessionId) processEntry(sessionId, entry);
        newEntries.push(entry);
      } catch { /* skip malformed */ }
    }
    return newEntries;
  } catch { return []; }
}

// ─── Session Discovery ──────────────────────────────────

async function discoverSessions() {
  console.log('Discovering sessions...');
  const projectsDir = join(CLAUDE_DIR, 'projects');

  try {
    const projectDirs = await readdir(projectsDir);

    for (const projectDir of projectDirs) {
      const projectPath = join(projectsDir, projectDir);
      const projectStat = await stat(projectPath).catch(() => null);
      if (!projectStat?.isDirectory()) continue;

      // Read sessions-index.json if available
      const indexPath = join(projectPath, 'sessions-index.json');
      try {
        const indexContent = await readFile(indexPath, 'utf-8');
        const index = JSON.parse(indexContent);
        if (index.entries && Array.isArray(index.entries)) {
          for (const entry of index.entries) {
            const session = getOrCreateSession(entry.sessionId);
            session.projectDir = projectDir;
            session.projectPath = entry.projectPath || '';
            session.projectName = extractProjectName(projectDir, entry.projectPath);
            session.jsonlPath = entry.fullPath || join(projectPath, `${entry.sessionId}.jsonl`);
            session.gitBranch = entry.gitBranch || '';
            session.firstPrompt = cleanPrompt(entry.firstPrompt) || '';
            session.messageCount = entry.messageCount || 0;
            session.created = entry.created || '';
            session.modified = entry.modified || '';
            session.isSidechain = entry.isSidechain || false;

            // Discover subagents
            await discoverSubagents(session, projectPath);
          }
        }
      } catch { /* no index file */ }

      // ALWAYS scan for .jsonl files to catch sessions not in the index
      try {
        const files = await readdir(projectPath);
        for (const file of files) {
          if (file.endsWith('.jsonl')) {
            const sessionId = basename(file, '.jsonl');
            if (sessions.has(sessionId)) {
              // Already discovered via index — just update modified from file stat
              const session = sessions.get(sessionId);
              const fileStat = await stat(join(projectPath, file)).catch(() => null);
              if (fileStat) {
                const fileMod = fileStat.mtime.toISOString();
                if (!session.modified || fileMod > session.modified) {
                  session.modified = fileMod;
                }
              }
              continue;
            }
            // New session not in index
            const session = getOrCreateSession(sessionId);
            session.projectDir = projectDir;
            session.projectName = extractProjectName(projectDir, '');
            session.jsonlPath = join(projectPath, file);

            const fileStat = await stat(join(projectPath, file)).catch(() => null);
            if (fileStat) {
              session.modified = fileStat.mtime.toISOString();
            }

            await discoverSubagents(session, projectPath);
          }
        }
      } catch { /* skip */ }
    }
  } catch (err) {
    console.error('Error discovering sessions:', err.message);
  }

  // Parse active sessions for full data
  for (const [sessionId, session] of sessions) {
    if (isActive(session) && session.jsonlPath) {
      await parseSessionJsonl(session.jsonlPath, sessionId);
    }
  }

  // Discover tasks
  await discoverTasks();

  console.log(`Discovered ${sessions.size} sessions`);
}

async function discoverSubagents(session, projectPath) {
  const subagentDir = join(projectPath, session.sessionId, 'subagents');
  try {
    const files = await readdir(subagentDir);
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const agentId = basename(file, '.jsonl').replace('agent-', '');
      const filePath = join(subagentDir, file);
      const fileStat = await stat(filePath).catch(() => null);

      session.subagents.set(agentId, {
        agentId,
        jsonlPath: filePath,
        fileSize: fileStat?.size || 0,
        lastActive: fileStat?.mtime.toISOString() || '',
        messageCount: 0,
        isCompact: agentId.startsWith('compact-'),
      });
    }
  } catch { /* no subagents dir */ }
}

async function discoverTasks() {
  const tasksDir = join(CLAUDE_DIR, 'tasks');
  try {
    const sessionDirs = await readdir(tasksDir);
    for (const sessionDir of sessionDirs) {
      const session = sessions.get(sessionDir);
      if (!session) continue;

      const taskPath = join(tasksDir, sessionDir);
      const taskStat = await stat(taskPath).catch(() => null);
      if (!taskStat?.isDirectory()) continue;

      const files = await readdir(taskPath);
      const tasks = [];
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = await readFile(join(taskPath, file), 'utf-8');
          tasks.push(JSON.parse(content));
        } catch { /* skip */ }
      }
      session.tasks = tasks.sort((a, b) => Number(a.id) - Number(b.id));
    }
  } catch { /* no tasks dir */ }
}

// ─── SSE Broadcast ──────────────────────────────────────

function broadcast(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch { sseClients.delete(client); }
  }
}

function sessionSummary(session) {
  return {
    sessionId: session.sessionId,
    projectDir: session.projectDir,
    projectName: session.projectName,
    projectPath: session.projectPath,
    gitBranch: session.gitBranch,
    firstPrompt: session.firstPrompt,
    messageCount: session.messageCount,
    created: session.created,
    modified: session.modified,
    status: session.status,
    contextPercent: session.contextPercent,
    subagentCount: session.subagents.size,
    isActive: isActive(session),
    isSidechain: session.isSidechain,
  };
}

function sessionDetail(session) {
  return {
    ...sessionSummary(session),
    lastAssistantText: session.lastAssistantText,
    activeToolNames: session.activeToolNames,
    lastUsage: session.lastUsage,
    contextIngested: session.contextIngested,
    messages: session.messages.slice(-100),
    subagents: [...session.subagents.values()].map(sa => ({
      agentId: sa.agentId,
      fileSize: sa.fileSize,
      lastActive: sa.lastActive,
      messageCount: sa.messageCount,
      isCompact: sa.isCompact,
    })),
    tasks: session.tasks,
  };
}

// ─── Chokidar Watcher ──────────────────────────────────

function startWatcher() {
  const watcher = chokidar.watch(CLAUDE_DIR, {
    persistent: true,
    ignoreInitial: true,
    usePolling: true,
    interval: 500,
    ignored: [
      '**/cache/**', '**/image-cache/**', '**/paste-cache/**',
      '**/backups/**', '**/shell-snapshots/**', '**/statsig/**',
      '**/telemetry/**', '**/debug/**', '**/chrome/**',
      '**/ide/**', '**/downloads/**', '**/file-history/**',
      '**/plans/**', '**/plugins/**', '**/commands/**',
      '**/skills/**', '**/tool-results/**',
    ],
    depth: 5,
  });

  async function handleChange(filePath) {
    const rel = shortPath(filePath);

    // Main session JSONL
    if (filePath.endsWith('.jsonl') && rel.startsWith('projects/') && !rel.includes('/subagents/')) {
      const sessionId = basename(filePath, '.jsonl');
      const session = sessions.get(sessionId);
      if (session) {
        const newEntries = await parseSessionJsonl(filePath, sessionId);
        if (newEntries.length > 0) {
          broadcast('session:update', sessionSummary(session));
          for (const entry of newEntries) {
            const role = entry.message?.role;
            if (role === 'user' || role === 'assistant') {
              broadcast('session:message', { sessionId, entry: simplifyEntry(entry) });
            }
          }
        }
      }
    }

    // Subagent JSONL
    else if (filePath.endsWith('.jsonl') && rel.includes('/subagents/')) {
      const agentFile = basename(filePath, '.jsonl');
      const agentId = agentFile.replace('agent-', '');
      // Extract sessionId from path: projects/{dir}/{sessionId}/subagents/agent-X.jsonl
      const parts = rel.split('/');
      const sessionId = parts[2]; // projects / dir / sessionId / subagents / file
      const session = sessions.get(sessionId);
      if (session) {
        const newEntries = await parseSessionJsonl(filePath, sessionId);
        const sa = session.subagents.get(agentId);
        if (sa) {
          sa.messageCount += newEntries.length;
          sa.lastActive = new Date().toISOString();
          const fileStat = await stat(filePath).catch(() => null);
          if (fileStat) sa.fileSize = fileStat.size;
        }
        broadcast('subagent:update', { sessionId, agentId, messageCount: sa?.messageCount || 0, lastActive: new Date().toISOString() });
        for (const entry of newEntries) {
          const role = entry.message?.role;
          if (role === 'user' || role === 'assistant') {
            broadcast('subagent:message', { sessionId, agentId, entry: simplifyEntry(entry) });
          }
        }
      }
    }

    // Sessions index
    else if (rel.endsWith('sessions-index.json')) {
      await discoverSessions();
      broadcast('sessions:list', { sessions: [...sessions.values()].map(sessionSummary) });
    }

    // Tasks
    else if (rel.startsWith('tasks/') && filePath.endsWith('.json')) {
      const parts = rel.split('/');
      const sessionId = parts[1];
      const session = sessions.get(sessionId);
      if (session) {
        try {
          const content = await readFile(filePath, 'utf-8');
          const task = JSON.parse(content);
          const idx = session.tasks.findIndex(t => t.id === task.id);
          if (idx >= 0) session.tasks[idx] = task;
          else session.tasks.push(task);
          broadcast('tasks:update', { sessionId, tasks: session.tasks });
        } catch { /* skip */ }
      }
    }

    // Todos
    else if (rel.startsWith('todos/') && filePath.endsWith('.json')) {
      // Todo filenames: {sessionId}-agent-{agentId}.json
      const name = basename(filePath, '.json');
      const match = name.match(/^([0-9a-f-]+)-agent-/);
      if (match) {
        const sessionId = match[1];
        const session = sessions.get(sessionId);
        if (session) {
          try {
            const content = await readFile(filePath, 'utf-8');
            const todos = JSON.parse(content);
            broadcast('todos:update', { sessionId, todos });
          } catch { /* skip */ }
        }
      }
    }
  }

  async function handleAdd(filePath) {
    const rel = shortPath(filePath);

    if (filePath.endsWith('.jsonl') && rel.startsWith('projects/') && !rel.includes('/subagents/')) {
      // New session JSONL
      const sessionId = basename(filePath, '.jsonl');
      const session = getOrCreateSession(sessionId);
      const parts = rel.split('/');
      session.projectDir = parts[1] || '';
      session.projectName = extractProjectName(session.projectDir, '');
      session.jsonlPath = filePath;
      fileLineCounts.set(filePath, 0);
      await parseSessionJsonl(filePath, sessionId);
      broadcast('sessions:list', { sessions: [...sessions.values()].map(sessionSummary) });
    }

    else if (filePath.endsWith('.jsonl') && rel.includes('/subagents/')) {
      const agentFile = basename(filePath, '.jsonl');
      const agentId = agentFile.replace('agent-', '');
      const parts = rel.split('/');
      const sessionId = parts[2];
      const session = sessions.get(sessionId);
      if (session) {
        const fileStat = await stat(filePath).catch(() => null);
        session.subagents.set(agentId, {
          agentId,
          jsonlPath: filePath,
          fileSize: fileStat?.size || 0,
          lastActive: new Date().toISOString(),
          messageCount: 0,
          isCompact: agentId.startsWith('compact-'),
        });
        broadcast('subagent:update', { sessionId, agentId, isNew: true });
      }
    }

    else if (rel.startsWith('tasks/') && filePath.endsWith('.json')) {
      await handleChange(filePath);
    }
  }

  watcher.on('change', handleChange);
  watcher.on('add', handleAdd);
  watcher.on('error', (err) => console.error('Watcher error:', err.message));
  watcher.on('ready', () => console.log('File watcher ready'));

  return watcher;
}

function simplifyEntry(entry) {
  const role = entry.message?.role;
  if (role === 'user') {
    return { role: 'user', text: truncate(extractText(entry.message), 500), timestamp: entry.timestamp };
  }
  if (role === 'assistant') {
    const blocks = entry.message?.content || [];
    const texts = blocks.filter(b => b.type === 'text').map(b => truncate(b.text, 300));
    const tools = blocks.filter(b => b.type === 'tool_use').map(b => ({
      name: b.name,
      detail: truncate(String(b.input?.command || b.input?.file_path || b.input?.pattern || b.input?.query || b.input?.description || ''), 100),
    }));
    return { role: 'assistant', texts, tools, timestamp: entry.timestamp };
  }
  return { type: entry.type, timestamp: entry.timestamp };
}

// ─── Express App ────────────────────────────────────────

const app = express();

// Static files
app.use(express.static(join(__dirname, 'public')));

// SSE endpoint
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write('event: connected\ndata: {}\n\n');
  sseClients.add(res);

  const heartbeat = setInterval(() => {
    res.write('event: heartbeat\ndata: {}\n\n');
  }, 30000);

  req.on('close', () => {
    sseClients.delete(res);
    clearInterval(heartbeat);
  });
});

// REST: All sessions
app.get('/api/sessions', (req, res) => {
  const list = [...sessions.values()]
    .map(sessionSummary)
    .sort((a, b) => new Date(b.modified) - new Date(a.modified));
  res.json({ sessions: list });
});

// REST: Session detail
app.get('/api/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(sessionDetail(session));
});

// REST: Subagent messages
app.get('/api/sessions/:id/subagents/:agentId/messages', async (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const sa = session.subagents.get(req.params.agentId);
  if (!sa) return res.status(404).json({ error: 'Subagent not found' });

  try {
    const content = await readFile(sa.jsonlPath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    const messages = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const role = entry.message?.role;
        if (role === 'user' || role === 'assistant') {
          messages.push(simplifyEntry(entry));
        }
      } catch { /* skip */ }
    }

    const limit = parseInt(req.query.limit) || 100;
    res.json({ messages: messages.slice(-limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REST: Session tasks
app.get('/api/sessions/:id/tasks', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ tasks: session.tasks });
});

// ─── Start ──────────────────────────────────────────────

async function main() {
  console.log('\n  MnM POC - Web Dashboard');
  console.log('  ───────────────────────\n');

  await discoverSessions();
  const watcher = startWatcher();

  app.listen(PORT, () => {
    console.log(`\n  Dashboard: http://localhost:${PORT}`);
    console.log(`  Sessions:  ${sessions.size} discovered`);
    console.log(`  Active:    ${[...sessions.values()].filter(isActive).length}`);
    console.log(`  Watching:  ${CLAUDE_DIR}\n`);
  });

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    watcher.close();
    process.exit(0);
  });
}

main().catch(console.error);
