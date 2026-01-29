import { api, ExtensionContributions, ThemeContribution, ThemeColors, IconThemeContribution, GrammarContribution, SnippetContribution, VsCodeSnippet } from './api';

// ============================================================================
// Extension Service - Manages loading and applying extension contributions
// ============================================================================

// Monaco snippet format
export interface MonacoSnippet {
  label: string;
  insertText: string;
  insertTextRules: number; // 4 = InsertAsSnippet
  documentation?: string;
}

class ExtensionService {
  private contributions: ExtensionContributions | null = null;
  private loadedTheme: ThemeColors | null = null;
  private loadedIconTheme: Record<string, unknown> | null = null;
  private iconThemeBasePath: string = '';
  private loadedSnippets: Map<string, MonacoSnippet[]> = new Map();

  // --------------------------------------------------------------------------
  // Contributions Loading
  // --------------------------------------------------------------------------

  async loadContributions(): Promise<ExtensionContributions> {
    const result = await api.loadExtensionContributions();
    if (result.ok && result.data) {
      this.contributions = result.data;
      console.log('Loaded extension contributions:', {
        themes: this.contributions.themes.length,
        iconThemes: this.contributions.iconThemes.length,
        grammars: this.contributions.grammars.length,
        languages: this.contributions.languages.length,
        snippets: this.contributions.snippets.length,
        configuration: this.contributions.configuration?.length || 0,
      });
      return this.contributions;
    }
    return { themes: [], iconThemes: [], grammars: [], languages: [], snippets: [], configuration: [] };
  }

  getContributions(): ExtensionContributions | null {
    return this.contributions;
  }

  // --------------------------------------------------------------------------
  // Theme Management
  // --------------------------------------------------------------------------

  getAvailableThemes(): ThemeContribution[] {
    return this.contributions?.themes || [];
  }

  async loadTheme(theme: ThemeContribution): Promise<ThemeColors | null> {
    const result = await api.loadThemeFile(theme.path);
    if (result.ok && result.data) {
      this.loadedTheme = result.data;
      return result.data;
    }
    console.error('Failed to load theme:', result.error);
    return null;
  }

  getLoadedTheme(): ThemeColors | null {
    return this.loadedTheme;
  }

  // Apply theme colors to the app
  applyTheme(colors: ThemeColors): void {
    const root = document.documentElement;

    // Map VSCode theme colors to CSS variables
    const colorMappings: Record<string, string> = {
      'editor.background': '--editor-bg',
      'editor.foreground': '--editor-fg',
      'editorLineNumber.foreground': '--line-number-fg',
      'editorLineNumber.activeForeground': '--line-number-active-fg',
      'editor.selectionBackground': '--selection-bg',
      'editor.lineHighlightBackground': '--line-highlight-bg',
      'editorCursor.foreground': '--cursor-color',
      'sideBar.background': '--sidebar-bg',
      'sideBar.foreground': '--sidebar-fg',
      'sideBarSectionHeader.background': '--sidebar-header-bg',
      'activityBar.background': '--activity-bar-bg',
      'activityBar.foreground': '--activity-bar-fg',
      'titleBar.activeBackground': '--titlebar-bg',
      'titleBar.activeForeground': '--titlebar-fg',
      'statusBar.background': '--statusbar-bg',
      'statusBar.foreground': '--statusbar-fg',
      'tab.activeBackground': '--tab-active-bg',
      'tab.activeForeground': '--tab-active-fg',
      'tab.inactiveBackground': '--tab-inactive-bg',
      'tab.inactiveForeground': '--tab-inactive-fg',
      'panel.background': '--panel-bg',
      'panel.border': '--panel-border',
      'terminal.background': '--terminal-bg',
      'terminal.foreground': '--terminal-fg',
      'input.background': '--input-bg',
      'input.foreground': '--input-fg',
      'input.border': '--input-border',
      'button.background': '--button-bg',
      'button.foreground': '--button-fg',
      'list.activeSelectionBackground': '--list-active-bg',
      'list.activeSelectionForeground': '--list-active-fg',
      'list.hoverBackground': '--list-hover-bg',
      'focusBorder': '--focus-border',
      'foreground': '--foreground',
      'descriptionForeground': '--description-fg',
      'errorForeground': '--error-fg',
      'textLink.foreground': '--link-fg',
      'badge.background': '--badge-bg',
      'badge.foreground': '--badge-fg',
    };

    // Apply color mappings
    for (const [vsKey, cssVar] of Object.entries(colorMappings)) {
      const color = colors.colors[vsKey];
      if (color) {
        root.style.setProperty(cssVar, color);
      }
    }

    // Store token colors for Monaco
    (window as unknown as { __themeTokenColors: typeof colors.tokenColors }).__themeTokenColors = colors.tokenColors;

    console.log('Theme applied:', colors.name || 'Custom Theme');
  }

  // --------------------------------------------------------------------------
  // Icon Theme Management
  // --------------------------------------------------------------------------

  getAvailableIconThemes(): IconThemeContribution[] {
    return this.contributions?.iconThemes || [];
  }

  async loadIconTheme(theme: IconThemeContribution): Promise<Record<string, unknown> | null> {
    const result = await api.loadIconThemeFile(theme.path);
    if (result.ok && result.data) {
      this.loadedIconTheme = result.data;
      // Store the base path for resolving icon paths
      this.iconThemeBasePath = theme.path.replace(/[/\\][^/\\]+$/, '');
      return result.data;
    }
    console.error('Failed to load icon theme:', result.error);
    return null;
  }

  // Get icon for a file - returns icon ID and path
  getFileIcon(filename: string, isDirectory: boolean = false, isExpanded: boolean = false): { iconId: string; iconPath: string } | null {
    if (!this.loadedIconTheme) return null;

    const iconDefs = this.loadedIconTheme.iconDefinitions as Record<string, { iconPath?: string }> | undefined;
    if (!iconDefs) return null;

    const ext = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : '';
    const name = filename.toLowerCase();

    // Try specific file name first
    const fileNames = this.loadedIconTheme.fileNames as Record<string, string> | undefined;
    const fileExtensions = this.loadedIconTheme.fileExtensions as Record<string, string> | undefined;
    const folderNames = this.loadedIconTheme.folderNames as Record<string, string> | undefined;
    const folderNamesExpanded = this.loadedIconTheme.folderNamesExpanded as Record<string, string> | undefined;

    let iconId: string | undefined;

    if (isDirectory) {
      if (isExpanded) {
        iconId = folderNamesExpanded?.[name] || (this.loadedIconTheme.folderExpanded as string) || folderNames?.[name] || (this.loadedIconTheme.folder as string);
      } else {
        iconId = folderNames?.[name] || (this.loadedIconTheme.folder as string);
      }
    } else {
      iconId = fileNames?.[name] || (ext ? fileExtensions?.[ext] : undefined) || (this.loadedIconTheme.file as string);
    }

    if (iconId && iconDefs[iconId]?.iconPath) {
      const iconPath = iconDefs[iconId].iconPath;
      // Resolve relative path - convert to URL that can be loaded
      const fullPath = `${this.iconThemeBasePath}/${iconPath}`.replace(/\\/g, '/');
      return { iconId, iconPath: fullPath };
    }

    return null;
  }

  // Check if an icon theme is loaded
  hasIconTheme(): boolean {
    return this.loadedIconTheme !== null;
  }

  // Get the base path for the icon theme
  getIconThemeBasePath(): string {
    return this.iconThemeBasePath;
  }

  // --------------------------------------------------------------------------
  // Grammar Management
  // --------------------------------------------------------------------------

  getAvailableGrammars(): GrammarContribution[] {
    return this.contributions?.grammars || [];
  }

  async loadGrammar(grammar: GrammarContribution): Promise<Record<string, unknown> | null> {
    const result = await api.loadGrammarFile(grammar.path);
    if (result.ok && result.data) {
      return result.data;
    }
    console.error('Failed to load grammar:', result.error);
    return null;
  }

  // Get grammar for a language
  getGrammarForLanguage(languageId: string): GrammarContribution | undefined {
    return this.contributions?.grammars.find(g => g.language === languageId);
  }

  // Get grammar by scope name
  getGrammarByScopeName(scopeName: string): GrammarContribution | undefined {
    return this.contributions?.grammars.find(g => g.scopeName === scopeName);
  }

  // --------------------------------------------------------------------------
  // Snippet Management
  // --------------------------------------------------------------------------

  getAvailableSnippets(): SnippetContribution[] {
    return this.contributions?.snippets || [];
  }

  // Load all snippets for a language
  async loadSnippetsForLanguage(languageId: string): Promise<MonacoSnippet[]> {
    // Check if already loaded
    if (this.loadedSnippets.has(languageId)) {
      return this.loadedSnippets.get(languageId) || [];
    }

    const snippetContributions = this.contributions?.snippets.filter(s => s.language === languageId) || [];
    const allSnippets: MonacoSnippet[] = [];

    for (const contribution of snippetContributions) {
      const result = await api.loadSnippetsFile(contribution.path, languageId);
      if (result.ok && result.data) {
        for (const [name, snippet] of Object.entries(result.data.snippets)) {
          const monacoSnippet = this.convertToMonacoSnippet(name, snippet);
          allSnippets.push(monacoSnippet);
        }
      }
    }

    this.loadedSnippets.set(languageId, allSnippets);
    console.log(`Loaded ${allSnippets.length} snippets for ${languageId}`);
    return allSnippets;
  }

  // Convert VSCode snippet to Monaco format
  private convertToMonacoSnippet(name: string, snippet: VsCodeSnippet): MonacoSnippet {
    // Get the prefix (trigger text)
    const prefix = Array.isArray(snippet.prefix) ? snippet.prefix[0] : snippet.prefix;

    // Convert body to string (VSCode can use array for multi-line)
    const body = Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body;

    return {
      label: prefix || name,
      insertText: body,
      insertTextRules: 4, // monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      documentation: snippet.description,
    };
  }

  // Get all loaded snippets for a language
  getSnippetsForLanguage(languageId: string): MonacoSnippet[] {
    return this.loadedSnippets.get(languageId) || [];
  }

  // Clear loaded snippets (e.g., when extensions change)
  clearSnippets(): void {
    this.loadedSnippets.clear();
  }

  // --------------------------------------------------------------------------
  // Language Management
  // --------------------------------------------------------------------------

  // Get language ID for a file extension
  getLanguageForExtension(ext: string): string | undefined {
    const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
    const lang = this.contributions?.languages.find(l =>
      l.extensions.includes(normalizedExt)
    );
    return lang?.id;
  }
}

export const extensionService = new ExtensionService();
export default extensionService;
