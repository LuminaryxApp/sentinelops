/**
 * Chat service for web AI chat
 * Handles SSE streaming from /api/chat/completions
 */

const TOKEN_KEY = 'sentinelops_auth_token';

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: string;
}

export interface ChatStreamCallbacks {
  onChunk?: (content: string, fullContent: string) => void;
  onComplete?: (fullContent: string, usage?: TokenUsage) => void;
  onError?: (error: string) => void;
  onRateLimit?: (info: RateLimitInfo & { message: string }) => void;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Model information interface
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  inputPrice: number;
  outputPrice: number;
  description: string;
  category: string;
}

// Model categories
export interface ModelCategory {
  id: string;
  name: string;
  color: string;
  models: ModelInfo[];
}

// All available models organized by category
export const MODEL_CATEGORIES: ModelCategory[] = [
  {
    id: 'free',
    name: 'Free',
    color: '#89D185',
    models: [
      {
        id: 'meta-llama/llama-3.2-3b-instruct:free',
        name: 'Llama 3.2 3B Free',
        provider: 'Meta (OpenRouter)',
        contextWindow: 131072,
        inputPrice: 0,
        outputPrice: 0,
        description: 'Free tier - rate limited',
        category: 'free',
      },
    ],
  },
  {
    id: 'coding',
    name: 'Coding',
    color: '#007ACC',
    models: [
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'Anthropic',
        contextWindow: 200000,
        inputPrice: 3.00,
        outputPrice: 15.00,
        description: 'Best for complex coding',
        category: 'coding',
      },
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        provider: 'OpenAI',
        contextWindow: 128000,
        inputPrice: 2.50,
        outputPrice: 10.00,
        description: 'Excellent all-around',
        category: 'coding',
      },
      {
        id: 'deepseek/deepseek-chat',
        name: 'DeepSeek V3',
        provider: 'DeepSeek',
        contextWindow: 64000,
        inputPrice: 0.14,
        outputPrice: 0.28,
        description: 'Great value coder',
        category: 'coding',
      },
      {
        id: 'qwen/qwen-2.5-72b-instruct',
        name: 'Qwen 2.5 72B',
        provider: 'Qwen',
        contextWindow: 131072,
        inputPrice: 0.35,
        outputPrice: 0.40,
        description: 'Strong open-source',
        category: 'coding',
      },
      {
        id: 'meta-llama/llama-3.1-70b-instruct',
        name: 'Llama 3.1 70B',
        provider: 'Meta',
        contextWindow: 131072,
        inputPrice: 0.35,
        outputPrice: 0.40,
        description: 'Reliable coder',
        category: 'coding',
      },
      {
        id: 'openai/gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'OpenAI',
        contextWindow: 128000,
        inputPrice: 0.15,
        outputPrice: 0.60,
        description: 'Fast and cheap',
        category: 'coding',
      },
    ],
  },
  {
    id: 'reasoning',
    name: 'Reasoning',
    color: '#9C27B0',
    models: [
      {
        id: 'google/gemini-pro-1.5',
        name: 'Gemini 1.5 Pro',
        provider: 'Google',
        contextWindow: 2097152,
        inputPrice: 1.25,
        outputPrice: 5.00,
        description: '2M context window!',
        category: 'reasoning',
      },
      {
        id: 'meta-llama/llama-3.1-405b-instruct',
        name: 'Llama 3.1 405B',
        provider: 'Meta',
        contextWindow: 131072,
        inputPrice: 2.00,
        outputPrice: 2.00,
        description: 'Largest open model',
        category: 'reasoning',
      },
      {
        id: 'mistralai/mistral-large',
        name: 'Mistral Large',
        provider: 'Mistral',
        contextWindow: 128000,
        inputPrice: 2.00,
        outputPrice: 6.00,
        description: 'Strong European',
        category: 'reasoning',
      },
    ],
  },
  {
    id: 'chat',
    name: 'Chat',
    color: '#4CAF50',
    models: [
      {
        id: 'anthropic/claude-3-haiku',
        name: 'Claude 3 Haiku',
        provider: 'Anthropic',
        contextWindow: 200000,
        inputPrice: 0.25,
        outputPrice: 1.25,
        description: 'Fast and smart',
        category: 'chat',
      },
      {
        id: 'meta-llama/llama-3.1-8b-instruct',
        name: 'Llama 3.1 8B',
        provider: 'Meta',
        contextWindow: 131072,
        inputPrice: 0.055,
        outputPrice: 0.055,
        description: 'Ultra affordable',
        category: 'chat',
      },
      {
        id: 'mistralai/mistral-7b-instruct',
        name: 'Mistral 7B',
        provider: 'Mistral',
        contextWindow: 32768,
        inputPrice: 0.055,
        outputPrice: 0.055,
        description: 'Fast small model',
        category: 'chat',
      },
      {
        id: 'google/gemma-2-9b-it',
        name: 'Gemma 2 9B',
        provider: 'Google',
        contextWindow: 8192,
        inputPrice: 0.08,
        outputPrice: 0.08,
        description: 'Efficient',
        category: 'chat',
      },
    ],
  },
  {
    id: 'vision',
    name: 'Vision',
    color: '#FF9800',
    models: [
      {
        id: 'google/gemini-flash-1.5',
        name: 'Gemini 1.5 Flash',
        provider: 'Google',
        contextWindow: 1000000,
        inputPrice: 0.075,
        outputPrice: 0.30,
        description: 'Fast and cheap',
        category: 'vision',
      },
      {
        id: 'meta-llama/llama-3.2-11b-vision-instruct',
        name: 'Llama 3.2 11B Vision',
        provider: 'Meta',
        contextWindow: 131072,
        inputPrice: 0.055,
        outputPrice: 0.055,
        description: 'Open-source vision',
        category: 'vision',
      },
    ],
  },
];

// Flatten all models for easy access
export const ALL_MODELS = MODEL_CATEGORIES.flatMap((cat) => cat.models);

// Legacy format for backwards compatibility
export const AVAILABLE_MODELS = ALL_MODELS.map((m) => ({
  id: m.id,
  name: m.name,
  free: m.inputPrice === 0,
}));

// Premium price threshold (models costing $1.00+ per 1M input tokens require Pro)
const PREMIUM_PRICE_THRESHOLD = 1.00;

// Check if model is premium
export const isModelPremium = (modelId: string): boolean => {
  const model = ALL_MODELS.find((m) => m.id === modelId);
  return model ? model.inputPrice >= PREMIUM_PRICE_THRESHOLD : false;
};

// Find model by ID
export const findModel = (modelId: string): ModelInfo | undefined => {
  return ALL_MODELS.find((m) => m.id === modelId);
};

// API URL - uses VPS in production, configurable for development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://40.160.241.52';
const PROXY_URL = `${API_BASE_URL}/chat/completions`;

/**
 * Send a chat completion request with streaming
 */
export async function streamChatCompletion(
  messages: Pick<ChatMessage, 'role' | 'content'>[],
  options: ChatCompletionOptions = {},
  callbacks: ChatStreamCallbacks = {}
): Promise<void> {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://sentinelops.org',
    'X-Title': 'SentinelOps Web',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const requestBody = {
    model: options.model || 'meta-llama/llama-3.2-3b-instruct:free',
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
    stream: options.stream ?? true,
  };

  try {
    // Try the API route first, fall back to direct proxy
    let response = await fetch('/api/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    // If API route fails (404 in dev), try direct proxy
    if (response.status === 404) {
      response = await fetch(PROXY_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
    }

    // Check for rate limit
    if (response.status === 429) {
      const data = await response.json();
      callbacks.onRateLimit?.({
        limit: data.limit,
        remaining: data.remaining,
        resetAt: data.resetAt,
        message: data.message,
      });
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      callbacks.onError?.(errorData.message || errorData.error || 'Request failed');
      return;
    }

    // Handle streaming
    if (options.stream !== false && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              callbacks.onComplete?.(fullContent);
              return;
            }

            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                callbacks.onChunk?.(delta, fullContent);
              }

              // Check for usage info
              if (json.usage) {
                callbacks.onComplete?.(fullContent, {
                  promptTokens: json.usage.prompt_tokens || 0,
                  completionTokens: json.usage.completion_tokens || 0,
                  totalTokens: json.usage.total_tokens || 0,
                });
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }

        // Final completion if not already called
        if (fullContent) {
          callbacks.onComplete?.(fullContent);
        }
      } catch (streamError) {
        callbacks.onError?.(streamError instanceof Error ? streamError.message : 'Stream error');
      }
    } else {
      // Non-streaming response
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      callbacks.onComplete?.(content, data.usage ? {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0,
      } : undefined);
    }
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error.message : 'Network error');
  }
}

/**
 * Get rate limit info for current user/session
 */
export async function getRateLimitInfo(): Promise<RateLimitInfo | null> {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch('/api/chat/rate-limit', {
      method: 'GET',
      headers,
    });

    if (!response.ok) return null;

    return await response.json();
  } catch {
    return null;
  }
}

// Local storage keys for chat history
const CHAT_HISTORY_KEY = 'sentinelops_web_chat_history';
const CURRENT_CHAT_KEY = 'sentinelops_web_current_chat';

export interface ChatHistoryItem {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Save chat history to localStorage
 */
export function saveChatHistory(chats: ChatHistoryItem[]): void {
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chats.slice(0, 50)));
}

/**
 * Load chat history from localStorage
 */
export function loadChatHistory(): ChatHistoryItem[] {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save current chat ID
 */
export function setCurrentChatId(id: string | null): void {
  if (id) {
    localStorage.setItem(CURRENT_CHAT_KEY, id);
  } else {
    localStorage.removeItem(CURRENT_CHAT_KEY);
  }
}

/**
 * Get current chat ID
 */
export function getCurrentChatId(): string | null {
  return localStorage.getItem(CURRENT_CHAT_KEY);
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
