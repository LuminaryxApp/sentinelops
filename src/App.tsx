import { useEffect, useState, useRef, useCallback } from 'react';
import { useStore, matchShortcut } from './hooks/useStore';
import { api } from './services/api';
import { authService } from './services/authService';
import { extensionService } from './services/extensionService';
import MenuBar from './components/MenuBar';
import Sidebar from './components/Sidebar';
import FileBrowser from './components/FileBrowser';
import EditorArea from './components/EditorArea';
import StatusBar from './components/StatusBar';
import Notifications from './components/Notifications';
import CommandPalette from './components/CommandPalette';
import RecentFilesModal from './components/RecentFilesModal';
import BottomPanel from './components/BottomPanel';
import SearchPanel from './components/SearchPanel';
import GitPanel from './components/GitPanel';
import TrashPanel from './components/TrashPanel';
import SettingsPanel from './components/SettingsPanel';
import AgentPanel from './components/AgentPanel';
import ExtensionsPanel from './components/ExtensionsPanel';
import AppsPanel from './components/AppsPanel';
import ExtensionViewPanel from './components/ExtensionViewPanel';
import SqlitePanel from './components/SqlitePanel';
import DocumentationPanel from './components/DocumentationPanel';
import SetupWizard from './components/SetupWizard';
import ContextMenu, { type ContextMenuItem } from './components/ContextMenu';

function App() {
  const {
    activeTab,
    setServerInfo,
    setConnected,
    setFiles,
    addNotification,
    setLoadingFiles,
    showSetupWizard,
    setShowSetupWizard,
    setAuthUser,
    setCommandPaletteOpen,
    setRecentFilesOpen,
    setActiveTab,
    keyboardShortcuts,
    activeFile,
    closeFile,
    activeExtensionContainer,
  } = useStore();

  // Global right-click context menu (works on every screen except where local menu handles it)
  const [globalContextMenu, setGlobalContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Resizable bottom panel state
  const [bottomPanelHeight, setBottomPanelHeight] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Show setup wizard only on first launch
  useEffect(() => {
    const setupComplete = localStorage.getItem('sentinelops_setup_complete');
    if (!setupComplete) {
      setShowSetupWizard(true);
    }
  }, [setShowSetupWizard]);

  // Handle mouse down on resize handle
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newHeight = containerRect.bottom - e.clientY;

      // Constrain height between 100px and 80% of container height
      const minHeight = 100;
      const maxHeight = containerRect.height * 0.8;
      const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

      setBottomPanelHeight(constrainedHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Initialize app
  useEffect(() => {
    async function init() {
      try {
        // Restore auth session so user stays logged in across restarts
        await authService.initialize();
        const user = authService.getUser();
        if (user) setAuthUser(user);

        // Get config from Tauri backend
        const health = await api.health();

        if (health.ok && health.data) {
          setConnected(true);
          setServerInfo({
            port: 0,
            workspace: health.data.workspace,
            llmConfigured: health.data.qwen?.configured ?? false,
            llmProvider: health.data.qwen?.provider,
            llmModel: health.data.qwen?.model,
            llmBaseUrl: health.data.qwen?.baseUrl,
          });

          // Load initial files
          setLoadingFiles(true);
          const files = await api.list('.', false, false);
          if (files.ok && files.data) {
            setFiles(files.data.entries);
          }
          setLoadingFiles(false);

          // Load extension contributions
          const contributions = await extensionService.loadContributions();
          console.log('Extension contributions loaded:', {
            themes: contributions.themes.map(t => ({ id: t.id, label: t.label, ext: t.extensionId })),
            iconThemes: contributions.iconThemes.map(t => ({ id: t.id, label: t.label, ext: t.extensionId })),
          });

          // Apply saved theme if set
          const settings = useStore.getState().settings;
          console.log('Current theme settings:', { colorTheme: settings.colorTheme, iconTheme: settings.iconTheme });

          if (settings.colorTheme) {
            const theme = contributions.themes.find(t =>
              `${t.extensionId}:${t.id}` === settings.colorTheme ||
              t.id === settings.colorTheme
            );
            if (theme) {
              const colors = await extensionService.loadTheme(theme);
              if (colors) {
                extensionService.applyTheme(colors);
                console.log('Applied saved theme:', theme.label);
              }
            } else {
              console.warn('Saved theme not found:', settings.colorTheme);
            }
          } else if (contributions.themes.length > 0) {
            // Notify user that themes are available
            addNotification({
              type: 'info',
              title: 'Themes Available',
              message: `${contributions.themes.length} color themes available. Go to Settings to select one.`,
            });
          }

          // Load saved icon theme if set
          if (settings.iconTheme) {
            const iconTheme = contributions.iconThemes.find(t =>
              `${t.extensionId}:${t.id}` === settings.iconTheme ||
              t.id === settings.iconTheme
            );
            if (iconTheme) {
              await extensionService.loadIconTheme(iconTheme);
              useStore.getState().incrementIconThemeVersion();
              console.log('Loaded icon theme:', iconTheme.label);
            } else {
              console.warn('Saved icon theme not found:', settings.iconTheme);
            }
          } else if (contributions.iconThemes.length > 0) {
            // Notify user that icon themes are available
            addNotification({
              type: 'info',
              title: 'Icon Themes Available',
              message: `${contributions.iconThemes.length} icon themes available. Go to Settings to select one.`,
            });
          }
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
        addNotification({
          type: 'error',
          title: 'Initialization Failed',
          message: 'Could not connect to the backend',
        });
      }
    }

    init();
  }, [setServerInfo, setConnected, setFiles, addNotification, setLoadingFiles]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const store = useStore.getState();
      const shortcuts = store.keyboardShortcuts;

      // Command palette
      if (matchShortcut(e, shortcuts.commandPalette)) {
        e.preventDefault();
        store.setCommandPaletteOpen(true);
        return;
      }

      // Recent files
      if (matchShortcut(e, shortcuts.recentFiles)) {
        e.preventDefault();
        store.setRecentFilesOpen(true);
        return;
      }

      // Save (handled by EditorArea but we prevent default)
      if (matchShortcut(e, shortcuts.save)) {
        e.preventDefault();
        // Save is handled by EditorArea
        return;
      }

      // Find in files
      if (matchShortcut(e, shortcuts.findInFiles)) {
        e.preventDefault();
        store.setActiveTab('search');
        return;
      }

      // Source control
      if (matchShortcut(e, shortcuts.sourceControl)) {
        e.preventDefault();
        store.setActiveTab('sourceControl');
        return;
      }

      // Extensions
      if (matchShortcut(e, shortcuts.extensions)) {
        e.preventDefault();
        store.setActiveTab('extensions');
        return;
      }

      // Split editor
      if (matchShortcut(e, shortcuts.splitEditor)) {
        e.preventDefault();
        const current = store.splitDirection;
        if (current) {
          store.closeSplit();
        } else {
          store.splitEditor('vertical');
        }
        return;
      }

      // Close tab
      if (matchShortcut(e, shortcuts.closeTab)) {
        e.preventDefault();
        const activeFile = store.activeFile;
        if (activeFile) {
          store.closeFile(activeFile);
        }
        return;
      }

      // Toggle terminal
      if (matchShortcut(e, shortcuts.toggleTerminal)) {
        e.preventDefault();
        // Toggle to run tab
        if (store.activeTab === 'run') {
          store.setActiveTab('files');
        } else {
          store.setActiveTab('run');
        }
        return;
      }

      // Toggle sidebar
      if (matchShortcut(e, shortcuts.toggleSidebar)) {
        e.preventDefault();
        // Toggle between files and current tab
        if (store.activeTab === 'agent') {
          store.setActiveTab('files');
        }
        return;
      }

      // Next/prev tab navigation
      if (matchShortcut(e, shortcuts.nextTab)) {
        e.preventDefault();
        const openFiles = store.openFiles;
        const activeFile = store.activeFile;
        if (openFiles.length > 1 && activeFile) {
          const currentIndex = openFiles.findIndex(f => f.path === activeFile);
          const nextIndex = (currentIndex + 1) % openFiles.length;
          store.setActiveFile(openFiles[nextIndex].path);
        }
        return;
      }

      if (matchShortcut(e, shortcuts.prevTab)) {
        e.preventDefault();
        const openFiles = store.openFiles;
        const activeFile = store.activeFile;
        if (openFiles.length > 1 && activeFile) {
          const currentIndex = openFiles.findIndex(f => f.path === activeFile);
          const prevIndex = (currentIndex - 1 + openFiles.length) % openFiles.length;
          store.setActiveFile(openFiles[prevIndex].path);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showBottomPanel = ['files', 'run'].includes(activeTab);
  const showEditorWithSidebar = ['files', 'search', 'sourceControl'].includes(activeTab);
  const isFullPanelView = ['agent', 'extensions', 'apps', 'settings', 'trash', 'sqlite', 'documentation'].includes(activeTab) || (activeTab as string).startsWith('ext:');

  // Global right-click: show context menu unless a child (e.g. file tree) already handled it
  const handleGlobalContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setGlobalContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const globalContextMenuItems: ContextMenuItem[] = [
    { label: 'Command Palette', shortcut: keyboardShortcuts.commandPalette, onClick: () => setCommandPaletteOpen(true) },
    { label: 'Open Recent', shortcut: keyboardShortcuts.recentFiles, onClick: () => setRecentFilesOpen(true) },
    { separator: true },
    { label: 'Find in Files', shortcut: keyboardShortcuts.findInFiles, onClick: () => setActiveTab('search') },
    { label: 'Source Control', shortcut: keyboardShortcuts.sourceControl, onClick: () => setActiveTab('sourceControl') },
    { label: 'Toggle Terminal', shortcut: keyboardShortcuts.toggleTerminal, onClick: () => setActiveTab(activeTab === 'run' ? 'files' : 'run') },
    { separator: true },
    { label: 'Save', shortcut: keyboardShortcuts.save, onClick: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })), disabled: !activeFile },
    { label: 'Close Tab', shortcut: keyboardShortcuts.closeTab, onClick: () => activeFile && closeFile(activeFile), disabled: !activeFile },
    { separator: true },
    { label: 'Agent', onClick: () => setActiveTab('agent') },
    { label: 'Extensions', shortcut: keyboardShortcuts.extensions, onClick: () => setActiveTab('extensions') },
    { label: 'Settings', onClick: () => setActiveTab('settings') },
  ];

  const renderSidePanel = () => {
    switch (activeTab) {
      case 'files':
        return <FileBrowser />;
      case 'search':
        return <SearchPanel />;
      case 'sourceControl':
        return <GitPanel />;
      default:
        return null;
    }
  };

  const renderMainContent = () => {
    if (isFullPanelView) {
      // Check if it's an extension tab
      if ((activeTab as string).startsWith('ext:')) {
        const containerId = (activeTab as string).replace('ext:', '');
        return <ExtensionViewPanel containerId={containerId} container={activeExtensionContainer ?? undefined} />;
      }

      switch (activeTab) {
        case 'agent':
          return <AgentPanel />;
        case 'extensions':
          return <ExtensionsPanel />;
        case 'apps':
          return <AppsPanel />;
        case 'settings':
          return <SettingsPanel />;
        case 'trash':
          return <TrashPanel />;
        case 'sqlite':
          return <SqlitePanel />;
        case 'documentation':
          return <DocumentationPanel />;
        default:
          return null;
      }
    }
    return <EditorArea />;
  };

  // Show setup wizard
  if (showSetupWizard) {
    return <SetupWizard onComplete={() => setShowSetupWizard(false)} />;
  }

  return (
    <div
      className="flex h-screen flex-col text-[#D4D4D4]"
      style={{ backgroundColor: 'var(--editor-bg)' }}
      onContextMenu={handleGlobalContextMenu}
    >
      {/* Menu bar */}
      <MenuBar />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Center + bottom layout */}
        <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden">
          {/* Main editor area */}
          <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            {/* Side panel (File browser, Search, Git) */}
            {showEditorWithSidebar && (
              <aside className="w-64 flex-shrink-0 border-r border-[#3E3E42] overflow-hidden">
                {renderSidePanel()}
              </aside>
            )}

            {/* Main content (Editor or full panel views) */}
            <main className="flex-1 overflow-hidden">
              {renderMainContent()}
            </main>
          </div>

          {/* Resizable bottom panel */}
          {showBottomPanel && (
            <>
              <div
                onMouseDown={handleMouseDown}
                className="resizer-horizontal"
                style={{
                  backgroundColor: isResizing ? '#007ACC' : '#3E3E42',
                }}
                title="Drag to resize"
              />

              <div style={{ height: `${bottomPanelHeight}px`, minHeight: '100px' }}>
                <BottomPanel />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status bar */}
      <StatusBar />

      {/* Notifications */}
      <Notifications />

      {/* Command Palette */}
      <CommandPalette />

      {/* Recent Files Modal */}
      <RecentFilesModal />

      {/* Global right-click context menu */}
      {globalContextMenu && (
        <ContextMenu
          x={globalContextMenu.x}
          y={globalContextMenu.y}
          items={globalContextMenuItems}
          onClose={() => setGlobalContextMenu(null)}
        />
      )}
    </div>
  );
}

export default App;
