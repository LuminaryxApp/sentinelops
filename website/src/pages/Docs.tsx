import { useState } from 'react';
import {
  Book, Cpu, Cloud, CreditCard, RefreshCw, ChevronRight, ExternalLink,
  Sparkles, Keyboard, FolderOpen, GitBranch, Terminal, Puzzle, Palette,
  Database, Brain, Settings, Download, Zap, Shield, Search, Layout,
  FileCode, Image, MessageSquare, Command, Eye, Trash2, Bell, HelpCircle
} from 'lucide-react';

type Section = {
  id: string;
  icon: any;
  title: string;
  content: React.ReactNode;
};

const CodeBlock = ({ children, title }: { children: string; title?: string }) => (
  <div className="my-4 rounded-xl overflow-hidden border border-white/5">
    {title && (
      <div className="px-4 py-2 bg-midnight-200 border-b border-white/5 text-xs text-slate-400 font-mono">
        {title}
      </div>
    )}
    <pre className="p-4 bg-midnight-100 overflow-x-auto text-sm">
      <code className="text-slate-300 font-mono">{children}</code>
    </pre>
  </div>
);

const Table = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <div className="my-4 overflow-x-auto rounded-xl border border-white/5">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-midnight-200 border-b border-white/5">
          {headers.map((h, i) => (
            <th key={i} className="px-4 py-3 text-left text-slate-300 font-semibold">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-white/5 last:border-0">
            {row.map((cell, j) => (
              <td key={j} className="px-4 py-3 text-slate-400">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Tip = ({ children, type = 'tip' }: { children: React.ReactNode; type?: 'tip' | 'warning' | 'info' }) => {
  const styles = {
    tip: 'border-cyan/20 bg-cyan/5 text-cyan',
    warning: 'border-coral/20 bg-coral/5 text-coral',
    info: 'border-purple/20 bg-purple/5 text-purple',
  };
  return (
    <div className={`my-4 p-4 rounded-xl border ${styles[type]}`}>
      <div className="flex items-center gap-2 font-medium mb-2">
        <Sparkles size={14} />
        {type === 'tip' ? 'Pro Tip' : type === 'warning' ? 'Warning' : 'Note'}
      </div>
      <div className="text-slate-400 text-sm">{children}</div>
    </div>
  );
};

const sections: Section[] = [
  {
    id: 'getting-started',
    icon: Book,
    title: 'Getting Started',
    content: (
      <>
        <p className="text-slate-400 mb-4">
          Welcome to SentinelOps! Download for your platform from the{' '}
          <a href="/" className="text-cyan hover:underline">home page</a> or{' '}
          <a href="https://github.com/LuminaryxApp/sentinelops/releases" target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">
            GitHub releases
          </a>.
        </p>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Quick Start</h3>
        <ol className="space-y-3">
          {[
            'Download and install SentinelOps for your platform',
            'Launch the app and complete the setup wizard',
            'Open a folder or create a new workspace',
            'Configure AI in Settings (local or cloud)',
            'Start coding with AI assistance!',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cyan/20 text-cyan text-sm flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <span className="text-slate-400">{step}</span>
            </li>
          ))}
        </ol>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">System Requirements</h3>
        <Table
          headers={['Platform', 'Requirements']}
          rows={[
            ['Windows', 'Windows 10 or later (x64)'],
            ['macOS', 'macOS 10.15+ (Intel or Apple Silicon)'],
            ['Linux', 'Ubuntu 20.04+ or equivalent (x64)'],
          ]}
        />

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">First Launch Setup Wizard</h3>
        <p className="text-slate-400 mb-4">The setup wizard guides you through:</p>
        <ul className="space-y-2 text-slate-400">
          {[
            'Account creation or sign-in',
            'Workflow personality (Minimal, Balanced, Maximal)',
            'Workspace folder selection',
            'Editor preferences (font size, tab size)',
            'Theme and icon theme selection',
            'AI model configuration',
            'Keyboard preset selection',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <ChevronRight size={16} className="text-cyan flex-shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: 'ai-configuration',
    icon: Cpu,
    title: 'AI Configuration',
    content: (
      <>
        <p className="text-slate-400 mb-6">
          Configure AI models directly in Settings. SentinelOps supports three methods - all configured through the app's settings panel.
        </p>

        <div className="space-y-6">
          {/* Local Models */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan/20 flex items-center justify-center">
                <Cpu size={20} className="text-cyan" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Local Models (Recommended)</h4>
                <p className="text-sm text-slate-500">Free, unlimited, private</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Run AI models on your machine with Ollama or LM Studio. Zero latency, no API costs, complete privacy.
            </p>
            <h5 className="text-sm font-semibold text-white mb-2">Setup Steps:</h5>
            <ol className="space-y-2 text-sm text-slate-400">
              <li className="flex gap-2"><span className="text-cyan">1.</span> Install <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">Ollama</a> or <a href="https://lmstudio.ai" target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">LM Studio</a></li>
              <li className="flex gap-2"><span className="text-cyan">2.</span> Pull a model: <code className="px-1 bg-midnight-200 rounded">ollama pull llama3.2</code></li>
              <li className="flex gap-2"><span className="text-cyan">3.</span> Open SentinelOps Settings → AI</li>
              <li className="flex gap-2"><span className="text-cyan">4.</span> Enter Base URL: <code className="px-1 bg-midnight-200 rounded">http://localhost:11434/v1</code> (Ollama) or <code className="px-1 bg-midnight-200 rounded">http://localhost:1234/v1</code> (LM Studio)</li>
              <li className="flex gap-2"><span className="text-cyan">5.</span> Select your model from the dropdown</li>
            </ol>
          </div>

          {/* Proxy */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple/20 flex items-center justify-center">
                <Cloud size={20} className="text-purple" />
              </div>
              <div>
                <h4 className="font-semibold text-white">SentinelOps Proxy</h4>
                <p className="text-sm text-slate-500">Easy setup, 400+ models</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Connect to the SentinelOps proxy for instant access to cloud models. No API key needed - just connect and go.
            </p>
            <ol className="space-y-2 text-sm text-slate-400">
              <li className="flex gap-2"><span className="text-purple">1.</span> Go to Settings → AI</li>
              <li className="flex gap-2"><span className="text-purple">2.</span> Click "Connect to sentinelops.onrender.com"</li>
              <li className="flex gap-2"><span className="text-purple">3.</span> Select a model and start chatting</li>
            </ol>
          </div>

          {/* Direct API */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-coral/20 flex items-center justify-center">
                <ExternalLink size={20} className="text-coral" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Direct API Keys</h4>
                <p className="text-sm text-slate-500">Use your own API keys</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Connect directly to OpenRouter, OpenAI, Anthropic, or any OpenAI-compatible API.
            </p>
            <h5 className="text-sm font-semibold text-white mb-2">Setup Steps:</h5>
            <ol className="space-y-2 text-sm text-slate-400">
              <li className="flex gap-2"><span className="text-coral">1.</span> Go to Settings → AI</li>
              <li className="flex gap-2"><span className="text-coral">2.</span> Enter your API key</li>
              <li className="flex gap-2"><span className="text-coral">3.</span> Enter the Base URL for your provider</li>
              <li className="flex gap-2"><span className="text-coral">4.</span> Select a model from the dropdown</li>
            </ol>
            <h5 className="text-sm font-semibold text-white mt-4 mb-2">Supported Providers:</h5>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', models: '400+ models' },
                { name: 'OpenAI', url: 'https://api.openai.com/v1', models: 'GPT-4, GPT-3.5' },
                { name: 'Anthropic', url: 'https://api.anthropic.com/v1', models: 'Claude models' },
                { name: 'Google AI', url: 'https://generativelanguage.googleapis.com/v1beta', models: 'Gemini models' },
                { name: 'Groq', url: 'https://api.groq.com/openai/v1', models: 'Fast inference' },
                { name: 'DeepSeek', url: 'https://api.deepseek.com/v1', models: 'DeepSeek V3' },
              ].map((p) => (
                <div key={p.name} className="text-xs text-slate-400 p-2 bg-midnight-200 rounded-lg">
                  <span className="text-white">{p.name}</span> - {p.models}
                </div>
              ))}
            </div>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Available Models</h3>
        <p className="text-slate-400 mb-4">Popular models available via OpenRouter:</p>
        <Table
          headers={['Model', 'Provider', 'Context', 'Cost (per 1M tokens)']}
          rows={[
            ['Claude 3.5 Sonnet', 'Anthropic', '200k', '$3 / $15'],
            ['GPT-4o', 'OpenAI', '128k', '$2.50 / $10'],
            ['DeepSeek V3', 'DeepSeek', '64k', '$0.14 / $0.28'],
            ['Llama 3.1 70B', 'Meta', '131k', '$0.35 / $0.40'],
            ['Llama 3.2 3B', 'Meta', '131k', 'Free'],
            ['Gemma 2 9B', 'Google', '8k', 'Free'],
            ['Mistral 7B', 'Mistral', '32k', 'Free'],
          ]}
        />

        <Tip>
          All AI configuration is done through the Settings panel - no configuration files needed.
          Just open Settings → AI and enter your connection details.
        </Tip>
      </>
    ),
  },
  {
    id: 'ai-agent',
    icon: MessageSquare,
    title: 'AI Agent',
    content: (
      <>
        <p className="text-slate-400 mb-6">
          The AI Agent is your intelligent coding assistant. Access it from the sidebar when AI is enabled.
        </p>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Agent Modes</h3>
        <div className="space-y-4">
          {[
            {
              name: 'Chat Mode',
              desc: 'Simple conversational Q&A without file access. Great for questions, explanations, and guidance.',
              color: 'cyan',
            },
            {
              name: 'Agent Mode',
              desc: 'Full capabilities: read/write files, search code, execute commands (with approval), and more.',
              color: 'purple',
            },
            {
              name: 'Plan Mode',
              desc: 'Agent creates detailed implementation plans without automatic execution. Review and approve each step.',
              color: 'coral',
            },
            {
              name: 'Image Mode',
              desc: 'Generate images using AI models like Stable Diffusion, FLUX, and more.',
              color: 'cyan',
            },
          ].map((mode) => (
            <div key={mode.name} className="glass-card rounded-xl p-4">
              <h4 className={`font-semibold text-${mode.color} mb-2`}>{mode.name}</h4>
              <p className="text-slate-400 text-sm">{mode.desc}</p>
            </div>
          ))}
        </div>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Agent Capabilities</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { icon: Eye, name: 'Read Files', desc: 'View any file in your project' },
            { icon: FileCode, name: 'Write Files', desc: 'Create or modify files' },
            { icon: Search, name: 'Search Code', desc: 'Find text across your codebase' },
            { icon: Terminal, name: 'Run Commands', desc: 'Execute shell commands (with approval)' },
            { icon: FolderOpen, name: 'Manage Folders', desc: 'Create directories, list contents' },
            { icon: Trash2, name: 'Delete Files', desc: 'Move files to trash' },
            { icon: Cloud, name: 'Web Search', desc: 'Search the internet for information' },
            { icon: Brain, name: 'Memory', desc: 'Remember context across sessions' },
          ].map((cap) => (
            <div key={cap.name} className="flex items-start gap-3 p-3 bg-midnight-100 rounded-lg">
              <cap.icon size={18} className="text-cyan flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-white">{cap.name}</div>
                <div className="text-xs text-slate-500">{cap.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Command Approval</h3>
        <p className="text-slate-400 mb-4">
          For safety, terminal commands require your approval before execution:
        </p>
        <ul className="space-y-2 text-sm text-slate-400">
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan flex-shrink-0" /> Pending commands appear in a panel</li>
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan flex-shrink-0" /> Review the command, directory, and reason</li>
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan flex-shrink-0" /> Click Approve or Reject</li>
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan flex-shrink-0" /> Commands are executed in your working directory</li>
        </ul>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Chat History</h3>
        <p className="text-slate-400 text-sm">
          Conversations are automatically saved. Use the history sidebar to load previous chats,
          start new conversations, or delete old ones.
        </p>
      </>
    ),
  },
  {
    id: 'keyboard-shortcuts',
    icon: Keyboard,
    title: 'Keyboard Shortcuts',
    content: (
      <>
        <p className="text-slate-400 mb-6">
          SentinelOps supports multiple keyboard presets. Choose from Default, VS Code, Sublime Text, or Vim in Settings → Keyboard.
        </p>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Essential Shortcuts (Default)</h3>
        <Table
          headers={['Action', 'Windows/Linux', 'macOS']}
          rows={[
            ['Command Palette', 'Ctrl+P', 'Cmd+P'],
            ['Save File', 'Ctrl+S', 'Cmd+S'],
            ['Save All', 'Ctrl+K S', 'Cmd+K S'],
            ['Find in Files', 'Ctrl+Shift+F', 'Cmd+Shift+F'],
            ['Source Control', 'Ctrl+Shift+G', 'Cmd+Shift+G'],
            ['Extensions', 'Ctrl+Shift+X', 'Cmd+Shift+X'],
            ['Toggle Terminal', 'Ctrl+`', 'Cmd+`'],
            ['Toggle Sidebar', 'Ctrl+B', 'Cmd+B'],
            ['New File', 'Ctrl+N', 'Cmd+N'],
            ['Close Tab', 'Ctrl+W', 'Cmd+W'],
            ['Next Tab', 'Ctrl+Tab', 'Cmd+Tab'],
            ['Previous Tab', 'Ctrl+Shift+Tab', 'Cmd+Shift+Tab'],
            ['Split Editor', 'Ctrl+\\', 'Cmd+\\'],
            ['Go to Line', 'Ctrl+G', 'Cmd+G'],
            ['Find & Replace', 'Ctrl+H', 'Cmd+H'],
          ]}
        />

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Keyboard Presets</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { name: 'Default', desc: 'SentinelOps default keybindings' },
            { name: 'VS Code', desc: 'Standard VS Code keybindings (Ctrl+Shift+P for palette)' },
            { name: 'Sublime Text', desc: 'Sublime-style keybindings' },
            { name: 'Vim', desc: 'Vim-inspired keybindings for modal editing' },
          ].map((preset) => (
            <div key={preset.name} className="p-4 bg-midnight-100 rounded-xl">
              <div className="font-medium text-white mb-1">{preset.name}</div>
              <div className="text-sm text-slate-500">{preset.desc}</div>
            </div>
          ))}
        </div>

        <Tip>
          You can customize individual shortcuts in Settings → Keyboard. Click on any action to rebind its key combination.
        </Tip>
      </>
    ),
  },
  {
    id: 'file-management',
    icon: FolderOpen,
    title: 'File Management',
    content: (
      <>
        <p className="text-slate-400 mb-6">
          The file browser in the left sidebar provides full access to your project files.
        </p>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">File Operations</h3>
        <p className="text-slate-400 mb-4">Right-click on any file or folder for these options:</p>
        <div className="grid md:grid-cols-2 gap-3">
          {[
            'New File', 'New Folder', 'Rename', 'Cut', 'Copy', 'Paste',
            'Delete (to Trash)', 'Open in System Explorer',
          ].map((op) => (
            <div key={op} className="flex items-center gap-2 text-sm text-slate-400 p-2 bg-midnight-100 rounded-lg">
              <ChevronRight size={14} className="text-cyan" />
              {op}
            </div>
          ))}
        </div>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Supported File Types</h3>
        <Table
          headers={['Type', 'Extensions', 'Features']}
          rows={[
            ['Code', '.js, .ts, .py, .rs, .go, .java, .cpp, etc.', 'Syntax highlighting, formatting'],
            ['Markdown', '.md, .mdx, .markdown', 'Live preview, formatting'],
            ['Images', '.png, .jpg, .gif, .svg, .webp', 'Zoom, rotate, fit-to-window'],
            ['Config', '.json, .yaml, .toml, .env', 'Syntax highlighting'],
            ['Web', '.html, .css, .vue, .jsx, .tsx', 'Syntax highlighting'],
          ]}
        />

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Editor Features</h3>
        <ul className="space-y-2 text-sm text-slate-400">
          {[
            'Split editor vertically with Ctrl+\\',
            'Drag tabs between editor panes',
            'Dirty indicator (dot) shows unsaved changes',
            'Auto-save option in Settings',
            'Minimap code overview (toggleable)',
            'Word wrap option',
            'Configurable font size and tab size',
          ].map((f, i) => (
            <li key={i} className="flex gap-2">
              <ChevronRight size={16} className="text-cyan flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Trash / Recycle Bin</h3>
        <p className="text-slate-400 text-sm">
          Deleted files go to the Trash instead of being permanently removed. Access Trash from the sidebar to:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-slate-400">
          <li className="flex gap-2"><ChevronRight size={14} className="text-cyan" /> View deleted files with original paths</li>
          <li className="flex gap-2"><ChevronRight size={14} className="text-cyan" /> Restore files to their original location</li>
          <li className="flex gap-2"><ChevronRight size={14} className="text-cyan" /> Permanently delete files</li>
        </ul>
      </>
    ),
  },
  {
    id: 'git-integration',
    icon: GitBranch,
    title: 'Git Integration',
    content: (
      <>
        <p className="text-slate-400 mb-6">
          Full Git support built-in. Access via Ctrl+Shift+G or the Source Control icon in the sidebar.
        </p>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Git Features</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { name: 'Status View', desc: 'See all modified, staged, and untracked files' },
            { name: 'Staging', desc: 'Stage individual files or all changes' },
            { name: 'Diff View', desc: 'View line-by-line changes for any file' },
            { name: 'Commit', desc: 'Commit staged changes with a message' },
            { name: 'Branch Display', desc: 'Current branch shown in panel header' },
            { name: 'Refresh', desc: 'Reload git status manually' },
          ].map((f) => (
            <div key={f.name} className="p-3 bg-midnight-100 rounded-lg">
              <div className="font-medium text-white text-sm mb-1">{f.name}</div>
              <div className="text-xs text-slate-500">{f.desc}</div>
            </div>
          ))}
        </div>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Status Colors</h3>
        <div className="flex flex-wrap gap-3">
          {[
            { color: 'bg-yellow-500', label: 'Modified' },
            { color: 'bg-green-500', label: 'Added' },
            { color: 'bg-red-500', label: 'Deleted' },
            { color: 'bg-cyan-500', label: 'Renamed' },
            { color: 'bg-emerald-400', label: 'Untracked' },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-sm text-slate-400">
              <span className={`w-3 h-3 rounded-full ${s.color}`} />
              {s.label}
            </div>
          ))}
        </div>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Workflow</h3>
        <ol className="space-y-2 text-sm text-slate-400">
          <li className="flex gap-2"><span className="text-cyan">1.</span> View changed files in Source Control panel</li>
          <li className="flex gap-2"><span className="text-cyan">2.</span> Click the eye icon to view diffs</li>
          <li className="flex gap-2"><span className="text-cyan">3.</span> Click + to stage files (or Stage All)</li>
          <li className="flex gap-2"><span className="text-cyan">4.</span> Enter a commit message</li>
          <li className="flex gap-2"><span className="text-cyan">5.</span> Click Commit</li>
        </ol>

        <Tip type="info">
          For advanced Git operations (push, pull, merge, rebase), use the integrated terminal.
        </Tip>
      </>
    ),
  },
  {
    id: 'terminal',
    icon: Terminal,
    title: 'Terminal',
    content: (
      <>
        <p className="text-slate-400 mb-6">
          Built-in terminal for running commands without leaving the editor. Toggle with Ctrl+`.
        </p>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Features</h3>
        <ul className="space-y-2 text-sm text-slate-400">
          {[
            'Multiple terminal tabs',
            'Shell selection (PowerShell, CMD, bash, zsh)',
            'Command history (up/down arrows)',
            'Auto-scroll to latest output',
            'Resizable panel',
            'Copy/paste support',
          ].map((f, i) => (
            <li key={i} className="flex gap-2">
              <ChevronRight size={16} className="text-cyan flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Supported Shells</h3>
        <Table
          headers={['Platform', 'Available Shells']}
          rows={[
            ['Windows', 'PowerShell, CMD, Git Bash'],
            ['macOS', 'bash, zsh'],
            ['Linux', 'bash, sh, zsh, fish'],
          ]}
        />

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Bottom Panel Tabs</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { name: 'Terminal', desc: 'Shell execution' },
            { name: 'Problems', desc: 'Linter/extension diagnostics' },
            { name: 'Output', desc: 'Program and extension output' },
          ].map((tab) => (
            <div key={tab.name} className="p-3 bg-midnight-100 rounded-lg text-center">
              <div className="font-medium text-white text-sm">{tab.name}</div>
              <div className="text-xs text-slate-500">{tab.desc}</div>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: 'extensions',
    icon: Puzzle,
    title: 'Extensions',
    content: (
      <>
        <p className="text-slate-400 mb-6">
          Install themes, language support, and extensions from the Open VSX marketplace. Access with Ctrl+Shift+X.
        </p>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Extension Types</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { name: 'Themes', desc: 'Color schemes for the editor', icon: Palette },
            { name: 'Icon Themes', desc: 'Custom file icons', icon: Image },
            { name: 'Languages', desc: 'Syntax highlighting for languages', icon: FileCode },
            { name: 'Snippets', desc: 'Code templates and shortcuts', icon: Zap },
          ].map((t) => (
            <div key={t.name} className="flex items-start gap-3 p-4 bg-midnight-100 rounded-xl">
              <t.icon size={20} className="text-cyan flex-shrink-0" />
              <div>
                <div className="font-medium text-white">{t.name}</div>
                <div className="text-sm text-slate-500">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Installing Extensions</h3>
        <ol className="space-y-2 text-sm text-slate-400">
          <li className="flex gap-2"><span className="text-cyan">1.</span> Open Extensions panel (Ctrl+Shift+X)</li>
          <li className="flex gap-2"><span className="text-cyan">2.</span> Browse or search for extensions</li>
          <li className="flex gap-2"><span className="text-cyan">3.</span> Click Install on the extension</li>
          <li className="flex gap-2"><span className="text-cyan">4.</span> Themes are auto-applied if none set</li>
          <li className="flex gap-2"><span className="text-cyan">5.</span> Manage installed extensions in the "Installed" tab</li>
        </ol>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Extension Tabs</h3>
        <ul className="space-y-2 text-sm text-slate-400">
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> <strong className="text-white">VSCode</strong> - Browse popular VS Code extensions</li>
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> <strong className="text-white">Installed</strong> - Manage your installed extensions</li>
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> <strong className="text-white">Search</strong> - Search by name or category</li>
        </ul>

        <Tip>
          SentinelOps is compatible with VS Code extensions from the Open VSX registry. Most popular themes and language extensions work out of the box.
        </Tip>
      </>
    ),
  },
  {
    id: 'themes',
    icon: Palette,
    title: 'Themes & Appearance',
    content: (
      <>
        <p className="text-slate-400 mb-6">
          Customize the look of SentinelOps with themes, icon themes, and editor settings.
        </p>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Color Themes</h3>
        <p className="text-slate-400 text-sm mb-4">
          Install themes from the Extensions panel, then select in Settings → Appearance → Color Theme.
        </p>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Icon Themes</h3>
        <p className="text-slate-400 text-sm mb-4">
          Change file icons in the explorer with icon theme extensions.
        </p>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Editor Appearance</h3>
        <Table
          headers={['Setting', 'Options', 'Location']}
          rows={[
            ['Font Size', '1-72px', 'Settings → Editor'],
            ['Tab Size', '2, 4, or custom', 'Settings → Editor'],
            ['Word Wrap', 'On/Off', 'Settings → Editor'],
            ['Minimap', 'On/Off', 'Settings → Editor'],
            ['Theme', 'From installed extensions', 'Settings → Appearance'],
            ['Icon Theme', 'From installed extensions', 'Settings → Appearance'],
          ]}
        />

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Dark Mode</h3>
        <p className="text-slate-400 text-sm">
          SentinelOps defaults to dark mode. Light mode themes are available through extensions.
        </p>
      </>
    ),
  },
  {
    id: 'memory',
    icon: Brain,
    title: 'Memory System',
    content: (
      <>
        <p className="text-slate-400 mb-6">
          The Memory system allows the AI to remember context across conversations and sessions.
        </p>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">How Memory Works</h3>
        <ul className="space-y-2 text-sm text-slate-400">
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> Store important information for the AI to remember</li>
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> Memories are automatically retrieved based on relevance</li>
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> Semantic search finds related memories by meaning</li>
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> Pinned memories have higher priority</li>
        </ul>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Memory Types</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { name: 'User Memories', desc: 'Manually created by you' },
            { name: 'Auto Memories', desc: 'Automatically generated from conversations' },
            { name: 'Pinned', desc: 'Important memories marked for priority' },
          ].map((t) => (
            <div key={t.name} className="p-3 bg-midnight-100 rounded-lg">
              <div className="font-medium text-white text-sm">{t.name}</div>
              <div className="text-xs text-slate-500">{t.desc}</div>
            </div>
          ))}
        </div>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Creating Memories</h3>
        <ol className="space-y-2 text-sm text-slate-400">
          <li className="flex gap-2"><span className="text-cyan">1.</span> Open the Memory panel in the AI Agent</li>
          <li className="flex gap-2"><span className="text-cyan">2.</span> Click "Create" or the + button</li>
          <li className="flex gap-2"><span className="text-cyan">3.</span> Enter the memory content</li>
          <li className="flex gap-2"><span className="text-cyan">4.</span> Add tags and set importance (1-10)</li>
          <li className="flex gap-2"><span className="text-cyan">5.</span> Pin important memories for priority</li>
        </ol>
      </>
    ),
  },
  {
    id: 'database',
    icon: Database,
    title: 'SQLite Browser',
    content: (
      <>
        <p className="text-slate-400 mb-6">
          Built-in SQLite database browser for inspecting and querying local databases.
        </p>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Opening a Database</h3>
        <ol className="space-y-2 text-sm text-slate-400">
          <li className="flex gap-2"><span className="text-cyan">1.</span> Click "SQLite Browser" in the sidebar</li>
          <li className="flex gap-2"><span className="text-cyan">2.</span> Click "Open Database"</li>
          <li className="flex gap-2"><span className="text-cyan">3.</span> Select a .db or .sqlite file</li>
          <li className="flex gap-2"><span className="text-cyan">4.</span> Browse tables and data</li>
        </ol>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Features</h3>
        <ul className="space-y-2 text-sm text-slate-400">
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> View table structure and columns</li>
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> Browse table data with pagination</li>
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> Execute custom SQL queries</li>
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> View query results in table format</li>
        </ul>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Supported Operations</h3>
        <code className="block p-4 bg-midnight-100 rounded-xl text-sm text-slate-300">
          SELECT, INSERT, UPDATE, DELETE, JOIN, COUNT, SUM, AVG, etc.
        </code>
      </>
    ),
  },
  {
    id: 'search',
    icon: Search,
    title: 'Search & Navigation',
    content: (
      <>
        <h3 className="text-lg font-semibold text-white mb-4">Command Palette</h3>
        <p className="text-slate-400 text-sm mb-4">
          Press <code className="px-1.5 py-0.5 bg-midnight-200 rounded text-cyan">Ctrl+P</code> to open the command palette.
          Search for any command and execute it instantly.
        </p>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Find in Files</h3>
        <p className="text-slate-400 text-sm mb-4">
          Press <code className="px-1.5 py-0.5 bg-midnight-200 rounded text-cyan">Ctrl+Shift+F</code> to search across all files.
        </p>
        <ul className="space-y-2 text-sm text-slate-400">
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> Case-sensitive matching option</li>
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> Regular expression support</li>
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> Filter by file path</li>
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> Click results to jump to file</li>
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> Maximum 200 results displayed</li>
        </ul>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Recent Files</h3>
        <p className="text-slate-400 text-sm">
          Press <code className="px-1.5 py-0.5 bg-midnight-200 rounded text-cyan">Ctrl+E</code> to quickly open recently accessed files.
        </p>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Go to Line</h3>
        <p className="text-slate-400 text-sm">
          Press <code className="px-1.5 py-0.5 bg-midnight-200 rounded text-cyan">Ctrl+G</code> to jump to a specific line number.
        </p>
      </>
    ),
  },
  {
    id: 'settings',
    icon: Settings,
    title: 'Settings',
    content: (
      <>
        <p className="text-slate-400 mb-6">
          Access settings via the gear icon in the bottom-right corner or the Settings item in the sidebar.
        </p>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Settings Tabs</h3>
        <div className="space-y-4">
          {[
            {
              name: 'General',
              items: ['Theme mode', 'Font size', 'Tab size', 'Word wrap', 'Minimap', 'Auto-save', 'AI enabled'],
            },
            {
              name: 'AI',
              items: ['Model selection', 'API configuration', 'Local model setup', 'Proxy connection'],
            },
            {
              name: 'Keyboard',
              items: ['Preset selection', 'Custom keybindings', 'Reset to defaults'],
            },
            {
              name: 'Account',
              items: ['Email', 'Name', 'Subscription plan', 'Sign out'],
            },
            {
              name: 'About',
              items: ['Version info', 'Check for updates', 'Platform info', 'Report issues'],
            },
          ].map((tab) => (
            <div key={tab.name} className="glass-card rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">{tab.name}</h4>
              <div className="flex flex-wrap gap-2">
                {tab.items.map((item) => (
                  <span key={item} className="text-xs text-slate-400 px-2 py-1 bg-midnight-200 rounded">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: 'subscriptions',
    icon: CreditCard,
    title: 'Plans & Subscriptions',
    content: (
      <>
        <h3 className="text-lg font-semibold text-white mb-4">Subscription Plans</h3>
        <Table
          headers={['Feature', 'Free', 'Pro', 'Team']}
          rows={[
            ['Daily Messages', '25', '300', '1000'],
            ['Local Models', 'Unlimited', 'Unlimited', 'Unlimited'],
            ['Premium Models', 'Limited', 'All', 'All'],
            ['Cloud Sync', '-', 'Yes', 'Yes'],
            ['Priority Support', '-', 'Yes', 'Yes'],
            ['Team Collaboration', '-', '-', 'Yes'],
            ['Price', 'Free', '$12/month', '$29/month'],
          ]}
        />

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Message Packs</h3>
        <p className="text-slate-400 text-sm mb-4">
          Need more messages? Purchase additional packs that never expire:
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { messages: 25, price: '$2.99', note: 'Quick top-up' },
            { messages: 100, price: '$9.99', note: '17% savings' },
            { messages: 500, price: '$39.99', note: '33% savings' },
          ].map((pack) => (
            <div key={pack.messages} className="p-4 bg-midnight-100 rounded-xl text-center">
              <div className="text-2xl font-bold text-cyan">{pack.messages}</div>
              <div className="text-sm text-slate-400">messages</div>
              <div className="text-lg font-semibold text-white mt-2">{pack.price}</div>
              <div className="text-xs text-slate-500">{pack.note}</div>
            </div>
          ))}
        </div>

        <Tip type="info">
          Local AI models (Ollama, LM Studio) have no message limits and are completely free to use.
        </Tip>
      </>
    ),
  },
  {
    id: 'updates',
    icon: RefreshCw,
    title: 'Updates',
    content: (
      <>
        <p className="text-slate-400 mb-6">
          SentinelOps checks for updates automatically from GitHub releases.
        </p>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Checking for Updates</h3>
        <ul className="space-y-2 text-sm text-slate-400">
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> Automatic check on startup</li>
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> Manual check: Help → Check for Updates</li>
          <li className="flex gap-2"><ChevronRight size={16} className="text-cyan" /> Settings → About → Check for Updates</li>
        </ul>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Auto-Update</h3>
        <p className="text-slate-400 text-sm mb-4">
          Windows and macOS support automatic updates. You'll be notified when a new version is available.
        </p>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Manual Download</h3>
        <p className="text-slate-400 text-sm">
          Download the latest version from{' '}
          <a href="https://github.com/LuminaryxApp/sentinelops/releases" target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">
            GitHub Releases
          </a>
        </p>
      </>
    ),
  },
  {
    id: 'troubleshooting',
    icon: HelpCircle,
    title: 'Troubleshooting',
    content: (
      <>
        <h3 className="text-lg font-semibold text-white mb-4">Common Issues</h3>

        <div className="space-y-6">
          <div className="glass-card rounded-xl p-5">
            <h4 className="font-semibold text-white mb-2">AI not responding</h4>
            <ul className="space-y-1 text-sm text-slate-400">
              <li>• Check your AI settings in Settings → AI</li>
              <li>• Verify API key is correct (if using direct API)</li>
              <li>• For local models, ensure Ollama/LM Studio is running</li>
              <li>• Check internet connection for cloud models</li>
              <li>• Try the SentinelOps proxy for easy setup</li>
            </ul>
          </div>

          <div className="glass-card rounded-xl p-5">
            <h4 className="font-semibold text-white mb-2">Extensions not loading</h4>
            <ul className="space-y-1 text-sm text-slate-400">
              <li>• Restart the application</li>
              <li>• Check internet connection</li>
              <li>• Try uninstalling and reinstalling the extension</li>
            </ul>
          </div>

          <div className="glass-card rounded-xl p-5">
            <h4 className="font-semibold text-white mb-2">Performance issues</h4>
            <ul className="space-y-1 text-sm text-slate-400">
              <li>• Disable minimap in Settings</li>
              <li>• Turn off auto-save for large projects</li>
              <li>• Close unused tabs</li>
              <li>• Use local AI models for faster responses</li>
            </ul>
          </div>

          <div className="glass-card rounded-xl p-5">
            <h4 className="font-semibold text-white mb-2">Settings not saving</h4>
            <ul className="space-y-1 text-sm text-slate-400">
              <li>• Check you have write permissions to the config directory</li>
              <li>• Restart the application after changing settings</li>
              <li>• Sign in to sync settings across devices (Pro feature)</li>
            </ul>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Getting Help</h3>
        <div className="flex flex-wrap gap-4">
          <a
            href="https://github.com/LuminaryxApp/sentinelops/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-midnight-100 rounded-lg text-sm text-slate-400 hover:text-cyan transition-colors"
          >
            <ExternalLink size={14} />
            Report an Issue
          </a>
          <a
            href="https://github.com/LuminaryxApp/sentinelops/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-midnight-100 rounded-lg text-sm text-slate-400 hover:text-cyan transition-colors"
          >
            <ExternalLink size={14} />
            Community Discussions
          </a>
        </div>

        <h3 className="text-lg font-semibold text-white mt-8 mb-4">Data Locations</h3>
        <Table
          headers={['Platform', 'Config Path']}
          rows={[
            ['Windows', '%APPDATA%\\SentinelOps\\'],
            ['macOS', '~/Library/Application Support/com.luminaryxapp.sentinelops/'],
            ['Linux', '~/.config/SentinelOps/'],
          ]}
        />
      </>
    ),
  },
];

export default function Docs() {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentSection = sections.find((s) => s.id === activeSection);

  return (
    <div className="relative min-h-screen pt-32 pb-24 px-6">
      {/* Background */}
      <div className="mesh-gradient" />
      <div className="orb orb-purple w-80 h-80 -top-40 -right-40 animate-pulse-glow" />
      <div className="orb orb-cyan w-64 h-64 bottom-1/4 -left-32 animate-pulse-glow delay-300" />

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-subtle mb-6">
            <Book size={14} className="text-cyan" />
            <span className="text-sm text-slate-300">Documentation</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">SentinelOps</span> Documentation
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl">
            Complete guide to getting the most out of SentinelOps. From setup to advanced features.
          </p>
        </div>

        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden mb-6 px-4 py-2 glass-card rounded-xl text-sm text-slate-300 flex items-center gap-2"
        >
          <Layout size={16} />
          {currentSection?.title || 'Navigation'}
          <ChevronRight size={14} className={`transition-transform ${sidebarOpen ? 'rotate-90' : ''}`} />
        </button>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Sidebar Navigation */}
          <nav className={`lg:col-span-1 ${sidebarOpen ? 'block' : 'hidden lg:block'}`}>
            <div className="glass-card rounded-2xl p-3 sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <div className="space-y-1">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => {
                        setActiveSection(section.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm transition-all ${
                        activeSection === section.id
                          ? 'bg-cyan/10 text-cyan'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon size={14} className="flex-shrink-0" />
                      <span className="truncate">{section.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* Content */}
          <main className="lg:col-span-4">
            {sections.map((section) => (
              <div
                key={section.id}
                className={activeSection === section.id ? 'block' : 'hidden'}
              >
                <div className="glass-card rounded-2xl p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/5">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan/20 to-purple/20 flex items-center justify-center">
                      <section.icon size={24} className="text-cyan" />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white">{section.title}</h2>
                  </div>
                  <div className="prose prose-invert max-w-none">
                    {section.content}
                  </div>
                </div>
              </div>
            ))}

            {/* Navigation buttons */}
            <div className="flex justify-between mt-8">
              {(() => {
                const currentIndex = sections.findIndex((s) => s.id === activeSection);
                const prevSection = currentIndex > 0 ? sections[currentIndex - 1] : null;
                const nextSection = currentIndex < sections.length - 1 ? sections[currentIndex + 1] : null;

                return (
                  <>
                    {prevSection ? (
                      <button
                        onClick={() => setActiveSection(prevSection.id)}
                        className="flex items-center gap-2 text-sm text-slate-400 hover:text-cyan transition-colors"
                      >
                        <ChevronRight size={16} className="rotate-180" />
                        {prevSection.title}
                      </button>
                    ) : (
                      <div />
                    )}
                    {nextSection && (
                      <button
                        onClick={() => setActiveSection(nextSection.id)}
                        className="flex items-center gap-2 text-sm text-slate-400 hover:text-cyan transition-colors"
                      >
                        {nextSection.title}
                        <ChevronRight size={16} />
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </main>
        </div>

        {/* Bottom Links */}
        <div className="mt-16 text-center">
          <p className="text-slate-500 mb-4">Need more help?</p>
          <div className="flex flex-wrap justify-center gap-6">
            <a
              href="https://github.com/LuminaryxApp/sentinelops"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-cyan transition-colors link-underline inline-flex items-center gap-1"
            >
              GitHub Repository <ExternalLink size={12} />
            </a>
            <a
              href="https://github.com/LuminaryxApp/sentinelops/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-cyan transition-colors link-underline inline-flex items-center gap-1"
            >
              Report an Issue <ExternalLink size={12} />
            </a>
            <a
              href="https://github.com/LuminaryxApp/sentinelops/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-cyan transition-colors link-underline inline-flex items-center gap-1"
            >
              Community <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
