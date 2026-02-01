import { useState, useRef, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';

const REPORT_ISSUE_URL = 'https://github.com/LuminaryxApp/sentinelops/issues/new';

interface MenuItem {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  separator?: boolean;
}

interface Menu {
  label: string;
  items: MenuItem[];
}

export default function MenuBar() {
  const {
    setActiveTab,
    setCommandPaletteOpen,
    activeFile,
    openFiles,
    closeFile,
    addNotification,
  } = useStore();

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleNewWindow = async () => {
    try {
      await invoke('create_new_window');
      setOpenMenu(null);
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to create new window',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleSave = async () => {
    setOpenMenu(null);
    // Trigger save via keyboard event simulation
    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  const handleCloseFile = () => {
    if (activeFile) {
      closeFile(activeFile);
    }
    setOpenMenu(null);
  };

  const menus: Menu[] = [
    {
      label: 'File',
      items: [
        {
          label: 'New File',
          shortcut: 'Ctrl+N',
          onClick: () => {
            setActiveTab('files');
            setOpenMenu(null);
          },
        },
        {
          label: 'New Window',
          shortcut: 'Ctrl+Shift+N',
          onClick: handleNewWindow,
        },
        { separator: true, label: '' },
        {
          label: 'Open Folder...',
          shortcut: 'Ctrl+K Ctrl+O',
          onClick: () => {
            setActiveTab('files');
            setOpenMenu(null);
          },
        },
        { separator: true, label: '' },
        {
          label: 'Save',
          shortcut: 'Ctrl+S',
          onClick: handleSave,
          disabled: !activeFile,
        },
        {
          label: 'Save All',
          shortcut: 'Ctrl+K S',
          onClick: () => {
            // TODO: Implement save all
            setOpenMenu(null);
          },
          disabled: openFiles.filter(f => f.isDirty).length === 0,
        },
        { separator: true, label: '' },
        {
          label: 'Close Editor',
          shortcut: 'Ctrl+W',
          onClick: handleCloseFile,
          disabled: !activeFile,
        },
        {
          label: 'Close All',
          shortcut: 'Ctrl+K Ctrl+W',
          onClick: () => {
            openFiles.forEach(f => closeFile(f.path));
            setOpenMenu(null);
          },
          disabled: openFiles.length === 0,
        },
        { separator: true, label: '' },
        {
          label: 'Exit',
          shortcut: 'Alt+F4',
          onClick: async () => {
            try {
              await invoke('exit_app');
            } catch (e) {
              console.error('Failed to exit:', e);
            }
          },
        },
      ],
    },
    {
      label: 'Edit',
      items: [
        {
          label: 'Undo',
          shortcut: 'Ctrl+Z',
          onClick: () => {
            document.execCommand('undo');
            setOpenMenu(null);
          },
        },
        {
          label: 'Redo',
          shortcut: 'Ctrl+Y',
          onClick: () => {
            document.execCommand('redo');
            setOpenMenu(null);
          },
        },
        { separator: true, label: '' },
        {
          label: 'Cut',
          shortcut: 'Ctrl+X',
          onClick: () => {
            document.execCommand('cut');
            setOpenMenu(null);
          },
        },
        {
          label: 'Copy',
          shortcut: 'Ctrl+C',
          onClick: () => {
            document.execCommand('copy');
            setOpenMenu(null);
          },
        },
        {
          label: 'Paste',
          shortcut: 'Ctrl+V',
          onClick: () => {
            document.execCommand('paste');
            setOpenMenu(null);
          },
        },
        { separator: true, label: '' },
        {
          label: 'Find',
          shortcut: 'Ctrl+F',
          onClick: () => {
            setOpenMenu(null);
            // Trigger find in editor
            const event = new KeyboardEvent('keydown', {
              key: 'f',
              ctrlKey: true,
              bubbles: true,
            });
            document.dispatchEvent(event);
          },
        },
        {
          label: 'Replace',
          shortcut: 'Ctrl+H',
          onClick: () => {
            setOpenMenu(null);
            const event = new KeyboardEvent('keydown', {
              key: 'h',
              ctrlKey: true,
              bubbles: true,
            });
            document.dispatchEvent(event);
          },
        },
        {
          label: 'Find in Files',
          shortcut: 'Ctrl+Shift+F',
          onClick: () => {
            setActiveTab('search');
            setOpenMenu(null);
          },
        },
      ],
    },
    {
      label: 'View',
      items: [
        {
          label: 'Command Palette',
          shortcut: 'Ctrl+Shift+P',
          onClick: () => {
            setCommandPaletteOpen(true);
            setOpenMenu(null);
          },
        },
        { separator: true, label: '' },
        {
          label: 'Explorer',
          shortcut: 'Ctrl+Shift+E',
          onClick: () => {
            setActiveTab('files');
            setOpenMenu(null);
          },
        },
        {
          label: 'Search',
          shortcut: 'Ctrl+Shift+F',
          onClick: () => {
            setActiveTab('search');
            setOpenMenu(null);
          },
        },
        {
          label: 'Source Control',
          shortcut: 'Ctrl+Shift+G',
          onClick: () => {
            setActiveTab('sourceControl');
            setOpenMenu(null);
          },
        },
        {
          label: 'Extensions',
          shortcut: 'Ctrl+Shift+X',
          onClick: () => {
            setActiveTab('extensions');
            setOpenMenu(null);
          },
        },
        { separator: true, label: '' },
        {
          label: 'AI Agent',
          onClick: () => {
            setActiveTab('agent');
            setOpenMenu(null);
          },
        },
        {
          label: 'SQLite Browser',
          onClick: () => {
            setActiveTab('sqlite');
            setOpenMenu(null);
          },
        },
        {
          label: 'Terminal',
          shortcut: 'Ctrl+`',
          onClick: () => {
            setActiveTab('run');
            setOpenMenu(null);
          },
        },
        { separator: true, label: '' },
        {
          label: 'Settings',
          shortcut: 'Ctrl+,',
          onClick: () => {
            setActiveTab('settings');
            setOpenMenu(null);
          },
        },
      ],
    },
    {
      label: 'Window',
      items: [
        {
          label: 'New Window',
          shortcut: 'Ctrl+Shift+N',
          onClick: handleNewWindow,
        },
        { separator: true, label: '' },
        {
          label: 'Minimize',
          onClick: async () => {
            try {
              await invoke('minimize_window');
            } catch (e) {
              console.error('Failed to minimize:', e);
            }
            setOpenMenu(null);
          },
        },
        {
          label: 'Maximize',
          onClick: async () => {
            try {
              await invoke('toggle_maximize');
            } catch (e) {
              console.error('Failed to maximize:', e);
            }
            setOpenMenu(null);
          },
        },
      ],
    },
    {
      label: 'Help',
      items: [
        {
          label: 'Documentation',
          onClick: () => {
            setActiveTab('documentation');
            setOpenMenu(null);
          },
        },
        {
          label: 'Report Issue',
          onClick: async () => {
            setOpenMenu(null);
            try {
              await open(REPORT_ISSUE_URL);
            } catch (e) {
              addNotification({
                type: 'error',
                title: 'Could not open report issue',
                message: e instanceof Error ? e.message : String(e),
              });
            }
          },
        },
        { separator: true, label: '' },
        {
          label: 'About',
          onClick: () => {
            addNotification({
              type: 'info',
              title: 'SentinelOps',
              message: 'A modern code editor built with Tauri and React',
            });
            setOpenMenu(null);
          },
        },
      ],
    },
  ];

  return (
    <div
      ref={menuBarRef}
      className="flex items-center h-8 bg-[#3C3C3C] border-b border-[#252526] select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* App icon/title area */}
      <div
        className="flex items-center gap-2 px-3 text-[#CCCCCC] text-sm"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
        </svg>
      </div>

      {/* Menu items */}
      <div
        className="flex items-center"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {menus.map((menu) => (
          <div key={menu.label} className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
              onMouseEnter={() => openMenu && setOpenMenu(menu.label)}
              className={`px-3 py-1 text-sm transition-colors ${
                openMenu === menu.label
                  ? 'bg-[#094771] text-white'
                  : 'text-[#CCCCCC] hover:bg-[#505050]'
              }`}
            >
              {menu.label}
            </button>

            {openMenu === menu.label && (
              <div className="absolute top-full left-0 z-50 min-w-[200px] bg-[#252526] border border-[#454545] rounded-md shadow-xl py-1">
                {menu.items.map((item, index) => {
                  if (item.separator) {
                    return <div key={index} className="h-px bg-[#454545] my-1 mx-2" />;
                  }

                  return (
                    <button
                      key={index}
                      onClick={item.onClick}
                      disabled={item.disabled}
                      className={`
                        w-full px-3 py-1.5 flex items-center justify-between text-left text-sm
                        ${item.disabled
                          ? 'text-[#6e6e6e] cursor-not-allowed'
                          : 'text-[#CCCCCC] hover:bg-[#094771]'
                        }
                        transition-colors
                      `}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <span className="text-xs text-[#858585] ml-6">{item.shortcut}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Spacer for window dragging */}
      <div className="flex-1" />

      {/* Window controls (for Windows/Linux) */}
      <div
        className="flex items-center"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={async () => {
            try {
              await invoke('minimize_window');
            } catch (e) {
              console.error('Minimize failed:', e);
            }
          }}
          className="w-12 h-8 flex items-center justify-center text-[#CCCCCC] hover:bg-[#505050] transition-colors"
          title="Minimize"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M14 8v1H2V8h12z" />
          </svg>
        </button>
        <button
          onClick={async () => {
            try {
              await invoke('toggle_maximize');
            } catch (e) {
              console.error('Maximize failed:', e);
            }
          }}
          className="w-12 h-8 flex items-center justify-center text-[#CCCCCC] hover:bg-[#505050] transition-colors"
          title="Maximize"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 3v10h10V3H3zm9 9H4V4h8v8z" />
          </svg>
        </button>
        <button
          onClick={async () => {
            try {
              await invoke('close_window');
            } catch (e) {
              console.error('Close failed:', e);
            }
          }}
          className="w-12 h-8 flex items-center justify-center text-[#CCCCCC] hover:bg-[#E81123] transition-colors"
          title="Close"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
