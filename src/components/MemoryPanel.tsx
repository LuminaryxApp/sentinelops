import { useState, useEffect } from 'react';
import {
  Brain, Plus, Search, Trash2, Pin, PinOff,
  Clock, Star, Filter, ChevronDown, ChevronRight,
  Sparkles, Edit2, X, RefreshCw, Settings,
  Zap, Database, ArrowLeft
} from 'lucide-react';
import { useStore } from '../hooks/useStore';
import { memoryApi, Memory, MemoryWithScore, MemoryType } from '../services/memoryApi';

type ViewMode = 'list' | 'search' | 'create' | 'settings' | 'detail';
type FilterType = 'all' | 'user' | 'auto' | 'pinned';
type SortType = 'created' | 'importance' | 'accessed';

interface MemoryPanelProps {
  isEmbedded?: boolean;
  onClose?: () => void;
}

export default function MemoryPanel({ isEmbedded, onClose }: MemoryPanelProps) {
  // View state
  const [view, setView] = useState<ViewMode>('list');
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('created');
  const [showFilters, setShowFilters] = useState(false);

  // Create form state
  const [newContent, setNewContent] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newImportance, setNewImportance] = useState(5);
  const [newPinned, setNewPinned] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemoryWithScore[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [useSemanticSearch, setUseSemanticSearch] = useState(true);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Store state
  const {
    memories,
    setMemories,
    addMemory,
    updateMemoryInStore,
    removeMemory,
    memorySettings,
    setMemorySettings,
    memoryStats,
    setMemoryStats,
    isLoadingMemories,
    setLoadingMemories,
    addNotification,
  } = useStore();

  // Load data on mount
  useEffect(() => {
    loadMemories();
    loadSettings();
    loadStats();
  }, []);

  const loadMemories = async () => {
    setLoadingMemories(true);
    try {
      const response = await memoryApi.listMemories({
        sortBy,
        memoryType: filterType === 'all' ? undefined : filterType as MemoryType | 'pinned',
      });
      if (response.ok && response.data) {
        setMemories(response.data.memories);
      }
    } catch (error) {
      console.error('Failed to load memories:', error);
    } finally {
      setLoadingMemories(false);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await memoryApi.getSettings();
      if (response.ok && response.data) {
        setMemorySettings(response.data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await memoryApi.getStats();
      if (response.ok && response.data) {
        setMemoryStats(response.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  // Reload when filter/sort changes
  useEffect(() => {
    loadMemories();
  }, [filterType, sortBy]);

  const handleCreateMemory = async () => {
    if (!newContent.trim()) return;

    setIsCreating(true);
    try {
      const tags = newTags.split(',').map(t => t.trim()).filter(Boolean);
      const response = await memoryApi.createMemory({
        content: newContent,
        summary: newSummary || undefined,
        tags: tags.length > 0 ? tags : undefined,
        importance: newImportance,
        isPinned: newPinned,
        type: 'user',
        generateEmbedding: true,
      });

      if (response.ok && response.data) {
        addMemory(response.data);
        addNotification({ type: 'success', title: 'Memory Created', message: '' });
        // Reset form
        setNewContent('');
        setNewSummary('');
        setNewTags('');
        setNewImportance(5);
        setNewPinned(false);
        setView('list');
        loadStats();
      } else {
        addNotification({ type: 'error', title: 'Failed to create memory', message: response.error?.message || '' });
      }
    } catch (error) {
      addNotification({ type: 'error', title: 'Error', message: 'Failed to create memory' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await memoryApi.searchMemories({
        query: searchQuery,
        includeEmbedding: useSemanticSearch,
        limit: 20,
      });

      if (response.ok && response.data) {
        setSearchResults(response.data.memories);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      const response = await memoryApi.deleteMemory(id);
      if (response.ok) {
        removeMemory(id);
        addNotification({ type: 'success', title: 'Memory deleted', message: '' });
        loadStats();
        if (selectedMemory?.id === id) {
          setSelectedMemory(null);
          setView('list');
        }
      }
    } catch (error) {
      addNotification({ type: 'error', title: 'Failed to delete', message: '' });
    }
  };

  const handleTogglePin = async (memory: Memory) => {
    try {
      const response = await memoryApi.updateMemory(memory.id, {
        isPinned: !memory.isPinned,
      });
      if (response.ok && response.data) {
        updateMemoryInStore(memory.id, response.data);
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  const handleUpdateMemory = async (id: string) => {
    if (!editContent.trim()) return;

    try {
      const response = await memoryApi.updateMemory(id, { content: editContent });
      if (response.ok && response.data) {
        updateMemoryInStore(id, response.data);
        setEditingId(null);
        setEditContent('');
        addNotification({ type: 'success', title: 'Memory updated', message: '' });
      }
    } catch (error) {
      addNotification({ type: 'error', title: 'Failed to update', message: '' });
    }
  };

  const handleUpdateSettings = async (updates: Record<string, unknown>) => {
    if (!memorySettings) return;

    try {
      const response = await memoryApi.updateSettings(updates);
      if (response.ok && response.data) {
        setMemorySettings(response.data);
        addNotification({ type: 'success', title: 'Settings saved', message: '' });
      }
    } catch (error) {
      addNotification({ type: 'error', title: 'Failed to save settings', message: '' });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const getTypeColor = (type: MemoryType) => {
    switch (type) {
      case 'auto': return 'text-[#89D185]';
      case 'user': return 'text-[#569CD6]';
      case 'conversation': return 'text-[#CE9178]';
      default: return 'text-[#858585]';
    }
  };

  const getTypeIcon = (type: MemoryType) => {
    switch (type) {
      case 'auto': return <Sparkles className="h-3 w-3" />;
      case 'user': return <Brain className="h-3 w-3" />;
      case 'conversation': return <Database className="h-3 w-3" />;
      default: return <Brain className="h-3 w-3" />;
    }
  };

  // Render memory card
  const renderMemoryCard = (memory: Memory, score?: number) => {
    const isEditing = editingId === memory.id;

    return (
      <div
        key={memory.id}
        className={`p-3 rounded-lg border transition-colors cursor-pointer ${
          selectedMemory?.id === memory.id
            ? 'border-[#007ACC] bg-[#094771]/30'
            : 'border-[#3E3E42] bg-[#252526] hover:border-[#007ACC]/50'
        }`}
        onClick={() => {
          if (!isEditing) {
            setSelectedMemory(memory);
            setView('detail');
          }
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={getTypeColor(memory.type)}>{getTypeIcon(memory.type)}</span>
            {memory.isPinned && <Pin className="h-3 w-3 text-[#DCDCAA]" />}
            {memory.summary && (
              <span className="text-sm font-medium truncate">{memory.summary}</span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {score !== undefined && (
              <span className="text-xs text-[#89D185] bg-[#89D185]/10 px-1.5 py-0.5 rounded">
                {(score * 100).toFixed(0)}%
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); handleTogglePin(memory); }}
              className="p-1 hover:bg-[#3E3E42] rounded"
              title={memory.isPinned ? 'Unpin' : 'Pin'}
            >
              {memory.isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteMemory(memory.id); }}
              className="p-1 hover:bg-[#3E3E42] rounded text-[#F48771]"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-[#1E1E1E] border border-[#3E3E42] rounded px-2 py-1 text-sm resize-none"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleUpdateMemory(memory.id)}
                className="px-2 py-1 bg-[#0E639C] hover:bg-[#1177BB] rounded text-xs"
              >
                Save
              </button>
              <button
                onClick={() => { setEditingId(null); setEditContent(''); }}
                className="px-2 py-1 bg-[#3E3E42] hover:bg-[#4E4E52] rounded text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#CCCCCC] line-clamp-3">{memory.content}</p>
        )}

        {/* Tags */}
        {memory.tags && memory.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {memory.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="text-xs bg-[#3E3E42] text-[#858585] px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
            {memory.tags.length > 3 && (
              <span className="text-xs text-[#858585]">+{memory.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 mt-2 text-xs text-[#858585]">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(memory.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            {memory.importance}/10
          </span>
          {memory.accessCount > 0 && (
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {memory.accessCount}
            </span>
          )}
        </div>
      </div>
    );
  };

  // Render list view
  const renderListView = () => (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {isLoadingMemories ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-[#858585]" />
        </div>
      ) : memories.length === 0 ? (
        <div className="text-center py-8">
          <Brain className="h-12 w-12 text-[#3E3E42] mx-auto mb-3" />
          <p className="text-[#858585]">No memories yet</p>
          <p className="text-xs text-[#606060] mt-1">Create your first memory or let AI extract them</p>
          <button
            onClick={() => setView('create')}
            className="mt-4 px-4 py-2 bg-[#0E639C] hover:bg-[#1177BB] rounded text-sm"
          >
            Create Memory
          </button>
        </div>
      ) : (
        memories.map((memory) => renderMemoryCard(memory))
      )}
    </div>
  );

  // Render search view
  const renderSearchView = () => (
    <div className="flex-1 overflow-y-auto p-3">
      {/* Search input */}
      <div className="mb-4 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search memories..."
            className="flex-1 bg-[#1E1E1E] border border-[#3E3E42] rounded px-3 py-2 text-sm focus:border-[#007ACC] outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-4 py-2 bg-[#0E639C] hover:bg-[#1177BB] rounded text-sm disabled:opacity-50"
          >
            {isSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Search'}
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-[#858585]">
          <input
            type="checkbox"
            checked={useSemanticSearch}
            onChange={(e) => setUseSemanticSearch(e.target.checked)}
            className="rounded border-[#3E3E42]"
          />
          Use semantic search (AI-powered)
        </label>
      </div>

      {/* Results */}
      {searchResults.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-[#858585] mb-2">{searchResults.length} results found</p>
          {searchResults.map((result) => renderMemoryCard(result.memory, result.score))}
        </div>
      ) : searchQuery && !isSearching ? (
        <p className="text-center text-[#858585] py-8">No results found</p>
      ) : null}
    </div>
  );

  // Render create view
  const renderCreateView = () => (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="space-y-4">
        {/* Content */}
        <div>
          <label className="block text-sm text-[#CCCCCC] mb-1">Content *</label>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="What should be remembered..."
            className="w-full bg-[#1E1E1E] border border-[#3E3E42] rounded px-3 py-2 text-sm resize-none focus:border-[#007ACC] outline-none"
            rows={4}
          />
        </div>

        {/* Summary */}
        <div>
          <label className="block text-sm text-[#CCCCCC] mb-1">Summary (optional)</label>
          <input
            type="text"
            value={newSummary}
            onChange={(e) => setNewSummary(e.target.value)}
            placeholder="Brief title for this memory"
            className="w-full bg-[#1E1E1E] border border-[#3E3E42] rounded px-3 py-2 text-sm focus:border-[#007ACC] outline-none"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm text-[#CCCCCC] mb-1">Tags (comma-separated)</label>
          <input
            type="text"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            placeholder="e.g., preferences, react, architecture"
            className="w-full bg-[#1E1E1E] border border-[#3E3E42] rounded px-3 py-2 text-sm focus:border-[#007ACC] outline-none"
          />
        </div>

        {/* Importance */}
        <div>
          <label className="block text-sm text-[#CCCCCC] mb-1">Importance: {newImportance}/10</label>
          <input
            type="range"
            min="1"
            max="10"
            value={newImportance}
            onChange={(e) => setNewImportance(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Pin */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={newPinned}
            onChange={(e) => setNewPinned(e.target.checked)}
            className="rounded border-[#3E3E42]"
          />
          <span className="text-sm text-[#CCCCCC]">Pin this memory</span>
        </label>

        {/* Submit */}
        <button
          onClick={handleCreateMemory}
          disabled={!newContent.trim() || isCreating}
          className="w-full py-2 bg-[#0E639C] hover:bg-[#1177BB] rounded text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isCreating ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Create Memory
            </>
          )}
        </button>
      </div>
    </div>
  );

  // Render settings view
  const renderSettingsView = () => (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="space-y-4">
        {/* Auto-extraction */}
        <div className="p-3 bg-[#1E1E1E] rounded-lg border border-[#3E3E42]">
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#CCCCCC]">Auto-extract memories</p>
              <p className="text-xs text-[#858585]">AI extracts important info from conversations</p>
            </div>
            <input
              type="checkbox"
              checked={memorySettings?.autoExtractEnabled ?? true}
              onChange={(e) => handleUpdateSettings({ autoExtractEnabled: e.target.checked })}
              className="rounded border-[#3E3E42]"
            />
          </label>
        </div>

        {/* Context injection count */}
        <div className="p-3 bg-[#1E1E1E] rounded-lg border border-[#3E3E42]">
          <label className="block">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-[#CCCCCC]">Memories per conversation</p>
              <span className="text-sm text-[#858585]">{memorySettings?.contextInjectionCount ?? 5}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={memorySettings?.contextInjectionCount ?? 5}
              onChange={(e) => handleUpdateSettings({ contextInjectionCount: parseInt(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-[#858585] mt-1">How many relevant memories to include in conversations</p>
          </label>
        </div>

        {/* Similarity threshold */}
        <div className="p-3 bg-[#1E1E1E] rounded-lg border border-[#3E3E42]">
          <label className="block">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-[#CCCCCC]">Similarity threshold</p>
              <span className="text-sm text-[#858585]">{((memorySettings?.similarityThreshold ?? 0.7) * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={memorySettings?.similarityThreshold ?? 0.7}
              onChange={(e) => handleUpdateSettings({ similarityThreshold: parseFloat(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-[#858585] mt-1">Minimum relevance score for memory retrieval</p>
          </label>
        </div>

        {/* Max memories */}
        <div className="p-3 bg-[#1E1E1E] rounded-lg border border-[#3E3E42]">
          <label className="block">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-[#CCCCCC]">Maximum memories</p>
              <span className="text-sm text-[#858585]">{memorySettings?.maxMemories ?? 1000}</span>
            </div>
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={memorySettings?.maxMemories ?? 1000}
              onChange={(e) => handleUpdateSettings({ maxMemories: parseInt(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-[#858585] mt-1">Oldest memories are removed when limit is reached</p>
          </label>
        </div>

        {/* Embedding model */}
        <div className="p-3 bg-[#1E1E1E] rounded-lg border border-[#3E3E42]">
          <p className="text-sm text-[#CCCCCC] mb-2">Embedding Model</p>
          <select
            value={memorySettings?.embeddingModel ?? 'openai/text-embedding-3-small'}
            onChange={(e) => handleUpdateSettings({ embeddingModel: e.target.value })}
            className="w-full bg-[#252526] border border-[#3E3E42] rounded px-3 py-2 text-sm"
          >
            <option value="openai/text-embedding-3-small">text-embedding-3-small (Fast)</option>
            <option value="openai/text-embedding-3-large">text-embedding-3-large (Better)</option>
          </select>
          <p className="text-xs text-[#858585] mt-1">Model used for semantic search</p>
        </div>
      </div>
    </div>
  );

  // Render detail view
  const renderDetailView = () => {
    if (!selectedMemory) return null;

    return (
      <div className="flex-1 overflow-y-auto p-3">
        <button
          onClick={() => { setSelectedMemory(null); setView('list'); }}
          className="flex items-center gap-1 text-sm text-[#858585] hover:text-white mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </button>

        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className={getTypeColor(selectedMemory.type)}>{getTypeIcon(selectedMemory.type)}</span>
              <span className="text-xs uppercase text-[#858585]">{selectedMemory.type}</span>
              {selectedMemory.isPinned && <Pin className="h-4 w-4 text-[#DCDCAA]" />}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setEditingId(selectedMemory.id);
                  setEditContent(selectedMemory.content);
                }}
                className="p-1.5 hover:bg-[#3E3E42] rounded"
                title="Edit"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleTogglePin(selectedMemory)}
                className="p-1.5 hover:bg-[#3E3E42] rounded"
              >
                {selectedMemory.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </button>
              <button
                onClick={() => handleDeleteMemory(selectedMemory.id)}
                className="p-1.5 hover:bg-[#3E3E42] rounded text-[#F48771]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Summary */}
          {selectedMemory.summary && (
            <h2 className="text-lg font-medium">{selectedMemory.summary}</h2>
          )}

          {/* Content */}
          <div className="p-3 bg-[#1E1E1E] rounded-lg border border-[#3E3E42]">
            {editingId === selectedMemory.id ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-[#252526] border border-[#3E3E42] rounded px-2 py-1 text-sm resize-none"
                  rows={6}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateMemory(selectedMemory.id)}
                    className="px-3 py-1 bg-[#0E639C] hover:bg-[#1177BB] rounded text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setEditingId(null); setEditContent(''); }}
                    className="px-3 py-1 bg-[#3E3E42] hover:bg-[#4E4E52] rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{selectedMemory.content}</p>
            )}
          </div>

          {/* Tags */}
          {selectedMemory.tags && selectedMemory.tags.length > 0 && (
            <div>
              <p className="text-xs text-[#858585] mb-2">Tags</p>
              <div className="flex flex-wrap gap-1">
                {selectedMemory.tags.map((tag, i) => (
                  <span key={i} className="text-xs bg-[#3E3E42] text-[#CCCCCC] px-2 py-1 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-2 bg-[#1E1E1E] rounded border border-[#3E3E42]">
              <p className="text-xs text-[#858585]">Importance</p>
              <p className="text-[#CCCCCC]">{selectedMemory.importance}/10</p>
            </div>
            <div className="p-2 bg-[#1E1E1E] rounded border border-[#3E3E42]">
              <p className="text-xs text-[#858585]">Access Count</p>
              <p className="text-[#CCCCCC]">{selectedMemory.accessCount}</p>
            </div>
            <div className="p-2 bg-[#1E1E1E] rounded border border-[#3E3E42]">
              <p className="text-xs text-[#858585]">Created</p>
              <p className="text-[#CCCCCC]">{formatDate(selectedMemory.createdAt)}</p>
            </div>
            <div className="p-2 bg-[#1E1E1E] rounded border border-[#3E3E42]">
              <p className="text-xs text-[#858585]">Updated</p>
              <p className="text-[#CCCCCC]">{formatDate(selectedMemory.updatedAt)}</p>
            </div>
          </div>

          {selectedMemory.embeddingModel && (
            <div className="text-xs text-[#606060]">
              Embedded with: {selectedMemory.embeddingModel}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full ${isEmbedded ? '' : 'bg-[#1E1E1E]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3E3E42]">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-[#7B68EE]" />
          <span className="font-medium">AI Memory</span>
          {memoryStats && (
            <span className="text-xs text-[#858585] bg-[#3E3E42] px-2 py-0.5 rounded">
              {memoryStats.totalCount} memories
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={loadMemories}
            className="p-1.5 hover:bg-[#3E3E42] rounded"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingMemories ? 'animate-spin' : ''}`} />
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1.5 hover:bg-[#3E3E42] rounded">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* View tabs */}
      <div className="flex border-b border-[#3E3E42]">
        {(['list', 'search', 'create', 'settings'] as ViewMode[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              view === v
                ? 'border-[#007ACC] text-white'
                : 'border-transparent text-[#858585] hover:text-white'
            }`}
          >
            {v === 'list' && <Database className="h-3 w-3 inline mr-1" />}
            {v === 'search' && <Search className="h-3 w-3 inline mr-1" />}
            {v === 'create' && <Plus className="h-3 w-3 inline mr-1" />}
            {v === 'settings' && <Settings className="h-3 w-3 inline mr-1" />}
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* Filters (list view only) */}
      {view === 'list' && (
        <div className="px-3 py-2 border-b border-[#3E3E42] flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
              showFilters ? 'bg-[#3E3E42]' : 'hover:bg-[#3E3E42]'
            }`}
          >
            <Filter className="h-3 w-3" />
            Filter
            {showFilters ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>

          {showFilters && (
            <>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="bg-[#252526] border border-[#3E3E42] rounded px-2 py-1 text-xs"
              >
                <option value="all">All</option>
                <option value="user">User</option>
                <option value="auto">Auto</option>
                <option value="pinned">Pinned</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortType)}
                className="bg-[#252526] border border-[#3E3E42] rounded px-2 py-1 text-xs"
              >
                <option value="created">Newest</option>
                <option value="importance">Importance</option>
                <option value="accessed">Recently Used</option>
              </select>
            </>
          )}
        </div>
      )}

      {/* Content */}
      {view === 'list' && renderListView()}
      {view === 'search' && renderSearchView()}
      {view === 'create' && renderCreateView()}
      {view === 'settings' && renderSettingsView()}
      {view === 'detail' && renderDetailView()}

      {/* Stats footer */}
      {memoryStats && view !== 'settings' && (
        <div className="px-3 py-2 border-t border-[#3E3E42] flex items-center gap-4 text-xs text-[#858585]">
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            {memoryStats.autoCount} auto
          </span>
          <span className="flex items-center gap-1">
            <Brain className="h-3 w-3" />
            {memoryStats.userCount} user
          </span>
          <span className="flex items-center gap-1">
            <Pin className="h-3 w-3" />
            {memoryStats.pinnedCount} pinned
          </span>
        </div>
      )}
    </div>
  );
}
