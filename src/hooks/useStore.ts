import { create } from 'zustand';
import type { FileEntry, SearchMatch, TrashItem, GitChange, ExtensionConfiguration, ViewContainerContribution } from '../services/api';
import type { Memory, MemoryWithScore, MemorySettings, MemoryStats } from '../services/memoryApi';

// ============================================================================
// Owner Configuration
// ============================================================================

const OWNER_EMAIL = 'robertdeanlong@gmail.com';

export function isOwnerEmail(email: string): boolean {
  return email.toLowerCase() === OWNER_EMAIL.toLowerCase();
}

// ============================================================================
// Types
// ============================================================================

export type TabType =
  | 'files'
  | 'search'
  | 'sourceControl'
  | 'run'
  | 'extensions'
  | 'agent'
  | 'trash'
  | 'settings'
  | 'sqlite'
  | 'documentation'
  | 'apps';

export interface InstalledApp {
  id: string;
  name: string;
  icon?: string;
  extensionId?: string;
  extensionPath?: string;
  description?: string;
  addedAt: number;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  language: string;
  isDirty: boolean;
}

export interface RecentFile {
  path: string;
  name: string;
  timestamp: number;
}

export type SplitDirection = 'horizontal' | 'vertical' | null;

export interface EditorGroup {
  id: string;
  files: string[]; // file paths
  activeFile: string | null;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
}

export interface TerminalInstance {
  id: string;
  output: string;
  isRunning: boolean;
  cwd: string;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  toolCallId?: string;
  toolName?: string;
}

export interface ChatHistoryItem {
  id: string;
  timestamp: number;
  updatedAt: number;
  title: string; // First user message as title
  messages: ChatMessage[];
  model: string;
  totalTokens: number;
  totalCost: number;
  workingDirectory?: string; // Per-chat working directory
}

export interface SessionStats {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCost: number;
  messageCount: number;
}

export interface PendingCommand {
  id: string;
  toolCallId: string;
  command: string;
  workingDirectory: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed';
  result?: string;
  error?: string;
}

// Model pricing per 1M tokens (input/output) - OpenRouter pricing
export const MODEL_PRICING: Record<string, { input: number; output: number; contextWindow: number }> = {
  // Free models
  'meta-llama/llama-3.2-3b-instruct:free': { input: 0, output: 0, contextWindow: 131072 },
  'meta-llama/llama-3.1-8b-instruct:free': { input: 0, output: 0, contextWindow: 131072 },
  'qwen/qwen-2-7b-instruct:free': { input: 0, output: 0, contextWindow: 32768 },
  'google/gemma-2-9b-it:free': { input: 0, output: 0, contextWindow: 8192 },
  'mistralai/mistral-7b-instruct:free': { input: 0, output: 0, contextWindow: 32768 },
  'huggingfaceh4/zephyr-7b-beta:free': { input: 0, output: 0, contextWindow: 4096 },
  // Paid models
  'meta-llama/llama-3.1-8b-instruct': { input: 0.055, output: 0.055, contextWindow: 131072 },
  'meta-llama/llama-3.1-70b-instruct': { input: 0.35, output: 0.40, contextWindow: 131072 },
  'meta-llama/llama-3.1-405b-instruct': { input: 2.00, output: 2.00, contextWindow: 131072 },
  'meta-llama/llama-3.2-11b-vision-instruct': { input: 0.055, output: 0.055, contextWindow: 131072 },
  'openai/gpt-4o': { input: 2.50, output: 10.00, contextWindow: 128000 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.60, contextWindow: 128000 },
  'openai/gpt-4-turbo': { input: 10.00, output: 30.00, contextWindow: 128000 },
  'anthropic/claude-3.5-sonnet': { input: 3.00, output: 15.00, contextWindow: 200000 },
  'anthropic/claude-3-opus': { input: 15.00, output: 75.00, contextWindow: 200000 },
  'anthropic/claude-3-haiku': { input: 0.25, output: 1.25, contextWindow: 200000 },
  'google/gemini-pro-1.5': { input: 1.25, output: 5.00, contextWindow: 2097152 },
  'google/gemini-flash-1.5': { input: 0.075, output: 0.30, contextWindow: 1000000 },
  'google/gemma-2-9b-it': { input: 0.08, output: 0.08, contextWindow: 8192 },
  'mistralai/mistral-large': { input: 2.00, output: 6.00, contextWindow: 128000 },
  'mistralai/mistral-medium': { input: 2.70, output: 8.10, contextWindow: 32000 },
  'mistralai/mistral-7b-instruct': { input: 0.055, output: 0.055, contextWindow: 32768 },
  'deepseek/deepseek-chat': { input: 0.14, output: 0.28, contextWindow: 64000 },
  'qwen/qwen-2.5-72b-instruct': { input: 0.35, output: 0.40, contextWindow: 131072 },
};

export function calculateCost(
  promptTokens: number,
  completionTokens: number,
  model: string
): number {
  const pricing = MODEL_PRICING[model] || { input: 0.10, output: 0.10 }; // Default pricing
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

export function getContextWindow(model: string): number {
  return MODEL_PRICING[model]?.contextWindow || 8192; // Default 8k context
}

// ============================================================================
// Store Interface
// ============================================================================

interface AppStore {
  // Connection state
  connected: boolean;
  setConnected: (connected: boolean) => void;

  // Server info
  serverPort: number;
  workspaceRoot: string;
  llmConfigured: boolean;
  llmProvider: string;
  llmModel: string;
  llmBaseUrl: string;
  setLlmModel: (model: string) => void;
  setServerInfo: (info: {
    port?: number;
    workspace: string;
    llmConfigured: boolean;
    llmProvider?: string;
    llmModel?: string;
    llmBaseUrl?: string;
  }) => void;

  // Active tab
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;

  // Active extension container (for extension view panels)
  activeExtensionContainer: ViewContainerContribution | null;
  setActiveExtensionContainer: (container: ViewContainerContribution | null) => void;

  // Settings category (for opening settings to a specific tab)
  settingsCategory: string | null;
  setSettingsCategory: (category: string | null) => void;
  openSettingsToCategory: (category: string) => void;

  // Files
  files: FileEntry[];
  setFiles: (files: FileEntry[]) => void;
  loadingFiles: boolean;
  setLoadingFiles: (loading: boolean) => void;

  // Open files
  openFiles: OpenFile[];
  activeFile: string | null;
  openFile: (file: OpenFile) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  updateFileContent: (path: string, content: string) => void;
  markFileSaved: (path: string, newContent?: string) => void;

  // Expanded folders
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;

  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchMatch[];
  setSearchResults: (results: SearchMatch[]) => void;
  isSearching: boolean;
  setSearching: (searching: boolean) => void;

  // Git
  gitBranch: string | null;
  gitChanges: GitChange[];
  isLoadingGit: boolean;
  setGitLoading: (loading: boolean) => void;
  setGitData: (branch: string | null, changes: GitChange[]) => void;

  // Trash
  trashItems: TrashItem[];
  setTrashItems: (items: TrashItem[]) => void;
  isLoadingTrash: boolean;
  setLoadingTrash: (loading: boolean) => void;

  // Terminals
  terminals: TerminalInstance[];
  activeTerminalId: string | null;
  addTerminal: (terminal: TerminalInstance) => void;
  removeTerminal: (id: string) => void;
  setActiveTerminal: (id: string | null) => void;
  updateTerminalOutput: (id: string, output: string, isRunning: boolean) => void;

  // Agent
  agentGoal: string;
  setAgentGoal: (goal: string) => void;
  agentResponse: string | null;
  setAgentResponse: (response: string | null) => void;
  isAgentRunning: boolean;
  setAgentRunning: (running: boolean) => void;
  conversationLog: ChatMessage[];
  currentConversationId: string | null;
  addToConversation: (message: ChatMessage) => void;
  startNewConversation: () => void; // Saves current and starts fresh
  clearConversation: () => void; // Just clears without saving
  chatHistory: ChatHistoryItem[];
  saveConversationToHistory: () => void;
  loadConversation: (id: string) => void;
  deleteChatFromHistory: (id: string) => void;
  clearChatHistory: () => void;
  sessionStats: SessionStats;
  updateSessionStats: (promptTokens: number, completionTokens: number, model: string) => void;
  resetSessionStats: () => void;

  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  // Pending Commands (for AI agent approval)
  pendingCommands: PendingCommand[];
  agentPaused: boolean;
  pausedAtToolCallId: string | null;
  addPendingCommand: (cmd: Omit<PendingCommand, 'id' | 'status'>) => string;
  updatePendingCommand: (id: string, updates: Partial<PendingCommand>) => void;
  removePendingCommand: (id: string) => void;
  clearPendingCommands: () => void;
  setAgentPaused: (paused: boolean) => void;
  setPausedAtToolCallId: (id: string | null) => void;

  // Memory System
  memories: Memory[];
  setMemories: (memories: Memory[]) => void;
  addMemory: (memory: Memory) => void;
  updateMemoryInStore: (id: string, memory: Memory) => void;
  removeMemory: (id: string) => void;
  memorySettings: MemorySettings | null;
  setMemorySettings: (settings: MemorySettings | null) => void;
  memoryStats: MemoryStats | null;
  setMemoryStats: (stats: MemoryStats | null) => void;
  isLoadingMemories: boolean;
  setLoadingMemories: (loading: boolean) => void;
  relevantMemories: MemoryWithScore[];
  setRelevantMemories: (memories: MemoryWithScore[]) => void;
  showMemoryPanel: boolean;
  setShowMemoryPanel: (show: boolean) => void;

  // Per-chat working directory
  currentChatWorkingDirectory: string | null;
  setCurrentChatWorkingDirectory: (dir: string | null) => void;

  // Installed Apps (pinned extensions)
  installedApps: InstalledApp[];
  addInstalledApp: (app: Omit<InstalledApp, 'addedAt'>) => void;
  removeInstalledApp: (id: string) => void;
  clearInstalledApps: () => void;

  // Settings
  settings: {
    theme: 'dark' | 'light';
    fontSize: number;
    tabSize: number;
    wordWrap: boolean;
    minimap: boolean;
    autoSave: boolean;
    aiEnabled: boolean; // Whether AI assistant is enabled
    mood: 'focused' | 'creative' | 'relaxed'; // User's preferred mood/workflow
    allowedFolder?: string; // Global folder restriction for AI
    colorTheme?: string; // Extension theme ID (e.g., "dracula-theme.theme-dracula")
    iconTheme?: string; // Extension icon theme ID
  };
  updateSettings: (settings: Partial<AppStore['settings']>) => void;

  // Keyboard shortcuts
  keyboardShortcuts: Record<string, string>;
  keyboardPreset: KeyboardPreset;
  updateKeyboardShortcut: (action: string, shortcut: string) => void;
  resetKeyboardShortcuts: () => void;
  applyKeyboardPreset: (preset: KeyboardPreset) => void;

  // Extension theme state (for triggering re-renders)
  iconThemeVersion: number;
  incrementIconThemeVersion: () => void;

  // Recent files
  recentFiles: RecentFile[];
  addRecentFile: (path: string, name: string) => void;
  clearRecentFiles: () => void;
  recentFilesOpen: boolean;
  setRecentFilesOpen: (open: boolean) => void;

  // Split editor
  splitDirection: SplitDirection;
  editorGroups: EditorGroup[];
  activeGroupId: string;
  setSplitDirection: (direction: SplitDirection) => void;
  splitEditor: (direction: 'horizontal' | 'vertical') => void;
  closeSplit: () => void;
  moveFileToGroup: (path: string, groupId: string) => void;
  setActiveGroup: (groupId: string) => void;

  // Symbol outline
  showSymbolOutline: boolean;
  setShowSymbolOutline: (show: boolean) => void;

  // Markdown preview
  showMarkdownPreview: boolean;
  setShowMarkdownPreview: (show: boolean) => void;

  // Extension settings
  extensionSettings: Record<string, unknown>;
  extensionConfigurations: ExtensionConfiguration[];
  setExtensionSettings: (settings: Record<string, unknown>) => void;
  setExtensionConfigurations: (configs: ExtensionConfiguration[]) => void;
  updateExtensionSetting: (key: string, value: unknown) => void;

  // Update state
  updateAvailable: { version: string; currentVersion: string; body?: string } | null;
  updateProgress: { downloaded: number; total: number; percent: number } | null;
  isCheckingUpdate: boolean;
  isDownloadingUpdate: boolean;
  setUpdateAvailable: (update: { version: string; currentVersion: string; body?: string } | null) => void;
  setUpdateProgress: (progress: { downloaded: number; total: number; percent: number } | null) => void;
  setCheckingUpdate: (checking: boolean) => void;
  setDownloadingUpdate: (downloading: boolean) => void;

  // Setup wizard state
  showSetupWizard: boolean;
  setShowSetupWizard: (show: boolean) => void;
  isFirstLaunch: boolean;

  // Auth state
  authUser: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    role: 'user' | 'owner' | 'admin';
    subscription: {
      plan: 'free' | 'pro' | 'team';
      status: 'active' | 'cancelled' | 'expired' | 'past_due';
      expiresAt: string | null;
    };
  } | null;
  setAuthUser: (user: Omit<NonNullable<AppStore['authUser']>, 'role'> & { role?: 'user' | 'owner' | 'admin' } | null) => void;
  isAuthLoading: boolean;
  setAuthLoading: (loading: boolean) => void;

  // Usage tracking for daily limits
  dailyUsage: { messageCount: number; date: string };
  incrementDailyUsage: () => void;
  resetDailyUsage: () => void;

  // Bonus messages (purchased, don't reset daily)
  bonusMessages: number;
  addBonusMessages: (count: number) => void;
  useBonusMessage: () => boolean;
}

// ============================================================================
// Default Keyboard Shortcuts
// ============================================================================

export const DEFAULT_KEYBOARD_SHORTCUTS: Record<string, string> = {
  'save': 'Ctrl+S',
  'commandPalette': 'Ctrl+P',
  'recentFiles': 'Ctrl+E',
  'findInFiles': 'Ctrl+Shift+F',
  'sourceControl': 'Ctrl+Shift+G',
  'extensions': 'Ctrl+Shift+X',
  'splitEditor': 'Ctrl+\\',
  'closeTab': 'Ctrl+W',
  'nextTab': 'Ctrl+Tab',
  'prevTab': 'Ctrl+Shift+Tab',
  'toggleTerminal': 'Ctrl+`',
  'newFile': 'Ctrl+N',
  'toggleSidebar': 'Ctrl+B',
  'goToLine': 'Ctrl+G',
  'findReplace': 'Ctrl+H',
};

// VS Code keybindings (similar to default, already standard)
export const VSCODE_KEYBOARD_SHORTCUTS: Record<string, string> = {
  'save': 'Ctrl+S',
  'commandPalette': 'Ctrl+Shift+P',
  'recentFiles': 'Ctrl+E',
  'findInFiles': 'Ctrl+Shift+F',
  'sourceControl': 'Ctrl+Shift+G',
  'extensions': 'Ctrl+Shift+X',
  'splitEditor': 'Ctrl+\\',
  'closeTab': 'Ctrl+W',
  'nextTab': 'Ctrl+Tab',
  'prevTab': 'Ctrl+Shift+Tab',
  'toggleTerminal': 'Ctrl+`',
  'newFile': 'Ctrl+N',
  'toggleSidebar': 'Ctrl+B',
  'goToLine': 'Ctrl+G',
  'findReplace': 'Ctrl+H',
};

// Sublime Text keybindings
export const SUBLIME_KEYBOARD_SHORTCUTS: Record<string, string> = {
  'save': 'Ctrl+S',
  'commandPalette': 'Ctrl+Shift+P',
  'recentFiles': 'Ctrl+T',
  'findInFiles': 'Ctrl+Shift+F',
  'sourceControl': 'Ctrl+Shift+G',
  'extensions': 'Ctrl+Shift+X',
  'splitEditor': 'Alt+Shift+2',
  'closeTab': 'Ctrl+W',
  'nextTab': 'Ctrl+PageDown',
  'prevTab': 'Ctrl+PageUp',
  'toggleTerminal': 'Ctrl+`',
  'newFile': 'Ctrl+N',
  'toggleSidebar': 'Ctrl+K',
  'goToLine': 'Ctrl+G',
  'findReplace': 'Ctrl+H',
};

// Vim-style keybindings (with Ctrl combinations for non-modal commands)
export const VIM_KEYBOARD_SHORTCUTS: Record<string, string> = {
  'save': 'Ctrl+S',
  'commandPalette': 'Ctrl+P',
  'recentFiles': 'Ctrl+O',
  'findInFiles': 'Ctrl+Shift+F',
  'sourceControl': 'Ctrl+Shift+G',
  'extensions': 'Ctrl+Shift+X',
  'splitEditor': 'Ctrl+W',
  'closeTab': 'Ctrl+Shift+W',
  'nextTab': 'Ctrl+]',
  'prevTab': 'Ctrl+[',
  'toggleTerminal': 'Ctrl+`',
  'newFile': 'Ctrl+N',
  'toggleSidebar': 'Ctrl+B',
  'goToLine': 'Ctrl+G',
  'findReplace': 'Ctrl+H',
};

export type KeyboardPreset = 'default' | 'vscode' | 'sublime' | 'vim';

export function getKeyboardPreset(preset: KeyboardPreset): Record<string, string> {
  switch (preset) {
    case 'vscode':
      return { ...VSCODE_KEYBOARD_SHORTCUTS };
    case 'sublime':
      return { ...SUBLIME_KEYBOARD_SHORTCUTS };
    case 'vim':
      return { ...VIM_KEYBOARD_SHORTCUTS };
    default:
      return { ...DEFAULT_KEYBOARD_SHORTCUTS };
  }
}

export function parseShortcut(shortcut: string): { key: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean } {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  return {
    key,
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('meta') || parts.includes('cmd'),
  };
}

export function matchShortcut(e: KeyboardEvent, shortcut: string): boolean {
  if (!shortcut || !e.key) return false;
  const parsed = parseShortcut(shortcut);
  const eventKey = e.key.toLowerCase();

  // Handle special keys
  const keyMatch = eventKey === parsed.key ||
    (parsed.key === '`' && eventKey === '`') ||
    (parsed.key === '\\' && eventKey === '\\');

  return (
    keyMatch &&
    (e.ctrlKey || e.metaKey) === parsed.ctrl &&
    e.shiftKey === parsed.shift &&
    e.altKey === parsed.alt
  );
}

// ============================================================================
// Language Detection - Comprehensive mapping for all Monaco supported languages
// ============================================================================

export function getLanguageFromFilename(path: string): string {
  return getLanguageFromPath(path);
}

function getLanguageFromPath(path: string): string {
  const filename = path.split(/[/\\]/).pop()?.toLowerCase() || '';
  const ext = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() || '' : '';

  // Special filename mappings (files without extensions or special names)
  const filenameMap: Record<string, string> = {
    'dockerfile': 'dockerfile',
    'docker-compose.yml': 'yaml',
    'docker-compose.yaml': 'yaml',
    'makefile': 'makefile',
    'gnumakefile': 'makefile',
    'cmakelists.txt': 'cmake',
    'gemfile': 'ruby',
    'rakefile': 'ruby',
    'podfile': 'ruby',
    'vagrantfile': 'ruby',
    'brewfile': 'ruby',
    'guardfile': 'ruby',
    'fastfile': 'ruby',
    'appfile': 'ruby',
    'matchfile': 'ruby',
    'pluginfile': 'ruby',
    'dangerfile': 'ruby',
    '.gitignore': 'ignore',
    '.gitattributes': 'ignore',
    '.dockerignore': 'ignore',
    '.npmignore': 'ignore',
    '.eslintignore': 'ignore',
    '.prettierignore': 'ignore',
    '.env': 'dotenv',
    '.env.local': 'dotenv',
    '.env.development': 'dotenv',
    '.env.production': 'dotenv',
    '.env.example': 'dotenv',
    '.babelrc': 'json',
    '.eslintrc': 'json',
    '.prettierrc': 'json',
    '.stylelintrc': 'json',
    'package.json': 'json',
    'tsconfig.json': 'json',
    'jsconfig.json': 'json',
    'composer.json': 'json',
    'cargo.toml': 'toml',
    'pyproject.toml': 'toml',
    'requirements.txt': 'plaintext',
    'csproj': 'xml',
    'fsproj': 'xml',
    'vbproj': 'xml',
    'vcxproj': 'xml',
    'build.gradle': 'groovy',
    'settings.gradle': 'groovy',
    'build.gradle.kts': 'kotlin',
    'settings.gradle.kts': 'kotlin',
    'pom.xml': 'xml',
  };

  // Check filename first
  if (filenameMap[filename]) {
    return filenameMap[filename];
  }

  // Comprehensive extension to language mapping
  // Covers all Monaco built-in languages + common languages
  const languageMap: Record<string, string> = {
    // JavaScript / TypeScript
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    mts: 'typescript',
    cts: 'typescript',

    // Web Languages
    html: 'html',
    htm: 'html',
    xhtml: 'html',
    vue: 'html',
    svelte: 'html',
    astro: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    styl: 'stylus',
    stylus: 'stylus',

    // Data / Config formats
    json: 'json',
    jsonc: 'json',
    json5: 'json',
    jsonl: 'json',
    geojson: 'json',
    webmanifest: 'json',
    xml: 'xml',
    xsl: 'xml',
    xslt: 'xml',
    xsd: 'xml',
    svg: 'xml',
    plist: 'xml',
    xaml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'ini',
    ini: 'ini',
    cfg: 'ini',
    conf: 'ini',
    config: 'ini',
    properties: 'ini',
    env: 'dotenv',

    // Markdown / Documentation
    md: 'markdown',
    mdx: 'mdx',
    markdown: 'markdown',
    mdown: 'markdown',
    mkdn: 'markdown',
    mkd: 'markdown',
    rst: 'restructuredtext',
    rest: 'restructuredtext',
    txt: 'plaintext',
    text: 'plaintext',
    log: 'plaintext',

    // Python
    py: 'python',
    pyw: 'python',
    pyi: 'python',
    pyx: 'python',
    pxd: 'python',
    pxi: 'python',
    gyp: 'python',
    gypi: 'python',
    ipynb: 'json',

    // Ruby
    rb: 'ruby',
    rbx: 'ruby',
    rjs: 'ruby',
    rake: 'ruby',
    gemspec: 'ruby',
    erb: 'html',
    haml: 'haml',
    slim: 'slim',

    // PHP
    php: 'php',
    php3: 'php',
    php4: 'php',
    php5: 'php',
    php7: 'php',
    php8: 'php',
    phtml: 'php',
    phps: 'php',
    blade: 'php',

    // Java / JVM
    java: 'java',
    jar: 'java',
    class: 'java',
    kt: 'kotlin',
    kts: 'kotlin',
    scala: 'scala',
    sc: 'scala',
    groovy: 'groovy',
    gradle: 'groovy',
    gvy: 'groovy',
    gy: 'groovy',
    gsh: 'groovy',
    clj: 'clojure',
    cljs: 'clojure',
    cljc: 'clojure',
    edn: 'clojure',

    // C / C++ / Objective-C
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    'c++': 'cpp',
    hpp: 'cpp',
    hh: 'cpp',
    hxx: 'cpp',
    'h++': 'cpp',
    ino: 'cpp',
    m: 'objective-c',
    mm: 'objective-c',

    // C# / .NET
    cs: 'csharp',
    csx: 'csharp',
    cake: 'csharp',
    fs: 'fsharp',
    fsi: 'fsharp',
    fsx: 'fsharp',
    fsscript: 'fsharp',
    vb: 'vb',
    bas: 'vb',
    vbs: 'vb',

    // Go
    go: 'go',
    mod: 'go',
    sum: 'go',

    // Rust
    rs: 'rust',
    rlib: 'rust',

    // Swift
    swift: 'swift',
    swiftinterface: 'swift',

    // Dart / Flutter
    dart: 'dart',

    // R
    r: 'r',
    rmd: 'r',
    rhistory: 'r',
    rprofile: 'r',

    // Julia
    jl: 'julia',

    // Lua
    lua: 'lua',
    luau: 'lua',

    // Perl
    pl: 'perl',
    pm: 'perl',
    pod: 'perl',
    t: 'perl',
    perl: 'perl',

    // Haskell
    hs: 'haskell',
    lhs: 'haskell',

    // Elixir / Erlang
    ex: 'elixir',
    exs: 'elixir',
    erl: 'erlang',
    hrl: 'erlang',

    // OCaml / F# / ReasonML
    ml: 'fsharp',
    mli: 'fsharp',
    re: 'reason',
    rei: 'reason',

    // Lisp / Scheme
    lisp: 'scheme',
    lsp: 'scheme',
    cl: 'scheme',
    el: 'scheme',
    scm: 'scheme',
    ss: 'scheme',
    rkt: 'scheme',

    // Shell / Scripts
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    fish: 'shell',
    ksh: 'shell',
    csh: 'shell',
    tcsh: 'shell',
    ps1: 'powershell',
    psm1: 'powershell',
    psd1: 'powershell',
    bat: 'bat',
    cmd: 'bat',

    // SQL / Database
    sql: 'sql',
    mysql: 'mysql',
    pgsql: 'pgsql',
    plsql: 'sql',
    tsql: 'sql',
    sqlite: 'sql',
    sqlite3: 'sql',
    db: 'sql',

    // Assembly
    asm: 'mips',
    s: 'mips',
    nasm: 'mips',

    // Terraform / HCL
    tf: 'hcl',
    tfvars: 'hcl',
    hcl: 'hcl',

    // Docker / Containers
    dockerfile: 'dockerfile',

    // GraphQL
    graphql: 'graphql',
    gql: 'graphql',

    // Protocol Buffers
    proto: 'protobuf',

    // Solidity / Blockchain
    sol: 'solidity',
    vy: 'python',

    // Template languages
    pug: 'pug',
    jade: 'pug',
    hbs: 'handlebars',
    handlebars: 'handlebars',
    mustache: 'handlebars',
    ejs: 'html',
    njk: 'html',
    nunjucks: 'html',
    twig: 'twig',
    liquid: 'liquid',
    jinja: 'python',
    jinja2: 'python',

    // Game Development
    gd: 'python',
    gdscript: 'python',
    shader: 'cpp',
    glsl: 'cpp',
    hlsl: 'cpp',
    wgsl: 'wgsl',
    vert: 'cpp',
    frag: 'cpp',
    fx: 'cpp',
    cg: 'cpp',

    // Pascal / Delphi
    pas: 'pascal',
    pp: 'pascal',
    pascal: 'pascal',
    dpr: 'pascal',
    dfm: 'pascal',
    lpr: 'pascal',

    // Fortran
    f: 'fortran',
    for: 'fortran',
    f90: 'fortran',
    f95: 'fortran',
    f03: 'fortran',
    f08: 'fortran',

    // COBOL
    cob: 'cobol',
    cobol: 'cobol',
    cbl: 'cobol',
    cpy: 'cobol',

    // TCL
    tcl: 'tcl',
    tk: 'tcl',

    // Verilog / SystemVerilog
    v: 'systemverilog',
    vh: 'systemverilog',
    sv: 'systemverilog',
    svh: 'systemverilog',
    vhd: 'vhdl',
    vhdl: 'vhdl',

    // ABAP
    abap: 'abap',

    // Apex (Salesforce)
    apex: 'apex',
    cls: 'apex',
    trigger: 'apex',

    // PowerQuery
    pq: 'powerquery',

    // Bicep (Azure)
    bicep: 'bicep',

    // Coffee Script
    coffee: 'coffee',
    litcoffee: 'coffee',

    // Misc
    diff: 'diff',
    patch: 'diff',
    awk: 'awk',
    sed: 'sed',
    vim: 'vim',
    vimrc: 'vim',
    nginx: 'nginx',
    htaccess: 'apache',
    gitconfig: 'ini',
    editorconfig: 'ini',
  };

  return languageMap[ext] || 'plaintext';
}

// ============================================================================
// Store
// ============================================================================

export const useStore = create<AppStore>((set, get) => ({
  // Connection state
  connected: false,
  setConnected: (connected) => set({ connected }),

  // Server info
  serverPort: 0,
  workspaceRoot: '',
  llmConfigured: false,
  llmProvider: 'Unknown',
  llmModel: '',
  llmBaseUrl: '',
  setServerInfo: (info) =>
    set({
      serverPort: info.port ?? 0,
      workspaceRoot: info.workspace,
      llmConfigured: info.llmConfigured,
      llmProvider: info.llmProvider ?? 'Unknown',
      llmModel: info.llmModel ?? '',
      llmBaseUrl: info.llmBaseUrl ?? '',
    }),
  setLlmModel: (model) => set({ llmModel: model }),

  // Active tab
  activeTab: 'files',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Active extension container
  activeExtensionContainer: null,
  setActiveExtensionContainer: (container) => set({ activeExtensionContainer: container }),

  // Settings category
  settingsCategory: null,
  setSettingsCategory: (category) => set({ settingsCategory: category }),
  openSettingsToCategory: (category) => set({ settingsCategory: category, activeTab: 'settings' }),

  // Files
  files: [],
  setFiles: (files) => set({ files }),
  loadingFiles: false,
  setLoadingFiles: (loading) => set({ loadingFiles: loading }),

  // Open files
  openFiles: [],
  activeFile: null,

  openFile: (file) => {
    const { openFiles, addRecentFile } = get();
    const existing = openFiles.find((f) => f.path === file.path);

    // Add to recent files
    addRecentFile(file.path, file.name);

    if (existing) {
      set({ activeFile: file.path });
    } else {
      const newFile: OpenFile = {
        ...file,
        language: getLanguageFromPath(file.path),
        originalContent: file.content,
        isDirty: false,
      };
      set({
        openFiles: [...openFiles, newFile],
        activeFile: file.path,
      });
    }
  },

  closeFile: (path) => {
    const { openFiles, activeFile } = get();
    const newOpenFiles = openFiles.filter((f) => f.path !== path);
    let newActiveFile = activeFile;

    if (activeFile === path) {
      const index = openFiles.findIndex((f) => f.path === path);
      if (newOpenFiles.length > 0) {
        newActiveFile = newOpenFiles[Math.min(index, newOpenFiles.length - 1)].path;
      } else {
        newActiveFile = null;
      }
    }

    set({ openFiles: newOpenFiles, activeFile: newActiveFile });
  },

  setActiveFile: (path) => set({ activeFile: path }),

  updateFileContent: (path, content) => {
    const { openFiles } = get();
    set({
      openFiles: openFiles.map((f) =>
        f.path === path
          ? { ...f, content, isDirty: content !== f.originalContent }
          : f
      ),
    });
  },

  markFileSaved: (path, newContent) => {
    const { openFiles } = get();
    set({
      openFiles: openFiles.map((f) =>
        f.path === path
          ? {
              ...f,
              originalContent: newContent ?? f.content,
              isDirty: false,
            }
          : f
      ),
    });
  },

  // Expanded folders
  expandedFolders: new Set<string>(),
  toggleFolder: (path) => {
    const { expandedFolders } = get();
    const newSet = new Set(expandedFolders);
    if (newSet.has(path)) {
      newSet.delete(path);
    } else {
      newSet.add(path);
    }
    set({ expandedFolders: newSet });
  },

  // Notifications
  notifications: [],
  addNotification: (notification) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      notifications: [
        ...state.notifications,
        { ...notification, id, timestamp: Date.now() },
      ],
    }));

    setTimeout(() => {
      get().removeNotification(id);
    }, 5000);
  },
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  // Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  searchResults: [],
  setSearchResults: (results) => set({ searchResults: results }),
  isSearching: false,
  setSearching: (searching) => set({ isSearching: searching }),

  // Git
  gitBranch: null,
  gitChanges: [],
  isLoadingGit: false,
  setGitLoading: (loading) => set({ isLoadingGit: loading }),
  setGitData: (branch, changes) => set({ gitBranch: branch, gitChanges: changes }),

  // Trash
  trashItems: [],
  setTrashItems: (items) => set({ trashItems: items }),
  isLoadingTrash: false,
  setLoadingTrash: (loading) => set({ isLoadingTrash: loading }),

  // Terminals
  terminals: [],
  activeTerminalId: null,
  addTerminal: (terminal) =>
    set((state) => ({
      terminals: [...state.terminals, terminal],
      activeTerminalId: terminal.id,
    })),
  removeTerminal: (id) =>
    set((state) => {
      const remaining = state.terminals.filter((t) => t.id !== id);
      return {
        terminals: remaining,
        activeTerminalId:
          state.activeTerminalId === id
            ? remaining[0]?.id || null
            : state.activeTerminalId,
      };
    }),
  setActiveTerminal: (id) => set({ activeTerminalId: id }),
  updateTerminalOutput: (id, output, isRunning) =>
    set((state) => ({
      terminals: state.terminals.map((t) =>
        t.id === id ? { ...t, output, isRunning } : t
      ),
    })),

  // Agent
  agentGoal: '',
  setAgentGoal: (goal) => set({ agentGoal: goal }),
  agentResponse: null,
  setAgentResponse: (response) => set({ agentResponse: response }),
  isAgentRunning: false,
  setAgentRunning: (running) => set({ isAgentRunning: running }),
  conversationLog: [],
  currentConversationId: null,
  addToConversation: (message) =>
    set((state) => ({
      conversationLog: [...state.conversationLog, message],
    })),
  startNewConversation: () => {
    const state = get();
    // Save current conversation if it has messages
    if (state.conversationLog.length > 0) {
      state.saveConversationToHistory();
    }
    // Determine initial working directory: allowedFolder > workspaceRoot > null
    const initialWorkingDir = state.settings.allowedFolder || state.workspaceRoot || null;
    // Start fresh
    set({
      conversationLog: [],
      currentConversationId: crypto.randomUUID(),
      agentResponse: null,
      agentGoal: '',
      sessionStats: {
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        messageCount: 0,
      },
      currentChatWorkingDirectory: initialWorkingDir,
    });
  },
  clearConversation: () =>
    set({
      conversationLog: [],
      currentConversationId: null,
      agentResponse: null,
      agentGoal: '',
    }),
  chatHistory: (() => {
    try {
      const stored = localStorage.getItem('sentinelops_chat_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  })(),
  saveConversationToHistory: () => {
    const state = get();
    if (state.conversationLog.length === 0) return;

    const userMessages = state.conversationLog.filter(m => m.role === 'user');
    const title = userMessages[0]?.content.substring(0, 100) || 'Untitled';
    const existingIndex = state.chatHistory.findIndex(c => c.id === state.currentConversationId);

    const conversationData: ChatHistoryItem = {
      id: state.currentConversationId || crypto.randomUUID(),
      timestamp: existingIndex >= 0 ? state.chatHistory[existingIndex].timestamp : Date.now(),
      updatedAt: Date.now(),
      title,
      messages: [...state.conversationLog],
      model: state.llmModel,
      totalTokens: state.sessionStats.totalTokens,
      totalCost: state.sessionStats.totalCost,
      workingDirectory: state.currentChatWorkingDirectory || undefined,
    };

    let updated: ChatHistoryItem[];
    if (existingIndex >= 0) {
      // Update existing conversation
      updated = [...state.chatHistory];
      updated[existingIndex] = conversationData;
    } else {
      // Add new conversation
      updated = [conversationData, ...state.chatHistory].slice(0, 50);
    }

    localStorage.setItem('sentinelops_chat_history', JSON.stringify(updated));
    set({ chatHistory: updated, currentConversationId: conversationData.id });
  },
  loadConversation: (id) => {
    const state = get();
    const conversation = state.chatHistory.find(c => c.id === id);
    if (!conversation) return;

    set({
      conversationLog: [...conversation.messages],
      currentConversationId: id,
      agentResponse: null,
      agentGoal: '',
      llmModel: conversation.model,
      sessionStats: {
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: conversation.totalTokens,
        totalCost: conversation.totalCost,
        messageCount: conversation.messages.filter(m => m.role === 'assistant').length,
      },
      currentChatWorkingDirectory: conversation.workingDirectory || null,
    });
  },
  deleteChatFromHistory: (id) =>
    set((state) => {
      const updated = state.chatHistory.filter((c) => c.id !== id);
      localStorage.setItem('sentinelops_chat_history', JSON.stringify(updated));
      // If deleting current conversation, clear it
      if (state.currentConversationId === id) {
        return { chatHistory: updated, currentConversationId: null, conversationLog: [] };
      }
      return { chatHistory: updated };
    }),
  clearChatHistory: () => {
    localStorage.removeItem('sentinelops_chat_history');
    set({ chatHistory: [], currentConversationId: null });
  },
  sessionStats: {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    messageCount: 0,
  },
  updateSessionStats: (promptTokens, completionTokens, model) =>
    set((state) => {
      const cost = calculateCost(promptTokens, completionTokens, model);
      return {
        sessionStats: {
          totalPromptTokens: state.sessionStats.totalPromptTokens + promptTokens,
          totalCompletionTokens: state.sessionStats.totalCompletionTokens + completionTokens,
          totalTokens: state.sessionStats.totalTokens + promptTokens + completionTokens,
          totalCost: state.sessionStats.totalCost + cost,
          messageCount: state.sessionStats.messageCount + 1,
        },
      };
    }),
  resetSessionStats: () =>
    set({
      sessionStats: {
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        messageCount: 0,
      },
    }),

  // Memory System
  memories: [],
  setMemories: (memories) => set({ memories }),
  addMemory: (memory) =>
    set((state) => ({
      memories: [memory, ...state.memories],
    })),
  updateMemoryInStore: (id, memory) =>
    set((state) => ({
      memories: state.memories.map((m) => (m.id === id ? memory : m)),
    })),
  removeMemory: (id) =>
    set((state) => ({
      memories: state.memories.filter((m) => m.id !== id),
    })),
  memorySettings: null,
  setMemorySettings: (settings) => set({ memorySettings: settings }),
  memoryStats: null,
  setMemoryStats: (stats) => set({ memoryStats: stats }),
  isLoadingMemories: false,
  setLoadingMemories: (loading) => set({ isLoadingMemories: loading }),
  relevantMemories: [],
  setRelevantMemories: (memories) => set({ relevantMemories: memories }),
  showMemoryPanel: false,
  setShowMemoryPanel: (show) => set({ showMemoryPanel: show }),

  // Command palette
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  // Pending Commands (for AI agent approval)
  pendingCommands: [],
  agentPaused: false,
  pausedAtToolCallId: null,
  addPendingCommand: (cmd) => {
    const id = crypto.randomUUID();
    set((state) => ({
      pendingCommands: [
        ...state.pendingCommands,
        { ...cmd, id, status: 'pending' as const },
      ],
    }));
    return id;
  },
  updatePendingCommand: (id, updates) =>
    set((state) => ({
      pendingCommands: state.pendingCommands.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  removePendingCommand: (id) =>
    set((state) => ({
      pendingCommands: state.pendingCommands.filter((c) => c.id !== id),
    })),
  clearPendingCommands: () => set({ pendingCommands: [] }),
  setAgentPaused: (paused) => set({ agentPaused: paused }),
  setPausedAtToolCallId: (id) => set({ pausedAtToolCallId: id }),

  // Per-chat working directory
  currentChatWorkingDirectory: null,
  setCurrentChatWorkingDirectory: (dir) => set({ currentChatWorkingDirectory: dir }),

  // Installed Apps (pinned extensions)
  installedApps: (() => {
    try {
      const saved = localStorage.getItem('sentinelops-installed-apps');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })(),
  addInstalledApp: (app) => set((state) => {
    // Don't add duplicates
    if (state.installedApps.some(a => a.id === app.id)) {
      return state;
    }
    const newApp: InstalledApp = { ...app, addedAt: Date.now() };
    const updated = [...state.installedApps, newApp];
    localStorage.setItem('sentinelops-installed-apps', JSON.stringify(updated));
    return { installedApps: updated };
  }),
  removeInstalledApp: (id) => set((state) => {
    const updated = state.installedApps.filter(a => a.id !== id);
    localStorage.setItem('sentinelops-installed-apps', JSON.stringify(updated));
    return { installedApps: updated };
  }),
  clearInstalledApps: () => {
    localStorage.removeItem('sentinelops-installed-apps');
    set({ installedApps: [] });
  },

  // Settings
  settings: (() => {
    const defaults = {
      theme: 'dark' as const,
      fontSize: 14,
      tabSize: 2,
      wordWrap: true,
      minimap: true,
      autoSave: false,
      aiEnabled: true,
      mood: 'focused' as const,
    };
    try {
      const stored = localStorage.getItem('sentinelops_settings');
      return stored
        ? { ...defaults, ...JSON.parse(stored) }
        : defaults;
    } catch {
      return defaults;
    }
  })(),
  updateSettings: (newSettings) =>
    set((state) => {
      const updated = { ...state.settings, ...newSettings };
      localStorage.setItem('sentinelops_settings', JSON.stringify(updated));
      return { settings: updated };
    }),

  // Keyboard shortcuts
  keyboardShortcuts: (() => {
    try {
      const stored = localStorage.getItem('sentinelops_keyboard_shortcuts');
      return stored ? { ...DEFAULT_KEYBOARD_SHORTCUTS, ...JSON.parse(stored) } : { ...DEFAULT_KEYBOARD_SHORTCUTS };
    } catch {
      return { ...DEFAULT_KEYBOARD_SHORTCUTS };
    }
  })(),
  keyboardPreset: (() => {
    try {
      const stored = localStorage.getItem('sentinelops_keyboard_preset');
      return (stored as KeyboardPreset) || 'default';
    } catch {
      return 'default' as KeyboardPreset;
    }
  })(),
  updateKeyboardShortcut: (action, shortcut) =>
    set((state) => {
      const updated = { ...state.keyboardShortcuts, [action]: shortcut };
      localStorage.setItem('sentinelops_keyboard_shortcuts', JSON.stringify(updated));
      return { keyboardShortcuts: updated };
    }),
  resetKeyboardShortcuts: () => {
    localStorage.removeItem('sentinelops_keyboard_shortcuts');
    localStorage.removeItem('sentinelops_keyboard_preset');
    set({ keyboardShortcuts: { ...DEFAULT_KEYBOARD_SHORTCUTS }, keyboardPreset: 'default' });
  },
  applyKeyboardPreset: (preset) => {
    const shortcuts = getKeyboardPreset(preset);
    localStorage.setItem('sentinelops_keyboard_shortcuts', JSON.stringify(shortcuts));
    localStorage.setItem('sentinelops_keyboard_preset', preset);
    set({ keyboardShortcuts: shortcuts, keyboardPreset: preset });
  },

  // Extension theme state (for triggering re-renders)
  iconThemeVersion: 0,
  incrementIconThemeVersion: () =>
    set((state) => ({ iconThemeVersion: state.iconThemeVersion + 1 })),

  // Recent files
  recentFiles: (() => {
    try {
      const stored = localStorage.getItem('sentinelops_recent_files');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  })(),
  addRecentFile: (path, name) =>
    set((state) => {
      const filtered = state.recentFiles.filter((f) => f.path !== path);
      const updated = [{ path, name, timestamp: Date.now() }, ...filtered].slice(0, 20);
      localStorage.setItem('sentinelops_recent_files', JSON.stringify(updated));
      return { recentFiles: updated };
    }),
  clearRecentFiles: () => {
    localStorage.removeItem('sentinelops_recent_files');
    set({ recentFiles: [] });
  },
  recentFilesOpen: false,
  setRecentFilesOpen: (open) => set({ recentFilesOpen: open }),

  // Split editor
  splitDirection: null,
  editorGroups: [{ id: 'main', files: [], activeFile: null }],
  activeGroupId: 'main',
  setSplitDirection: (direction) => set({ splitDirection: direction }),
  splitEditor: (direction) =>
    set((state) => {
      if (state.splitDirection) return state; // Already split
      const newGroup: EditorGroup = { id: 'split', files: [], activeFile: null };
      return {
        splitDirection: direction,
        editorGroups: [...state.editorGroups, newGroup],
      };
    }),
  closeSplit: () =>
    set((state) => {
      // Move all files from split group to main
      const mainGroup = state.editorGroups.find((g) => g.id === 'main');
      const splitGroup = state.editorGroups.find((g) => g.id === 'split');
      if (!mainGroup || !splitGroup) return state;

      return {
        splitDirection: null,
        editorGroups: [
          {
            ...mainGroup,
            files: [...new Set([...mainGroup.files, ...splitGroup.files])],
          },
        ],
        activeGroupId: 'main',
      };
    }),
  moveFileToGroup: (path, groupId) =>
    set((state) => ({
      editorGroups: state.editorGroups.map((g) => {
        if (g.id === groupId) {
          return {
            ...g,
            files: g.files.includes(path) ? g.files : [...g.files, path],
            activeFile: path,
          };
        }
        return {
          ...g,
          files: g.files.filter((f) => f !== path),
          activeFile: g.activeFile === path ? (g.files[0] || null) : g.activeFile,
        };
      }),
      activeGroupId: groupId,
    })),
  setActiveGroup: (groupId) => set({ activeGroupId: groupId }),

  // Symbol outline
  showSymbolOutline: false,
  setShowSymbolOutline: (show) => set({ showSymbolOutline: show }),

  // Markdown preview
  showMarkdownPreview: false,
  setShowMarkdownPreview: (show) => set({ showMarkdownPreview: show }),

  // Extension settings
  extensionSettings: {},
  extensionConfigurations: [],
  setExtensionSettings: (settings) => set({ extensionSettings: settings }),
  setExtensionConfigurations: (configs) => set({ extensionConfigurations: configs }),
  updateExtensionSetting: (key, value) =>
    set((state) => ({
      extensionSettings: { ...state.extensionSettings, [key]: value },
    })),

  // Update state
  updateAvailable: null,
  updateProgress: null,
  isCheckingUpdate: false,
  isDownloadingUpdate: false,
  setUpdateAvailable: (update) => set({ updateAvailable: update }),
  setUpdateProgress: (progress) => set({ updateProgress: progress }),
  setCheckingUpdate: (checking) => set({ isCheckingUpdate: checking }),
  setDownloadingUpdate: (downloading) => set({ isDownloadingUpdate: downloading }),

  // Setup wizard state
  showSetupWizard: false,
  setShowSetupWizard: (show) => set({ showSetupWizard: show }),
  isFirstLaunch: !localStorage.getItem('sentinelops_setup_complete'),

  // Auth state - also apply owner role check when loading from cache
  authUser: (() => {
    try {
      const cached = localStorage.getItem('sentinelops_auth_user');
      if (!cached) return null;
      const user = JSON.parse(cached);
      // Apply owner role if email matches (in case it wasn't set before)
      if (user && isOwnerEmail(user.email)) {
        user.role = 'owner';
      }
      return user;
    } catch {
      return null;
    }
  })(),
  setAuthUser: (user) => {
    if (user) {
      // Automatically assign owner role if email matches
      const userWithRole = {
        ...user,
        role: isOwnerEmail(user.email) ? 'owner' as const : (user.role || 'user' as const),
      };
      localStorage.setItem('sentinelops_auth_user', JSON.stringify(userWithRole));
      set({ authUser: userWithRole });
    } else {
      localStorage.removeItem('sentinelops_auth_user');
      set({ authUser: user });
    }
  },
  isAuthLoading: false,
  setAuthLoading: (loading) => set({ isAuthLoading: loading }),

  // Usage tracking for daily limits
  dailyUsage: (() => {
    try {
      const cached = localStorage.getItem('sentinelops_daily_usage');
      if (cached) {
        const data = JSON.parse(cached);
        // Check if we need to reset (new day)
        const today = new Date().toDateString();
        if (data.date !== today) {
          return { messageCount: 0, date: today };
        }
        return data;
      }
      return { messageCount: 0, date: new Date().toDateString() };
    } catch {
      return { messageCount: 0, date: new Date().toDateString() };
    }
  })(),
  incrementDailyUsage: () => {
    const today = new Date().toDateString();
    set((state) => {
      const currentDate = state.dailyUsage.date;
      const newCount = currentDate === today ? state.dailyUsage.messageCount + 1 : 1;
      const newUsage = { messageCount: newCount, date: today };
      localStorage.setItem('sentinelops_daily_usage', JSON.stringify(newUsage));
      return { dailyUsage: newUsage };
    });
  },
  resetDailyUsage: () => {
    const newUsage = { messageCount: 0, date: new Date().toDateString() };
    localStorage.setItem('sentinelops_daily_usage', JSON.stringify(newUsage));
    set({ dailyUsage: newUsage });
  },

  // Bonus messages (purchased, don't reset daily)
  bonusMessages: (() => {
    try {
      const cached = localStorage.getItem('sentinelops_bonus_messages');
      return cached ? parseInt(cached, 10) : 0;
    } catch {
      return 0;
    }
  })(),
  addBonusMessages: (count) => {
    set((state) => {
      const newCount = state.bonusMessages + count;
      localStorage.setItem('sentinelops_bonus_messages', String(newCount));
      return { bonusMessages: newCount };
    });
  },
  useBonusMessage: () => {
    const state = useStore.getState();
    if (state.bonusMessages > 0) {
      const newCount = state.bonusMessages - 1;
      localStorage.setItem('sentinelops_bonus_messages', String(newCount));
      set({ bonusMessages: newCount });
      return true;
    }
    return false;
  },
}));

export default useStore;
