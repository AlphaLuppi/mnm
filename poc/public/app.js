/**
 * MnM POC - Dashboard Client
 * SSE consumer + DOM rendering for all 7 monitoring features.
 */

// ─── State ──────────────────────────────────────────────

const state = {
  sessions: new Map(),
  selectedSessionId: null,
  selectedDetail: null,
  filter: 'active',
  connected: false,
};

// ─── Helpers ────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncate(str, maxLen) {
  if (!str) return '';
  const oneLine = str.replace(/\n/g, ' ').trim();
  return oneLine.length > maxLen ? oneLine.slice(0, maxLen) + '...' : oneLine;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function shortPath(fullPath) {
  if (!fullPath) return '';
  // Remove common prefixes to shorten the display
  return fullPath
    .replace(/\\/g, '/')
    .replace(/^C:\/Users\/[^/]+\/IdeaProjects\//, '')
    .replace(/^C:\/Users\/[^/]+\//, '~/');
}

function toolTagClass(name) {
  const n = (name || '').toLowerCase();
  if (n === 'read' || n === 'glob' || n === 'grep') return 'read';
  if (n === 'write' || n === 'edit') return 'write';
  if (n === 'bash') return 'bash';
  if (n === 'agent') return 'agent';
  return '';
}

// ─── SSE Connection ─────────────────────────────────────

let eventSource = null;

function connectSSE() {
  eventSource = new EventSource('/api/events');

  eventSource.addEventListener('connected', () => {
    state.connected = true;
    updateConnectionUI();
    fetchSessions();
  });

  eventSource.addEventListener('sessions:list', (e) => {
    const { sessions } = JSON.parse(e.data);
    sessions.forEach(s => state.sessions.set(s.sessionId, s));
    renderSessionList();
  });

  eventSource.addEventListener('session:update', (e) => {
    const data = JSON.parse(e.data);
    const existing = state.sessions.get(data.sessionId) || {};
    state.sessions.set(data.sessionId, { ...existing, ...data });
    renderSessionList();
    if (data.sessionId === state.selectedSessionId) {
      // Refresh detail for real-time updates
      fetchSessionDetail(data.sessionId);
    }
  });

  eventSource.addEventListener('session:message', (e) => {
    const { sessionId, entry } = JSON.parse(e.data);
    if (sessionId === state.selectedSessionId && state.selectedDetail) {
      appendMessageToActivity(entry);
    }
  });

  eventSource.addEventListener('subagent:update', (e) => {
    const data = JSON.parse(e.data);
    if (data.sessionId === state.selectedSessionId) {
      fetchSessionDetail(data.sessionId);
    }
  });

  eventSource.addEventListener('tasks:update', (e) => {
    const { sessionId, tasks } = JSON.parse(e.data);
    if (sessionId === state.selectedSessionId) {
      renderTasks(tasks);
    }
  });

  eventSource.addEventListener('heartbeat', () => {
    updateLastUpdate();
  });

  eventSource.onerror = () => {
    state.connected = false;
    updateConnectionUI();
  };
}

function updateConnectionUI() {
  const indicator = document.getElementById('connection-indicator');
  const text = document.getElementById('connection-text');
  if (state.connected) {
    indicator.className = 'indicator connected';
    text.textContent = 'Connected';
  } else {
    indicator.className = 'indicator disconnected';
    text.textContent = 'Reconnecting...';
  }
}

function updateLastUpdate() {
  const el = document.getElementById('last-update');
  el.textContent = new Date().toLocaleTimeString('fr-FR', { hour12: false });
}

// ─── REST Fetchers ──────────────────────────────────────

async function fetchSessions() {
  try {
    const res = await fetch('/api/sessions');
    const { sessions } = await res.json();
    sessions.forEach(s => state.sessions.set(s.sessionId, s));
    renderSessionList();
  } catch (err) {
    console.error('Failed to fetch sessions:', err);
  }
}

async function fetchSessionDetail(sessionId) {
  try {
    const res = await fetch(`/api/sessions/${sessionId}`);
    const detail = await res.json();
    state.selectedDetail = detail;
    renderDetail(detail);
  } catch (err) {
    console.error('Failed to fetch session detail:', err);
  }
}

async function fetchSubagentChat(sessionId, agentId) {
  try {
    const res = await fetch(`/api/sessions/${sessionId}/subagents/${agentId}/messages?limit=100`);
    const { messages } = await res.json();
    renderChat(agentId, messages);
  } catch (err) {
    console.error('Failed to fetch subagent chat:', err);
  }
}

// ─── Rendering: Session List ────────────────────────────

function renderSessionList() {
  const container = document.getElementById('session-list');
  const allSessions = [...state.sessions.values()];

  const filtered = state.filter === 'active'
    ? allSessions.filter(s => s.isActive)
    : allSessions;

  filtered.sort((a, b) => new Date(b.modified || 0) - new Date(a.modified || 0));

  document.getElementById('session-count').textContent = filtered.length;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding: 40px 0;"><p class="text-muted">No ${state.filter === 'active' ? 'active ' : ''}sessions found</p></div>`;
    return;
  }

  container.innerHTML = filtered.map(s => `
    <div class="session-card ${s.sessionId === state.selectedSessionId ? 'selected' : ''} ${s.isActive ? 'active-session' : ''}"
         onclick="selectSession('${s.sessionId}')">
      <div class="card-header">
        <span class="project-name">${escapeHtml(s.projectName || s.projectDir || 'Unknown')}</span>
        <span class="status-dot ${s.status || 'idle'}"></span>
      </div>
      <div class="card-branch">${escapeHtml(s.gitBranch || 'no branch')}</div>
      <div class="card-prompt">${escapeHtml(truncate(s.firstPrompt, 100))}</div>
      <div class="card-footer">
        <span>${s.messageCount || 0} msgs</span>
        ${s.subagentCount ? `<span>${s.subagentCount} agents</span>` : ''}
        ${s.backgroundTaskCount ? `<span style="color:var(--accent-green)">${s.backgroundTaskCount} bg</span>` : ''}
        <span>${timeAgo(s.modified)}</span>
      </div>
    </div>
  `).join('');
}

// ─── Rendering: Detail View ─────────────────────────────

function renderDetail(detail) {
  document.getElementById('detail-empty').classList.add('hidden');
  document.getElementById('detail-content').classList.remove('hidden');

  // Header
  document.getElementById('detail-project').textContent = detail.projectName || detail.projectDir || 'Unknown';

  const statusBadge = document.getElementById('detail-status');
  statusBadge.className = `status-badge ${detail.status || 'idle'}`;
  statusBadge.innerHTML = `<span class="status-dot ${detail.status || 'idle'}"></span> ${detail.status || 'idle'}`;

  document.getElementById('detail-branch').textContent = detail.gitBranch || 'no branch';
  document.getElementById('detail-messages').textContent = `${detail.messageCount || 0} messages`;
  document.getElementById('detail-time').textContent = timeAgo(detail.modified);
  document.getElementById('detail-prompt').textContent = detail.firstPrompt || 'No initial prompt';

  // Context bar
  const pct = detail.contextPercent || 0;
  const fill = document.getElementById('detail-context-fill');
  fill.style.width = pct + '%';
  fill.className = 'progress-fill' + (pct > 80 ? ' danger' : pct > 50 ? ' warning' : '');
  document.getElementById('detail-context-pct').textContent = pct + '%';

  // Activity
  renderActivity(detail);

  // Background tasks
  renderBackgroundTasks(detail.backgroundTasks || []);

  // Tasks
  renderTasks(detail.tasks || []);

  // Sub-agents
  renderSubagents(detail);

  // Context Ingested
  renderContextIngested(detail.contextIngested || []);
}

function renderActivity(detail) {
  const textEl = document.getElementById('activity-text');
  textEl.textContent = detail.lastAssistantText || 'No recent activity';

  const toolsEl = document.getElementById('activity-tools');
  const tools = detail.activeToolNames || [];
  if (tools.length > 0) {
    toolsEl.innerHTML = tools.map(t =>
      `<span class="tool-tag ${toolTagClass(t)}">${escapeHtml(t)}</span>`
    ).join('');
  } else {
    toolsEl.innerHTML = '';
  }
}

function renderBackgroundTasks(tasks) {
  const container = document.getElementById('bg-task-list');
  const countEl = document.getElementById('bg-count');
  // Only show running tasks
  const running = tasks.filter(t => t.status === 'running');
  countEl.textContent = running.length;

  if (running.length === 0) {
    container.innerHTML = '<div class="bg-task-empty">No background processes</div>';
    return;
  }

  container.innerHTML = running.map(t => {
    const elapsed = t.elapsed ? formatElapsed(t.elapsed) : '';
    return `
      <div class="bg-task-item ${t.status}">
        <div class="bg-task-header">
          <span class="bg-task-desc">${escapeHtml(t.description || t.command || t.taskId)}</span>
          <span class="bg-task-status ${t.status}">${t.status}</span>
        </div>
        ${t.command ? `<div class="bg-task-cmd">${escapeHtml(t.command)}</div>` : ''}
        <div class="bg-task-meta">
          ${elapsed ? `<span>&#9201; ${elapsed}</span>` : ''}
          ${t.totalLines ? `<span>${t.totalLines} lines</span>` : ''}
          ${t.taskId ? `<span>ID: ${escapeHtml(t.taskId)}</span>` : ''}
        </div>
        ${t.output ? `<div class="bg-task-output">${escapeHtml(t.output)}</div>` : ''}
      </div>
    `;
  }).join('');
}

function formatElapsed(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function renderTasks(tasks) {
  const container = document.getElementById('task-list');
  if (!tasks || tasks.length === 0) {
    container.innerHTML = '<div class="task-empty">No tasks</div>';
    return;
  }

  container.innerHTML = tasks.map(t => {
    const icon = t.status === 'completed' ? '&#9989;' :
                 t.status === 'in_progress' ? '&#128260;' : '&#11036;';
    const activeForm = t.status === 'in_progress' && t.activeForm
      ? `<div class="task-active-form">${escapeHtml(t.activeForm)}</div>` : '';
    return `
      <div class="task-item ${t.status || ''}">
        <span class="task-icon">${icon}</span>
        <div>
          <div class="task-subject">${escapeHtml(t.subject || t.content || '')}</div>
          ${activeForm}
        </div>
      </div>
    `;
  }).join('');
}

function renderSubagents(detail) {
  const container = document.getElementById('subagent-list');
  const count = document.getElementById('subagent-count');
  const subagents = detail.subagents || [];

  count.textContent = subagents.length;

  if (subagents.length === 0) {
    container.innerHTML = '<div class="subagent-empty">No sub-agents</div>';
    return;
  }

  container.innerHTML = subagents.map(sa => `
    <div class="subagent-item" onclick="openSubagentChat('${detail.sessionId}', '${sa.agentId}')">
      <div class="subagent-info">
        <span class="subagent-id">${escapeHtml(sa.agentId.slice(0, 8))}</span>
        <span class="subagent-size">${formatBytes(sa.fileSize)}</span>
        ${sa.isCompact ? '<span class="subagent-compact">compact</span>' : ''}
      </div>
      <span class="subagent-meta">${timeAgo(sa.lastActive)}</span>
    </div>
  `).join('');
}

function renderContextIngested(items) {
  const filesEl = document.getElementById('context-files');
  const urlsEl = document.getElementById('context-urls');
  const searchEl = document.getElementById('context-searches');

  const files = items.filter(i => i.type === 'file').sort((a, b) => b.count - a.count);
  const urls = items.filter(i => i.type === 'url').sort((a, b) => b.count - a.count);
  const searches = items.filter(i => i.type === 'search' || i.type === 'agent').sort((a, b) => b.count - a.count);

  if (files.length > 0) {
    filesEl.innerHTML = `
      <div class="context-group-title">Files (${files.length})</div>
      ${files.slice(0, 30).map(f => `
        <div class="context-item">
          <span class="context-path" title="${escapeHtml(f.value)}">${escapeHtml(shortPath(f.value))}</span>
          <span class="context-count">&times;${f.count}</span>
        </div>
      `).join('')}
      ${files.length > 30 ? `<div class="text-muted text-sm">+${files.length - 30} more...</div>` : ''}
    `;
  } else {
    filesEl.innerHTML = '';
  }

  if (urls.length > 0) {
    urlsEl.innerHTML = `
      <div class="context-group-title">URLs (${urls.length})</div>
      ${urls.slice(0, 15).map(u => `
        <div class="context-item">
          <span class="context-path" title="${escapeHtml(u.value)}">${escapeHtml(truncate(u.value, 60))}</span>
          <span class="context-count">&times;${u.count}</span>
        </div>
      `).join('')}
    `;
  } else {
    urlsEl.innerHTML = '';
  }

  if (searches.length > 0) {
    searchEl.innerHTML = `
      <div class="context-group-title">Searches & Agents (${searches.length})</div>
      ${searches.slice(0, 15).map(s => `
        <div class="context-item">
          <span class="context-path" title="${escapeHtml(s.value)}">${escapeHtml(truncate(s.value, 60))}</span>
          <span class="context-count">&times;${s.count}</span>
        </div>
      `).join('')}
    `;
  } else {
    searchEl.innerHTML = '';
  }
}

// ─── Rendering: Chat ────────────────────────────────────

function renderChat(agentId, messages) {
  const section = document.getElementById('section-chat');
  section.classList.remove('hidden');
  document.getElementById('chat-agent-id').textContent = agentId.slice(0, 8);

  const container = document.getElementById('chat-messages');
  container.innerHTML = messages.map(msg => {
    if (msg.role === 'user') {
      return `
        <div class="chat-msg user">
          <div>${escapeHtml(msg.text || '')}</div>
          ${msg.timestamp ? `<div class="chat-time">${new Date(msg.timestamp).toLocaleTimeString('fr-FR')}</div>` : ''}
        </div>
      `;
    }
    if (msg.role === 'assistant') {
      const texts = (msg.texts || []).filter(t => t).map(t => escapeHtml(truncate(t, 300))).join('<br>');
      const tools = (msg.tools || []).map(t =>
        `<span class="chat-tool-pill">${escapeHtml(t.name)} ${escapeHtml(truncate(t.detail, 40))}</span>`
      ).join('');
      return `
        <div class="chat-msg assistant">
          ${texts ? `<div>${texts}</div>` : ''}
          ${tools ? `<div class="chat-tools">${tools}</div>` : ''}
          ${msg.timestamp ? `<div class="chat-time">${new Date(msg.timestamp).toLocaleTimeString('fr-FR')}</div>` : ''}
        </div>
      `;
    }
    return '';
  }).join('');

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function appendMessageToActivity(entry) {
  // On new messages, just refresh the detail
  if (state.selectedSessionId) {
    fetchSessionDetail(state.selectedSessionId);
  }
}

// ─── Actions ────────────────────────────────────────────

function selectSession(sessionId) {
  state.selectedSessionId = sessionId;
  closeChat();
  fetchSessionDetail(sessionId);
  renderSessionList(); // Update selected state
}

function setFilter(filter) {
  state.filter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderSessionList();
}

function openSubagentChat(sessionId, agentId) {
  fetchSubagentChat(sessionId, agentId);
}

function closeChat() {
  document.getElementById('section-chat').classList.add('hidden');
}

// ─── Auto-refresh ───────────────────────────────────────

// Refresh session list every 10 seconds to update timeAgo and active status
setInterval(() => {
  renderSessionList();
}, 10000);

// ─── Init ───────────────────────────────────────────────

connectSSE();
