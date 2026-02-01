// ============================================================================
// Extension Runtime - Executes VSCode extensions with a mock API
// ============================================================================

import { api } from './api';

// Types for the extension runtime
export interface ExtensionContext {
  extensionId: string;
  extensionPath: string;
  subscriptions: { dispose: () => void }[];
  workspaceState: Map<string, unknown>;
  globalState: Map<string, unknown>;
  extensionUri: { fsPath: string };
  storageUri: { fsPath: string };
  globalStorageUri: { fsPath: string };
}

export interface WebviewPanel {
  id: string;
  extensionId: string;
  viewType: string;
  title: string;
  html: string;
  options: {
    enableScripts?: boolean;
    localResourceRoots?: string[];
    retainContextWhenHidden?: boolean;
  };
  onDidReceiveMessage: (callback: (message: unknown) => void) => void;
  postMessage: (message: unknown) => Promise<boolean>;
  dispose: () => void;
  visible: boolean;
  active: boolean;
  webview: {
    html: string;
    options: unknown;
    onDidReceiveMessage: (callback: (message: unknown) => void) => void;
    postMessage: (message: unknown) => Promise<boolean>;
    asWebviewUri: (uri: { fsPath: string }) => { toString: () => string };
    cspSource: string;
  };
}

export interface RegisteredCommand {
  command: string;
  callback: (...args: unknown[]) => unknown;
  thisArg?: unknown;
}

export interface TreeDataProvider<T> {
  getTreeItem: (element: T) => unknown;
  getChildren: (element?: T) => Promise<T[]> | T[];
  onDidChangeTreeData?: unknown;
}

export interface RegisteredTreeView {
  viewId: string;
  provider: TreeDataProvider<unknown>;
}

// Active extension state
interface ActiveExtension {
  id: string;
  context: ExtensionContext;
  exports: unknown;
  webviewPanels: Map<string, WebviewPanel>;
  commands: Map<string, RegisteredCommand>;
  treeViews: Map<string, RegisteredTreeView>;
  messageHandlers: Map<string, ((message: unknown) => void)[]>;
}

class ExtensionRuntime {
  private activeExtensions: Map<string, ActiveExtension> = new Map();
  private globalCommands: Map<string, RegisteredCommand> = new Map();
  private webviewPanels: Map<string, WebviewPanel> = new Map();
  private webviewMessageListeners: Map<string, ((message: unknown) => void)[]> = new Map();
  private outputChannels: Map<string, string[]> = new Map();

  // Event emitter for UI updates
  private listeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();

  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, ...args: unknown[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(...args));
    }
  }

  // Create mock VSCode API for an extension
  private createVSCodeAPI(extensionId: string, extensionPath: string): unknown {
    const self = this;
    const extension = this.activeExtensions.get(extensionId);

    // Uri class mock
    class Uri {
      static file(path: string) {
        return { fsPath: path, scheme: 'file', path, toString: () => `file://${path}` };
      }
      static parse(uri: string) {
        return { fsPath: uri, scheme: 'file', path: uri, toString: () => uri };
      }
      static joinPath(base: { fsPath: string }, ...pathSegments: string[]) {
        const joined = [base.fsPath, ...pathSegments].join('/');
        return Uri.file(joined);
      }
    }

    // EventEmitter mock
    class EventEmitter<T> {
      private handlers: ((e: T) => void)[] = [];
      event = (handler: (e: T) => void) => {
        this.handlers.push(handler);
        return { dispose: () => this.handlers.splice(this.handlers.indexOf(handler), 1) };
      };
      fire(data: T) {
        this.handlers.forEach(h => h(data));
      }
      dispose() {
        this.handlers = [];
      }
    }

    // TreeItem mock
    class TreeItem {
      label: string;
      collapsibleState?: number;
      command?: unknown;
      iconPath?: unknown;
      contextValue?: string;
      description?: string;
      tooltip?: string;

      constructor(label: string, collapsibleState?: number) {
        this.label = label;
        this.collapsibleState = collapsibleState;
      }
    }

    const vscode = {
      // Enums
      TreeItemCollapsibleState: {
        None: 0,
        Collapsed: 1,
        Expanded: 2,
      },
      ViewColumn: {
        Active: -1,
        Beside: -2,
        One: 1,
        Two: 2,
        Three: 3,
      },
      StatusBarAlignment: {
        Left: 1,
        Right: 2,
      },
      ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3,
      },
      DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3,
      },
      EndOfLine: {
        LF: 1,
        CRLF: 2,
      },
      FileType: {
        Unknown: 0,
        File: 1,
        Directory: 2,
        SymbolicLink: 64,
      },

      // Classes
      Uri,
      EventEmitter,
      TreeItem,
      ThemeIcon: class ThemeIcon {
        id: string;
        color?: unknown;
        constructor(id: string, color?: unknown) {
          this.id = id;
          this.color = color;
        }
      },
      ThemeColor: class ThemeColor {
        id: string;
        constructor(id: string) {
          this.id = id;
        }
      },
      Range: class Range {
        start: unknown;
        end: unknown;
        constructor(startLine: number, startChar: number, endLine: number, endChar: number) {
          this.start = { line: startLine, character: startChar };
          this.end = { line: endLine, character: endChar };
        }
      },
      Position: class Position {
        line: number;
        character: number;
        constructor(line: number, character: number) {
          this.line = line;
          this.character = character;
        }
      },
      Selection: class Selection {
        start: unknown;
        end: unknown;
        anchor: unknown;
        active: unknown;
        constructor(anchorLine: number, anchorChar: number, activeLine: number, activeChar: number) {
          this.anchor = { line: anchorLine, character: anchorChar };
          this.active = { line: activeLine, character: activeChar };
          this.start = this.anchor;
          this.end = this.active;
        }
      },
      CancellationTokenSource: class CancellationTokenSource {
        token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };
        cancel() { this.token.isCancellationRequested = true; }
        dispose() {}
      },
      Disposable: class Disposable {
        private disposeFunc: () => void;
        constructor(disposeFunc: () => void) {
          this.disposeFunc = disposeFunc;
        }
        dispose() {
          this.disposeFunc();
        }
        static from(...disposables: { dispose: () => void }[]) {
          return new Disposable(() => disposables.forEach(d => d.dispose()));
        }
      },

      // Commands API
      commands: {
        registerCommand(command: string, callback: (...args: unknown[]) => unknown, thisArg?: unknown) {
          const cmd: RegisteredCommand = { command, callback, thisArg };
          self.globalCommands.set(command, cmd);
          extension?.commands.set(command, cmd);
          console.log(`[ExtRuntime] Registered command: ${command}`);
          return { dispose: () => self.globalCommands.delete(command) };
        },
        executeCommand(command: string, ...args: unknown[]) {
          return self.executeCommand(command, ...args);
        },
        getCommands(filterInternal?: boolean) {
          const cmds = Array.from(self.globalCommands.keys());
          if (filterInternal) {
            return Promise.resolve(cmds.filter(c => !c.startsWith('_')));
          }
          return Promise.resolve(cmds);
        },
      },

      // Window API
      window: {
        createWebviewPanel(
          viewType: string,
          title: string,
          _showOptions: unknown,
          options?: {
            enableScripts?: boolean;
            localResourceRoots?: string[];
            retainContextWhenHidden?: boolean;
          }
        ): WebviewPanel {
          const panelId = `${extensionId}-${viewType}-${Date.now()}`;
          const messageHandlers: ((message: unknown) => void)[] = [];

          const panel: WebviewPanel = {
            id: panelId,
            extensionId,
            viewType,
            title,
            html: '',
            options: options || {},
            visible: true,
            active: true,
            onDidReceiveMessage: (callback) => {
              messageHandlers.push(callback);
              return { dispose: () => messageHandlers.splice(messageHandlers.indexOf(callback), 1) };
            },
            postMessage: async (message) => {
              self.emit('webview-message', panelId, message);
              return true;
            },
            dispose: () => {
              self.webviewPanels.delete(panelId);
              self.emit('webview-disposed', panelId);
            },
            webview: {
              html: '',
              options: options || {},
              onDidReceiveMessage: (callback) => {
                messageHandlers.push(callback);
                return { dispose: () => messageHandlers.splice(messageHandlers.indexOf(callback), 1) };
              },
              postMessage: async (message) => {
                self.emit('webview-message', panelId, message);
                return true;
              },
              asWebviewUri: (uri) => ({
                toString: () => `vscode-webview:///${uri.fsPath}`,
              }),
              cspSource: "'self'",
            },
          };

          // Proxy html setter
          Object.defineProperty(panel.webview, 'html', {
            get: () => panel.html,
            set: (value: string) => {
              panel.html = value;
              self.emit('webview-html-changed', panelId, value);
            },
          });

          self.webviewPanels.set(panelId, panel);
          self.webviewMessageListeners.set(panelId, messageHandlers);
          extension?.webviewPanels.set(panelId, panel);

          self.emit('webview-created', panelId, panel);
          console.log(`[ExtRuntime] Created webview panel: ${viewType} (${panelId})`);

          return panel;
        },

        registerWebviewViewProvider(viewId: string, _provider: unknown) {
          console.log(`[ExtRuntime] Registered webview view provider: ${viewId}`);
          // Store provider for later use
          return { dispose: () => {} };
        },

        createTreeView(viewId: string, options: { treeDataProvider: TreeDataProvider<unknown> }) {
          const view: RegisteredTreeView = {
            viewId,
            provider: options.treeDataProvider,
          };
          extension?.treeViews.set(viewId, view);
          console.log(`[ExtRuntime] Created tree view: ${viewId}`);
          return {
            dispose: () => extension?.treeViews.delete(viewId),
            reveal: () => {},
            selection: [],
            visible: true,
            onDidChangeSelection: () => ({ dispose: () => {} }),
            onDidChangeVisibility: () => ({ dispose: () => {} }),
            onDidCollapseElement: () => ({ dispose: () => {} }),
            onDidExpandElement: () => ({ dispose: () => {} }),
          };
        },

        registerTreeDataProvider(viewId: string, provider: TreeDataProvider<unknown>) {
          const view: RegisteredTreeView = { viewId, provider };
          extension?.treeViews.set(viewId, view);
          console.log(`[ExtRuntime] Registered tree data provider: ${viewId}`);
          return { dispose: () => extension?.treeViews.delete(viewId) };
        },

        showInformationMessage(message: string, ...items: string[]) {
          console.log(`[ExtRuntime] Info: ${message}`);
          self.emit('show-message', 'info', message, items);
          return Promise.resolve(items[0]);
        },

        showWarningMessage(message: string, ...items: string[]) {
          console.log(`[ExtRuntime] Warning: ${message}`);
          self.emit('show-message', 'warning', message, items);
          return Promise.resolve(items[0]);
        },

        showErrorMessage(message: string, ...items: string[]) {
          console.log(`[ExtRuntime] Error: ${message}`);
          self.emit('show-message', 'error', message, items);
          return Promise.resolve(items[0]);
        },

        showInputBox(_options?: { prompt?: string; value?: string; placeHolder?: string }) {
          self.emit('show-input-box', _options);
          return Promise.resolve('');
        },

        showQuickPick(items: string[] | Promise<string[]>, options?: unknown) {
          self.emit('show-quick-pick', items, options);
          return Promise.resolve(Array.isArray(items) ? items[0] : undefined);
        },

        createOutputChannel(name: string) {
          self.outputChannels.set(name, []);
          return {
            name,
            append: (value: string) => self.outputChannels.get(name)?.push(value),
            appendLine: (value: string) => self.outputChannels.get(name)?.push(value + '\n'),
            clear: () => self.outputChannels.set(name, []),
            show: () => self.emit('show-output-channel', name),
            hide: () => {},
            dispose: () => self.outputChannels.delete(name),
          };
        },

        createStatusBarItem(alignment?: number, priority?: number) {
          return {
            alignment: alignment || 1,
            priority: priority || 0,
            text: '',
            tooltip: '',
            color: undefined,
            backgroundColor: undefined,
            command: undefined,
            show: () => self.emit('statusbar-show', {}),
            hide: () => self.emit('statusbar-hide', {}),
            dispose: () => {},
          };
        },

        activeTextEditor: undefined,
        visibleTextEditors: [],
        onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
        onDidChangeVisibleTextEditors: () => ({ dispose: () => {} }),
        onDidChangeTextEditorSelection: () => ({ dispose: () => {} }),
        showTextDocument: () => Promise.resolve(undefined),
        createTextEditorDecorationType: () => ({ dispose: () => {} }),
        withProgress: async (_options: unknown, task: (progress: unknown) => Promise<unknown>) => {
          return task({
            report: (value: unknown) => console.log('[ExtRuntime] Progress:', value),
          });
        },
        setStatusBarMessage: (text: string, hideAfterTimeout?: number) => {
          self.emit('statusbar-message', text, hideAfterTimeout);
          return { dispose: () => {} };
        },
      },

      // Workspace API
      workspace: {
        workspaceFolders: [{
          uri: Uri.file(extensionPath),
          name: 'workspace',
          index: 0,
        }],
        getConfiguration(_section?: string) {
          return {
            get: <T>(_key: string, defaultValue?: T): T | undefined => {
              return defaultValue;
            },
            has: () => false,
            inspect: () => undefined,
            update: () => Promise.resolve(),
          };
        },
        onDidChangeConfiguration: () => ({ dispose: () => {} }),
        onDidOpenTextDocument: () => ({ dispose: () => {} }),
        onDidCloseTextDocument: () => ({ dispose: () => {} }),
        onDidChangeTextDocument: () => ({ dispose: () => {} }),
        onDidSaveTextDocument: () => ({ dispose: () => {} }),
        onDidCreateFiles: () => ({ dispose: () => {} }),
        onDidDeleteFiles: () => ({ dispose: () => {} }),
        onDidRenameFiles: () => ({ dispose: () => {} }),
        openTextDocument: (uri: unknown) => Promise.resolve({ getText: () => '', uri }),
        applyEdit: () => Promise.resolve(true),
        findFiles: () => Promise.resolve([]),
        fs: {
          readFile: async (uri: { fsPath: string }) => {
            const result = await api.read(uri.fsPath);
            if (result.ok && result.data) {
              return new TextEncoder().encode(result.data.content);
            }
            throw new Error('File not found');
          },
          writeFile: async (uri: { fsPath: string }, content: Uint8Array) => {
            await api.write(uri.fsPath, new TextDecoder().decode(content));
          },
          stat: async () => ({ type: 1, ctime: Date.now(), mtime: Date.now(), size: 0 }),
          readDirectory: async () => [],
          createDirectory: async () => {},
          delete: async () => {},
          rename: async () => {},
          copy: async () => {},
        },
        getWorkspaceFolder: () => undefined,
        asRelativePath: (path: string) => path,
        createFileSystemWatcher: () => ({
          onDidChange: () => ({ dispose: () => {} }),
          onDidCreate: () => ({ dispose: () => {} }),
          onDidDelete: () => ({ dispose: () => {} }),
          dispose: () => {},
        }),
        registerTextDocumentContentProvider: () => ({ dispose: () => {} }),
        textDocuments: [],
      },

      // Environment API
      env: {
        appName: 'SentinelOps',
        appRoot: extensionPath,
        language: 'en',
        machineId: 'sentinelops-' + Date.now(),
        sessionId: 'session-' + Date.now(),
        uriScheme: 'sentinelops',
        clipboard: {
          readText: () => navigator.clipboard.readText(),
          writeText: (text: string) => navigator.clipboard.writeText(text),
        },
        openExternal: (uri: { toString: () => string }) => {
          window.open(uri.toString(), '_blank');
          return Promise.resolve(true);
        },
        asExternalUri: (uri: unknown) => Promise.resolve(uri),
        shell: 'bash',
        isTelemetryEnabled: false,
        onDidChangeTelemetryEnabled: () => ({ dispose: () => {} }),
      },

      // Extensions API
      extensions: {
        getExtension: (extensionId: string) => {
          const ext = self.activeExtensions.get(extensionId);
          if (ext) {
            return {
              id: extensionId,
              extensionPath: ext.context.extensionPath,
              isActive: true,
              exports: ext.exports,
              activate: () => Promise.resolve(ext.exports),
            };
          }
          return undefined;
        },
        all: [],
        onDidChange: () => ({ dispose: () => {} }),
      },

      // Languages API (minimal)
      languages: {
        registerCompletionItemProvider: () => ({ dispose: () => {} }),
        registerHoverProvider: () => ({ dispose: () => {} }),
        registerDefinitionProvider: () => ({ dispose: () => {} }),
        registerCodeActionsProvider: () => ({ dispose: () => {} }),
        registerDocumentFormattingEditProvider: () => ({ dispose: () => {} }),
        getDiagnostics: () => [],
        createDiagnosticCollection: () => ({
          name: '',
          set: () => {},
          delete: () => {},
          clear: () => {},
          forEach: () => {},
          get: () => undefined,
          has: () => false,
          dispose: () => {},
        }),
      },

      // Debug API (minimal)
      debug: {
        activeDebugSession: undefined,
        breakpoints: [],
        onDidStartDebugSession: () => ({ dispose: () => {} }),
        onDidTerminateDebugSession: () => ({ dispose: () => {} }),
        registerDebugConfigurationProvider: () => ({ dispose: () => {} }),
        startDebugging: () => Promise.resolve(false),
      },

      // Tasks API (minimal)
      tasks: {
        registerTaskProvider: () => ({ dispose: () => {} }),
        fetchTasks: () => Promise.resolve([]),
        executeTask: () => Promise.resolve(undefined),
        taskExecutions: [],
        onDidStartTask: () => ({ dispose: () => {} }),
        onDidEndTask: () => ({ dispose: () => {} }),
      },

      // Authentication API
      authentication: {
        getSession: () => Promise.resolve(undefined),
        onDidChangeSessions: () => ({ dispose: () => {} }),
        registerAuthenticationProvider: () => ({ dispose: () => {} }),
      },

      // Comments API (minimal)
      comments: {
        createCommentController: () => ({
          id: '',
          label: '',
          dispose: () => {},
          createCommentThread: () => ({}),
        }),
      },

      // Notebooks API (minimal)
      notebooks: {
        registerNotebookCellStatusBarItemProvider: () => ({ dispose: () => {} }),
      },

      // SCM API (minimal)
      scm: {
        createSourceControl: () => ({
          dispose: () => {},
          createResourceGroup: () => ({}),
        }),
      },

      // Test API (minimal)
      tests: {
        createTestController: () => ({
          dispose: () => {},
          createRunProfile: () => ({}),
          createTestItem: () => ({}),
          items: { add: () => {}, delete: () => {}, replace: () => {} },
        }),
      },
    };

    return vscode;
  }

  // Activate an extension
  async activateExtension(extensionId: string, extensionPath: string): Promise<boolean> {
    if (this.activeExtensions.has(extensionId)) {
      console.log(`[ExtRuntime] Extension ${extensionId} already active`);
      return true;
    }

    console.log(`[ExtRuntime] Activating extension: ${extensionId} at ${extensionPath}`);

    try {
      // Read package.json to get the main entry point
      const packageJsonPath = `${extensionPath}/package.json`;
      const packageResult = await api.read(packageJsonPath);

      if (!packageResult.ok || !packageResult.data) {
        console.error(`[ExtRuntime] Could not read package.json for ${extensionId}`);
        return false;
      }

      const packageJson = JSON.parse(packageResult.data.content);
      const mainEntry = packageJson.main || packageJson.browser;

      if (!mainEntry) {
        console.log(`[ExtRuntime] Extension ${extensionId} has no main entry, marking as passive`);
        // Still mark as "active" for extensions without JS (like themes)
        const context = this.createExtensionContext(extensionId, extensionPath);
        this.activeExtensions.set(extensionId, {
          id: extensionId,
          context,
          exports: {},
          webviewPanels: new Map(),
          commands: new Map(),
          treeViews: new Map(),
          messageHandlers: new Map(),
        });
        return true;
      }

      // Create extension context
      const context = this.createExtensionContext(extensionId, extensionPath);

      // Initialize extension entry
      this.activeExtensions.set(extensionId, {
        id: extensionId,
        context,
        exports: {},
        webviewPanels: new Map(),
        commands: new Map(),
        treeViews: new Map(),
        messageHandlers: new Map(),
      });

      // Create mock VSCode API (stored for future use if we implement JS execution)
      this.createVSCodeAPI(extensionId, extensionPath);

      // Try to load and execute extension JavaScript
      // Note: This is limited in browser environment. For full support,
      // we'd need a service worker or iframe sandbox.
      console.log(`[ExtRuntime] Extension ${extensionId} activated (limited mode)`);

      this.emit('extension-activated', extensionId);
      return true;
    } catch (error) {
      console.error(`[ExtRuntime] Failed to activate ${extensionId}:`, error);
      return false;
    }
  }

  // Create extension context
  private createExtensionContext(extensionId: string, extensionPath: string): ExtensionContext {
    return {
      extensionId,
      extensionPath,
      subscriptions: [],
      workspaceState: new Map(),
      globalState: new Map(),
      extensionUri: { fsPath: extensionPath },
      storageUri: { fsPath: `${extensionPath}/.storage` },
      globalStorageUri: { fsPath: `~/.sentinelops/extensions/${extensionId}/.storage` },
    };
  }

  // Deactivate an extension
  async deactivateExtension(extensionId: string): Promise<void> {
    const extension = this.activeExtensions.get(extensionId);
    if (!extension) return;

    // Dispose subscriptions
    extension.context.subscriptions.forEach(sub => sub.dispose());

    // Dispose webview panels
    extension.webviewPanels.forEach(panel => panel.dispose());

    // Remove from active extensions
    this.activeExtensions.delete(extensionId);

    this.emit('extension-deactivated', extensionId);
    console.log(`[ExtRuntime] Deactivated extension: ${extensionId}`);
  }

  // Execute a command
  async executeCommand(command: string, ...args: unknown[]): Promise<unknown> {
    const cmd = this.globalCommands.get(command);
    if (cmd) {
      try {
        const result = cmd.callback.apply(cmd.thisArg, args);
        return result instanceof Promise ? await result : result;
      } catch (error) {
        console.error(`[ExtRuntime] Command ${command} failed:`, error);
        throw error;
      }
    }
    console.warn(`[ExtRuntime] Command not found: ${command}`);
    return undefined;
  }

  // Get webview panel
  getWebviewPanel(panelId: string): WebviewPanel | undefined {
    return this.webviewPanels.get(panelId);
  }

  // Get all webview panels for an extension
  getWebviewPanelsForExtension(extensionId: string): WebviewPanel[] {
    return Array.from(this.webviewPanels.values()).filter(p => p.extensionId === extensionId);
  }

  // Send message to webview
  sendMessageToWebview(panelId: string, message: unknown): void {
    const handlers = this.webviewMessageListeners.get(panelId);
    if (handlers) {
      handlers.forEach(handler => handler(message));
    }
  }

  // Get tree view data
  async getTreeViewData(viewId: string): Promise<unknown[]> {
    for (const extension of this.activeExtensions.values()) {
      const treeView = extension.treeViews.get(viewId);
      if (treeView) {
        try {
          const children = await treeView.provider.getChildren();
          return Array.isArray(children) ? children : [];
        } catch (error) {
          console.error(`[ExtRuntime] Failed to get tree data for ${viewId}:`, error);
        }
      }
    }
    return [];
  }

  // Check if extension is active
  isExtensionActive(extensionId: string): boolean {
    return this.activeExtensions.has(extensionId);
  }

  // Get all registered commands
  getRegisteredCommands(): string[] {
    return Array.from(this.globalCommands.keys());
  }

  // Get output channel content
  getOutputChannelContent(name: string): string[] {
    return this.outputChannels.get(name) || [];
  }
}

export const extensionRuntime = new ExtensionRuntime();
export default extensionRuntime;
