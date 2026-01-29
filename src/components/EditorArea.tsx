import { useEffect, useRef, useState, useCallback } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { useStore, OpenFile } from '../hooks/useStore';
import { api } from '../services/api';
import { extensionService } from '../services/extensionService';
import {
  X,
  Circle,
  Image,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Columns,
  Rows,
  Eye,
  List,
  PanelRightClose,
} from 'lucide-react';
import Breadcrumbs from './Breadcrumbs';
import SymbolOutline from './SymbolOutline';
import MarkdownPreview from './MarkdownPreview';

// Image file extensions
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif'];

function isImageFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function isMarkdownFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ['.md', '.markdown', '.mdx'].some(ext => lower.endsWith(ext));
}

function getMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.avif')) return 'image/avif';
  return 'image/png';
}

// Editor Pane Component
interface EditorPaneProps {
  files: OpenFile[];
  activeFilePath: string | null;
  onFileSelect: (path: string) => void;
  onFileClose: (path: string) => void;
  onContentChange: (path: string, content: string) => void;
  settings: any;
  isSecondary?: boolean;
  onMoveToOtherPane?: (path: string) => void;
}

function EditorPane({
  files,
  activeFilePath,
  onFileSelect,
  onFileClose,
  onContentChange,
  settings,
  isSecondary,
  onMoveToOtherPane,
}: EditorPaneProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const activeFile = files.find((f) => f.path === activeFilePath);

  const [imageZoom, setImageZoom] = useState(100);
  const [imageRotation, setImageRotation] = useState(0);

  const handleEditorMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && activeFilePath) {
      onContentChange(activeFilePath, value);
    }
  };

  if (files.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1E1E1E] text-[#858585]">
        <p className="text-sm">{isSecondary ? 'Drag a tab here or open a file' : 'No files open'}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1E1E1E]">
      {/* Tab bar */}
      <div className="flex bg-[#252526] overflow-x-auto border-b border-[#3E3E42]">
        {files.map((file) => (
          <div
            key={file.path}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', file.path);
            }}
            className={`editor-tab ${activeFilePath === file.path ? 'active' : ''}`}
            onClick={() => onFileSelect(file.path)}
            onDoubleClick={() => onMoveToOtherPane?.(file.path)}
          >
            {file.isDirty ? (
              <Circle size={8} className="text-white fill-white" />
            ) : (
              <span className="w-2" />
            )}
            <span className="text-sm truncate max-w-[120px]">{file.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFileClose(file.path);
              }}
              className="p-0.5 hover:bg-[#3E3E42] rounded ml-1"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-hidden">
        {activeFile && isImageFile(activeFile.name) ? (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 px-4 py-2 bg-[#252526] border-b border-[#3E3E42]">
              <Image className="h-4 w-4 text-[#858585]" />
              <span className="text-sm text-[#858585]">Image Preview</span>
              <div className="flex-1" />
              <button onClick={() => setImageZoom(z => Math.max(10, z - 25))} className="p-1.5 hover:bg-[#3E3E42] rounded">
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-xs text-[#858585] w-12 text-center">{imageZoom}%</span>
              <button onClick={() => setImageZoom(z => Math.min(500, z + 25))} className="p-1.5 hover:bg-[#3E3E42] rounded">
                <ZoomIn className="h-4 w-4" />
              </button>
              <button onClick={() => setImageRotation(r => (r + 90) % 360)} className="p-1.5 hover:bg-[#3E3E42] rounded">
                <RotateCw className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4">
              <img
                src={`data:${getMimeType(activeFile.name)};base64,${activeFile.content}`}
                alt={activeFile.name}
                style={{
                  transform: `scale(${imageZoom / 100}) rotate(${imageRotation}deg)`,
                  transition: 'transform 0.2s ease',
                }}
              />
            </div>
          </div>
        ) : activeFile ? (
          <Editor
            height="100%"
            language={activeFile.language}
            value={activeFile.content}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              minimap: { enabled: settings.minimap },
              fontSize: settings.fontSize,
              lineNumbers: 'on',
              wordWrap: settings.wordWrap ? 'on' : 'off',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              tabSize: settings.tabSize,
              cursorBlinking: 'smooth',
              smoothScrolling: true,
              padding: { top: 10 },
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function EditorArea() {
  const {
    openFiles,
    activeFile,
    setActiveFile,
    closeFile,
    updateFileContent,
    markFileSaved,
    addNotification,
    settings,
    workspaceRoot,
    splitDirection,
    setSplitDirection,
    showSymbolOutline,
    setShowSymbolOutline,
    showMarkdownPreview,
    setShowMarkdownPreview,
  } = useStore();

  const registeredLanguagesRef = useRef<Set<string>>(new Set());
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeOpenFile = openFiles.find((f) => f.path === activeFile);

  // Split editor state - track which files are in which pane
  const [secondaryActiveFile, setSecondaryActiveFile] = useState<string | null>(null);
  const [secondaryFiles, setSecondaryFiles] = useState<string[]>([]);

  // Current symbol for breadcrumbs
  const [currentSymbol] = useState<string | undefined>();

  // Get files for each pane
  const primaryFiles = openFiles.filter(f => !secondaryFiles.includes(f.path));
  const secondaryOpenFiles = openFiles.filter(f => secondaryFiles.includes(f.path));

  // Auto-save functionality
  const saveFile = useCallback(async (file: OpenFile | undefined) => {
    if (!file || !file.isDirty) return;

    try {
      const result = await api.write(file.path, file.content, { overwrite: true });
      if (result.ok) {
        markFileSaved(file.path);
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [markFileSaved]);

  // Auto-save effect
  useEffect(() => {
    if (!settings.autoSave || !activeOpenFile?.isDirty) {
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      saveFile(activeOpenFile);
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [activeOpenFile?.content, activeOpenFile?.isDirty, settings.autoSave, saveFile, activeOpenFile]);

  // Manual save handler
  useEffect(() => {
    const handleSave = async (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (!activeOpenFile || !activeOpenFile.isDirty) return;

        try {
          const result = await api.write(activeOpenFile.path, activeOpenFile.content, { overwrite: true });
          if (result.ok) {
            markFileSaved(activeOpenFile.path);
            addNotification({ type: 'success', title: 'File saved', message: activeOpenFile.name });
          } else {
            addNotification({ type: 'error', title: 'Failed to save', message: result.error?.message || 'Unknown error' });
          }
        } catch (error) {
          addNotification({ type: 'error', title: 'Failed to save', message: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
    };

    window.addEventListener('keydown', handleSave);
    return () => window.removeEventListener('keydown', handleSave);
  }, [activeOpenFile, markFileSaved, addNotification]);

  // Register snippets
  useEffect(() => {
    const language = activeOpenFile?.language;
    if (!language || language === 'image' || registeredLanguagesRef.current.has(language)) return;

    const registerSnippets = async () => {
      const snippets = await extensionService.loadSnippetsForLanguage(language);
      if (snippets.length > 0) {
        registeredLanguagesRef.current.add(language);
      }
    };
    registerSnippets();
  }, [activeOpenFile?.language]);

  const handleSplit = (direction: 'horizontal' | 'vertical') => {
    if (activeFile && !splitDirection) {
      setSplitDirection(direction);
      // Move active file to secondary pane
      setSecondaryFiles([activeFile]);
      setSecondaryActiveFile(activeFile);
      // Set a different file as primary if available
      const otherFile = openFiles.find(f => f.path !== activeFile);
      if (otherFile) {
        setActiveFile(otherFile.path);
      }
    }
  };

  const handleCloseSplit = () => {
    setSplitDirection(null);
    setSecondaryFiles([]);
    setSecondaryActiveFile(null);
  };

  const handleMoveToSecondary = (path: string) => {
    if (splitDirection && !secondaryFiles.includes(path)) {
      setSecondaryFiles([...secondaryFiles, path]);
      setSecondaryActiveFile(path);
    }
  };

  const handleMoveToPrimary = (path: string) => {
    setSecondaryFiles(secondaryFiles.filter(f => f !== path));
    if (secondaryActiveFile === path) {
      setSecondaryActiveFile(secondaryFiles.find(f => f !== path) || null);
    }
    setActiveFile(path);
  };

  const handleSecondaryFileClose = (path: string) => {
    closeFile(path);
    setSecondaryFiles(secondaryFiles.filter(f => f !== path));
    if (secondaryActiveFile === path) {
      const remaining = secondaryFiles.filter(f => f !== path);
      setSecondaryActiveFile(remaining[0] || null);
    }
  };

  const navigateToLine = (_line: number) => {
    // This would need a ref to the active editor
  };

  if (openFiles.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#1E1E1E] text-[#858585]">
        <div className="text-6xl mb-4 opacity-20">{'</>'}</div>
        <h2 className="text-xl mb-2 font-light">SentinelOps</h2>
        <p className="text-sm opacity-60">Open a file to start editing</p>
        <div className="mt-8 text-xs opacity-40 space-y-1">
          <p><kbd className="px-1.5 py-0.5 bg-[#3C3C3C] rounded">Ctrl+P</kbd> Command palette</p>
          <p><kbd className="px-1.5 py-0.5 bg-[#3C3C3C] rounded">Ctrl+E</kbd> Recent files</p>
          <p><kbd className="px-1.5 py-0.5 bg-[#3C3C3C] rounded">Ctrl+S</kbd> Save</p>
        </div>
      </div>
    );
  }

  const showMdPreview = showMarkdownPreview && activeOpenFile && isMarkdownFile(activeOpenFile.name);

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--editor-bg)' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#252526] border-b border-[#3E3E42]">
        {/* Breadcrumbs */}
        <div className="flex-1 min-w-0">
          {activeOpenFile && (
            <Breadcrumbs
              path={activeOpenFile.path}
              workspaceRoot={workspaceRoot}
              currentSymbol={currentSymbol}
            />
          )}
        </div>

        {/* Editor actions */}
        <div className="flex items-center gap-1">
          {!splitDirection ? (
            <>
              <button
                onClick={() => handleSplit('vertical')}
                className="p-1.5 hover:bg-[#3E3E42] rounded text-[#858585] hover:text-[#CCCCCC]"
                title="Split Right (Ctrl+\)"
              >
                <Columns size={16} />
              </button>
              <button
                onClick={() => handleSplit('horizontal')}
                className="p-1.5 hover:bg-[#3E3E42] rounded text-[#858585] hover:text-[#CCCCCC]"
                title="Split Down"
              >
                <Rows size={16} />
              </button>
            </>
          ) : (
            <button
              onClick={handleCloseSplit}
              className="p-1.5 hover:bg-[#3E3E42] rounded text-[#858585] hover:text-[#CCCCCC]"
              title="Close Split"
            >
              <PanelRightClose size={16} />
            </button>
          )}

          <div className="w-px h-4 bg-[#3E3E42] mx-1" />

          {activeOpenFile && isMarkdownFile(activeOpenFile.name) && (
            <button
              onClick={() => setShowMarkdownPreview(!showMarkdownPreview)}
              className={`p-1.5 rounded ${showMarkdownPreview ? 'bg-[#094771] text-white' : 'text-[#858585] hover:text-[#CCCCCC] hover:bg-[#3E3E42]'}`}
              title="Toggle Preview"
            >
              <Eye size={16} />
            </button>
          )}

          <button
            onClick={() => setShowSymbolOutline(!showSymbolOutline)}
            className={`p-1.5 rounded ${showSymbolOutline ? 'bg-[#094771] text-white' : 'text-[#858585] hover:text-[#CCCCCC] hover:bg-[#3E3E42]'}`}
            title="Toggle Outline"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Editor content area */}
      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 flex ${splitDirection === 'horizontal' ? 'flex-col' : 'flex-row'} overflow-hidden`}>
          {/* Primary pane */}
          <div className={`${splitDirection ? 'flex-1' : 'flex-1'} flex overflow-hidden min-w-0 min-h-0`}>
            <div className="flex-1 overflow-hidden">
              <EditorPane
                files={primaryFiles}
                activeFilePath={activeFile}
                onFileSelect={setActiveFile}
                onFileClose={closeFile}
                onContentChange={updateFileContent}
                settings={settings}
                onMoveToOtherPane={splitDirection ? handleMoveToSecondary : undefined}
              />
            </div>

            {/* Markdown preview (side by side with primary) */}
            {showMdPreview && activeOpenFile && (
              <div className="flex-1 border-l border-[#3E3E42] min-w-0">
                <MarkdownPreview
                  content={activeOpenFile.content}
                  onClose={() => setShowMarkdownPreview(false)}
                />
              </div>
            )}
          </div>

          {/* Resizer */}
          {splitDirection && (
            <div
              className={`${splitDirection === 'horizontal' ? 'h-1 cursor-row-resize' : 'w-1 cursor-col-resize'} bg-[#3E3E42] hover:bg-[#007ACC] transition-colors`}
            />
          )}

          {/* Secondary pane */}
          {splitDirection && (
            <div className="flex-1 overflow-hidden min-w-0 min-h-0">
              <EditorPane
                files={secondaryOpenFiles}
                activeFilePath={secondaryActiveFile}
                onFileSelect={setSecondaryActiveFile}
                onFileClose={handleSecondaryFileClose}
                onContentChange={updateFileContent}
                settings={settings}
                isSecondary
                onMoveToOtherPane={handleMoveToPrimary}
              />
            </div>
          )}
        </div>

        {/* Symbol outline panel */}
        {showSymbolOutline && activeOpenFile && !isImageFile(activeOpenFile.name) && (
          <div className="w-56 border-l border-[#3E3E42]">
            <SymbolOutline
              content={activeOpenFile.content}
              language={activeOpenFile.language}
              onNavigate={navigateToLine}
              onClose={() => setShowSymbolOutline(false)}
            />
          </div>
        )}
      </div>

      {/* Auto-save indicator */}
      {settings.autoSave && activeOpenFile?.isDirty && (
        <div className="absolute bottom-4 right-4 text-xs text-[#858585] bg-[#252526] px-2 py-1 rounded border border-[#3E3E42]">
          Auto-saving...
        </div>
      )}
    </div>
  );
}
