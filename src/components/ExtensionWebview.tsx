import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, AlertCircle, RefreshCw, Bot, ExternalLink } from 'lucide-react';
import { extensionRuntime, WebviewPanel } from '../services/extensionRuntime';
import { useStore } from '../hooks/useStore';

interface ExtensionWebviewProps {
  extensionId: string;
  extensionPath?: string;
  viewType?: string;
  title?: string;
}

export default function ExtensionWebview({
  extensionId,
  extensionPath,
  viewType,
  title,
}: ExtensionWebviewProps) {
  const { addNotification, setActiveTab } = useStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webviewHtml, setWebviewHtml] = useState<string | null>(null);
  const [webviewPanel, setWebviewPanel] = useState<WebviewPanel | null>(null);

  // Check if this is an AI/coding assistant extension
  const isAiExtension = extensionId.toLowerCase().includes('chatgpt') ||
    extensionId.toLowerCase().includes('copilot') ||
    extensionId.toLowerCase().includes('codex') ||
    extensionId.toLowerCase().includes('codeium') ||
    extensionId.toLowerCase().includes('tabnine');

  // Activate extension and set up webview
  useEffect(() => {
    const setupExtension = async () => {
      if (!extensionPath) {
        setError('Extension path not provided');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Activate the extension
        const activated = await extensionRuntime.activateExtension(extensionId, extensionPath);

        if (!activated) {
          setError('Failed to activate extension');
          setIsLoading(false);
          return;
        }

        // Check for existing webview panels
        const panels = extensionRuntime.getWebviewPanelsForExtension(extensionId);
        if (panels.length > 0) {
          const panel = panels[0];
          setWebviewPanel(panel);
          if (panel.html) {
            setWebviewHtml(panel.html);
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Extension setup error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsLoading(false);
      }
    };

    setupExtension();
  }, [extensionId, extensionPath]);

  // Listen for webview HTML changes
  useEffect(() => {
    const handleHtmlChanged = (...args: unknown[]) => {
      const [panelId, html] = args as [string, string];
      if (webviewPanel?.id === panelId) {
        setWebviewHtml(html);
      }
    };

    const handleWebviewCreated = (...args: unknown[]) => {
      const [, panel] = args as [string, WebviewPanel];
      if (panel.extensionId === extensionId) {
        setWebviewPanel(panel);
        if (panel.html) {
          setWebviewHtml(panel.html);
        }
      }
    };

    const handleMessage = (...args: unknown[]) => {
      const [type, message] = args as [string, string];
      if (type === 'info') {
        addNotification({ type: 'info', title: 'Extension', message });
      } else if (type === 'warning') {
        addNotification({ type: 'warning', title: 'Extension Warning', message });
      } else if (type === 'error') {
        addNotification({ type: 'error', title: 'Extension Error', message });
      }
    };

    extensionRuntime.on('webview-html-changed', handleHtmlChanged);
    extensionRuntime.on('webview-created', handleWebviewCreated);
    extensionRuntime.on('show-message', handleMessage);

    return () => {
      extensionRuntime.off('webview-html-changed', handleHtmlChanged);
      extensionRuntime.off('webview-created', handleWebviewCreated);
      extensionRuntime.off('show-message', handleMessage);
    };
  }, [extensionId, webviewPanel, addNotification]);

  // Handle messages from iframe
  const handleIframeMessage = useCallback(
    (event: MessageEvent) => {
      if (webviewPanel && event.source === iframeRef.current?.contentWindow) {
        // Forward message to extension
        extensionRuntime.sendMessageToWebview(webviewPanel.id, event.data);
      }
    },
    [webviewPanel]
  );

  useEffect(() => {
    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, [handleIframeMessage]);

  // Process webview HTML to make it work in iframe
  const processedHtml = webviewHtml
    ? `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; font-src 'self' data: https:;">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          html, body {
            margin: 0;
            padding: 0;
            background: #1e1e1e;
            color: #cccccc;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            height: 100%;
          }
          * {
            box-sizing: border-box;
          }
        </style>
        <script>
          // Mock acquireVsCodeApi
          const vscode = {
            postMessage: (message) => {
              window.parent.postMessage(message, '*');
            },
            setState: (state) => {
              window.__vscodeState = state;
              localStorage.setItem('vscode-state-${extensionId}', JSON.stringify(state));
            },
            getState: () => {
              if (window.__vscodeState) return window.__vscodeState;
              try {
                return JSON.parse(localStorage.getItem('vscode-state-${extensionId}') || 'null');
              } catch {
                return null;
              }
            }
          };
          window.acquireVsCodeApi = () => vscode;

          // Listen for messages from parent
          window.addEventListener('message', (event) => {
            if (event.data && typeof window.onVsCodeMessage === 'function') {
              window.onVsCodeMessage(event.data);
            }
          });
        </script>
      </head>
      <body>
        ${webviewHtml}
      </body>
    </html>
  `
    : null;

  const reload = () => {
    setIsLoading(true);
    setError(null);
    setWebviewHtml(null);
    // Re-trigger setup
    if (extensionPath) {
      extensionRuntime.deactivateExtension(extensionId).then(() => {
        extensionRuntime.activateExtension(extensionId, extensionPath).then((activated) => {
          if (!activated) {
            setError('Failed to reload extension');
          }
          setIsLoading(false);
        });
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#1E1E1E] text-[#858585]">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p className="text-sm">Loading extension...</p>
        <p className="text-xs mt-1">{extensionId}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#1E1E1E] p-6">
        <AlertCircle className="h-12 w-12 text-[#F48771] mb-4" />
        <h3 className="text-lg font-medium mb-2">Extension Error</h3>
        <p className="text-sm text-[#858585] text-center mb-4">{error}</p>
        <button
          onClick={reload}
          className="flex items-center gap-2 px-4 py-2 bg-[#0E639C] hover:bg-[#1177BB] rounded text-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!processedHtml) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#1E1E1E] p-6 text-[#858585]">
        <div className="max-w-lg text-center">
          <h3 className="text-lg font-medium mb-2 text-[#CCCCCC]">
            {title || 'Extension View'}
          </h3>

          {isAiExtension ? (
            <>
              <div className="bg-[#252526] border border-[#3E3E42] rounded-lg p-4 mb-4">
                <p className="text-sm text-[#CCCCCC] mb-3">
                  This AI extension requires the full VSCode runtime and external authentication to function.
                </p>
                <p className="text-xs text-[#858585]">
                  SentinelOps has a built-in AI Agent that provides similar coding assistance without requiring external accounts.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('agent')}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#0E639C] hover:bg-[#1177BB] rounded text-sm font-medium transition-colors mx-auto"
              >
                <Bot className="h-4 w-4" />
                Use SentinelOps AI Agent
              </button>

              <p className="text-xs text-[#606060] mt-4">
                The AI Agent supports multiple models via OpenRouter and can read, write, and execute code.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm mb-4">
                This extension requires JavaScript execution to create its interface.
              </p>
              <div className="bg-[#252526] border border-[#3E3E42] rounded-lg p-4 mb-4">
                <p className="text-xs text-[#858585]">
                  VSCode extensions run Node.js code which cannot execute directly in the browser.
                  Extensions that provide themes, icons, or snippets work fully, but extensions
                  requiring runtime code have limited functionality.
                </p>
              </div>
              <a
                href={`https://open-vsx.org/extension/${extensionId.split('.')[0]}/${extensionId.split('.').slice(1).join('.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[#007ACC] hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                View on Open-VSX
              </a>
            </>
          )}

          <div className="mt-6 pt-4 border-t border-[#3E3E42] space-y-1">
            <p className="text-xs text-[#606060]">Extension ID: {extensionId}</p>
            {viewType && (
              <p className="text-xs text-[#606060]">View Type: {viewType}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      <iframe
        ref={iframeRef}
        srcDoc={processedHtml}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        title={title || extensionId}
      />
    </div>
  );
}
