import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// Types
// ============================================================================

export interface ApiResponse<T> {
  ok: boolean;
  request_id: string;
  data: T | null;
  error: { code: string; message: string } | null;
}

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modifiedAt: string;
}

export interface FileStat {
  path: string;
  name: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  createdAt: string;
  modifiedAt: string;
  accessedAt: string;
  mode: number;
  sha256?: string;
}

export interface SearchMatch {
  path: string;
  line: number;
  column: number;
  text: string;
}

export interface TrashItem {
  trashId: string;
  originalPath: string;
  deletedAt: string;
  type: 'file' | 'directory';
  size: number;
  sha256?: string;
  request_id: string;
}

export interface GitChange {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  staged: boolean;
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote: boolean;
}

export interface GitCommit {
  hash: string;
  fullHash: string;
  message: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  };
}

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  model: string;
  width: number;
  height: number;
  numImages: number;
  steps?: number;
  guidanceScale?: number;
  seed?: number;
}

export interface ExtensionInfo {
  id: string;
  name: string;
  publisher: string;
  version: string;
  description?: string;
  icon?: string;
  installed: boolean;
  path?: string;
  // Rich metadata from Open-VSX
  downloadCount?: number;
  averageRating?: number;
  reviewCount?: number;
  repository?: string;
  homepage?: string;
  license?: string;
  categories?: string[];
  tags?: string[];
  lastUpdated?: string;
  preview?: boolean;
}

export interface ExtensionContributions {
  themes: ThemeContribution[];
  iconThemes: IconThemeContribution[];
  grammars: GrammarContribution[];
  languages: LanguageContribution[];
  snippets: SnippetContribution[];
  configuration: ExtensionConfiguration[];
}

export interface ExtensionConfiguration {
  extensionId: string;
  extensionName: string;
  title?: string;
  properties: Record<string, ConfigurationProperty>;
}

export interface ConfigurationProperty {
  propType?: string;
  default?: unknown;
  description?: string;
  markdownDescription?: string;
  enumValues?: unknown[];
  enumDescriptions?: string[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  deprecated?: boolean;
  deprecationMessage?: string;
  scope?: string;
  order?: number;
}

export interface ExtensionSettingsData {
  settings: Record<string, unknown>;
}

export interface ThemeContribution {
  id: string;
  label: string;
  uiTheme: string;
  path: string;
  extensionId: string;
}

export interface IconThemeContribution {
  id: string;
  label: string;
  path: string;
  extensionId: string;
}

export interface GrammarContribution {
  language?: string;
  scopeName: string;
  path: string;
  extensionId: string;
  embeddedLanguages?: Record<string, string>;
}

export interface LanguageContribution {
  id: string;
  extensions: string[];
  aliases: string[];
  configuration?: string;
  extensionId: string;
}

export interface SnippetContribution {
  language: string;
  path: string;
  extensionId: string;
}

export interface VsCodeSnippet {
  prefix: string | string[];
  body: string | string[];
  description?: string;
}

export interface LoadedSnippets {
  language: string;
  snippets: Record<string, VsCodeSnippet>;
}

export interface ThemeColors {
  colors: Record<string, string>;
  tokenColors: TokenColor[];
  name?: string;
  themeType?: string;
}

export interface TokenColor {
  name?: string;
  scope?: string | string[];
  settings: {
    foreground?: string;
    background?: string;
    fontStyle?: string;
  };
}

export interface ShellInfo {
  id: string;
  name: string;
  path: string;
  args: string[];
}

export interface WebSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  count: number;
}

export interface SqliteTable {
  name: string;
  tableType: string;
  rowCount: number | null;
}

export interface SqliteColumn {
  cid: number;
  name: string;
  columnType: string;
  notnull: boolean;
  dfltValue: string | null;
  pk: boolean;
}

export interface SqliteIndex {
  name: string;
  tableName: string;
  unique: boolean;
  columns: string[];
}

export interface SqliteQueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  affectedRows: number | null;
  executionTimeMs: number;
}

export interface SqliteSchemaInfo {
  tables: SqliteTable[];
  version: string;
  databaseSize: number;
  pageSize: number;
  pageCount: number;
}

// ============================================================================
// API Client
// ============================================================================

class TauriApiClient {
  // --------------------------------------------------------------------------
  // Config & App Info
  // --------------------------------------------------------------------------

  async getConfig(): Promise<ApiResponse<{
    workspaceRoot: string;
    llmConfigured: boolean;
    llmProvider: string;
    llmModel: string;
  }>> {
    return invoke('get_config');
  }

  async setWorkspace(path: string): Promise<ApiResponse<{ workspaceRoot: string }>> {
    return invoke('set_workspace', { path });
  }

  async getAppInfo(): Promise<ApiResponse<{
    version: string;
    name: string;
    platform: string;
  }>> {
    return invoke('get_app_info');
  }

  // --------------------------------------------------------------------------
  // File Operations
  // --------------------------------------------------------------------------

  async list(
    path: string = '.',
    recursive: boolean = false,
    includeHidden: boolean = false
  ): Promise<ApiResponse<{ entries: FileEntry[]; count: number }>> {
    return invoke('list_directory', { path, recursive, includeHidden });
  }

  async stat(path: string, includeHash: boolean = false): Promise<ApiResponse<FileStat>> {
    return invoke('get_stat', { path, includeHash });
  }

  async read(path: string): Promise<ApiResponse<{ content: string; sha256: string; size: number }>> {
    return invoke('read_file', { path });
  }

  async readBinary(path: string): Promise<ApiResponse<{ content: string; size: number; mimeType: string }>> {
    return invoke('read_file_binary', { path });
  }

  async write(
    path: string,
    content: string,
    options: { createDirs?: boolean; overwrite?: boolean } = {}
  ): Promise<ApiResponse<{ path: string; sha256: string; created: boolean; bytesWritten: number }>> {
    return invoke('write_file', {
      path,
      content,
      createDirs: options.createDirs ?? true,
      overwrite: options.overwrite ?? true,
    });
  }

  async mkdir(
    path: string,
    options: { recursive?: boolean } = {}
  ): Promise<ApiResponse<{ path: string; created: boolean }>> {
    return invoke('create_directory', { path, recursive: options.recursive ?? true });
  }

  async move(
    from: string,
    to: string,
    options: { overwrite?: boolean } = {}
  ): Promise<ApiResponse<{ from: string; to: string; moved: boolean }>> {
    return invoke('move_path', { from, to, overwrite: options.overwrite ?? false });
  }

  async copy(
    from: string,
    to: string,
    options: { overwrite?: boolean } = {}
  ): Promise<ApiResponse<{ from: string; to: string; copied: boolean }>> {
    return invoke('copy_path', { from, to, overwrite: options.overwrite ?? false });
  }

  async delete(
    path: string,
    options: { recursive?: boolean; permanent?: boolean } = {}
  ): Promise<ApiResponse<{ path: string; deleted: boolean; trashId?: string }>> {
    return invoke('delete_path', {
      path,
      recursive: options.recursive ?? false,
      permanent: options.permanent ?? false,
    });
  }

  async search(
    query: string,
    options: {
      path?: string;
      caseSensitive?: boolean;
      maxResults?: number;
    } = {}
  ): Promise<ApiResponse<{ matches: SearchMatch[]; count: number; truncated: boolean }>> {
    return invoke('search_files', {
      query,
      path: options.path ?? '.',
      caseSensitive: options.caseSensitive ?? false,
      maxResults: options.maxResults ?? 200,
    });
  }

  async exists(path: string): Promise<ApiResponse<boolean>> {
    return invoke('exists', { path });
  }

  // --------------------------------------------------------------------------
  // Trash Operations
  // --------------------------------------------------------------------------

  async trashList(date?: string): Promise<ApiResponse<{ items: TrashItem[]; count: number }>> {
    return invoke('list_trash', { date });
  }

  async trashRestore(
    trashId: string,
    options: { toPath?: string } = {}
  ): Promise<ApiResponse<{ restored: boolean; toPath: string }>> {
    return invoke('restore_from_trash', { trashId, toPath: options.toPath });
  }

  async trashPurge(
    options: { trashId?: string; olderThanDays?: number } = {}
  ): Promise<ApiResponse<{ purged: string[] }>> {
    return invoke('purge_trash', {
      trashId: options.trashId,
      olderThanDays: options.olderThanDays,
    });
  }

  // --------------------------------------------------------------------------
  // Git Operations
  // --------------------------------------------------------------------------

  async gitStatus(path?: string): Promise<ApiResponse<{ branch: string | null; changes: GitChange[] }>> {
    return invoke('git_status', { path });
  }

  async gitStage(paths: string[]): Promise<ApiResponse<{ staged: string[] }>> {
    return invoke('git_stage', { paths });
  }

  async gitUnstage(paths: string[]): Promise<ApiResponse<{ unstaged: string[] }>> {
    return invoke('git_unstage', { paths });
  }

  async gitCommit(message: string): Promise<ApiResponse<{ committed: boolean; output: string }>> {
    return invoke('git_commit', { message });
  }

  async gitDiff(path?: string): Promise<ApiResponse<{ diff: string }>> {
    return invoke('git_diff', { path });
  }

  async gitBranches(): Promise<ApiResponse<{ branches: GitBranch[] }>> {
    return invoke('git_branches');
  }

  async gitCheckout(name: string, create?: boolean): Promise<ApiResponse<{ branch: string; output: string }>> {
    return invoke('git_checkout', { name, create });
  }

  async gitLog(limit?: number): Promise<ApiResponse<{ commits: GitCommit[] }>> {
    return invoke('git_log', { limit });
  }

  // --------------------------------------------------------------------------
  // Terminal Operations
  // --------------------------------------------------------------------------

  async terminalExecute(
    command: string,
    options?: { cwd?: string; terminalId?: string; shell?: string }
  ): Promise<ApiResponse<{ terminalId: string; pid?: number }>> {
    return invoke('execute_command', {
      command,
      cwd: options?.cwd,
      terminalId: options?.terminalId,
      shell: options?.shell,
    });
  }

  async terminalKill(terminalId: string): Promise<ApiResponse<{ killed: boolean }>> {
    return invoke('kill_terminal', { terminalId });
  }

  async terminalOutput(terminalId: string): Promise<ApiResponse<{ output: string; isRunning: boolean; cwd: string }>> {
    return invoke('get_terminal_output', { terminalId });
  }

  async listAvailableShells(): Promise<ApiResponse<{ shells: ShellInfo[] }>> {
    return invoke('list_available_shells');
  }

  // --------------------------------------------------------------------------
  // LLM Operations
  // --------------------------------------------------------------------------

  async testLlmConnection(): Promise<ApiResponse<{
    connected: boolean;
    model: string;
    provider: string;
    message?: string;
  }>> {
    return invoke('test_llm_connection');
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: { model?: string; temperature?: number; maxTokens?: number }
  ): Promise<ApiResponse<{
    id: string;
    model: string;
    content: string | null;
    finishReason: string;
    usage?: TokenUsage;
  }>> {
    return invoke('chat_completion', {
      messages,
      model: options?.model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });
  }

  async chatCompletionWithTools(
    messages: (ChatMessage | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] } | { role: 'tool'; tool_call_id: string; content: string })[],
    tools?: ToolDefinition[],
    options?: { model?: string; temperature?: number; maxTokens?: number }
  ): Promise<ApiResponse<{
    id: string;
    model: string;
    content: string | null;
    finishReason: string;
    toolCalls?: ToolCall[];
    usage?: TokenUsage;
  }>> {
    return invoke('chat_completion_with_tools', {
      messages,
      tools,
      model: options?.model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });
  }

  async generateImage(request: ImageGenerationRequest): Promise<ApiResponse<{
    images: string[];
    model: string;
  }>> {
    return invoke('generate_image', {
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      model: request.model,
      width: request.width,
      height: request.height,
      numImages: request.numImages,
      steps: request.steps,
      guidanceScale: request.guidanceScale,
      seed: request.seed,
    });
  }

  // --------------------------------------------------------------------------
  // Extension Operations
  // --------------------------------------------------------------------------

  async listVscodeExtensions(): Promise<ApiResponse<{ extensions: ExtensionInfo[]; count: number }>> {
    return invoke('list_vscode_extensions');
  }

  async listInstalledExtensions(): Promise<ApiResponse<{ extensions: ExtensionInfo[]; count: number }>> {
    return invoke('list_installed_extensions');
  }

  async searchOpenvsx(query: string): Promise<ApiResponse<{ extensions: ExtensionInfo[]; count: number }>> {
    return invoke('search_openvsx', { query });
  }

  async getOpenvsxExtension(extensionId: string): Promise<ApiResponse<ExtensionInfo>> {
    return invoke('get_openvsx_extension', { extensionId });
  }

  async installExtension(extensionId: string): Promise<ApiResponse<ExtensionInfo>> {
    return invoke('install_extension', { extensionId });
  }

  async uninstallExtension(extensionId: string): Promise<ApiResponse<boolean>> {
    return invoke('uninstall_extension', { extensionId });
  }

  async loadExtensionContributions(): Promise<ApiResponse<ExtensionContributions>> {
    return invoke('load_extension_contributions');
  }

  async loadThemeFile(path: string): Promise<ApiResponse<ThemeColors>> {
    return invoke('load_theme_file', { path });
  }

  async loadIconThemeFile(path: string): Promise<ApiResponse<Record<string, unknown>>> {
    return invoke('load_icon_theme_file', { path });
  }

  async loadGrammarFile(path: string): Promise<ApiResponse<Record<string, unknown>>> {
    return invoke('load_grammar_file', { path });
  }

  async loadSnippetsFile(path: string, language: string): Promise<ApiResponse<LoadedSnippets>> {
    return invoke('load_snippets_file', { path, language });
  }

  async loadExtensionIcon(path: string): Promise<ApiResponse<string>> {
    return invoke('load_extension_icon', { path });
  }

  async loadExtensionReadme(extensionId: string): Promise<ApiResponse<string>> {
    return invoke('load_extension_readme', { extensionId });
  }

  async getExtensionSettings(): Promise<ApiResponse<ExtensionSettingsData>> {
    return invoke('get_extension_settings');
  }

  async setExtensionSetting(key: string, value: unknown): Promise<ApiResponse<boolean>> {
    return invoke('set_extension_setting', { key, value });
  }

  async resetExtensionSetting(key: string): Promise<ApiResponse<boolean>> {
    return invoke('reset_extension_setting', { key });
  }

  // --------------------------------------------------------------------------
  // Web Search Operations
  // --------------------------------------------------------------------------

  async webSearch(query: string, count?: number): Promise<ApiResponse<WebSearchResponse>> {
    return invoke('web_search', { query, count });
  }

  // --------------------------------------------------------------------------
  // SQLite Operations
  // --------------------------------------------------------------------------

  async sqliteGetSchema(path: string): Promise<ApiResponse<SqliteSchemaInfo>> {
    return invoke('sqlite_get_schema', { path });
  }

  async sqliteGetColumns(path: string, table: string): Promise<ApiResponse<SqliteColumn[]>> {
    return invoke('sqlite_get_columns', { path, table });
  }

  async sqliteGetIndexes(path: string, table: string): Promise<ApiResponse<SqliteIndex[]>> {
    return invoke('sqlite_get_indexes', { path, table });
  }

  async sqliteExecuteQuery(path: string, query: string): Promise<ApiResponse<SqliteQueryResult>> {
    return invoke('sqlite_execute_query', { path, query });
  }

  async sqliteGetTableData(
    path: string,
    table: string,
    limit?: number,
    offset?: number
  ): Promise<ApiResponse<SqliteQueryResult>> {
    return invoke('sqlite_get_table_data', { path, table, limit, offset });
  }

  // --------------------------------------------------------------------------
  // Health Check (compatibility method)
  // --------------------------------------------------------------------------

  async health(): Promise<ApiResponse<{
    status: string;
    workspace: string;
    qwen?: { configured: boolean; connected?: boolean; model?: string; provider?: string };
  }>> {
    try {
      const config = await this.getConfig();
      if (config.ok && config.data) {
        return {
          ok: true,
          request_id: config.request_id,
          data: {
            status: 'ok',
            workspace: config.data.workspaceRoot,
            qwen: {
              configured: config.data.llmConfigured,
              model: config.data.llmModel,
              provider: config.data.llmProvider,
            },
          },
          error: null,
        };
      }
      return {
        ok: false,
        request_id: config.request_id,
        data: null,
        error: config.error,
      };
    } catch (error) {
      return {
        ok: false,
        request_id: 'error',
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const api = new TauriApiClient();
export default api;
