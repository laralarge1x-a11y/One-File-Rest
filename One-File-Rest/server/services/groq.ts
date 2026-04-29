import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

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
 * Uses llama-3.2-90b-vision-preview model for image analysis
 */
export async function groqVision(options: GroqVisionOptions): Promise<string> {
  const {
    imageUrl,
    question,
    temperature = 0.7,
    maxTokens = 1024,
  } = options;

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.2-90b-vision-preview',
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
