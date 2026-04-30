import fs from 'node:fs';
import path from 'node:path';

export type MemoryEntry = {
  title: string;
  path: string;
  date: string;
  excerpt: string;
};

export type MemorySection = {
  title: string;
  description: string;
  entries: MemoryEntry[];
};

export type MemoryArchive = {
  generatedAt: string;
  currentState: string;
  sections: MemorySection[];
};

const MEMORY_DIR = path.join(process.cwd(), 'memory');

const SECTION_DEFS = [
  {
    title: 'Sessions',
    dir: 'sessions',
    description: 'Chronological records of agent work blocks.',
  },
  {
    title: 'Decisions',
    dir: 'decisions',
    description: 'Architectural and product choices with reasoning.',
  },
  {
    title: 'Designs',
    dir: 'designs',
    description: 'UI, product, data, and system design notes.',
  },
  {
    title: 'Handoffs',
    dir: 'handoffs',
    description: 'Continuity notes for the next agent.',
  },
  {
    title: 'Notes',
    dir: 'notes',
    description: 'General project memory entries.',
  },
];

function readFile(relativePath: string) {
  try {
    return fs.readFileSync(path.join(MEMORY_DIR, relativePath), 'utf8');
  } catch {
    return '';
  }
}

function firstHeading(content: string, fallback: string) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

function frontmatterOrLineDate(content: string) {
  const frontmatter = content.match(/^date:\s*"?([^"\n]+)"?/m);
  if (frontmatter) return frontmatter[1].trim();

  const dateLine = content.match(/^Date:\s*(.+)$/m);
  if (dateLine) return dateLine[1].trim();

  const updatedLine = content.match(/^Last updated:\s*(.+)$/m);
  if (updatedLine) return updatedLine[1].trim();

  return 'Undated';
}

function excerpt(content: string) {
  const cleaned = content
    .replace(/^---[\s\S]*?---\s*/m, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('---'))
    .join(' ');

  return cleaned.length > 260 ? `${cleaned.slice(0, 257)}...` : cleaned;
}

function listEntries(dirName: string): MemoryEntry[] {
  const dir = path.join(MEMORY_DIR, dirName);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => {
      const relativePath = `${dirName}/${entry.name}`;
      const content = readFile(relativePath);
      return {
        title: firstHeading(content, entry.name.replace(/\.md$/, '')),
        path: `memory/${relativePath}`,
        date: frontmatterOrLineDate(content),
        excerpt: excerpt(content),
      };
    })
    .sort((a, b) => b.path.localeCompare(a.path));
}

export function getMemoryArchive(): MemoryArchive {
  return {
    generatedAt: new Date().toISOString(),
    currentState: readFile('CURRENT_STATE.md'),
    sections: SECTION_DEFS.map((section) => ({
      title: section.title,
      description: section.description,
      entries: listEntries(section.dir),
    })),
  };
}
