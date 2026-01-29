import { useStore } from '../hooks/useStore';
import { GitBranch, CheckCircle, AlertCircle, WifiOff } from 'lucide-react';

export default function StatusBar() {
  const { connected, llmConfigured, openFiles, activeFile, gitBranch } = useStore();

  const activeOpenFile = openFiles.find((f) => f.path === activeFile);

  // Get line/column info (placeholder - would need Monaco editor integration)
  const lineCol = 'Ln 1, Col 1';

  return (
    <footer className="flex items-center justify-between h-6 px-2 bg-[#007ACC] text-white text-xs">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Connection status */}
        {connected ? (
          <span className="flex items-center gap-1">
            <CheckCircle size={12} />
            Connected
          </span>
        ) : (
          <span className="flex items-center gap-1 text-yellow-200">
            <WifiOff size={12} />
            Disconnected
          </span>
        )}

        {/* Git branch */}
        {gitBranch && (
          <span className="flex items-center gap-1">
            <GitBranch size={12} />
            {gitBranch}
          </span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* LLM status */}
        {llmConfigured ? (
          <span className="flex items-center gap-1">
            <CheckCircle size={12} />
            AI Ready
          </span>
        ) : (
          <span className="flex items-center gap-1 opacity-70">
            <AlertCircle size={12} />
            AI Not Configured
          </span>
        )}

        {/* File info */}
        {activeOpenFile && (
          <>
            <span>{lineCol}</span>
            <span className="uppercase">{activeOpenFile.language}</span>
            <span>UTF-8</span>
          </>
        )}

        {/* App name */}
        <span className="font-medium">SentinelOps</span>
      </div>
    </footer>
  );
}
