import { useStore, TabType } from '../hooks/useStore';
import { Files, Search, GitBranch, Play, Bot, Trash2, Settings, Package, Database } from 'lucide-react';

interface SidebarItem {
  id: TabType;
  icon: React.ReactNode;
  label: string;
  requiresAi?: boolean;
}

const sidebarItems: SidebarItem[] = [
  { id: 'files', icon: <Files size={24} />, label: 'Explorer' },
  { id: 'search', icon: <Search size={24} />, label: 'Search' },
  { id: 'sourceControl', icon: <GitBranch size={24} />, label: 'Source Control' },
  { id: 'run', icon: <Play size={24} />, label: 'Run & Debug' },
  { id: 'extensions', icon: <Package size={24} />, label: 'Extensions' },
  { id: 'sqlite', icon: <Database size={24} />, label: 'SQLite Browser' },
  { id: 'agent', icon: <Bot size={24} />, label: 'AI Agent', requiresAi: true },
];

const bottomItems: SidebarItem[] = [
  { id: 'trash', icon: <Trash2 size={24} />, label: 'Trash' },
  { id: 'settings', icon: <Settings size={24} />, label: 'Settings' },
];

export default function Sidebar() {
  const { activeTab, setActiveTab, settings } = useStore();

  // Filter sidebar items based on AI enabled state
  const visibleSidebarItems = sidebarItems.filter(item => !item.requiresAi || settings.aiEnabled);

  return (
    <aside className="flex flex-col w-12 border-r border-[#3E3E42]" style={{ backgroundColor: 'var(--activity-bar-bg)' }}>
      {/* Main items */}
      <div className="flex flex-col items-center py-2 flex-1">
        {visibleSidebarItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`
              w-12 h-12 flex items-center justify-center
              transition-colors relative group
              ${
                activeTab === item.id
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

      {/* Bottom items */}
      <div className="flex flex-col items-center py-2 border-t border-[#3E3E42]">
        {bottomItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`
              w-12 h-12 flex items-center justify-center
              transition-colors relative group
              ${
                activeTab === item.id
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
