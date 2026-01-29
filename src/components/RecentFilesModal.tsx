import { useState, useEffect, useRef } from 'react';
import { useStore, getLanguageFromFilename } from '../hooks/useStore';
import { api } from '../services/api';
import { Clock, File, X } from 'lucide-react';

export default function RecentFilesModal() {
  const {
    recentFiles,
    recentFilesOpen,
    setRecentFilesOpen,
    openFile,
    addNotification,
  } = useStore();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter files based on query
  const filteredFiles = recentFiles.filter(
    (f) =>
      f.name.toLowerCase().includes(query.toLowerCase()) ||
      f.path.toLowerCase().includes(query.toLowerCase())
  );

  // Reset on open/close
  useEffect(() => {
    if (recentFilesOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [recentFilesOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!recentFilesOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredFiles.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredFiles[selectedIndex]) {
          openRecentFile(filteredFiles[selectedIndex].path);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setRecentFilesOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recentFilesOpen, filteredFiles, selectedIndex, setRecentFilesOpen]);

  const openRecentFile = async (path: string) => {
    try {
      const result = await api.read(path);
      if (result.ok && result.data) {
        const filename = path.split(/[/\\]/).pop() || path;
        openFile({
          path,
          name: filename,
          content: result.data.content,
          originalContent: result.data.content,
          language: getLanguageFromFilename(filename),
          isDirty: false,
        });
        setRecentFilesOpen(false);
      } else {
        addNotification({
          type: 'error',
          title: 'Failed to open file',
          message: result.error?.message || 'File may have been moved or deleted',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to open file',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (!recentFilesOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15%] bg-black/50"
      onClick={() => setRecentFilesOpen(false)}
    >
      <div
        className="w-[600px] max-w-[90%] bg-[#252526] rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#3E3E42]">
          <Clock size={16} className="text-[#858585]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search recent files..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-[#CCCCCC] placeholder-[#858585]"
          />
          <button
            onClick={() => setRecentFilesOpen(false)}
            className="p-1 hover:bg-[#3E3E42] rounded"
          >
            <X size={14} className="text-[#858585]" />
          </button>
        </div>

        {/* File list */}
        <div className="max-h-[400px] overflow-y-auto">
          {filteredFiles.length === 0 ? (
            <div className="px-4 py-8 text-center text-[#858585]">
              <Clock className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">
                {query ? 'No matching files' : 'No recent files'}
              </p>
            </div>
          ) : (
            filteredFiles.map((file, index) => (
              <div
                key={file.path}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                  index === selectedIndex ? 'bg-[#094771]' : 'hover:bg-[#2A2D2E]'
                }`}
                onClick={() => openRecentFile(file.path)}
              >
                <File size={16} className="text-[#858585] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#CCCCCC] truncate">{file.name}</p>
                  <p className="text-xs text-[#858585] truncate">{file.path}</p>
                </div>
                <span className="text-xs text-[#606060] flex-shrink-0">
                  {formatTime(file.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-3 py-2 border-t border-[#3E3E42] text-xs text-[#858585]">
          <span className="mr-4">
            <kbd className="px-1 py-0.5 bg-[#3E3E42] rounded">↑↓</kbd> Navigate
          </span>
          <span className="mr-4">
            <kbd className="px-1 py-0.5 bg-[#3E3E42] rounded">Enter</kbd> Open
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-[#3E3E42] rounded">Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
