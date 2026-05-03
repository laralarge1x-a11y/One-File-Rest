import Groq from 'groq-sdk';

if (!process.env.GROQ_API_KEY) {
  console.warn('⚠️  GROQ_API_KEY not configured. AI features will be unavailable.');
}

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface GroqTextOptions {
  systemPrompt: string;
  userMessage: string;
  history?: Message[];
  temperature?: number;
  maxTokens?: number;
}

export interface GroqVisionOptions {
  imageUrl: string;
  question: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GroqJSONOptions<T> {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Generate text completion using Groq API
 * Uses llama-3.3-70b-versatile model for general text tasks
 */
export async function groqText(options: GroqTextOptions): Promise<string> {
  if (!groq) throw new Error('AI features are unavailable: GROQ_API_KEY not configured.');
  const {
    systemPrompt,
    userMessage,
    history = [],
    temperature = 0.7,
    maxTokens = 2048,
  } = options;

  const messages: Message[] = [
    ...history,
    { role: 'user', content: userMessage },
  ];

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ] as any,
      temperature,
      max_tokens: maxTokens,
    });

    return response.choices[0]?.message?.content || '';
  } catch (err) {
    console.error('Groq text API error:', err);
    throw new Error(`Failed to generate text: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Analyze images using Groq vision API
 * Uses meta-llama/llama-4-scout-17b-16e-instruct model for image analysis
 */
export async function groqVision(options: GroqVisionOptions): Promise<string> {
  if (!groq) throw new Error('AI features are unavailable: GROQ_API_KEY not configured.');
  const {
    imageUrl,
    question,
    temperature = 0.7,
    maxTokens = 1024,
  } = options;

  try {
    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl },
            },
            {
              type: 'text',
              text: question,
            },
          ],
        },
      ] as any,
      temperature,
      max_tokens: maxTokens,
    });

    return response.choices[0]?.message?.content || '';
  } catch (err) {
    console.error('Groq vision API error:', err);
    throw new Error(`Failed to analyze image: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Generate structured JSON output from Groq API
 * Uses llama-3.3-70b-versatile model with lower temperature for consistency
 */
export async function groqJSON<T = any>(options: GroqJSONOptions<T>): Promise<T> {
  if (!groq) throw new Error('AI features are unavailable: GROQ_API_KEY not configured.');
  const {
    systemPrompt,
    userMessage,
    temperature = 0.3,
    maxTokens = 2048,
  } = options;

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ] as any,
      temperature,
      max_tokens: maxTokens,
    });

    const content = response.choices[0]?.message?.content || '{}';

    try {
      return JSON.parse(content) as T;
    } catch (parseErr) {
      console.error('Failed to parse JSON response:', content);
      return {} as T;
    }
  } catch (err) {
    console.error('Groq JSON API error:', err);
    throw new Error(`Failed to generate JSON: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Fast text generation using smaller, faster model
 * Uses llama-3.1-8b-instant for quick responses
 */
export async function groqFast(options: GroqTextOptions): Promise<string> {
  if (!groq) throw new Error('AI features are unavailable: GROQ_API_KEY not configured.');
  const {
    systemPrompt,
    userMessage,
    history = [],
    temperature = 0.7,
    maxTokens = 1024,
  } = options;

  const messages: Message[] = [
    ...history,
    { role: 'user', content: userMessage },
  ];

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ] as any,
      temperature,
      max_tokens: maxTokens,
    });

    return response.choices[0]?.message?.content || '';
  } catch (err) {
    console.error('Groq fast API error:', err);
    throw new Error(`Failed to generate fast response: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

// ─── Tool calling (used by the omniscient "Ask Elite" assistant) ──────────
export interface GroqToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface GroqToolMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

export interface GroqToolResponse {
  content: string;
  tool_calls: Array<{
    id: string;
    name: string;
    args: any;
  }>;
  tokens_in: number;
  tokens_out: number;
}

/**
 * Tool-calling chat completion. Returns either a final text answer OR a list
 * of tool calls the model wants executed. Model: llama-3.3-70b-versatile.
 */
export async function groqTool(opts: {
  messages: GroqToolMessage[];
  tools?: GroqToolDef[];
  temperature?: number;
  maxTokens?: number;
  toolChoice?: 'auto' | 'none' | 'required';
}): Promise<GroqToolResponse> {
  if (!groq) throw new Error('AI features are unavailable: GROQ_API_KEY not configured.');
  const { messages, tools, temperature = 0.3, maxTokens = 2048, toolChoice = 'auto' } = opts;
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: messages as any,
      tools: tools as any,
      tool_choice: tools && tools.length > 0 ? (toolChoice as any) : undefined,
      temperature,
      max_tokens: maxTokens,
    });
    const choice = response.choices[0];
    const msg: any = choice?.message || {};
    const calls = (msg.tool_calls || []).map((tc: any) => {
      let args: any = {};
      try { args = JSON.parse(tc.function?.arguments || '{}'); } catch {}
      return { id: tc.id, name: tc.function?.name, args };
    });
    return {
      content: msg.content || '',
      tool_calls: calls,
      tokens_in: response.usage?.prompt_tokens || 0,
      tokens_out: response.usage?.completion_tokens || 0,
    };
  } catch (err) {
    console.error('Groq tool API error:', err);
    throw new Error(`Failed to call Groq with tools: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export async function groqStreamFinal(opts: {
  messages: GroqToolMessage[];
  temperature?: number;
  maxTokens?: number;
  onToken: (chunk: string) => void;
}): Promise<{ content: string; tokens_in: number; tokens_out: number }> {
  if (!groq) throw new Error('AI features are unavailable: GROQ_API_KEY not configured.');
  const { messages, temperature = 0.2, maxTokens = 1500, onToken } = opts;
  let full = '';
  let tokens_in = 0;
  let tokens_out = 0;
  try {
    const stream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: messages as any,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    });
    for await (const chunk of stream as any) {
      const delta: string = chunk?.choices?.[0]?.delta?.content || '';
      if (delta) {
        full += delta;
        onToken(delta);
      }
      const usage = chunk?.x_groq?.usage || chunk?.usage;
      if (usage) {
        tokens_in = usage.prompt_tokens || tokens_in;
        tokens_out = usage.completion_tokens || tokens_out;
      }
    }
    return { content: full, tokens_in, tokens_out };
  } catch (err) {
    console.error('Groq stream API error:', err);
    throw new Error(`Failed to stream completion: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Batch process multiple requests with rate limiting
 */
export async function groqBatch(
  requests: Array<{ type: 'text' | 'vision' | 'json'; options: any }>
): Promise<any[]> {
  const results: any[] = [];

  for (const request of requests) {
    try {
      let result;
      switch (request.type) {
        case 'text':
          result = await groqText(request.options);
          break;
        case 'vision':
          result = await groqVision(request.options);
          break;
        case 'json':
          result = await groqJSON(request.options);
          break;
        default:
          result = null;
      }
      results.push(result);

      // Rate limiting: 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      console.error('Batch request error:', err);
      results.push(null);
    }
  }

  return results;
}
