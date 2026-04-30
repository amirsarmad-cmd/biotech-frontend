import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  createRecord,
  getMemoryStatus,
  readMemoryFile,
  searchMemory,
  writeHandoff,
} from '../scripts/memory.mjs';

const server = new McpServer({
  name: 'biotech-project-memory',
  version: '0.1.0',
});

function text(value) {
  return {
    content: [
      {
        type: 'text',
        text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

server.registerTool(
  'memory_status',
  {
    title: 'Read project memory status',
    description: 'Summarize the memory archive and current git state.',
  },
  async () => text(getMemoryStatus()),
);

server.registerTool(
  'memory_read',
  {
    title: 'Read a memory file',
    description: 'Read a markdown file from the project memory archive.',
    inputSchema: z.object({
      path: z.string().default('CURRENT_STATE.md').describe('Path relative to memory/.'),
    }),
  },
  async ({ path }) => text(readMemoryFile(path)),
);

server.registerTool(
  'memory_search',
  {
    title: 'Search project memory',
    description: 'Search markdown records in memory/ for a text query.',
    inputSchema: z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).default(10),
    }),
  },
  async ({ query, limit }) => text(searchMemory(query, limit)),
);

server.registerTool(
  'memory_append',
  {
    title: 'Append a memory record',
    description: 'Create a session, decision, design, note, or handoff record in memory/.',
    inputSchema: z.object({
      type: z.enum(['session', 'decision', 'design', 'note']).default('session'),
      agent: z.string().default('mcp-agent'),
      title: z.string().min(1),
      summary: z.string().default(''),
      body: z.string().default(''),
      tags: z.array(z.string()).default([]),
      next: z.array(z.string()).default([]),
    }),
  },
  async (args) => text(createRecord(args)),
);

server.registerTool(
  'memory_handoff',
  {
    title: 'Update next-agent handoff',
    description: 'Replace memory/handoffs/NEXT_AGENT.md with the latest continuity note.',
    inputSchema: z.object({
      agent: z.string().default('mcp-agent'),
      title: z.string().default('Next Agent Handoff'),
      summary: z.string().default(''),
      body: z.string().default(''),
      next: z.array(z.string()).default([]),
    }),
  },
  async (args) => text(writeHandoff(args)),
);

export async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.env.MEMORY_MCP_NO_START !== '1') {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

