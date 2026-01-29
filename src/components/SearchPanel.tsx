import { useState } from 'react';
import { Search, RefreshCw, File, CaseSensitive, Regex } from 'lucide-react';
import { useStore, getLanguageFromFilename } from '../hooks/useStore';
import { api } from '../services/api';

export default function SearchPanel() {
  const {
    searchQuery,
    searchResults,
    isSearching,
    setSearchQuery,
    setSearchResults,
    setSearching,
    addNotification,
    openFile,
    setActiveTab,
  } = useStore();

  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [searchPath, setSearchPath] = useState('.');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResults([]);

    try {
      const response = await api.search(searchQuery, {
        path: searchPath,
        caseSensitive,
        maxResults: 200,
      });

      if (response.ok && response.data) {
        setSearchResults(response.data.matches);
        if (response.data.truncated) {
          addNotification({
            type: 'warning',
            title: 'Results truncated',
            message: 'Search returned more than 200 results',
          });
        }
      } else {
        addNotification({
          type: 'error',
          title: 'Search failed',
          message: response.error?.message || 'Unknown error',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Search failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const openResult = async (path: string) => {
    try {
      const response = await api.read(path);
      if (response.ok && response.data) {
        const filename = path.split(/[/\\]/).pop() || path;
        openFile({
          path,
          name: filename,
          content: response.data.content,
          originalContent: response.data.content,
          language: getLanguageFromFilename(filename),
          isDirty: false,
        });
        setActiveTab('files');
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to open file',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Group results by file
  const groupedResults = searchResults.reduce(
    (acc, match) => {
      if (!acc[match.path]) {
        acc[match.path] = [];
      }
      acc[match.path].push(match);
      return acc;
    },
    {} as Record<string, typeof searchResults>
  );

  return (
    <div className="flex h-full flex-col bg-[#252526]">
      {/* Header */}
      <div className="panel-header">
        <span>Search</span>
      </div>

      {/* Search controls */}
      <div className="p-3 border-b border-[#3E3E42]">
        {/* Search input */}
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#858585]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search in files..."
            className="input pl-8 pr-16 text-sm"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 text-xs bg-[#0E639C] hover:bg-[#1177BB] text-white rounded disabled:opacity-50"
          >
            {isSearching ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Go'}
          </button>
        </div>

        {/* Search options */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
              caseSensitive
                ? 'bg-[#094771] text-white'
                : 'bg-[#3C3C3C] text-[#858585] hover:text-white'
            }`}
            title="Case sensitive"
          >
            <CaseSensitive className="h-3 w-3" />
            Aa
          </button>
          <button
            onClick={() => setUseRegex(!useRegex)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
              useRegex
                ? 'bg-[#094771] text-white'
                : 'bg-[#3C3C3C] text-[#858585] hover:text-white'
            }`}
            title="Use regex"
          >
            <Regex className="h-3 w-3" />
            .*
          </button>
        </div>

        {/* Search path */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#858585]">In:</span>
          <input
            type="text"
            value={searchPath}
            onChange={(e) => setSearchPath(e.target.value)}
            placeholder="."
            className="input flex-1 py-1 text-xs"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {searchResults.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[#858585]">
            <div className="text-center">
              <Search className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">{isSearching ? 'Searching...' : 'Enter a search query'}</p>
            </div>
          </div>
        ) : (
          <div>
            {Object.entries(groupedResults).map(([path, matches]) => (
              <div key={path} className="border-b border-[#3E3E42]">
                {/* File header */}
                <button
                  onClick={() => openResult(path)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[#2A2D2E] text-sm"
                >
                  <File className="h-4 w-4 text-[#858585]" />
                  <span className="text-[#3B78FF] truncate">{path}</span>
                  <span className="text-[#858585] text-xs">({matches.length})</span>
                </button>

                {/* Matches */}
                <div className="pl-6">
                  {matches.slice(0, 5).map((match, i) => (
                    <button
                      key={i}
                      onClick={() => openResult(path)}
                      className="flex items-start gap-2 w-full px-3 py-1 text-left hover:bg-[#2A2D2E] text-xs"
                    >
                      <span className="text-[#858585] w-8 text-right flex-shrink-0">
                        {match.line}:
                      </span>
                      <code className="text-[#D4D4D4] truncate">{match.text}</code>
                    </button>
                  ))}
                  {matches.length > 5 && (
                    <p className="px-3 py-1 text-xs text-[#858585]">
                      +{matches.length - 5} more matches
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status */}
      {searchResults.length > 0 && (
        <div className="px-3 py-2 text-xs text-[#858585] border-t border-[#3E3E42]">
          {searchResults.length} results in {Object.keys(groupedResults).length} files
        </div>
      )}
    </div>
  );
}
