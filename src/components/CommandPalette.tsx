import { useState, useEffect, useRef } from 'react';
import { useStore, getLanguageFromFilename } from '../hooks/useStore';
import { api } from '../services/api';
import { extensionService } from '../services/extensionService';
import {
  Search,
  File,
  Settings,
  FolderOpen,
  GitBranch,
  Bot,
  Trash2,
  Terminal,
  BookOpen,
  Puzzle,
} from 'lucide-react';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

export default function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setActiveTab, openFile, addNotification } =
    useStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<'commands' | 'files'>('commands');
  const [fileResults, setFileResults] = useState<Array<{ path: string; name: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Available commands
  const commands: Command[] = [
    {
      id: 'open-file',
      label: 'Go to File',
      description: 'Quickly open a file by name',
      icon: <File size={16} />,
      action: () => setMode('files'),
      category: 'Navigation',
    },
    {
      id: 'explorer',
      label: 'Show Explorer',
      icon: <FolderOpen size={16} />,
      action: () => {
        setActiveTab('files');
        setCommandPaletteOpen(false);
      },
      category: 'View',
    },
    {
      id: 'search',
      label: 'Show Search',
      description: 'Search in files',
      icon: <Search size={16} />,
      action: () => {
        setActiveTab('search');
        setCommandPaletteOpen(false);
      },
      category: 'View',
    },
    {
      id: 'git',
      label: 'Show Source Control',
      icon: <GitBranch size={16} />,
      action: () => {
        setActiveTab('sourceControl');
        setCommandPaletteOpen(false);
      },
      category: 'View',
    },
    {
      id: 'agent',
      label: 'Show AI Agent',
      icon: <Bot size={16} />,
      action: () => {
        setActiveTab('agent');
        setCommandPaletteOpen(false);
      },
      category: 'View',
    },
    {
      id: 'trash',
      label: 'Show Trash',
      icon: <Trash2 size={16} />,
      action: () => {
        setActiveTab('trash');
        setCommandPaletteOpen(false);
      },
      category: 'View',
    },
    {
      id: 'documentation',
      label: 'Open Documentation',
      description: 'View in-app documentation',
      icon: <BookOpen size={16} />,
      action: () => {
        setActiveTab('documentation');
        setCommandPaletteOpen(false);
      },
      category: 'Help',
    },
    {
      id: 'settings',
      label: 'Open Settings',
      icon: <Settings size={16} />,
      action: () => {
        setActiveTab('settings');
        setCommandPaletteOpen(false);
      },
      category: 'Preferences',
    },
    {
      id: 'terminal',
      label: 'New Terminal',
      icon: <Terminal size={16} />,
      action: () => {
        setActiveTab('run');
        setCommandPaletteOpen(false);
      },
      category: 'Terminal',
    },
  ];

  // Add extension commands (deduplicated by command ID)
  const allExtCommands = extensionService.getAvailableCommands();
  const uniqueExtCommands = allExtCommands.filter((cmd, index, self) =>
    index === self.findIndex(c => c.command === cmd.command)
  );
  const extensionCommands: Command[] = uniqueExtCommands.map(cmd => ({
    id: cmd.command,
    label: cmd.category ? `${cmd.category}: ${cmd.title}` : cmd.title,
    description: `Extension: ${cmd.extensionName}`,
    icon: <Puzzle size={16} />,
    action: () => {
      addNotification({
        type: 'info',
        title: 'Extension Command',
        message: `Command "${cmd.title}" requires extension runtime support.`,
      });
      setCommandPaletteOpen(false);
    },
    category: cmd.extensionName,
  }));

  const allCommands = [...commands, ...extensionCommands];

  // Filter commands based on query
  const filteredCommands = allCommands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description?.toLowerCase().includes(query.toLowerCase()) ||
      cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  // Search files when in file mode
  useEffect(() => {
    if (mode === 'files' && query.length > 0) {
      const searchFiles = async () => {
        // Simple search - in production, you'd want fuzzy matching
        const result = await api.list('.', true, false);
        if (result.ok && result.data) {
          const matches = result.data.entries
            .filter(
              (e) =>
                e.type === 'file' && e.name.toLowerCase().includes(query.toLowerCase())
            )
            .slice(0, 10)
            .map((e) => ({ path: e.path, name: e.name }));
          setFileResults(matches);
        }
      };
      searchFiles();
    } else {
      setFileResults([]);
    }
  }, [query, mode]);

  // Reset on open/close
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setMode('commands');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [commandPaletteOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!commandPaletteOpen) return;

      const items = mode === 'files' ? fileResults : filteredCommands;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (mode === 'files' && fileResults[selectedIndex]) {
          openFileByPath(fileResults[selectedIndex].path);
        } else if (mode === 'commands' && filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (mode === 'files') {
          setMode('commands');
          setQuery('');
        } else {
          setCommandPaletteOpen(false);
        }
      } else if (e.key === 'Backspace' && query === '' && mode === 'files') {
        setMode('commands');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    commandPaletteOpen,
    mode,
    filteredCommands,
    fileResults,
    selectedIndex,
    setCommandPaletteOpen,
  ]);

  const openFileByPath = async (path: string) => {
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
        setCommandPaletteOpen(false);
      } else {
        addNotification({
          type: 'error',
          title: 'Failed to open file',
          message: result.error?.message || 'Unknown error',
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

  if (!commandPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15%] bg-black/50"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="w-[600px] max-w-[90%] bg-[#252526] rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#3E3E42]">
          <Search size={16} className="text-[#858585]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={mode === 'files' ? 'Search files...' : 'Type a command...'}
            className="flex-1 bg-transparent border-none outline-none text-sm text-[#CCCCCC] placeholder-[#858585]"
          />
          {mode === 'files' && (
            <span className="text-xs text-[#858585] bg-[#3E3E42] px-2 py-0.5 rounded">
              ESC to go back
            </span>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto">
          {mode === 'files' ? (
            fileResults.length > 0 ? (
              fileResults.map((file, i) => (
                <div
                  key={file.path}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                    i === selectedIndex ? 'bg-[#094771]' : 'hover:bg-[#2A2D2E]'
                  }`}
                  onClick={() => openFileByPath(file.path)}
                >
                  <File size={16} className="text-[#858585]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#CCCCCC] truncate">{file.name}</p>
                    <p className="text-xs text-[#858585] truncate">{file.path}</p>
                  </div>
                </div>
              ))
            ) : query.length > 0 ? (
              <div className="px-3 py-4 text-center text-sm text-[#858585]">
                No files found
              </div>
            ) : (
              <div className="px-3 py-4 text-center text-sm text-[#858585]">
                Type to search files
              </div>
            )
          ) : filteredCommands.length > 0 ? (
            filteredCommands.map((cmd, i) => (
              <div
                key={cmd.id}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                  i === selectedIndex ? 'bg-[#094771]' : 'hover:bg-[#2A2D2E]'
                }`}
                onClick={() => cmd.action()}
              >
                <span className="text-[#858585]">{cmd.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#CCCCCC]">{cmd.label}</p>
                  {cmd.description && (
                    <p className="text-xs text-[#858585]">{cmd.description}</p>
                  )}
                </div>
                <span className="text-xs text-[#606060]">{cmd.category}</span>
              </div>
            ))
          ) : (
            <div className="px-3 py-4 text-center text-sm text-[#858585]">
              No commands found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
