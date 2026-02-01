import { useState, useEffect } from 'react';
import { useStore, TabType } from '../hooks/useStore';
import { Files, Search, GitBranch, Play, Bot, Trash2, Settings, Package, Database, BookOpen, Grid3X3, Puzzle } from 'lucide-react';
import { extensionService } from '../services/extensionService';
import { ViewContainerContribution } from '../services/api';

interface SidebarItem {
  id: TabType | string;
  icon: React.ReactNode;
  label: string;
  requiresAi?: boolean;
  isExtension?: boolean;
  extensionContainer?: ViewContainerContribution;
}

const coreSidebarItems: SidebarItem[] = [
  { id: 'files', icon: <Files size={24} />, label: 'Explorer' },
  { id: 'search', icon: <Search size={24} />, label: 'Search' },
  { id: 'sourceControl', icon: <GitBranch size={24} />, label: 'Source Control' },
  { id: 'run', icon: <Play size={24} />, label: 'Run & Debug' },
  { id: 'extensions', icon: <Package size={24} />, label: 'Extensions' },
  { id: 'apps', icon: <Grid3X3 size={24} />, label: 'Applications' },
  { id: 'sqlite', icon: <Database size={24} />, label: 'SQLite Browser' },
  { id: 'agent', icon: <Bot size={24} />, label: 'AI Agent', requiresAi: true },
];

const bottomItems: SidebarItem[] = [
  { id: 'documentation', icon: <BookOpen size={24} />, label: 'Documentation' },
  { id: 'trash', icon: <Trash2 size={24} />, label: 'Trash' },
  { id: 'settings', icon: <Settings size={24} />, label: 'Settings' },
];

export default function Sidebar() {
  const { activeTab, setActiveTab, settings, installedApps, setActiveExtensionContainer } = useStore();
  const [extensionContainers, setExtensionContainers] = useState<ViewContainerContribution[]>([]);

  // Load extension view containers - only for apps the user has added
  useEffect(() => {
    const loadContainers = async () => {
      await extensionService.loadContributions();
      const containers = extensionService.getActivityBarContainers();
      // Deduplicate by container ID (same extension may be in multiple directories)
      const uniqueContainers = containers.filter((container, index, self) =>
        index === self.findIndex(c => c.id === container.id)
      );
      // Only show containers for extensions the user has added via Applications panel
      const addedExtensionIds = installedApps.map(app => app.extensionId || app.id);
      const filteredContainers = uniqueContainers.filter(container =>
        addedExtensionIds.some(id =>
          container.extensionId === id ||
          container.extensionId.toLowerCase() === id.toLowerCase()
        )
      );
      setExtensionContainers(filteredContainers);
    };
    loadContainers();
  }, [installedApps]);

  // Build sidebar items including extension containers
  const visibleSidebarItems = coreSidebarItems.filter(item => !item.requiresAi || settings.aiEnabled);

  // Create extension sidebar items
  const extensionSidebarItems: SidebarItem[] = extensionContainers.map(container => ({
    id: `ext:${container.id}`,
    icon: container.icon ? (
      <img src={container.icon} alt="" className="w-6 h-6" />
    ) : (
      <Puzzle size={24} />
    ),
    label: container.title,
    isExtension: true,
    extensionContainer: container,
  }));

  const handleTabClick = (item: SidebarItem) => {
    if (item.isExtension && item.extensionContainer) {
      // Store the active extension container in Zustand store
      setActiveExtensionContainer(item.extensionContainer);
    } else {
      setActiveExtensionContainer(null);
    }
    setActiveTab(item.id as TabType);
  };

  const isActive = (itemId: string) => {
    return activeTab === itemId || (activeTab as string) === itemId;
  };

  return (
    <aside className="flex flex-col w-12 border-r border-[#3E3E42]" style={{ backgroundColor: 'var(--activity-bar-bg)' }}>
      {/* Main items */}
      <div className="flex flex-col items-center py-2 flex-1">
        {visibleSidebarItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabClick(item)}
            className={`
              w-12 h-12 flex items-center justify-center
              transition-colors relative group
              ${
                isActive(item.id)
                  ? 'text-white border-l-2 border-white bg-[#37373D]'
                  : 'text-[#858585] hover:text-white border-l-2 border-transparent'
              }
            `}
            title={item.label}
          >
            {item.icon}
            {/* Tooltip */}
            <span className="absolute left-14 px-2 py-1 bg-[#252526] text-sm text-white rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
              {item.label}
            </span>
          </button>
        ))}

        {/* Extension view containers - with separator if there are any */}
        {extensionSidebarItems.length > 0 && (
          <>
            <div className="w-8 h-px bg-[#3E3E42] my-2" />
            {extensionSidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabClick(item)}
                className={`
                  w-12 h-12 flex items-center justify-center
                  transition-colors relative group
                  ${
                    isActive(item.id)
                      ? 'text-white border-l-2 border-white bg-[#37373D]'
                      : 'text-[#858585] hover:text-white border-l-2 border-transparent'
                  }
                `}
                title={item.label}
              >
                {item.icon}
                {/* Tooltip with extension badge */}
                <span className="absolute left-14 px-2 py-1 bg-[#252526] text-sm text-white rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity flex items-center gap-2">
                  {item.label}
                  <span className="text-xs bg-[#094771] text-[#75BEFF] px-1.5 py-0.5 rounded">ext</span>
                </span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Bottom items */}
      <div className="flex flex-col items-center py-2 border-t border-[#3E3E42]">
        {bottomItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabClick(item)}
            className={`
              w-12 h-12 flex items-center justify-center
              transition-colors relative group
              ${
                isActive(item.id)
                  ? 'text-white border-l-2 border-white bg-[#37373D]'
                  : 'text-[#858585] hover:text-white border-l-2 border-transparent'
              }
            `}
            title={item.label}
          >
            {item.icon}
            {/* Tooltip */}
            <span className="absolute left-14 px-2 py-1 bg-[#252526] text-sm text-white rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
