/**
 * MnM POC - Claude Code Session Watcher
 *
 * Watches ~/.claude/ for real-time changes and displays them.
 * Run this while a Claude Code session is active to validate
 * the "file watching" approach for MnM.
 *
 * Usage: node watch-session.js
 */

import chokidar from 'chokidar';
import { readFile, stat, readdir } from 'fs/promises';
import { basename, join, relative, sep } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

// ─── Config ────────────────────────────────────────────────
const CLAUDE_DIR = join(homedir(), '.claude');

// Track file sizes for incremental JSONL reading
const fileSizes = new Map();

// Stats
const stats = {
  sessionEntries: 0,
  todoChanges: 0,
  taskChanges: 0,
  fileChanges: 0,
  watcherErrors: 0,
  startTime: Date.now()
};

// ─── Helpers ───────────────────────────────────────────────
function ts() {
  return chalk.gray(new Date().toLocaleTimeString('fr-FR', { hour12: false }));
}

function shortPath(fullPath) {
  return relative(CLAUDE_DIR, fullPath).replaceAll(sep, '/');
}

function truncate(str, maxLen) {
  if (!str) return '';
  const oneLine = str.replace(/\n/g, ' ').trim();
  return oneLine.length > maxLen ? oneLine.slice(0, maxLen) + '...' : oneLine;
}

function printBanner() {
  console.log(chalk.cyan.bold('\n╔══════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║     MnM POC - Claude Code Session Watcher    ║'));
  console.log(chalk.cyan.bold('╚══════════════════════════════════════════════╝\n'));
  console.log(chalk.gray(`Watching: ${CLAUDE_DIR}`));
  console.log(chalk.gray(`Platform: ${process.platform}`));
  console.log(chalk.gray(`Time: ${new Date().toLocaleString('fr-FR')}`));
  console.log(chalk.gray('Press Ctrl+C to stop\n'));
  console.log(chalk.yellow('─'.repeat(60)));
}

// ─── Parsers ───────────────────────────────────────────────

async function parseSessionJsonl(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    const allLines = lines.length;
    const previousLines = fileSizes.get(filePath) || 0;

    if (allLines <= previousLines) return;

    const newLines = lines.slice(previousLines);
    fileSizes.set(filePath, allLines);

    for (const line of newLines) {
      try {
        const entry = JSON.parse(line);
        displaySessionEntry(entry);
        stats.sessionEntries++;
      } catch { /* skip malformed */ }
    }
  } catch { /* file being written */ }
}

function displaySessionEntry(entry) {
  const t = ts();

  if (entry.type === 'system') {
    console.log(`${t} ${chalk.blue('⚙ SYS')} ${chalk.gray(entry.subtype || '')} ${chalk.white(truncate(entry.content || '', 80))}`);
    return;
  }
  if (entry.type === 'summary') {
    console.log(`${t} ${chalk.red('📋 COMPACTED')} ${chalk.gray('Context window compacted')}`);
    return;
  }

  const role = entry.message?.role;
  const model = entry.message?.model || '';

  if (role === 'user') {
    const content = extractText(entry.message);
    console.log(`${t} ${chalk.green('👤 USER')} ${chalk.white(truncate(content, 100))}`);
  }
  else if (role === 'assistant') {
    const blocks = entry.message?.content;
    if (Array.isArray(blocks)) {
      for (const block of blocks) {
        if (block.type === 'text' && block.text?.trim()) {
          console.log(`${t} ${chalk.magenta('🤖 ASST')} ${chalk.white(truncate(block.text, 100))}`);
        }
        else if (block.type === 'tool_use') {
          const inp = block.input || {};
          const detail = inp.command || inp.file_path || inp.pattern || inp.query || inp.prompt || inp.skill || '';
          console.log(`${t} ${chalk.yellow('🔧 TOOL')} ${chalk.cyan(block.name)} ${chalk.gray(truncate(String(detail), 60))}`);
        }
      }
    }
  }
}

function extractText(message) {
  if (!message?.content) return '';
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content.filter(b => b.type === 'text').map(b => b.text).join(' ');
  }
  return '';
}

async function parseTodoFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const todos = JSON.parse(content);
    if (!Array.isArray(todos) || todos.length === 0) return;

    console.log(`${ts()} ${chalk.blue('📝 TODO')} ${chalk.gray(basename(filePath, '.json').slice(0, 25) + '...')}`);
    for (const todo of todos) {
      const icon = todo.status === 'completed' ? chalk.green('✅') :
                   todo.status === 'in_progress' ? chalk.yellow('🔄') : chalk.gray('⬜');
      console.log(`    ${icon} ${chalk.white(truncate(todo.content || '', 60))}`);
    }
    stats.todoChanges++;
  } catch { /* skip */ }
}

async function parseTaskFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    const tasks = Array.isArray(data) ? data : [data];

    console.log(`${ts()} ${chalk.red('📌 TASK')} ${chalk.gray(basename(filePath, '.json').slice(0, 25) + '...')}`);
    for (const task of tasks) {
      if (task.subject || task.content) {
        const icon = task.status === 'completed' ? chalk.green('✅') :
                     task.status === 'in_progress' ? chalk.yellow('🔄') : chalk.gray('⬜');
        console.log(`    ${icon} ${chalk.white(truncate(task.subject || task.content || '', 60))}`);
      }
    }
    stats.taskChanges++;
  } catch { /* skip */ }
}

// ─── Main Watcher ──────────────────────────────────────────

async function main() {
  printBanner();

  // Use explicit paths instead of globs for better Windows compatibility
  const watchTargets = [
    { path: join(CLAUDE_DIR, 'projects'), label: 'Sessions (JSONL)' },
    { path: join(CLAUDE_DIR, 'todos'), label: 'Todos' },
    { path: join(CLAUDE_DIR, 'tasks'), label: 'Tasks' },
  ];

  console.log('');
  for (const t of watchTargets) {
    try {
      await stat(t.path);
      console.log(chalk.green(`  ✅ ${t.label}: ${shortPath(t.path)}`));
    } catch {
      console.log(chalk.red(`  ❌ ${t.label}: ${shortPath(t.path)} (not found)`));
    }
  }

  console.log('');
  console.log(chalk.yellow('─'.repeat(60)));
  console.log(chalk.green.bold('  Watching for activity... (use Claude Code to see events)\n'));

  // Single recursive watcher on the whole .claude directory
  // with usePolling for Windows compatibility
  const watcher = chokidar.watch(CLAUDE_DIR, {
    persistent: true,
    ignoreInitial: true,
    usePolling: true,          // More reliable on Windows
    interval: 500,             // Poll every 500ms
    ignored: [
      '**/cache/**',
      '**/image-cache/**',
      '**/paste-cache/**',
      '**/backups/**',
      '**/shell-snapshots/**',
      '**/statsig/**',
      '**/telemetry/**',
      '**/debug/**',
      '**/chrome/**',
      '**/ide/**',
      '**/downloads/**',
      '**/file-history/**',
    ],
    depth: 5,
  });

  watcher.on('change', async (filePath) => {
    const rel = shortPath(filePath);
    stats.fileChanges++;

    // Session JSONL
    if (filePath.endsWith('.jsonl')) {
      await parseSessionJsonl(filePath);
    }
    // Todo files
    else if (rel.startsWith('todos/') && filePath.endsWith('.json')) {
      await parseTodoFile(filePath);
    }
    // Task files
    else if (rel.startsWith('tasks/') && filePath.endsWith('.json')) {
      await parseTaskFile(filePath);
    }
    // History
    else if (rel === 'history.jsonl') {
      console.log(`${ts()} ${chalk.blue('📜 HIST')} ${chalk.gray('history.jsonl updated')}`);
    }
    // Other interesting files
    else if (filePath.endsWith('.json') || filePath.endsWith('.jsonl')) {
      console.log(`${ts()} ${chalk.gray('📄 FILE')} ${chalk.gray(rel)}`);
    }
  });

  watcher.on('add', async (filePath) => {
    const rel = shortPath(filePath);

    if (filePath.endsWith('.jsonl') && rel.includes('projects/')) {
      console.log(`${ts()} ${chalk.green.bold('🆕 NEW')} ${chalk.white(rel)}`);
      fileSizes.set(filePath, 0);
      await parseSessionJsonl(filePath);
    }
    else if (rel.startsWith('todos/') && filePath.endsWith('.json')) {
      await parseTodoFile(filePath);
    }
    else if (rel.startsWith('tasks/') && filePath.endsWith('.json')) {
      await parseTaskFile(filePath);
    }
  });

  watcher.on('error', (err) => {
    stats.watcherErrors++;
    console.log(`${ts()} ${chalk.red('❗ ERR')} ${chalk.gray(err.message)}`);
  });

  watcher.on('ready', () => {
    console.log(`${ts()} ${chalk.green('👁  READY')} ${chalk.gray('Watcher initialized, tracking changes...')}\n`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(0);
    console.log('\n');
    console.log(chalk.yellow('─'.repeat(60)));
    console.log(chalk.cyan.bold('  MnM POC - Watch Summary'));
    console.log(chalk.yellow('─'.repeat(60)));
    console.log(`  Duration:         ${elapsed}s`);
    console.log(`  Session entries:  ${stats.sessionEntries}`);
    console.log(`  Todo updates:     ${stats.todoChanges}`);
    console.log(`  Task updates:     ${stats.taskChanges}`);
    console.log(`  Total file events: ${stats.fileChanges}`);
    console.log(`  Watcher errors:   ${stats.watcherErrors}`);
    console.log(chalk.yellow('─'.repeat(60)));
    console.log(chalk.green('\n  ✅ POC RESULT: File watching ' + (stats.fileChanges > 0 ? 'WORKS!' : 'needs more testing')));
    console.log('');

    watcher.close();
    process.exit(0);
  });
}

main().catch(console.error);
