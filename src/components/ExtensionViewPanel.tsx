import { useState, useEffect } from 'react';
import { Package, Command, Info, ExternalLink, Settings, Puzzle, Play, Loader2, CheckCircle2 } from 'lucide-react';
import { extensionService } from '../services/extensionService';
import { extensionRuntime } from '../services/extensionRuntime';
import { ViewContainerContribution, ViewContribution, CommandContribution } from '../services/api';
import { useStore } from '../hooks/useStore';
import ExtensionWebview from './ExtensionWebview';

interface ExtensionViewPanelProps {
  containerId: string;
  container?: ViewContainerContribution;
}

type ViewMode = 'info' | 'webview' | 'commands';

export default function ExtensionViewPanel({ containerId, container }: ExtensionViewPanelProps) {
  const { addNotification, installedApps } = useStore();
  const [views, setViews] = useState<ViewContribution[]>([]);
  const [commands, setCommands] = useState<CommandContribution[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('webview');
  const [isActivating, setIsActivating] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [extensionPath, setExtensionPath] = useState<string | undefined>();
  const [executingCommand, setExecutingCommand] = useState<string | null>(null);

  // Find extension path from installed apps
  useEffect(() => {
    if (!container?.extensionId) return;

    // Check installed apps for the extension path
    const app = installedApps.find(
      a => a.extensionId === container.extensionId || a.id === container.extensionId
    );

    if (app?.extensionPath) {
      setExtensionPath(app.extensionPath);
    }
  }, [container?.extensionId, installedApps]);

  useEffect(() => {
    // Load views for this container (deduplicate by ID)
    const containerViews = extensionService.getViewsForContainer(containerId);
    const uniqueViews = containerViews.filter((view, index, self) =>
      index === self.findIndex(v => v.id === view.id)
    );
    setViews(uniqueViews);

    // Load commands for this extension (deduplicate by command)
    if (container?.extensionId) {
      const extCommands = extensionService.getCommandsByExtension(container.extensionId);
      const uniqueCommands = extCommands.filter((cmd, index, self) =>
        index === self.findIndex(c => c.command === cmd.command)
      );
      setCommands(uniqueCommands);

      // Check if extension is already active
      setIsActive(extensionRuntime.isExtensionActive(container.extensionId));
    }
  }, [containerId, container?.extensionId]);

  // Activate extension
  const activateExtension = async () => {
    if (!container?.extensionId || !extensionPath) {
      addNotification({
        type: 'warning',
        title: 'Cannot Activate',
        message: 'Extension path not found. Try reinstalling the extension.',
      });
      return;
    }

    setIsActivating(true);
    try {
      const success = await extensionRuntime.activateExtension(container.extensionId, extensionPath);
      if (success) {
        setIsActive(true);
        addNotification({
          type: 'success',
          title: 'Extension Activated',
          message: `${container.extensionName} is now active`,
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Activation Failed',
          message: 'Could not activate the extension',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Activation Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    setIsActivating(false);
  };

  const executeCommand = async (command: CommandContribution) => {
    setExecutingCommand(command.command);
    try {
      // Try to execute through runtime
      await extensionRuntime.executeCommand(command.command);
      addNotification({
        type: 'success',
        title: 'Command Executed',
        message: `Executed: ${command.title}`,
      });
    } catch (error) {
      // Fallback notification
      addNotification({
        type: 'info',
        title: 'Extension Command',
        message: `Command "${command.title}" (${command.command}) requires the extension runtime to execute.`,
      });
    }
    setExecutingCommand(null);
  };

  return (
    <div className="flex h-full flex-col bg-[#1E1E1E]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#3E3E42]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {container?.icon ? (
              <img src={container.icon} alt="" className="h-5 w-5" />
            ) : (
              <Puzzle className="h-5 w-5 text-[#007ACC]" />
            )}
            <span className="font-medium">{container?.title || 'Extension View'}</span>
            {isActive && (
              <span className="flex items-center gap-1 text-xs bg-[#89D185]/20 text-[#89D185] px-2 py-0.5 rounded">
                <CheckCircle2 className="h-3 w-3" />
                Active
              </span>
            )}
          </div>

          {/* View mode tabs */}
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode('webview')}
              className={`px-2 py-1 text-xs rounded ${
                viewMode === 'webview'
                  ? 'bg-[#094771] text-white'
                  : 'text-[#858585] hover:bg-[#2A2D2E]'
              }`}
            >
              View
            </button>
            <button
              onClick={() => setViewMode('commands')}
              className={`px-2 py-1 text-xs rounded ${
                viewMode === 'commands'
                  ? 'bg-[#094771] text-white'
                  : 'text-[#858585] hover:bg-[#2A2D2E]'
              }`}
            >
              Commands
            </button>
            <button
              onClick={() => setViewMode('info')}
              className={`px-2 py-1 text-xs rounded ${
                viewMode === 'info'
                  ? 'bg-[#094771] text-white'
                  : 'text-[#858585] hover:bg-[#2A2D2E]'
              }`}
            >
              Info
            </button>
          </div>
        </div>
        {container && (
          <p className="text-xs text-[#858585] mt-1">
            Provided by {container.extensionName}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'webview' && (
          <div className="h-full">
            {!container?.extensionId ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-[#858585]">
                <Puzzle className="h-16 w-16 mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2 text-[#CCCCCC]">Extension Not Found</h3>
                <p className="text-sm text-center max-w-md">
                  Could not load extension information. Try clicking the extension icon in the sidebar again.
                </p>
                <p className="text-xs mt-4 text-[#606060]">
                  Container ID: {containerId}
                </p>
              </div>
            ) : !isActive ? (
              <div className="flex flex-col items-center justify-center h-full p-6">
                <Puzzle className="h-16 w-16 text-[#007ACC] mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">{container.title}</h3>
                <p className="text-sm text-[#858585] text-center mb-6 max-w-md">
                  Activate this extension to use its features. Once activated, the extension
                  can provide custom views, commands, and functionality.
                </p>
                <button
                  onClick={activateExtension}
                  disabled={isActivating || !extensionPath}
                  className="flex items-center gap-2 px-6 py-2 bg-[#0E639C] hover:bg-[#1177BB] disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
                >
                  {isActivating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Activating...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Activate Extension
                    </>
                  )}
                </button>
                {!extensionPath && (
                  <p className="text-xs text-[#F48771] mt-3">
                    Extension path not found. The extension may need to be reinstalled.
                  </p>
                )}
              </div>
            ) : (
              <ExtensionWebview
                extensionId={container.extensionId}
                extensionPath={extensionPath}
                viewType={containerId}
                title={container.title}
              />
            )}
          </div>
        )}

        {viewMode === 'commands' && (
          <div className="overflow-y-auto p-4 h-full">
            {commands.length > 0 ? (
              <div className="space-y-2">
                {commands.map((cmd, index) => (
                  <button
                    key={`${cmd.command}-${index}`}
                    onClick={() => executeCommand(cmd)}
                    disabled={executingCommand === cmd.command}
                    className="w-full bg-[#252526] border border-[#3E3E42] rounded-lg p-3 text-left hover:border-[#007ACC] transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">
                          {cmd.category ? `${cmd.category}: ` : ''}
                          {cmd.title}
                        </span>
                        <p className="text-xs text-[#858585] mt-0.5 font-mono">
                          {cmd.command}
                        </p>
                      </div>
                      {executingCommand === cmd.command ? (
                        <Loader2 className="h-4 w-4 text-[#007ACC] animate-spin" />
                      ) : (
                        <Command className="h-4 w-4 text-[#858585]" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[#858585]">
                <Command className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">No commands available</p>
              </div>
            )}
          </div>
        )}

        {viewMode === 'info' && (
          <div className="overflow-y-auto p-4 h-full">
            {/* Info Message */}
            <div className="bg-[#252526] border border-[#3E3E42] rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-[#007ACC] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-[#CCCCCC] mb-2">
                    This extension provides custom views and functionality for SentinelOps.
                  </p>
                  <p className="text-xs text-[#858585]">
                    Extensions run in a sandboxed environment with access to a subset of the
                    VSCode API. Some advanced features may have limited functionality.
                  </p>
                </div>
              </div>
            </div>

            {/* Views Section */}
            {views.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-[#858585] mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Views ({views.length})
                </h3>
                <div className="space-y-2">
                  {views.map((view, index) => (
                    <div
                      key={`${view.id}-${index}`}
                      className="bg-[#252526] border border-[#3E3E42] rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium">{view.name}</span>
                          <p className="text-xs text-[#858585] mt-0.5 font-mono">
                            {view.id}
                          </p>
                        </div>
                        {view.when && (
                          <span className="text-xs bg-[#3C3C3C] px-2 py-1 rounded text-[#858585]">
                            when: {view.when}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Extension Details */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-[#858585] mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Details
              </h3>
              <div className="bg-[#252526] border border-[#3E3E42] rounded-lg p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-[#858585]">Extension ID</span>
                  <span className="text-xs font-mono">{container?.extensionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[#858585]">Container ID</span>
                  <span className="text-xs font-mono">{containerId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[#858585]">Status</span>
                  <span className={`text-xs ${isActive ? 'text-[#89D185]' : 'text-[#858585]'}`}>
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {extensionPath && (
                  <div className="flex justify-between">
                    <span className="text-xs text-[#858585]">Path</span>
                    <span className="text-xs font-mono truncate max-w-[200px]" title={extensionPath}>
                      {extensionPath}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Links */}
            <div className="space-y-2">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  addNotification({
                    type: 'info',
                    title: 'Extension Settings',
                    message: 'Extension settings can be configured in Settings > Extensions',
                  });
                }}
                className="flex items-center gap-2 text-sm text-[#007ACC] hover:underline"
              >
                <Settings className="h-4 w-4" />
                Configure Extension Settings
              </a>

              {container?.extensionId && (
                <a
                  href={`https://open-vsx.org/extension/${container.extensionId.split('.')[0]}/${container.extensionId.split('.').slice(1).join('.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#007ACC] hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  View on Open-VSX
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
