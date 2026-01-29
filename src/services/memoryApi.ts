import { invoke } from '@tauri-apps/api/core';
import type { ApiResponse } from './api';

// ============================================================================
// Types
// ============================================================================

export type MemoryType = 'auto' | 'user' | 'conversation';

export interface Memory {
  id: string;
  workspaceId: string;
  content: string;
  summary?: string;
  type: MemoryType;
  sourceConversationId?: string;
  sourceMessageIds?: string[];
  embeddingModel?: string;
  tags?: string[];
  importance: number;
  accessCount: number;
  lastAccessedAt?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  isPinned: boolean;
  metadata?: Record<string, unknown>;
}

export interface MemoryWithScore {
  memory: Memory;
  score: number;
  matchType: 'semantic' | 'keyword' | 'hybrid';
}

export interface MemorySettings {
  workspaceId: string;
  autoExtractEnabled: boolean;
  extractionModel?: string;
  embeddingModel: string;
  maxMemories: number;
  contextInjectionCount: number;
  similarityThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryStats {
  totalCount: number;
  autoCount: number;
  userCount: number;
  conversationCount: number;
  pinnedCount: number;
  withEmbeddings: number;
  avgImportance: number;
}

export interface MemoryListResult {
  memories: Memory[];
  count: number;
  total: number;
}

export interface MemorySearchResult {
  memories: MemoryWithScore[];
  count: number;
  searchType: string;
}

export interface CreateMemoryRequest {
  content: string;
  summary?: string;
  type?: MemoryType;
  tags?: string[];
  importance?: number;
  isPinned?: boolean;
  sourceConversationId?: string;
  sourceMessageIds?: string[];
  metadata?: Record<string, unknown>;
  generateEmbedding?: boolean;
}

export interface UpdateMemoryRequest {
  content?: string;
  summary?: string;
  tags?: string[];
  importance?: number;
  isPinned?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SearchMemoryRequest {
  query: string;
  limit?: number;
  threshold?: number;
  includeEmbedding?: boolean;
  tags?: string[];
  type?: MemoryType;
}

export interface ExtractMemoriesRequest {
  conversationId: string;
  messages: Array<{ role: string; content: string }>;
  model?: string;
}

export interface UpdateSettingsRequest {
  autoExtractEnabled?: boolean;
  extractionModel?: string;
  embeddingModel?: string;
  maxMemories?: number;
  contextInjectionCount?: number;
  similarityThreshold?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
  tokenCount?: number;
}

// ============================================================================
// Memory API Client
// ============================================================================

class MemoryApiClient {
  // --------------------------------------------------------------------------
  // Memory CRUD Operations
  // --------------------------------------------------------------------------

  async createMemory(request: CreateMemoryRequest): Promise<ApiResponse<Memory>> {
    return invoke('create_memory', { request });
  }

  async getMemory(id: string): Promise<ApiResponse<Memory>> {
    return invoke('get_memory', { id });
  }

  async updateMemory(id: string, request: UpdateMemoryRequest): Promise<ApiResponse<Memory>> {
    return invoke('update_memory', { id, request });
  }

  async deleteMemory(id: string): Promise<ApiResponse<boolean>> {
    return invoke('delete_memory', { id });
  }

  async listMemories(options?: {
    memoryType?: MemoryType | 'pinned';
    tags?: string[];
    limit?: number;
    offset?: number;
    sortBy?: 'created' | 'importance' | 'accessed';
  }): Promise<ApiResponse<MemoryListResult>> {
    return invoke('list_memories', {
      memoryType: options?.memoryType,
      tags: options?.tags,
      limit: options?.limit,
      offset: options?.offset,
      sortBy: options?.sortBy,
    });
  }

  // --------------------------------------------------------------------------
  // Search Operations
  // --------------------------------------------------------------------------

  async searchMemories(request: SearchMemoryRequest): Promise<ApiResponse<MemorySearchResult>> {
    return invoke('search_memories', { request });
  }

  async getRelevantMemories(context: string, limit?: number): Promise<ApiResponse<MemoryWithScore[]>> {
    return invoke('get_relevant_memories', { context, limit });
  }

  // --------------------------------------------------------------------------
  // Extraction Operations
  // --------------------------------------------------------------------------

  async extractMemories(request: ExtractMemoriesRequest): Promise<ApiResponse<Memory[]>> {
    return invoke('extract_memories', { request });
  }

  // --------------------------------------------------------------------------
  // Settings Operations
  // --------------------------------------------------------------------------

  async getSettings(): Promise<ApiResponse<MemorySettings>> {
    return invoke('get_memory_settings');
  }

  async updateSettings(settings: UpdateSettingsRequest): Promise<ApiResponse<MemorySettings>> {
    return invoke('update_memory_settings', { settings });
  }

  // --------------------------------------------------------------------------
  // Stats Operations
  // --------------------------------------------------------------------------

  async getStats(): Promise<ApiResponse<MemoryStats>> {
    return invoke('get_memory_stats');
  }

  // --------------------------------------------------------------------------
  // Embedding Operations
  // --------------------------------------------------------------------------

  async createEmbedding(text: string, model?: string): Promise<ApiResponse<EmbeddingResult>> {
    return invoke('create_embedding', { text, model });
  }

  async batchCreateEmbeddings(texts: string[], model?: string): Promise<ApiResponse<{
    embeddings: number[][];
    model: string;
    dimensions: number;
    totalTokens?: number;
  }>> {
    return invoke('batch_create_embeddings', { texts, model });
  }
}

export const memoryApi = new MemoryApiClient();
export default memoryApi;
