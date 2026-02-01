import { useStore } from '../hooks/useStore';
import {
  GitBranch,
  AlertCircle,
  Wifi,
  WifiOff,
  Cpu,
  Sparkles,
  FolderOpen,
  Bell,
  Settings
} from 'lucide-react';

export default function StatusBar() {
  const {
    connected,
    llmConfigured,
    openFiles,
    activeFile,
    gitBranch,
    notifications,
    setActiveTab
  } = useStore();

  const activeOpenFile = openFiles.find((f) => f.path === activeFile);

  // Get line/column info (placeholder - would need Monaco editor integration)
  const lineCol = 'Ln 1, Col 1';

  // Get workspace name from path
  const workspaceName = useStore.getState().workspaceRoot?.split(/[/\\]/).pop() || 'No Workspace';

  const openSettings = () => {
    setActiveTab('settings');
  };

  return (
    <footer className="flex items-center justify-between h-[22px] px-2 bg-[#181818] border-t border-[#2D2D2D] text-[11px] select-none">
      {/* Left side */}
      <div className="flex items-center gap-0.5">
        {/* Connection status */}
        <button
          onClick={openSettings}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-sm transition-colors ${
            connected
              ? 'text-[#89D185] hover:bg-[#89D185]/10'
              : 'text-[#CCA700] hover:bg-[#CCA700]/10'
          }`}
          title={connected ? 'Connected to backend' : 'Disconnected from backend'}
        >
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span>{connected ? 'Connected' : 'Offline'}</span>
        </button>

        {/* Separator */}
        <div className="w-px h-3 bg-[#3E3E42] mx-1" />

        {/* Git branch */}
        {gitBranch && (
          <button
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[#CCCCCC] hover:bg-[#2A2D2E] transition-colors"
            title={`Current branch: ${gitBranch}`}
          >
            <GitBranch size={12} />
            <span className="max-w-[120px] truncate">{gitBranch}</span>
          </button>
        )}

        {/* Workspace */}
        <button
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[#CCCCCC] hover:bg-[#2A2D2E] transition-colors"
          title="Current workspace"
        >
          <FolderOpen size={12} />
          <span className="max-w-[150px] truncate">{workspaceName}</span>
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-0.5">
        {/* Notifications */}
        {notifications.length > 0 && (
          <button
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[#CCA700] hover:bg-[#CCA700]/10 transition-colors"
            title={`${notifications.length} notification${notifications.length > 1 ? 's' : ''}`}
          >
            <Bell size={12} />
            <span>{notifications.length}</span>
          </button>
        )}

        {/* LLM status */}
        <button
          onClick={openSettings}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-sm transition-colors ${
            llmConfigured
              ? 'text-[#89D185] hover:bg-[#89D185]/10'
              : 'text-[#858585] hover:bg-[#2A2D2E]'
          }`}
          title={llmConfigured ? 'AI is configured and ready' : 'Click to configure AI'}
        >
          {llmConfigured ? (
            <>
              <Sparkles size={12} />
              <span>AI Ready</span>
            </>
          ) : (
            <>
              <AlertCircle size={12} />
              <span>Setup AI</span>
            </>
          )}
        </button>

        {/* Separator */}
        <div className="w-px h-3 bg-[#3E3E42] mx-1" />

        {/* File info */}
        {activeOpenFile && (
          <>
            <span className="px-2 py-0.5 text-[#858585]">{lineCol}</span>
            <span className="px-2 py-0.5 text-[#858585] uppercase">{activeOpenFile.language}</span>
            <span className="px-2 py-0.5 text-[#858585]">UTF-8</span>
            <div className="w-px h-3 bg-[#3E3E42] mx-1" />
          </>
        )}

        {/* Settings shortcut */}
        <button
          onClick={openSettings}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[#858585] hover:text-[#CCCCCC] hover:bg-[#2A2D2E] transition-colors"
          title="Settings"
        >
          <Settings size={12} />
        </button>

        {/* App branding */}
        <div className="flex items-center gap-1.5 pl-2 ml-1 border-l border-[#3E3E42]">
          <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-[#0078D4] to-[#00BCF2] flex items-center justify-center">
            <Cpu size={8} className="text-white" />
          </div>
          <span className="text-[#858585] font-medium tracking-wide">SentinelOps</span>
        </div>
      </div>
    </footer>
  );
}
