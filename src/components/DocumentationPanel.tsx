import { useState } from 'react';
import {
  BookOpen,
  Zap,
  CreditCard,
  RefreshCw,
  ChevronRight,
  ExternalLink,
  Files,
  Search,
  GitBranch,
  Play,
  Package,
  Database,
  Bot,
  Trash2,
  Settings,
  Keyboard,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';

type DocSection =
  | 'getting-started'
  | 'explorer'
  | 'search'
  | 'source-control'
  | 'terminal'
  | 'extensions'
  | 'sqlite'
  | 'agent'
  | 'trash'
  | 'settings'
  | 'environment'
  | 'payments'
  | 'updates'
  | 'keyboard';

const DOCS_REPO = 'https://github.com/LuminaryxApp/sentinelops';
const REPORT_ISSUE_URL = 'https://github.com/LuminaryxApp/sentinelops/issues/new';

const sections: { id: DocSection; label: string; icon: React.ReactNode }[] = [
  { id: 'getting-started', label: 'Getting Started', icon: <BookOpen size={18} /> },
  { id: 'explorer', label: 'Explorer & Files', icon: <Files size={18} /> },
  { id: 'search', label: 'Search', icon: <Search size={18} /> },
  { id: 'source-control', label: 'Source Control', icon: <GitBranch size={18} /> },
  { id: 'terminal', label: 'Terminal', icon: <Play size={18} /> },
  { id: 'extensions', label: 'Extensions', icon: <Package size={18} /> },
  { id: 'sqlite', label: 'SQLite Browser', icon: <Database size={18} /> },
  { id: 'agent', label: 'AI Agent', icon: <Bot size={18} /> },
  { id: 'trash', label: 'Trash', icon: <Trash2 size={18} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
  { id: 'environment', label: 'Environment & LLM', icon: <Zap size={18} /> },
  { id: 'payments', label: 'Payments & Subscriptions', icon: <CreditCard size={18} /> },
  { id: 'updates', label: 'Updates', icon: <RefreshCw size={18} /> },
  { id: 'keyboard', label: 'Keyboard & Command Palette', icon: <Keyboard size={18} /> },
];

function DocHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-[#E0E0E0] mt-6 mb-2 first:mt-0">{children}</h2>;
}
function DocH3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium text-[#D4D4D4] mt-4 mb-2">{children}</h3>;
}
function DocP({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[#CCCCCC] leading-relaxed mb-3">{children}</p>;
}
function DocUl({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc list-inside text-sm text-[#CCCCCC] space-y-1 mb-3 ml-2">{children}</ul>;
}
function DocOl({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal list-inside text-sm text-[#CCCCCC] space-y-1 mb-3 ml-2">{children}</ol>;
}
void DocOl; // suppress unused warning
function DocCode({ children }: { children: React.ReactNode }) {
  return <code className="px-1.5 py-0.5 rounded bg-[#2D2D2D] text-[#CE9178] text-xs font-mono">{children}</code>;
}
function DocPre({ children }: { children: React.ReactNode }) {
  return <pre className="bg-[#1E1E1E] border border-[#3C3C3C] rounded p-3 text-xs text-[#D4D4D4] overflow-x-auto mb-3 font-mono">{children}</pre>;
}
void DocPre; // suppress unused warning
function DocTable({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto mb-3"><table className="w-full text-sm text-[#CCCCCC] border-collapse">{children}</table></div>;
}

export default function DocumentationPanel() {
  const [section, setSection] = useState<DocSection>('getting-started');

  return (
    <div className="flex h-full bg-[#252526]" style={{ minHeight: 0 }}>
      {/* Sidebar */}
      <div className="w-56 shrink-0 border-r border-[#3C3C3C] flex flex-col py-3 min-h-0">
        <div className="px-3 text-xs font-medium text-[#858585] uppercase tracking-wider mb-2 shrink-0">Documentation</div>
        <div className="flex-1 overflow-y-auto min-h-0">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex items-center gap-2 w-full px-3 py-2 text-left text-sm transition-colors ${
              section === s.id ? 'bg-[#094771] text-white' : 'text-[#CCCCCC] hover:bg-[#2D2D2D]'
            }`}
          >
            {s.icon}
            <span>{s.label}</span>
            {section === s.id && <ChevronRight size={16} className="ml-auto" />}
          </button>
        ))}
        </div>
        <div className="mt-auto pt-3 border-t shrink-0 border-[#3C3C3C] px-3">
          <button
            onClick={() => open(REPORT_ISSUE_URL)}
            className="flex items-center gap-2 text-xs text-[#858585] hover:text-[#CCCCCC] transition-colors"
          >
            <ExternalLink size={14} />
            Report an issue
          </button>
          <button
            onClick={() => open(DOCS_REPO)}
            className="flex items-center gap-2 text-xs text-[#858585] hover:text-[#CCCCCC] transition-colors mt-1"
          >
            <ExternalLink size={14} />
            View on GitHub
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0">
        {section === 'getting-started' && (
          <>
            <DocHeading>Getting Started</DocHeading>
            <DocP>SentinelOps is a modern code editor. Use this documentation to learn how to use the app and get the most out of it.</DocP>
            <DocH3>Quick links</DocH3>
            <DocUl>
              <li><strong>Explorer & Files</strong> – File tree, open folder, new file/folder, context menu.</li>
              <li><strong>Search</strong> – Find in Files (Ctrl+Shift+F).</li>
              <li><strong>Settings</strong> – Account, editor, appearance, AI, keyboard shortcuts.</li>
              <li><strong>Environment & LLM</strong> – Get the AI Agent working (use as-is, your own API key, or local Ollama/LM Studio).</li>
              <li><strong>Payments & Subscriptions</strong> – Upgrade to Pro or Team and manage your subscription.</li>
              <li><strong>Updates</strong> – Check for updates and install new versions from the app.</li>
              <li><strong>Keyboard & Command Palette</strong> – Shortcuts and Command Palette (Ctrl+Shift+P or Ctrl+P).</li>
            </DocUl>
            <DocP>You don&apos;t need a <DocCode>.env</DocCode> file for the AI—OpenRouter is hosted on Render. Only if you want your own API key or a local LLM (e.g. Ollama), see Environment & LLM for where to put <DocCode>.env</DocCode> and what to add.</DocP>
          </>
        )}

        {section === 'explorer' && (
          <>
            <DocHeading>Explorer & Files</DocHeading>
            <DocP>The Explorer shows the file tree for your open folder. Use it to browse, open, and manage files and folders.</DocP>
            <DocH3>Opening a folder</DocH3>
            <DocP>Use <DocCode>Ctrl+K Ctrl+O</DocCode> (or File → Open Folder) to open a folder. The sidebar shows the Explorer when the Files icon is selected.</DocP>
            <DocH3>Creating files and folders</DocH3>
            <DocP>Right-click in the tree and choose New File or New Folder. You can also use the context menu to cut, copy, paste, rename, and delete items.</DocP>
            <DocH3>Context menu</DocH3>
            <DocUl>
              <li><strong>Cut / Copy / Paste</strong> – Move or duplicate files and folders.</li>
              <li><strong>Copy Path</strong> – Copy full path; <strong>Copy Relative Path</strong> – path relative to workspace.</li>
              <li><strong>Rename</strong> – Rename the selected item.</li>
              <li><strong>Delete</strong> – Move to Trash.</li>
              <li><strong>Reveal in File Explorer</strong> – Open the file&apos;s location in the system file manager.</li>
            </DocUl>
            <DocH3>Editor tabs</DocH3>
            <DocP>Open files appear as tabs. Close a tab with <DocCode>Ctrl+W</DocCode> or the tab close button. Use <DocCode>Ctrl+Tab</DocCode> and <DocCode>Ctrl+Shift+Tab</DocCode> to switch between tabs.</DocP>
          </>
        )}

        {section === 'search' && (
          <>
            <DocHeading>Search</DocHeading>
            <DocP>Find in Files lets you search across your workspace. Open it from the sidebar (Search icon) or with <DocCode>Ctrl+Shift+F</DocCode>.</DocP>
            <DocH3>Using search</DocH3>
            <DocP>Type your query in the search box. You can restrict by file pattern (e.g. <DocCode>*.ts</DocCode>) and use match case / whole word options. Results list file paths and matching lines; click a result to open the file in the editor at that location.</DocP>
          </>
        )}

        {section === 'source-control' && (
          <>
            <DocHeading>Source Control</DocHeading>
            <DocP>The Source Control panel shows Git changes in your workspace. Open it from the sidebar (Git icon) or <DocCode>Ctrl+Shift+G</DocCode>.</DocP>
            <DocH3>Viewing changes</DocH3>
            <DocP>Modified, added, and deleted files appear under Changes. Click a file to see the diff or open it in the editor. You can stage and commit from the panel when your workspace is a Git repository.</DocP>
          </>
        )}

        {section === 'terminal' && (
          <>
            <DocHeading>Terminal (Run & Debug)</DocHeading>
            <DocP>The Run & Debug panel hosts integrated terminals. Open it from the sidebar (Play icon) or <DocCode>Ctrl+`</DocCode> (backtick).</DocP>
            <DocH3>Multiple terminals</DocH3>
            <DocP>You can create multiple terminal tabs. Use the + button or the shell dropdown to add a new terminal. The dropdown lists detected shells (PowerShell, cmd, bash, etc.) so you can pick one for each terminal.</DocP>
            <DocH3>Running commands</DocH3>
            <DocP>Type commands in the terminal as you would in a system terminal. The terminal runs in your workspace directory by default.</DocP>
          </>
        )}

        {section === 'extensions' && (
          <>
            <DocHeading>Extensions</DocHeading>
            <DocP>Extensions add themes, language support, and other features. Open the Extensions panel from the sidebar (Package icon) or <DocCode>Ctrl+Shift+X</DocCode>.</DocP>
            <DocH3>Browse and install</DocH3>
            <DocP>Use the search box to find extensions (e.g. VS Code–style marketplace). Click Install on an extension to add it. The Installed tab lists what you have; you can disable or uninstall from there.</DocP>
          </>
        )}

        {section === 'sqlite' && (
          <>
            <DocHeading>SQLite Browser</DocHeading>
            <DocP>The SQLite Browser lets you open <DocCode>.db</DocCode> files, view tables, and run queries. Open it from the sidebar (Database icon).</DocP>
            <DocH3>Opening a database</DocH3>
            <DocP>Open a database file from the panel (or via the file tree). Once open, you can switch between a data view (table rows) and a query tab to run SQL.</DocP>
            <DocH3>Running queries</DocH3>
            <DocP>In the Query tab, type SQL and run it. Results appear in the panel. Use the Data tab to browse table contents.</DocP>
          </>
        )}

        {section === 'agent' && (
          <>
            <DocHeading>AI Agent</DocHeading>
            <DocP>The AI Agent is a chat panel that can edit files, run commands, and search the web. Open it from the sidebar (Bot icon). It requires an LLM to be configured (see Environment & LLM).</DocP>
            <DocH3>Chat and model selection</DocH3>
            <DocP>Choose a model from the dropdown (free and paid models may be listed). Type messages and send; the agent can use tools to read/write files, run terminal commands, and search. Some models support image generation with size options.</DocP>
            <DocH3>Tools and memory</DocH3>
            <DocP>The agent can run approved commands in your workspace, edit code, and use memory for context. You may be prompted to approve risky actions (e.g. shell commands) before they run.</DocP>
          </>
        )}

        {section === 'trash' && (
          <>
            <DocHeading>Trash</DocHeading>
            <DocP>Deleted files are moved to Trash. Open the Trash panel from the sidebar (Trash icon) to see deleted items.</DocP>
            <DocH3>Restore and empty</DocH3>
            <DocP>Restore a file to its original location from the Trash list, or empty the trash to permanently remove all items. Empty Trash cannot be undone.</DocP>
          </>
        )}

        {section === 'settings' && (
          <>
            <DocHeading>Settings</DocHeading>
            <DocP>Settings control account, editor behavior, appearance, AI, extensions, and keyboard shortcuts. Open Settings from the sidebar (gear icon) or <DocCode>Ctrl+,</DocCode>.</DocP>
            <DocH3>Categories</DocH3>
            <DocUl>
              <li><strong>Account</strong> – Sign in, profile, subscription (Pro/Team).</li>
              <li><strong>General</strong> – Workspace, window, and app options.</li>
              <li><strong>Editor</strong> – Font, word wrap, minimap, auto-save.</li>
              <li><strong>Appearance</strong> – Color theme and icon theme.</li>
              <li><strong>AI & Models</strong> – LLM base URL, model, proxy; enable/disable AI.</li>
              <li><strong>Extensions</strong> – Extension-related settings.</li>
              <li><strong>Keyboard</strong> – Keybinding preset (Default, VS Code, Sublime, Vim) and custom shortcuts.</li>
              <li><strong>About</strong> – App version and info.</li>
              <li><strong>Admin Dashboard</strong> – Shown for admins; usage and subscription management.</li>
            </DocUl>
            <DocP>To change keybindings, go to Settings → Keyboard and pick a preset or edit individual shortcuts.</DocP>
          </>
        )}

        {section === 'keyboard' && (
          <>
            <DocHeading>Keyboard Shortcuts & Command Palette</DocHeading>
            <DocP>The Command Palette gives quick access to actions. Open it with <DocCode>Ctrl+Shift+P</DocCode> (VS Code preset) or <DocCode>Ctrl+P</DocCode> (Default preset). Type to filter and select an action.</DocP>
            <DocH3>Common shortcuts</DocH3>
            <DocTable>
              <thead>
                <tr className="border-b border-[#3C3C3C]">
                  <th className="text-left py-2 pr-4">Action</th>
                  <th className="text-left py-2">Shortcut (default)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#2D2D2D]"><td className="py-2 pr-4">Save</td><td className="py-2">Ctrl+S</td></tr>
                <tr className="border-b border-[#2D2D2D]"><td className="py-2 pr-4">Open Recent</td><td className="py-2">Ctrl+E</td></tr>
                <tr className="border-b border-[#2D2D2D]"><td className="py-2 pr-4">Find in Files</td><td className="py-2">Ctrl+Shift+F</td></tr>
                <tr className="border-b border-[#2D2D2D]"><td className="py-2 pr-4">Source Control</td><td className="py-2">Ctrl+Shift+G</td></tr>
                <tr className="border-b border-[#2D2D2D]"><td className="py-2 pr-4">Extensions</td><td className="py-2">Ctrl+Shift+X</td></tr>
                <tr className="border-b border-[#2D2D2D]"><td className="py-2 pr-4">Split Editor</td><td className="py-2">Ctrl+\</td></tr>
                <tr className="border-b border-[#2D2D2D]"><td className="py-2 pr-4">Close Tab</td><td className="py-2">Ctrl+W</td></tr>
                <tr className="border-b border-[#2D2D2D]"><td className="py-2 pr-4">Next / Previous Tab</td><td className="py-2">Ctrl+Tab / Ctrl+Shift+Tab</td></tr>
                <tr className="border-b border-[#2D2D2D]"><td className="py-2 pr-4">Toggle Terminal</td><td className="py-2">Ctrl+`</td></tr>
                <tr className="border-b border-[#2D2D2D]"><td className="py-2 pr-4">New File</td><td className="py-2">Ctrl+N</td></tr>
                <tr className="border-b border-[#2D2D2D]"><td className="py-2 pr-4">Toggle Sidebar</td><td className="py-2">Ctrl+B</td></tr>
                <tr className="border-b border-[#2D2D2D]"><td className="py-2 pr-4">Go to Line</td><td className="py-2">Ctrl+G</td></tr>
                <tr className="border-b border-[#2D2D2D]"><td className="py-2 pr-4">Find / Replace</td><td className="py-2">Ctrl+F / Ctrl+H</td></tr>
              </tbody>
            </DocTable>
            <DocP>Shortcuts can differ by keyboard preset (Default, VS Code, Sublime, Vim). Change the preset or individual keys in Settings → Keyboard.</DocP>
          </>
        )}

        {section === 'environment' && (
          <>
            <DocHeading>Getting the AI Agent to work</DocHeading>
            <DocP>The AI Agent (sidebar, Bot icon) uses OpenRouter, which is hosted on Render. You don&apos;t need a <DocCode>.env</DocCode> file or an API key—the AI works out of the box. Only set up <DocCode>.env</DocCode> if you want to use your own API key or run a local model.</DocP>
            <DocH3>Use the app as-is (no setup)</DocH3>
            <DocP>OpenRouter is hosted on Render, so the AI Agent is ready to use. Open the AI Agent (Bot icon in the sidebar), send a message, and you&apos;re good to go. No <DocCode>.env</DocCode> or API key needed.</DocP>
            <DocH3>Use your own API key (optional)</DocH3>
            <DocP>If you have an API key from OpenRouter or another provider, you can put it in a <DocCode>.env</DocCode> file so the app uses your key. Create a file named <DocCode>.env</DocCode> and add a line like <DocCode>LLM_API_KEY=your-key</DocCode>. Put the file in one of these places so the app finds it:</DocP>
            <DocUl>
              <li><strong>Next to the app</strong> – same folder as SentinelOps.exe (or the app on Mac/Linux).</li>
              <li><strong>Config folder</strong> – Windows: <DocCode>%APPDATA%\SentinelOps\.env</DocCode>; macOS: <DocCode>~/Library/Application Support/SentinelOps/.env</DocCode>; Linux: <DocCode>~/.config/SentinelOps/.env</DocCode>.</li>
              <li><strong>Your user folder</strong> – <DocCode>~/.env</DocCode> or <DocCode>~/SentinelOps/.env</DocCode>.</li>
            </DocUl>
            <DocH3>Use local Ollama or LM Studio</DocH3>
            <DocP>You can run models on your own machine with Ollama or LM Studio. Install one of them, start it, then in <DocCode>.env</DocCode> set <DocCode>LLM_BASE_URL</DocCode> (e.g. <DocCode>http://localhost:11434/v1</DocCode> for Ollama). No API key is needed. Make sure you don&apos;t have <DocCode>LLM_PROXY_URL</DocCode> set so the app uses your local URL.</DocP>
            <DocH3>Seeing &quot;Not Configured&quot;?</DocH3>
            <DocP>Normally you won&apos;t see this—OpenRouter on Render is used by default. If you chose to use your own API key or local LLM and the app says not configured, the app may not be finding your <DocCode>.env</DocCode> file. Move <DocCode>.env</DocCode> to one of the locations above (next to the app or in the config folder is most reliable), then restart the app.</DocP>
          </>
        )}

        {section === 'payments' && (
          <>
            <DocHeading>Upgrading and managing your subscription</DocHeading>
            <DocP>SentinelOps can offer Free, Pro, and Team plans. Upgrade and manage your subscription from the app.</DocP>
            <DocH3>Upgrading to Pro or Team</DocH3>
            <DocP>Go to <strong>Settings → Account</strong> (click the gear in the sidebar, then Account). If you&apos;re signed in, you&apos;ll see upgrade options for Pro and Team. Click the one you want; you&apos;ll be taken to the checkout page (your app may use Lemon Squeezy, Gumroad, or another provider). Complete payment there; your plan will update in the app.</DocP>
            <DocH3>Managing your subscription</DocH3>
            <DocP>If you&apos;re on Pro or Team, Settings → Account shows a <strong>Manage Subscription</strong> button. Use it to update your payment method, view invoices, or cancel. That link opens the provider&apos;s portal in your browser.</DocP>
            <DocH3>Refreshing your plan in the app</DocH3>
            <DocP>If you just upgraded but the app still shows Free, use <strong>Refresh subscription</strong> (or similar) in Settings → Account so the app fetches your latest plan.</DocP>
          </>
        )}

        {section === 'updates' && (
          <>
            <DocHeading>Keeping the app up to date</DocHeading>
            <DocP>You can check for updates and install new versions from inside the app.</DocP>
            <DocH3>Checking for updates</DocH3>
            <DocP>Go to <strong>Settings → About</strong>. In the Updates section, click <strong>Check for Updates</strong>. The app will contact the update server and either tell you &quot;You&apos;re up to date&quot; (with your current version) or show that a newer version is available.</DocP>
            <DocH3>Installing an update</DocH3>
            <DocP>When an update is available, you&apos;ll see the new version number and release notes. Click <strong>Download &amp; Install Update</strong>. The app downloads the installer and, when ready, prompts you to install. After installing, restart the app to use the new version.</DocP>
            <DocH3>If the app can&apos;t check for updates</DocH3>
            <DocP>If you see an error when checking for updates (e.g. no network or the update server isn&apos;t set up yet), you can still get the latest version by downloading the installer from the website or from the project&apos;s GitHub Releases page and installing it yourself.</DocP>
          </>
        )}
      </div>
    </div>
  );
}
