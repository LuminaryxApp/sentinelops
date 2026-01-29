import { useState, useEffect, useRef } from 'react';
import { useStore, getLanguageFromFilename } from '../hooks/useStore';
import { api, FileEntry } from '../services/api';
import { extensionService } from '../services/extensionService';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  RefreshCw,
  FileText,
  FolderPlus,
  FilePlus,
  X,
  FolderInput,
  Trash2,
  Pencil,
  Copy,
  Clipboard,
  Scissors,
  FileSymlink,
  FolderSymlink,
  ExternalLink,
} from 'lucide-react';
import { openFolderPicker } from './FolderPicker';
import ContextMenu, { ContextMenuItem } from './ContextMenu';

// Clipboard state for copy/cut operations
let clipboardEntry: { entry: FileEntry; operation: 'copy' | 'cut' } | null = null;

interface FileTreeItemProps {
  entry: FileEntry;
  level: number;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  onRefresh: () => void;
}

function FileTreeItem({ entry, level, onContextMenu, onRefresh }: FileTreeItemProps) {
  const {
    expandedFolders,
    toggleFolder,
    openFile,
    activeFile,
    addNotification,
    iconThemeVersion,
  } = useStore();

  const isExpanded = expandedFolders.has(entry.path);
  const isDirectory = entry.type === 'directory';
  const [folderContents, setFolderContents] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(entry.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Load folder contents when expanded
  useEffect(() => {
    if (isDirectory && isExpanded && folderContents.length === 0) {
      setLoading(true);
      api.list(entry.path, false, false).then((result) => {
        if (result.ok && result.data) {
          setFolderContents(result.data.entries);
        }
        setLoading(false);
      });
    }
  }, [isExpanded, isDirectory, entry.path, folderContents.length]);

  // Focus rename input when renaming
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      // Select filename without extension
      const dotIndex = entry.name.lastIndexOf('.');
      if (dotIndex > 0 && !isDirectory) {
        renameInputRef.current.setSelectionRange(0, dotIndex);
      } else {
        renameInputRef.current.select();
      }
    }
  }, [isRenaming, entry.name, isDirectory]);

  // Check if file is an image
  const isImageFile = (filename: string): boolean => {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif'];
    const lower = filename.toLowerCase();
    return imageExtensions.some(ext => lower.endsWith(ext));
  };

  const handleClick = async () => {
    if (isRenaming) return;

    if (isDirectory) {
      toggleFolder(entry.path);
    } else {
      // Open file
      try {
        if (isImageFile(entry.name)) {
          const result = await api.readBinary(entry.path);
          if (result.ok && result.data) {
            openFile({
              path: entry.path,
              name: entry.name,
              content: result.data.content,
              originalContent: result.data.content,
              language: 'image',
              isDirty: false,
            });
          } else {
            addNotification({
              type: 'error',
              title: 'Failed to open image',
              message: result.error?.message || 'Unknown error',
            });
          }
        } else {
          const result = await api.read(entry.path);
          if (result.ok && result.data) {
            openFile({
              path: entry.path,
              name: entry.name,
              content: result.data.content,
              originalContent: result.data.content,
              language: getLanguageFromFilename(entry.name),
              isDirty: false,
            });
          } else {
            addNotification({
              type: 'error',
              title: 'Failed to open file',
              message: result.error?.message || 'Unknown error',
            });
          }
        }
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Failed to open file',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  };

  const handleRename = async () => {
    if (!newName.trim() || newName === entry.name) {
      setIsRenaming(false);
      setNewName(entry.name);
      return;
    }

    const parentPath = entry.path.substring(0, entry.path.lastIndexOf(entry.name));
    const newPath = parentPath + newName;

    try {
      const result = await api.move(entry.path, newPath);
      if (result.ok) {
        addNotification({ type: 'success', title: 'Renamed', message: `${entry.name} → ${newName}` });
        onRefresh();
      } else {
        addNotification({ type: 'error', title: 'Rename failed', message: result.error?.message || 'Unknown error' });
      }
    } catch (error) {
      addNotification({ type: 'error', title: 'Rename failed', message: error instanceof Error ? error.message : 'Unknown error' });
    }

    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setIsRenaming(false);
      setNewName(entry.name);
    }
  };

  const isActive = activeFile === entry.path;

  return (
    <div>
      <div
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, entry)}
        className={`file-item ${isActive ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {/* Expand/collapse arrow for directories */}
        {isDirectory ? (
          <span className="w-4 h-4 flex items-center justify-center text-[#858585]">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        ) : (
          <span className="w-4" />
        )}

        {/* Icon */}
        <span className="text-[#C5C5C5]">
          <FileIcon key={`${entry.name}-${iconThemeVersion}`} name={entry.name} isDirectory={isDirectory} isExpanded={isExpanded} />
        </span>

        {/* Name or rename input */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRename}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-[#3C3C3C] px-1 text-sm rounded border border-[#007ACC] outline-none"
          />
        ) : (
          <span className="flex-1 truncate text-sm">{entry.name}</span>
        )}
      </div>

      {/* Children */}
      {isDirectory && isExpanded && (
        <div>
          {loading ? (
            <div
              className="text-xs text-[#858585] py-1"
              style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
            >
              Loading...
            </div>
          ) : (
            folderContents
              .sort((a, b) => {
                if (a.type === 'directory' && b.type !== 'directory') return -1;
                if (a.type !== 'directory' && b.type === 'directory') return 1;
                return a.name.localeCompare(b.name);
              })
              .map((child) => (
                <FileTreeItem
                  key={child.path}
                  entry={child}
                  level={level + 1}
                  onContextMenu={onContextMenu}
                  onRefresh={onRefresh}
                />
              ))
          )}
        </div>
      )}
    </div>
  );
}

// Cache for loaded extension icons
const iconCache = new Map<string, string>();

// Component to display extension icons
function ExtensionIcon({ iconPath, size = 16 }: { iconPath: string; size?: number }) {
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadIcon = async () => {
      if (iconCache.has(iconPath)) {
        setIconDataUrl(iconCache.get(iconPath) || null);
        setLoading(false);
        return;
      }

      try {
        const result = await api.loadExtensionIcon(iconPath);
        if (cancelled) return;

        if (result.ok && result.data) {
          iconCache.set(iconPath, result.data);
          setIconDataUrl(result.data);
          setError(false);
        } else {
          setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      }
      if (!cancelled) setLoading(false);
    };

    setLoading(true);
    setError(false);
    loadIcon();

    return () => {
      cancelled = true;
    };
  }, [iconPath]);

  if (loading || error || !iconDataUrl) {
    return null;
  }

  return (
    <img
      src={iconDataUrl}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      onError={() => setError(true)}
    />
  );
}

function FileIcon({ name, isDirectory = false, isExpanded = false }: { name: string; isDirectory?: boolean; isExpanded?: boolean }) {
  const extensionIcon = extensionService.getFileIcon(name, isDirectory, isExpanded);

  if (extensionIcon) {
    return <ExtensionIcon iconPath={extensionIcon.iconPath} size={16} />;
  }

  if (isDirectory) {
    return isExpanded ? (
      <FolderOpen size={16} className="text-[#DCB67A]" />
    ) : (
      <Folder size={16} className="text-[#DCB67A]" />
    );
  }

  const ext = name.split('.').pop()?.toLowerCase() || '';

  const iconColors: Record<string, string> = {
    ts: '#3178C6',
    tsx: '#3178C6',
    js: '#F7DF1E',
    jsx: '#F7DF1E',
    json: '#CBB079',
    md: '#519ABA',
    css: '#563D7C',
    scss: '#CD6799',
    html: '#E34C26',
    py: '#3776AB',
    rs: '#DEA584',
    go: '#00ADD8',
    java: '#B07219',
    toml: '#9C4121',
    yaml: '#CB171E',
    yml: '#CB171E',
  };

  const color = iconColors[ext] || '#C5C5C5';

  return <FileText size={16} style={{ color }} />;
}

export default function FileBrowser() {
  const { files, setFiles, loadingFiles, setLoadingFiles, workspaceRoot, addNotification, openFile, closeFile } = useStore();
  const [showNewInput, setShowNewInput] = useState<'file' | 'folder' | null>(null);
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null);

  const refreshFiles = async () => {
    setLoadingFiles(true);
    const result = await api.list('.', false, false);
    if (result.ok && result.data) {
      setFiles(result.data.entries);
    }
    setLoadingFiles(false);
  };

  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const handleDelete = async (entry: FileEntry) => {
    const isDir = entry.type === 'directory';
    const confirmMsg = isDir
      ? `Delete folder "${entry.name}" and all its contents?`
      : `Delete file "${entry.name}"?`;

    if (!confirm(confirmMsg)) return;

    try {
      const result = await api.delete(entry.path, { recursive: isDir });
      if (result.ok) {
        addNotification({ type: 'success', title: 'Deleted', message: entry.name });
        closeFile(entry.path);
        refreshFiles();
      } else {
        addNotification({ type: 'error', title: 'Delete failed', message: result.error?.message || 'Unknown error' });
      }
    } catch (error) {
      addNotification({ type: 'error', title: 'Delete failed', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const handleCopy = (entry: FileEntry) => {
    clipboardEntry = { entry, operation: 'copy' };
    addNotification({ type: 'info', title: 'Copied', message: entry.name });
  };

  const handleCut = (entry: FileEntry) => {
    clipboardEntry = { entry, operation: 'cut' };
    addNotification({ type: 'info', title: 'Cut', message: entry.name });
  };

  const handlePaste = async (targetFolder: FileEntry) => {
    if (!clipboardEntry) {
      addNotification({ type: 'warning', title: 'Nothing to paste', message: 'Copy or cut a file first' });
      return;
    }

    const { entry: sourceEntry, operation } = clipboardEntry;
    const targetPath = `${targetFolder.path}/${sourceEntry.name}`;

    try {
      if (operation === 'copy') {
        const result = await api.copy(sourceEntry.path, targetPath);
        if (result.ok) {
          addNotification({ type: 'success', title: 'Copied', message: `${sourceEntry.name} → ${targetFolder.name}` });
          refreshFiles();
        } else {
          addNotification({ type: 'error', title: 'Copy failed', message: result.error?.message || 'Unknown error' });
        }
      } else {
        const result = await api.move(sourceEntry.path, targetPath);
        if (result.ok) {
          addNotification({ type: 'success', title: 'Moved', message: `${sourceEntry.name} → ${targetFolder.name}` });
          clipboardEntry = null;
          refreshFiles();
        } else {
          addNotification({ type: 'error', title: 'Move failed', message: result.error?.message || 'Unknown error' });
        }
      }
    } catch (error) {
      addNotification({ type: 'error', title: 'Paste failed', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const handleCopyPath = (entry: FileEntry, relative: boolean = false) => {
    const pathToCopy = relative ? entry.path : `${workspaceRoot}/${entry.path}`;
    navigator.clipboard.writeText(pathToCopy);
    addNotification({ type: 'info', title: 'Path copied', message: pathToCopy });
  };

  const handleRevealInExplorer = async (entry: FileEntry) => {
    // This would need a Tauri command to open in file explorer
    // For now, just copy the path
    const fullPath = `${workspaceRoot}/${entry.path}`;
    navigator.clipboard.writeText(fullPath);
    addNotification({ type: 'info', title: 'Path copied', message: 'Open your file explorer and navigate to this path' });
  };

  const getContextMenuItems = (entry: FileEntry): ContextMenuItem[] => {
    const isDir = entry.type === 'directory';

    const items: ContextMenuItem[] = [];

    if (!isDir) {
      items.push({
        label: 'Open',
        icon: <FileText size={14} />,
        onClick: () => {
          // Trigger file open
          api.read(entry.path).then(result => {
            if (result.ok && result.data) {
              openFile({
                path: entry.path,
                name: entry.name,
                content: result.data.content,
                originalContent: result.data.content,
                language: getLanguageFromFilename(entry.name),
                isDirty: false,
              });
            }
          });
        },
      });
      items.push({ separator: true, label: '' });
    }

    if (isDir) {
      items.push({
        label: 'New File',
        icon: <FilePlus size={14} />,
        shortcut: '',
        onClick: () => {
          const fileName = prompt('New file name:');
          if (fileName) {
            const filePath = `${entry.path}/${fileName}`;
            api.write(filePath, '', { createDirs: true }).then(result => {
              if (result.ok) {
                addNotification({ type: 'success', title: 'File created', message: fileName });
                refreshFiles();
                openFile({
                  path: filePath,
                  name: fileName,
                  content: '',
                  originalContent: '',
                  language: getLanguageFromFilename(fileName),
                  isDirty: false,
                });
              }
            });
          }
        },
      });
      items.push({
        label: 'New Folder',
        icon: <FolderPlus size={14} />,
        onClick: () => {
          const folderName = prompt('New folder name:');
          if (folderName) {
            api.mkdir(`${entry.path}/${folderName}`).then(result => {
              if (result.ok) {
                addNotification({ type: 'success', title: 'Folder created', message: folderName });
                refreshFiles();
              }
            });
          }
        },
      });
      items.push({ separator: true, label: '' });
    }

    items.push({
      label: 'Cut',
      icon: <Scissors size={14} />,
      shortcut: 'Ctrl+X',
      onClick: () => handleCut(entry),
    });
    items.push({
      label: 'Copy',
      icon: <Copy size={14} />,
      shortcut: 'Ctrl+C',
      onClick: () => handleCopy(entry),
    });

    if (isDir) {
      items.push({
        label: 'Paste',
        icon: <Clipboard size={14} />,
        shortcut: 'Ctrl+V',
        disabled: !clipboardEntry,
        onClick: () => handlePaste(entry),
      });
    }

    items.push({ separator: true, label: '' });

    items.push({
      label: 'Copy Path',
      icon: <FileSymlink size={14} />,
      onClick: () => handleCopyPath(entry, false),
    });
    items.push({
      label: 'Copy Relative Path',
      icon: <FolderSymlink size={14} />,
      onClick: () => handleCopyPath(entry, true),
    });

    items.push({ separator: true, label: '' });

    items.push({
      label: 'Rename',
      icon: <Pencil size={14} />,
      shortcut: 'F2',
      onClick: () => {
        // Find and trigger rename on the item - we'll use a different approach
        const newNameInput = prompt('New name:', entry.name);
        if (newNameInput && newNameInput !== entry.name) {
          const parentPath = entry.path.substring(0, entry.path.lastIndexOf(entry.name));
          const newPath = parentPath + newNameInput;
          api.move(entry.path, newPath).then(result => {
            if (result.ok) {
              addNotification({ type: 'success', title: 'Renamed', message: `${entry.name} → ${newNameInput}` });
              refreshFiles();
            } else {
              addNotification({ type: 'error', title: 'Rename failed', message: result.error?.message || 'Unknown error' });
            }
          });
        }
      },
    });
    items.push({
      label: 'Delete',
      icon: <Trash2 size={14} />,
      shortcut: 'Del',
      danger: true,
      onClick: () => handleDelete(entry),
    });

    items.push({ separator: true, label: '' });

    items.push({
      label: 'Reveal in File Explorer',
      icon: <ExternalLink size={14} />,
      onClick: () => handleRevealInExplorer(entry),
    });

    return items;
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;

    try {
      if (showNewInput === 'folder') {
        const result = await api.mkdir(newName.trim());
        if (result.ok) {
          addNotification({ type: 'success', title: 'Folder created', message: newName });
          refreshFiles();
        } else {
          addNotification({ type: 'error', title: 'Failed to create folder', message: result.error?.message || 'Unknown error' });
        }
      } else {
        const result = await api.write(newName.trim(), '', { createDirs: true });
        if (result.ok) {
          addNotification({ type: 'success', title: 'File created', message: newName });
          refreshFiles();
          openFile({
            path: newName.trim(),
            name: newName.trim().split(/[/\\]/).pop() || newName.trim(),
            content: '',
            originalContent: '',
            language: getLanguageFromFilename(newName.trim()),
            isDirty: false,
          });
        } else {
          addNotification({ type: 'error', title: 'Failed to create file', message: result.error?.message || 'Unknown error' });
        }
      }
    } catch (error) {
      addNotification({ type: 'error', title: 'Error', message: error instanceof Error ? error.message : String(error) });
    }

    setShowNewInput(null);
    setNewName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    } else if (e.key === 'Escape') {
      setShowNewInput(null);
      setNewName('');
    }
  };

  useEffect(() => {
    if (showNewInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showNewInput]);

  const sortedFiles = [...files].sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--sidebar-bg)' }}>
      {/* Header */}
      <div className="panel-header">
        <span>Explorer</span>
        <div className="flex gap-1">
          <button
            onClick={async () => {
              const selected = await openFolderPicker({
                title: 'Open Folder',
                defaultPath: workspaceRoot,
              });
              if (selected) {
                const result = await api.setWorkspace(selected);
                if (result.ok && result.data) {
                  useStore.getState().setServerInfo({
                    workspace: result.data.workspaceRoot,
                    llmConfigured: useStore.getState().llmConfigured,
                    llmProvider: useStore.getState().llmProvider,
                    llmModel: useStore.getState().llmModel,
                  });
                  refreshFiles();
                  addNotification({ type: 'success', title: 'Folder Opened', message: selected });
                }
              }
            }}
            className="p-1 hover:bg-[#3E3E42] rounded"
            title="Open Folder"
          >
            <FolderInput size={14} />
          </button>
          <button
            onClick={refreshFiles}
            className="p-1 hover:bg-[#3E3E42] rounded"
            title="Refresh"
          >
            <RefreshCw size={14} className={loadingFiles ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowNewInput('file')}
            className="p-1 hover:bg-[#3E3E42] rounded"
            title="New File"
          >
            <FilePlus size={14} />
          </button>
          <button
            onClick={() => setShowNewInput('folder')}
            className="p-1 hover:bg-[#3E3E42] rounded"
            title="New Folder"
          >
            <FolderPlus size={14} />
          </button>
        </div>
      </div>

      {/* Workspace name */}
      <div
        onClick={async () => {
          const selected = await openFolderPicker({
            title: 'Select Workspace Folder',
            defaultPath: workspaceRoot,
          });
          if (selected) {
            const result = await api.setWorkspace(selected);
            if (result.ok && result.data) {
              useStore.getState().setServerInfo({
                workspace: result.data.workspaceRoot,
                llmConfigured: useStore.getState().llmConfigured,
                llmProvider: useStore.getState().llmProvider,
                llmModel: useStore.getState().llmModel,
              });
              refreshFiles();
              addNotification({ type: 'success', title: 'Workspace Changed', message: selected });
            }
          }
        }}
        className="px-3 py-2 text-xs text-[#858585] uppercase tracking-wider border-b border-[#3E3E42] cursor-pointer hover:bg-[#2A2D2E] flex items-center gap-2 group"
        title={`Current: ${workspaceRoot}\nClick to change workspace`}
      >
        <FolderInput size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="flex-1 truncate">{workspaceRoot?.split(/[/\\]/).pop() || 'Workspace'}</span>
      </div>

      {/* New file/folder input */}
      {showNewInput && (
        <div className="px-2 py-2 border-b border-[#3E3E42] flex items-center gap-2">
          {showNewInput === 'folder' ? (
            <FolderPlus size={16} className="text-[#DCB67A]" />
          ) : (
            <FilePlus size={16} className="text-[#858585]" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (!newName.trim()) {
                setShowNewInput(null);
              }
            }}
            placeholder={showNewInput === 'folder' ? 'folder name' : 'file name'}
            className="flex-1 bg-[#3C3C3C] px-2 py-1 text-xs rounded border border-[#007ACC] outline-none"
          />
          <button
            onClick={() => {
              setShowNewInput(null);
              setNewName('');
            }}
            className="p-1 hover:bg-[#3E3E42] rounded"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {loadingFiles ? (
          <div className="flex items-center justify-center py-8">
            <div className="spinner" />
          </div>
        ) : sortedFiles.length === 0 ? (
          <div className="text-center text-sm text-[#858585] py-8">
            No files found
          </div>
        ) : (
          sortedFiles.map((entry) => (
            <FileTreeItem
              key={entry.path}
              entry={entry}
              level={0}
              onContextMenu={handleContextMenu}
              onRefresh={refreshFiles}
            />
          ))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.entry)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
