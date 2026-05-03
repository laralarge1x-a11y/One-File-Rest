// Shared types for the omniscient assistant ("Ask Elite").
// Tools are read-only — they MUST NOT mutate any table. The orchestrator
// enforces this by only registering safe SELECT-style functions here.

export type SourceType =
  | 'case'
  | 'message'
  | 'discord'
  | 'evidence'
  | 'kb'
  | 'audit'
  | 'client'
  | 'staff'
  | 'template'
  | 'policy';

export interface Source {
  type: SourceType;
  id: string | number;
  label: string;
  url?: string;          // deep link into the portal
  snippet?: string;      // short excerpt
}

export interface ToolResult {
  ok: boolean;
  data?: any;            // arbitrary structured data fed back to the model
  sources?: Source[];    // collected for citation rendering
  error?: string;
  truncated?: boolean;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
  handler: (args: any, ctx: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  staffDiscordId: string;
  staffRole: string;
  surface: 'web' | 'discord';
}

export interface AskRequest {
  question: string;
  threadId?: number;
  surface?: 'web' | 'discord';
  contextHint?: { caseId?: number; clientDiscordId?: string };
}

export type StreamEvent =
  | { type: 'thread'; thread_id: number }
  | { type: 'step'; tool: string; args?: any }
  | { type: 'tool_result'; tool: string; ok: boolean; summary?: string }
  | { type: 'token'; text: string }
  | { type: 'sources'; sources: Source[] }
  | { type: 'done'; tokens_in: number; tokens_out: number; duration_ms: number }
  | { type: 'error'; message: string };
