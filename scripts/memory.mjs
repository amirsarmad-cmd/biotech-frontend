import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const MEMORY_DIR = path.join(ROOT, 'memory');

const TYPE_DIRS = {
  session: 'sessions',
  decision: 'decisions',
  design: 'designs',
  handoff: 'handoffs',
  note: 'notes',
};

const START_HERE = [
  'CURRENT_STATE.md',
  'INDEX.md',
  'DECISIONS.md',
  'handoffs/NEXT_AGENT.md',
];

function ensureDirs() {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  for (const dir of Object.values(TYPE_DIRS)) {
    fs.mkdirSync(path.join(MEMORY_DIR, dir), { recursive: true });
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  const [command = 'status', ...rest] = argv;
  const options = { _: [] };

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith('--')) {
      options._.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    i += 1;
  }

  return { command, options };
}

function slugify(value = 'untitled') {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';
}

function nowIso() {
  return new Date().toISOString();
}

function fileStamp(iso) {
  return iso.replace(/[:.]/g, '-');
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeList);
  return value
    .toString()
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatList(items) {
  if (!items.length) return '- None recorded.';
  return items.map((item) => `- ${item}`).join('\n');
}

function escapeYaml(value) {
  return value.toString().replace(/"/g, '\\"');
}

function relativeFromRoot(absPath) {
  return path.relative(ROOT, absPath).replace(/\\/g, '/');
}

function relativeFromMemory(absPath) {
  return path.relative(MEMORY_DIR, absPath).replace(/\\/g, '/');
}

function assertInsideMemory(absPath) {
  const resolved = path.resolve(absPath);
  const root = path.resolve(MEMORY_DIR);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Refusing to access path outside memory/: ${absPath}`);
  }
  return resolved;
}

function safeMemoryPath(relativePath = 'CURRENT_STATE.md') {
  const target = path.resolve(MEMORY_DIR, relativePath);
  return assertInsideMemory(target);
}

function readTitle(content, fallback) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

function readFrontmatter(content, key) {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

function listMarkdownFiles(dirName) {
  const dir = path.join(MEMORY_DIR, dirName);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => {
      const absPath = path.join(dir, entry.name);
      const content = fs.readFileSync(absPath, 'utf8');
      const stats = fs.statSync(absPath);
      return {
        title: readTitle(content, entry.name.replace(/\.md$/, '')),
        date: readFrontmatter(content, 'Date') || readFrontmatter(content, 'date') || stats.mtime.toISOString(),
        path: relativeFromMemory(absPath),
        mtimeMs: stats.mtimeMs,
      };
    })
    .sort((a, b) => b.path.localeCompare(a.path));
}

function formatEntries(entries) {
  if (!entries.length) return '- None yet.';
  return entries
    .slice(0, 20)
    .map((entry) => `- ${entry.date}: [${entry.title}](${entry.path})`)
    .join('\n');
}

export function rebuildIndex() {
  ensureDirs();
  const iso = nowIso();
  const sections = [
    '# Memory Index',
    '',
    `Generated: ${iso}`,
    '',
    '## Start Here',
    '',
    START_HERE.map((file) => `- [${file}](${file})`).join('\n'),
    '',
    '## Recent Sessions',
    '',
    formatEntries(listMarkdownFiles('sessions')),
    '',
    '## Decisions',
    '',
    formatEntries(listMarkdownFiles('decisions')),
    '',
    '## Designs',
    '',
    formatEntries(listMarkdownFiles('designs')),
    '',
    '## Handoffs',
    '',
    formatEntries(listMarkdownFiles('handoffs').filter((entry) => entry.path !== 'handoffs/NEXT_AGENT.md')),
    '',
    '## Notes',
    '',
    formatEntries(listMarkdownFiles('notes')),
    '',
  ];

  fs.writeFileSync(path.join(MEMORY_DIR, 'INDEX.md'), sections.join('\n'), 'utf8');
  return relativeFromRoot(path.join(MEMORY_DIR, 'INDEX.md'));
}

export function createRecord({
  type = 'session',
  agent = 'unknown',
  title = 'Untitled memory record',
  summary = '',
  body = '',
  tags = [],
  next = [],
} = {}) {
  ensureDirs();
  const dirName = TYPE_DIRS[type];
  if (!dirName) {
    throw new Error(`Unknown memory type "${type}". Use ${Object.keys(TYPE_DIRS).join(', ')}.`);
  }

  const iso = nowIso();
  const safeTitle = title.toString().trim() || 'Untitled memory record';
  const fileName = `${fileStamp(iso)}-${slugify(safeTitle)}.md`;
  const absPath = path.join(MEMORY_DIR, dirName, fileName);
  const tagList = normalizeList(tags);
  const nextList = normalizeList(next);
  const summaryText = summary || 'No summary provided.';
  const bodyText = body || 'No additional details recorded.';

  const content = [
    '---',
    `type: "${escapeYaml(type)}"`,
    `title: "${escapeYaml(safeTitle)}"`,
    `date: "${iso}"`,
    `agent: "${escapeYaml(agent)}"`,
    `tags: "${escapeYaml(tagList.join(', '))}"`,
    '---',
    '',
    `# ${safeTitle}`,
    '',
    `Date: ${iso}`,
    `Agent: ${agent}`,
    `Type: ${type}`,
    '',
    '## Summary',
    '',
    summaryText,
    '',
    '## Details',
    '',
    bodyText,
    '',
    '## Next',
    '',
    formatList(nextList),
    '',
  ].join('\n');

  fs.writeFileSync(absPath, content, 'utf8');

  if (type === 'decision') {
    appendDecisionIndex({ title: safeTitle, summary: summaryText, absPath, iso });
  }

  rebuildIndex();
  return {
    path: relativeFromRoot(absPath),
    memoryPath: relativeFromMemory(absPath),
    date: iso,
    title: safeTitle,
    type,
  };
}

function appendDecisionIndex({ title, summary, absPath, iso }) {
  const decisionsPath = path.join(MEMORY_DIR, 'DECISIONS.md');
  if (!fs.existsSync(decisionsPath)) {
    fs.writeFileSync(decisionsPath, '# Decisions\n\n## Accepted\n\n', 'utf8');
  }

  const date = iso.slice(0, 10);
  const memoryPath = relativeFromMemory(absPath);
  const line = `- ${date}: [${title}](${memoryPath}) - ${summary}\n`;
  const current = fs.readFileSync(decisionsPath, 'utf8');
  if (!current.includes(`[${title}](${memoryPath})`)) {
    fs.appendFileSync(decisionsPath, line, 'utf8');
  }
}

export function writeHandoff({
  agent = 'unknown',
  title = 'Next Agent Handoff',
  summary = '',
  body = '',
  next = [],
} = {}) {
  ensureDirs();
  const iso = nowIso();
  const nextList = normalizeList(next);
  const absPath = path.join(MEMORY_DIR, 'handoffs', 'NEXT_AGENT.md');
  const content = [
    `# ${title}`,
    '',
    `Last updated: ${iso}`,
    `Updated by: ${agent}`,
    '',
    '## Read First',
    '',
    START_HERE.map((file) => `- memory/${file}`).join('\n'),
    '- AGENTS.md',
    '- CLAUDE.md',
    '',
    '## Current State',
    '',
    summary || 'No current-state summary provided.',
    '',
    '## Details',
    '',
    body || 'No additional details recorded.',
    '',
    '## Next Actions',
    '',
    formatList(nextList),
    '',
    '## Guardrails',
    '',
    '- Do not commit local agent settings or secrets.',
    '- Keep memory updates in Git with related code changes.',
    '- Run npm run memory:index after manual memory edits.',
    '',
  ].join('\n');

  fs.writeFileSync(absPath, content, 'utf8');
  rebuildIndex();
  return {
    path: relativeFromRoot(absPath),
    memoryPath: relativeFromMemory(absPath),
    date: iso,
  };
}

export function readMemoryFile(relativePath = 'CURRENT_STATE.md') {
  ensureDirs();
  const absPath = safeMemoryPath(relativePath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Memory file not found: ${relativePath}`);
  }
  return fs.readFileSync(absPath, 'utf8');
}

function walkMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkMarkdown(absPath);
    if (entry.isFile() && entry.name.endsWith('.md')) return [absPath];
    return [];
  });
}

export function searchMemory(query, limit = 10) {
  ensureDirs();
  const needle = query.toString().trim().toLowerCase();
  if (!needle) return [];

  const results = [];
  for (const absPath of walkMarkdown(MEMORY_DIR)) {
    const content = fs.readFileSync(absPath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.toLowerCase().includes(needle)) continue;
      results.push({
        path: relativeFromMemory(absPath),
        line: index + 1,
        text: line.trim(),
      });
      if (results.length >= limit) return results;
    }
  }

  return results;
}

export function getMemoryStatus() {
  ensureDirs();
  let gitStatus = 'Git status unavailable.';
  try {
    gitStatus = execFileSync('git', ['status', '--short', '--branch'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
  } catch (error) {
    gitStatus = `Git status unavailable: ${error.message}`;
  }

  return [
    'Project memory status',
    '',
    'Start here:',
    ...START_HERE.map((file) => `- memory/${file}`),
    '- AGENTS.md',
    '- CLAUDE.md',
    '',
    'Counts:',
    `- Sessions: ${listMarkdownFiles('sessions').length}`,
    `- Decisions: ${listMarkdownFiles('decisions').length}`,
    `- Designs: ${listMarkdownFiles('designs').length}`,
    `- Notes: ${listMarkdownFiles('notes').length}`,
    '',
    'Git:',
    gitStatus || 'Clean working tree.',
  ].join('\n');
}

function usage() {
  return [
    'Usage:',
    '  npm run memory:status',
    '  npm run memory:index',
    '  npm run memory:session -- --agent codex --title "Title" --summary "Summary"',
    '  npm run memory:decision -- --title "Title" --summary "Summary" --body "Details"',
    '  npm run memory:design -- --title "Title" --summary "Summary" --body "Details"',
    '  npm run memory:handoff -- --agent codex --summary "Current state" --next "Next action"',
  ].join('\n');
}

async function main() {
  const { command, options } = parseArgs();
  let result;

  switch (command) {
    case 'init':
      ensureDirs();
      result = `Initialized memory archive and rebuilt ${rebuildIndex()}`;
      break;
    case 'index':
      result = `Rebuilt ${rebuildIndex()}`;
      break;
    case 'status':
      result = getMemoryStatus();
      break;
    case 'session':
      result = `Recorded ${createRecord({ ...options, type: 'session' }).path}`;
      break;
    case 'decision':
      result = `Recorded ${createRecord({ ...options, type: 'decision' }).path}`;
      break;
    case 'design':
      result = `Recorded ${createRecord({ ...options, type: 'design' }).path}`;
      break;
    case 'note':
      result = `Recorded ${createRecord({ ...options, type: 'note' }).path}`;
      break;
    case 'handoff':
      result = `Updated ${writeHandoff(options).path}`;
      break;
    case 'help':
    case '--help':
    case '-h':
      result = usage();
      break;
    default:
      throw new Error(`Unknown command "${command}".\n\n${usage()}`);
  }

  console.log(result);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

