import { useState, useEffect } from 'react';
import {
  Settings,
  Search,
  Monitor,
  Palette,
  Code2,
  Cpu,
  FolderLock,
  Package,
  Info,
  ChevronRight,
  Check,
  X,
  Trash2,
  Loader2,
  ExternalLink,
  Keyboard,
  Save,
  Type,
  Hash,
  WrapText,
  Map,
  FileImage,
  User,
  Crown,
  CreditCard,
  LogOut,
  Zap,
  Shield,
  Cloud,
  Users,
  BarChart3,
  DollarSign,
  Activity,
  TrendingUp,
  Mail,
  Calendar,
  RefreshCw,
  Heart,
  BookOpen,
  Github,
  Sparkles,
  Server,
  CheckCircle,
} from 'lucide-react';
import { useStore, DEFAULT_KEYBOARD_SHORTCUTS } from '../hooks/useStore';
import { api, ExtensionInfo, ThemeContribution, IconThemeContribution, ConfigurationProperty } from '../services/api';
import { openFolderPicker } from './FolderPicker';
import { extensionService } from '../services/extensionService';
import { updateService } from '../services/updateService';
import { authService } from '../services/authService';
import { getPlans, getManageSubscriptionUrl } from '../services/paymentService';
import { tursoService, type UserWithStats } from '../services/tursoService';
import { open } from '@tauri-apps/plugin-shell';
import AuthModal from './AuthModal';

type SettingsCategory = 'account' | 'general' | 'editor' | 'appearance' | 'ai' | 'extensions' | 'keyboard' | 'about' | 'admin';

interface SettingItemProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingItem({ icon, title, description, children }: SettingItemProps) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-[#2D2D2D] last:border-0">
      {icon && <div className="mt-0.5 text-[#858585]">{icon}</div>}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-[#E0E0E0] mb-1">{title}</h4>
        <p className="text-xs text-[#858585] mb-3">{description}</p>
        {children}
      </div>
    </div>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const LOCAL_PRESETS = [
  { id: 'ollama', name: 'Ollama', url: 'http://localhost:11434/v1', model: 'llama3.2', hint: 'Free, runs on your Mac/PC. Get it at ollama.com' },
  { id: 'lmstudio', name: 'LM Studio', url: 'http://localhost:1234/v1', model: 'local-model', hint: 'Run open models locally. Get it at lmstudio.ai' },
  { id: 'custom', name: 'Custom', url: '', model: '', hint: 'Any OpenAI-compatible API (localhost or remote)' },
] as const;

// Define AI providers for API key configuration
const AI_PROVIDERS = [
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', hint: 'Access 400+ models with one key. Get it at openrouter.ai' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', hint: 'GPT-4, GPT-3.5, etc. Get it at platform.openai.com' },
  { id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', hint: 'Claude models. Get it at console.anthropic.com' },
  { id: 'google', name: 'Google AI', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', hint: 'Gemini models. Get it at aistudio.google.com' },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', hint: 'Fast inference. Get it at console.groq.com' },
  { id: 'together', name: 'Together AI', baseUrl: 'https://api.together.xyz/v1', hint: 'Open source models. Get it at together.ai' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', hint: 'DeepSeek models. Get it at platform.deepseek.com' },
] as const;

function AIConfigSection({
  llmConfigured,
  llmProvider,
  llmModel,
  llmBaseUrl,
  setServerInfo,
  settings,
  updateSettings,
  addNotification,
}: {
  llmConfigured: boolean;
  llmProvider: string;
  llmModel: string;
  llmBaseUrl: string;
  setServerInfo: (info: { workspace: string; llmConfigured: boolean; llmProvider?: string; llmModel?: string; llmBaseUrl?: string }) => void;
  settings: { aiEnabled: boolean };
  updateSettings: (s: Partial<{ aiEnabled: boolean }>) => void;
  addNotification: (n: { type: 'info' | 'success' | 'warning' | 'error'; title: string; message: string }) => void;
}) {
  const isLocal = llmBaseUrl.includes('localhost') || llmBaseUrl.includes('127.0.0.1');
  const [preset, setPreset] = useState<'ollama' | 'lmstudio' | 'custom'>(() => {
    if (llmBaseUrl.includes('11434')) return 'ollama';
    if (llmBaseUrl.includes('1234')) return 'lmstudio';
    return 'custom';
  });
  const [url, setUrl] = useState(llmBaseUrl || 'http://localhost:11434/v1');
  const [model, setModel] = useState(llmModel || 'llama3.2');

  useEffect(() => {
    setUrl(llmBaseUrl || 'http://localhost:11434/v1');
    setModel(llmModel || 'llama3.2');
    if (llmBaseUrl.includes('11434')) setPreset('ollama');
    else if (llmBaseUrl.includes('1234')) setPreset('lmstudio');
    else setPreset('custom');
  }, [llmBaseUrl, llmModel]);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switchingToCloud, setSwitchingToCloud] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // API Keys state
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [showApiKeys, setShowApiKeys] = useState(false);

  // Load configured providers on mount
  useEffect(() => {
    api.getApiKeysInfo().then((res) => {
      if (res.ok && res.data) {
        setConfiguredProviders(res.data.configuredProviders || []);
      }
    });
  }, []);

  const handleSaveApiKey = async (providerId: string) => {
    const key = apiKeyInputs[providerId]?.trim();
    if (!key) {
      addNotification({ type: 'warning', title: 'Missing API Key', message: 'Please enter an API key' });
      return;
    }
    setSavingKey(providerId);
    try {
      const res = await api.setApiKey(providerId, key);
      if (res.ok && res.data) {
        setConfiguredProviders(res.data.configuredProviders || []);
        setApiKeyInputs((prev) => ({ ...prev, [providerId]: '' }));
        addNotification({ type: 'success', title: 'API Key Saved', message: `${AI_PROVIDERS.find(p => p.id === providerId)?.name} API key saved successfully` });
      } else {
        addNotification({ type: 'error', title: 'Error', message: res.error?.message || 'Failed to save API key' });
      }
    } catch (e) {
      addNotification({ type: 'error', title: 'Error', message: String(e) });
    } finally {
      setSavingKey(null);
    }
  };

  const handleClearApiKey = async (providerId: string) => {
    setSavingKey(providerId);
    try {
      const res = await api.clearApiKey(providerId);
      if (res.ok && res.data) {
        setConfiguredProviders(res.data.configuredProviders || []);
        addNotification({ type: 'info', title: 'API Key Removed', message: `${AI_PROVIDERS.find(p => p.id === providerId)?.name} API key removed` });
      }
    } catch (e) {
      addNotification({ type: 'error', title: 'Error', message: String(e) });
    } finally {
      setSavingKey(null);
    }
  };

  const handlePreset = (p: typeof preset) => {
    setPreset(p);
    const pr = LOCAL_PRESETS.find((x) => x.id === p)!;
    setUrl(pr.url || url);
    if (pr.model) setModel(pr.model);
  };

  const handleLoadModels = async () => {
    const u = url.trim() || (preset === 'ollama' ? 'http://localhost:11434/v1' : preset === 'lmstudio' ? 'http://localhost:1234/v1' : url);
    if (!u) return;
    setLoadingModels(true);
    try {
      const res = await api.listLocalModels(u);
      if (res.ok && res.data) {
        setAvailableModels(res.data);
        if (res.data.length > 0 && !model) setModel(res.data[0]);
        addNotification({ type: 'success', title: 'Models loaded', message: `Found ${res.data.length} model(s)` });
      }
    } catch {
      addNotification({ type: 'warning', title: 'Could not load models', message: 'Make sure the app is running (Ollama or LM Studio)' });
    } finally {
      setLoadingModels(false);
    }
  };

  const handleTest = async () => {
    const u = url.trim();
    const m = model.trim();
    if (!u || !m) {
      addNotification({ type: 'warning', title: 'Missing fields', message: 'Enter URL and model name' });
      return;
    }
    setTesting(true);
    try {
      // Temporarily save to test (backend uses current config for test)
      const saveRes = await api.setLocalLlmConfig(u, m);
      if (!saveRes.ok) {
        addNotification({ type: 'error', title: 'Error', message: saveRes.error?.message || 'Failed to set config' });
        return;
      }
      const res = await api.testLlmConnection();
      if (res.ok && res.data?.connected) {
        addNotification({ type: 'success', title: 'Connected!', message: `${m} is ready to use` });
      } else {
        addNotification({ type: 'error', title: 'Connection failed', message: res.data?.message || 'Check that the app is running' });
      }
    } catch (e) {
      addNotification({ type: 'error', title: 'Error', message: String(e) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const u = url.trim();
    const m = model.trim();
    if (!u || !m) {
      addNotification({ type: 'warning', title: 'Missing fields', message: 'Enter URL and model name' });
      return;
    }
    setSaving(true);
    try {
      const res = await api.setLocalLlmConfig(u, m);
      if (res.ok && res.data) {
        setServerInfo({
          workspace: useStore.getState().workspaceRoot,
          llmConfigured: true,
          llmProvider: res.data.llmProvider,
          llmModel: res.data.llmModel,
          llmBaseUrl: res.data.llmBaseUrl,
        });
        addNotification({ type: 'success', title: 'Saved', message: 'Local model configured' });
      } else {
        addNotification({ type: 'error', title: 'Error', message: res.error?.message || 'Failed to save' });
      }
    } catch (e) {
      addNotification({ type: 'error', title: 'Error', message: String(e) });
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchToCloud = async () => {
    setSwitchingToCloud(true);
    try {
      const res = await api.clearLocalLlmConfig();
      if (res.ok && res.data) {
        setServerInfo({
          workspace: useStore.getState().workspaceRoot,
          llmConfigured: res.data.llmConfigured,
          llmProvider: res.data.llmProvider,
          llmModel: res.data.llmModel,
          llmBaseUrl: res.data.llmBaseUrl,
        });
        addNotification({ type: 'success', title: 'Switched', message: 'Now using OpenRouter/Proxy. Pick a model in the Agent panel.' });
      } else {
        addNotification({ type: 'error', title: 'Error', message: res.error?.message || 'Failed to switch' });
      }
    } catch (e) {
      addNotification({ type: 'error', title: 'Error', message: String(e) });
    } finally {
      setSwitchingToCloud(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-[#E0E0E0] mb-4">AI Configuration</h3>

      <SettingItem
        icon={<Cpu size={18} />}
        title="Enable AI Assistant"
        description="Turn the AI assistant on or off. When disabled, AI features will be hidden."
      >
        <div className="flex items-center gap-3">
          <ToggleSwitch
            checked={settings.aiEnabled}
            onChange={(checked) => updateSettings({ aiEnabled: checked })}
          />
          <span className={`text-sm ${settings.aiEnabled ? 'text-[#89D185]' : 'text-[#858585]'}`}>
            {settings.aiEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </SettingItem>

      <div className={`p-4 rounded-lg border ${llmConfigured ? 'bg-[#1E3A2F] border-[#2D5A3D]' : 'bg-[#2D2D2D] border-[#3E3E42]'}`}>
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-3 h-3 rounded-full ${llmConfigured ? 'bg-[#89D185]' : 'bg-[#858585]'}`} />
          <span className="font-medium text-[#E0E0E0]">
            {llmConfigured ? 'Connected' : 'Not configured yet'}
          </span>
        </div>
        {llmConfigured && (
          <div className="space-y-1 text-sm mb-4">
            <p className="text-[#858585]">Provider: <span className="text-[#CCCCCC]">{llmProvider}</span></p>
            <p className="text-[#858585]">Model: <span className="text-[#4EC9B0] font-mono">{llmModel}</span></p>
          </div>
        )}

        <h4 className="text-sm font-medium text-[#E0E0E0] mb-3 flex items-center gap-2">
          <Cloud size={16} className="text-[#0078D4]" />
          Use proxy (OpenRouter, 400+ models)
        </h4>
        <p className="text-xs text-[#858585] mb-3">
          Connect to the SentinelOps proxy for instant access to cloud models. No API key needed in the app.
        </p>
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={async () => {
              setSaving(true);
              try {
                const res = await api.setProxyUrl('https://sentinelops.onrender.com');
                if (res.ok && res.data) {
                  setServerInfo({
                    workspace: useStore.getState().workspaceRoot,
                    llmConfigured: true,
                    llmProvider: res.data.llmProvider,
                    llmModel: res.data.llmModel,
                    llmBaseUrl: res.data.llmBaseUrl,
                  });
                  addNotification({ type: 'success', title: 'Connected', message: 'Using SentinelOps proxy. Pick a model in the Agent panel.' });
                } else {
                  addNotification({ type: 'error', title: 'Error', message: res.error?.message || 'Connection failed' });
                }
              } catch (e) {
                addNotification({ type: 'error', title: 'Error', message: String(e) });
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="px-4 py-2 bg-[#0078D4] hover:bg-[#106EBE] rounded-lg text-sm text-white disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />}
            Connect to sentinelops.onrender.com
          </button>
        </div>

        {/* API Keys Section */}
        <div className="mb-6 pt-4 border-t border-[#3E3E42]">
          <button
            onClick={() => setShowApiKeys(!showApiKeys)}
            className="w-full flex items-center justify-between text-sm font-medium text-[#E0E0E0] mb-3"
          >
            <span className="flex items-center gap-2">
              <Zap size={16} className="text-[#0078D4]" />
              Use your own API keys
              {configuredProviders?.length > 0 && (
                <span className="text-xs bg-[#89D185]/20 text-[#89D185] px-2 py-0.5 rounded">
                  {configuredProviders.length} configured
                </span>
              )}
            </span>
            <ChevronRight size={16} className={`transition-transform ${showApiKeys ? 'rotate-90' : ''}`} />
          </button>

          {showApiKeys && (
            <div className="space-y-3">
              <p className="text-xs text-[#858585] mb-3">
                Add your own API keys to use AI providers directly. Keys are stored securely on your device.
              </p>
              {AI_PROVIDERS.map((provider) => {
                const isConfigured = configuredProviders?.includes(provider.id) ?? false;
                return (
                  <div key={provider.id} className="bg-[#1E1E1E] border border-[#3E3E42] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#E0E0E0]">{provider.name}</span>
                        {isConfigured && (
                          <span className="text-xs bg-[#89D185]/20 text-[#89D185] px-2 py-0.5 rounded flex items-center gap-1">
                            <Check size={10} /> Configured
                          </span>
                        )}
                      </div>
                      {isConfigured && (
                        <button
                          onClick={() => handleClearApiKey(provider.id)}
                          disabled={savingKey === provider.id}
                          className="text-xs text-[#F48771] hover:underline disabled:opacity-50"
                        >
                          {savingKey === provider.id ? <Loader2 size={12} className="animate-spin" /> : 'Remove'}
                        </button>
                      )}
                    </div>
                    {!isConfigured && (
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={apiKeyInputs[provider.id] || ''}
                          onChange={(e) => setApiKeyInputs((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                          placeholder={`Enter ${provider.name} API key`}
                          className="flex-1 px-3 py-1.5 bg-[#252526] border border-[#3E3E42] rounded text-sm text-[#CCCCCC] focus:border-[#0078D4] focus:outline-none font-mono"
                        />
                        <button
                          onClick={() => handleSaveApiKey(provider.id)}
                          disabled={savingKey === provider.id || !apiKeyInputs[provider.id]?.trim()}
                          className="px-3 py-1.5 bg-[#0078D4] hover:bg-[#106EBE] rounded text-xs text-white disabled:opacity-50 flex items-center gap-1"
                        >
                          {savingKey === provider.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                          Save
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-[#606060] mt-1">{provider.hint}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <h4 className="text-sm font-medium text-[#E0E0E0] mb-3 flex items-center gap-2">
          <Server size={16} className="text-[#0078D4]" />
          Use a local model (Ollama, LM Studio)
        </h4>
        <p className="text-xs text-[#858585] mb-4">
          Run AI on your computer. No API key needed. Just install the app and connect.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {LOCAL_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePreset(p.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                preset === p.id
                  ? 'bg-[#0078D4] text-white'
                  : 'bg-[#3C3C3C] text-[#CCCCCC] hover:bg-[#505050]'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[#858585] mb-1">Server URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:11434/v1"
              className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#3E3E42] rounded-lg text-sm text-[#CCCCCC] focus:border-[#0078D4] focus:outline-none font-mono"
            />
            {LOCAL_PRESETS.find((p) => p.id === preset)?.hint && (
              <p className="text-xs text-[#606060] mt-1">{LOCAL_PRESETS.find((p) => p.id === preset)!.hint}</p>
            )}
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-[#858585] mb-1">Model name</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. llama3.2, codellama, mistral"
                className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#3E3E42] rounded-lg text-sm text-[#CCCCCC] focus:border-[#0078D4] focus:outline-none font-mono"
              />
            </div>
            <div className="flex flex-col justify-end">
              <button
                onClick={handleLoadModels}
                disabled={loadingModels}
                className="px-3 py-2 bg-[#3C3C3C] hover:bg-[#505050] rounded-lg text-xs text-[#CCCCCC] disabled:opacity-50 flex items-center gap-1.5 min-w-[100px] justify-center"
              >
                {loadingModels ? <Loader2 size={14} className="animate-spin" /> : null}
                {loadingModels ? 'Loading...' : 'Load models'}
              </button>
            </div>
          </div>
          {availableModels.length > 0 && (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#3E3E42] rounded-lg text-sm text-[#CCCCCC]"
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleTest}
              disabled={testing || !url.trim() || !model.trim()}
              className="px-4 py-2 bg-[#3C3C3C] hover:bg-[#505050] rounded-lg text-sm text-[#CCCCCC] disabled:opacity-50 flex items-center gap-2"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Test connection
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !url.trim() || !model.trim()}
              className="px-4 py-2 bg-[#0078D4] hover:bg-[#106EBE] rounded-lg text-sm text-white disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          </div>
        </div>

        {isLocal && (
          <div className="mt-4 pt-4 border-t border-[#3E3E42]">
            <h4 className="text-sm font-medium text-[#E0E0E0] mb-2 flex items-center gap-2">
              <Cloud size={16} className="text-[#0078D4]" />
              Use OpenRouter or proxy instead
            </h4>
            <p className="text-xs text-[#858585] mb-3">
              Switch back to cloud models. Use the proxy above or add your own API keys in "Use your own API keys".
            </p>
            <button
              onClick={handleSwitchToCloud}
              disabled={switchingToCloud}
              className="px-4 py-2 bg-[#3C3C3C] hover:bg-[#505050] rounded-lg text-sm text-[#CCCCCC] disabled:opacity-50 flex items-center gap-2"
            >
              {switchingToCloud ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />}
              Switch to cloud / API
            </button>
          </div>
        )}
        {!isLocal && llmConfigured && (
          <p className="text-xs text-[#858585] mt-4 pt-4 border-t border-[#3E3E42]">
            Using API key or proxy. You can add your own API keys above, or use the proxy for free access. To use local models, set URL and model above and click Save.
          </p>
        )}
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-[#0078D4]' : 'bg-[#3C3C3C]'}`}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function SettingsPanel() {
  const {
    settings,
    updateSettings,
    llmConfigured,
    llmProvider,
    llmModel,
    llmBaseUrl,
    setServerInfo,
    workspaceRoot,
    addNotification,
    incrementIconThemeVersion,
    recentFiles,
    clearRecentFiles,
    extensionSettings,
    extensionConfigurations,
    setExtensionSettings,
    setExtensionConfigurations,
    updateExtensionSetting,
    keyboardShortcuts,
    updateKeyboardShortcut,
    resetKeyboardShortcuts,
    updateAvailable,
    updateProgress,
    isCheckingUpdate,
    isDownloadingUpdate,
    setUpdateAvailable,
    setUpdateProgress,
    setCheckingUpdate,
    setDownloadingUpdate,
    setShowSetupWizard,
    authUser,
    setAuthUser,
  } = useStore();

  const { settingsCategory, setSettingsCategory } = useStore();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(
    (settingsCategory as SettingsCategory) || 'general'
  );

  // Clear the store's settingsCategory after using it
  useEffect(() => {
    if (settingsCategory) {
      setActiveCategory(settingsCategory as SettingsCategory);
      setSettingsCategory(null);
    }
  }, [settingsCategory, setSettingsCategory]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [installedExtensions, setInstalledExtensions] = useState<ExtensionInfo[]>([]);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);
  const [availableThemes, setAvailableThemes] = useState<ThemeContribution[]>([]);
  const [availableIconThemes, setAvailableIconThemes] = useState<IconThemeContribution[]>([]);
  const [applyingTheme, setApplyingTheme] = useState(false);
  const [expandedExtension, setExpandedExtension] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [appPlatform, setAppPlatform] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState<string | null>(null);
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Admin dashboard state
  const [adminUsers, setAdminUsers] = useState<UserWithStats[]>([]);
  const [adminStats, setAdminStats] = useState<{
    totalUsers: number;
    totalMessages: number;
    totalTokens: number;
    totalCost: number;
    usersByPlan: { plan: string; count: number }[];
    recentActivity: { date: string; messages: number; cost: number }[];
  } | null>(null);
  const [loadingAdminData, setLoadingAdminData] = useState(false);

  const isOwnerOrAdmin = authUser?.role === 'owner' || authUser?.role === 'admin';

  const categories: { id: SettingsCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'account', label: 'Account', icon: <User size={18} /> },
    { id: 'general', label: 'General', icon: <Monitor size={18} /> },
    { id: 'editor', label: 'Editor', icon: <Code2 size={18} /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={18} /> },
    { id: 'ai', label: 'AI & Models', icon: <Cpu size={18} /> },
    { id: 'extensions', label: 'Extensions', icon: <Package size={18} /> },
    { id: 'keyboard', label: 'Keyboard', icon: <Keyboard size={18} /> },
    { id: 'about', label: 'About', icon: <Info size={18} /> },
    ...(isOwnerOrAdmin ? [{ id: 'admin' as const, label: 'Admin Dashboard', icon: <BarChart3 size={18} /> }] : []),
  ];

  // Load data
  useEffect(() => {
    const loadData = async () => {
      const [extRes, contributions, settingsRes] = await Promise.all([
        api.listInstalledExtensions(),
        extensionService.loadContributions(),
        api.getExtensionSettings(),
      ]);

      if (extRes.ok && extRes.data) {
        setInstalledExtensions(extRes.data.extensions);
      }
      setAvailableThemes(contributions.themes);
      setAvailableIconThemes(contributions.iconThemes);
      setExtensionConfigurations(contributions.configuration || []);

      if (settingsRes.ok && settingsRes.data) {
        setExtensionSettings(settingsRes.data.settings);
      }
    };
    loadData();
  }, [setExtensionConfigurations, setExtensionSettings]);

  // Load app info when About category is shown
  useEffect(() => {
    if (activeCategory !== 'about') return;
    (async () => {
      try {
        const res = await api.getAppInfo();
        if (res.ok && res.data) {
          setAppVersion(res.data.version);
          setAppPlatform(res.data.platform ?? null);
        }
      } catch {
        // ignore
      }
    })();
  }, [activeCategory]);

  // Load admin data when admin category is selected
  const loadAdminData = async () => {
    if (!tursoService.isInitialized()) {
      console.log('Turso not initialized, skipping admin data load');
      return;
    }

    setLoadingAdminData(true);
    try {
      const [users, stats] = await Promise.all([
        tursoService.getAllUsersWithStats(),
        tursoService.getAdminStats(),
      ]);
      setAdminUsers(users);
      setAdminStats(stats);
    } catch (error) {
      console.error('Failed to load admin data:', error);
      // Don't show notification for expected errors
    } finally {
      setLoadingAdminData(false);
    }
  };

  useEffect(() => {
    if (activeCategory === 'admin' && authUser?.role === 'owner') {
      loadAdminData();

      // Auto-refresh admin data every 10 seconds
      const interval = setInterval(() => {
        loadAdminData();
      }, 10000);

      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, authUser?.role]);

  const uninstallExtension = async (ext: ExtensionInfo) => {
    if (!confirm(`Uninstall ${ext.name}?`)) return;
    setUninstallingId(ext.id);
    const res = await api.uninstallExtension(ext.id);
    if (res.ok) {
      setInstalledExtensions(prev => prev.filter(e => e.id !== ext.id));
      addNotification({ type: 'success', title: 'Extension uninstalled', message: ext.name });
    }
    setUninstallingId(null);
  };

  const checkForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const update = await updateService.checkForUpdates();
      if (update) {
        setUpdateAvailable({
          version: update.version,
          currentVersion: update.currentVersion,
          body: update.body,
        });
        addNotification({ type: 'info', title: 'Update available', message: `Version ${update.version} is available` });
      } else {
        let currentVer = '';
        try {
          const info = await api.getAppInfo();
          if (info.ok && info.data) currentVer = ` (v${info.data.version})`;
        } catch {
          // ignore
        }
        addNotification({ type: 'success', title: 'Up to date', message: `You are running the latest version${currentVer}` });
      }
    } catch (error) {
      const msg = String(error);
      const friendly =
        msg.includes('valid release JSON') || msg.includes('fetch')
          ? 'No update server configured yet. Create a GitHub Release with latest.json to enable in-app updates.'
          : msg;
      addNotification({ type: 'error', title: 'Update check failed', message: friendly });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const downloadAndInstallUpdate = async () => {
    setDownloadingUpdate(true);
    setUpdateProgress({ downloaded: 0, total: 0, percent: 0 });
    try {
      updateService.onProgress((progress) => {
        setUpdateProgress(progress);
      });
      await updateService.downloadAndInstall();
      // App will relaunch after install
    } catch (error) {
      addNotification({ type: 'error', title: 'Update failed', message: String(error) });
      setDownloadingUpdate(false);
      setUpdateProgress(null);
    }
  };

  const applyColorTheme = async (themeId: string) => {
    if (!themeId) {
      updateSettings({ colorTheme: undefined });
      return;
    }
    setApplyingTheme(true);
    const theme = availableThemes.find(t => `${t.extensionId}:${t.id}` === themeId);
    if (theme) {
      const colors = await extensionService.loadTheme(theme);
      if (colors) {
        extensionService.applyTheme(colors);
        updateSettings({ colorTheme: themeId });
        addNotification({ type: 'success', title: 'Theme applied', message: theme.label });
      }
    }
    setApplyingTheme(false);
  };

  const applyIconTheme = async (themeId: string) => {
    if (!themeId) {
      updateSettings({ iconTheme: undefined });
      incrementIconThemeVersion();
      return;
    }
    const theme = availableIconThemes.find(t => `${t.extensionId}:${t.id}` === themeId);
    if (theme) {
      await extensionService.loadIconTheme(theme);
      updateSettings({ iconTheme: themeId });
      incrementIconThemeVersion();
      addNotification({ type: 'success', title: 'Icon theme applied', message: theme.label });
    }
  };

  const saveExtensionSetting = async (key: string, value: unknown) => {
    setSavingSettings(key);
    try {
      const res = await api.setExtensionSetting(key, value);
      if (res.ok) {
        updateExtensionSetting(key, value);
      }
    } finally {
      setSavingSettings(null);
    }
  };

  const resetExtensionSetting = async (key: string, defaultValue: unknown) => {
    setSavingSettings(key);
    try {
      const res = await api.resetExtensionSetting(key);
      if (res.ok) {
        updateExtensionSetting(key, defaultValue);
      }
    } finally {
      setSavingSettings(null);
    }
  };

  const getSettingValue = (key: string, defaultValue: unknown) => {
    return extensionSettings[key] !== undefined ? extensionSettings[key] : defaultValue;
  };

  const renderSettingControl = (key: string, prop: ConfigurationProperty) => {
    const value = getSettingValue(key, prop.default);
    const isSaving = savingSettings === key;

    // Boolean toggle
    if (prop.propType === 'boolean') {
      return (
        <ToggleSwitch
          checked={value as boolean}
          onChange={(checked) => saveExtensionSetting(key, checked)}
          disabled={isSaving}
        />
      );
    }

    // Enum dropdown
    if (prop.enumValues && prop.enumValues.length > 0) {
      return (
        <select
          value={String(value ?? '')}
          onChange={(e) => saveExtensionSetting(key, e.target.value)}
          disabled={isSaving}
          className="w-full max-w-xs p-2 bg-[#1E1E1E] border border-[#3E3E42] rounded-lg text-sm text-[#CCCCCC] focus:border-[#0078D4] focus:outline-none"
        >
          {prop.enumValues.map((enumVal, idx) => (
            <option key={idx} value={String(enumVal)}>
              {String(enumVal)}
              {prop.enumDescriptions?.[idx] ? ` - ${prop.enumDescriptions[idx]}` : ''}
            </option>
          ))}
        </select>
      );
    }

    // Number input
    if (prop.propType === 'number' || prop.propType === 'integer') {
      return (
        <input
          type="number"
          value={value as number ?? ''}
          onChange={(e) => saveExtensionSetting(key, parseFloat(e.target.value) || 0)}
          min={prop.minimum}
          max={prop.maximum}
          disabled={isSaving}
          className="w-32 p-2 bg-[#1E1E1E] border border-[#3E3E42] rounded-lg text-sm text-[#CCCCCC] focus:border-[#0078D4] focus:outline-none"
        />
      );
    }

    // String input (default)
    return (
      <input
        type="text"
        value={String(value ?? '')}
        onChange={(e) => saveExtensionSetting(key, e.target.value)}
        disabled={isSaving}
        className="w-full max-w-md p-2 bg-[#1E1E1E] border border-[#3E3E42] rounded-lg text-sm text-[#CCCCCC] focus:border-[#0078D4] focus:outline-none"
      />
    );
  };

  const shortcutLabels: Record<string, string> = {
    save: 'Save file',
    commandPalette: 'Command palette',
    recentFiles: 'Recent files',
    findInFiles: 'Find in files',
    sourceControl: 'Source control',
    extensions: 'Extensions',
    splitEditor: 'Split editor',
    closeTab: 'Close tab',
    nextTab: 'Next tab',
    prevTab: 'Previous tab',
    toggleTerminal: 'Toggle terminal',
    newFile: 'New file',
    toggleSidebar: 'Toggle sidebar',
    goToLine: 'Go to line',
    findReplace: 'Find and replace',
  };

  // Clean up localization placeholders in extension descriptions
  const cleanDescription = (desc: string | undefined): string => {
    if (!desc) return 'No description';
    // If it's just a placeholder like %ext.config.something%, convert to readable text
    if (desc.startsWith('%') && desc.endsWith('%')) {
      // Extract the key and make it readable
      const key = desc.slice(1, -1);
      const parts = key.split('.');
      const lastPart = parts[parts.length - 1];
      // Convert camelCase to words: "requirePragma" -> "Require Pragma"
      return lastPart
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
    }
    // Replace any inline placeholders with empty string
    return desc.replace(/%[^%]+%/g, '').trim() || 'No description';
  };

  const handleShortcutKeyDown = (e: React.KeyboardEvent, action: string) => {
    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    // Get the key
    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key.length === 1) key = key.toUpperCase();
    else if (key === 'Backquote' || key === '`') key = '`';
    else if (key === 'Backslash' || key === '\\') key = '\\';
    else if (key === 'Tab') key = 'Tab';
    else if (key === 'Escape') {
      setEditingShortcut(null);
      return;
    } else if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
      return; // Don't save modifier-only shortcuts
    }

    parts.push(key);
    const shortcut = parts.join('+');
    updateKeyboardShortcut(action, shortcut);
    setEditingShortcut(null);
  };

  const renderContent = () => {
    const plans = getPlans();

    switch (activeCategory) {
      case 'account':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-[#E0E0E0] mb-4">Account & Subscription</h3>

            {/* User Profile Section */}
            {authUser ? (
              <div className="p-6 rounded-xl bg-gradient-to-br from-[#1E1E1E] to-[#252526] border border-[#3E3E42]">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0078D4] to-[#00BCF2] flex items-center justify-center text-white text-2xl font-bold">
                    {authUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-semibold text-[#E0E0E0]">{authUser.name}</h4>
                    <p className="text-sm text-[#858585]">{authUser.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        authUser.subscription.plan === 'team'
                          ? 'bg-[#9C27B0]/20 text-[#CE93D8]'
                          : authUser.subscription.plan === 'pro'
                          ? 'bg-[#DCB67A]/20 text-[#DCB67A]'
                          : 'bg-[#3E3E42] text-[#858585]'
                      }`}>
                        {authUser.subscription.plan === 'team' && <Users size={12} className="inline mr-1" />}
                        {authUser.subscription.plan === 'pro' && <Crown size={12} className="inline mr-1" />}
                        {authUser.subscription.plan.charAt(0).toUpperCase() + authUser.subscription.plan.slice(1)} Plan
                      </span>
                      {!authUser.emailVerified && (
                        <span className="px-2 py-1 rounded-full text-xs bg-[#F48771]/20 text-[#F48771]">
                          Email not verified
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await authService.signOut();
                      setAuthUser(null);
                      addNotification({ type: 'info', title: 'Signed out', message: 'You have been signed out' });
                    }}
                    className="px-3 py-2 rounded-lg text-sm text-[#858585] hover:text-[#E0E0E0] hover:bg-[#3E3E42] transition-colors flex items-center gap-2"
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-[#1E1E1E] border border-[#3E3E42] text-center">
                <User size={48} className="mx-auto mb-4 text-[#858585]" />
                <h4 className="text-lg font-semibold text-[#E0E0E0] mb-2">Not Signed In</h4>
                <p className="text-sm text-[#858585] mb-4">Sign in to sync settings and unlock Pro features</p>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-6 py-2 rounded-lg bg-[#0078D4] text-white font-medium hover:bg-[#106EBE] transition-colors"
                >
                  Sign In or Create Account
                </button>
              </div>
            )}

            {/* Subscription Plans */}
            <div>
              <h4 className="text-md font-semibold text-[#E0E0E0] mb-4 flex items-center gap-2">
                <CreditCard size={18} /> Subscription Plans
              </h4>
              <div className="grid grid-cols-3 gap-4">
                {plans.map((plan) => {
                  const isCurrentPlan = authUser?.subscription.plan === plan.id;
                  const isPro = plan.id === 'pro';
                  const isTeam = plan.id === 'team';

                  return (
                    <div
                      key={plan.id}
                      className={`p-5 rounded-xl border-2 transition-all ${
                        isCurrentPlan
                          ? 'border-[#0078D4] bg-[#0078D4]/10'
                          : 'border-[#3E3E42] bg-[#1E1E1E] hover:border-[#505050]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {isTeam && <Users size={18} className="text-[#CE93D8]" />}
                        {isPro && <Crown size={18} className="text-[#DCB67A]" />}
                        {!isPro && !isTeam && <User size={18} className="text-[#858585]" />}
                        <h5 className="font-semibold text-[#E0E0E0]">{plan.name}</h5>
                      </div>
                      <div className="mb-4">
                        <span className="text-2xl font-bold text-[#E0E0E0]">
                          ${plan.price}
                        </span>
                        {plan.interval && (
                          <span className="text-sm text-[#858585]">/{plan.interval}</span>
                        )}
                      </div>
                      <ul className="space-y-2 mb-4">
                        {(expandedPlan === plan.id ? plan.features : plan.features.slice(0, 4)).map((feature, i) => (
                          <li key={i} className="text-xs text-[#858585] flex items-start gap-2">
                            <Check size={12} className="text-[#89D185] mt-0.5 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                        {plan.features.length > 4 && (
                          <li>
                            <button
                              onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                              className="text-xs text-[#0078D4] hover:text-[#3794ff] transition-colors cursor-pointer flex items-center gap-1"
                            >
                              {expandedPlan === plan.id ? (
                                <>Show less</>
                              ) : (
                                <>+{plan.features.length - 4} more features</>
                              )}
                            </button>
                          </li>
                        )}
                      </ul>
                      {isCurrentPlan ? (
                        <div className="w-full py-2 rounded-lg bg-[#0078D4]/20 text-[#0078D4] text-sm font-medium text-center">
                          Current Plan
                        </div>
                      ) : plan.price === 0 ? (
                        <div className="w-full py-2 rounded-lg bg-[#3E3E42] text-[#858585] text-sm font-medium text-center">
                          Free Forever
                        </div>
                      ) : (
                        <button
                          onClick={async () => {
                            if (!authUser) {
                              addNotification({ type: 'warning', title: 'Sign in required', message: 'Please sign in to upgrade' });
                              setShowAuthModal(true);
                              return;
                            }
                            const checkout = plan.id === 'team'
                              ? await authService.upgradeToTeamCheckout()
                              : await authService.upgradeToProCheckout();
                            if (checkout?.url) {
                              open(checkout.url);
                            }
                          }}
                          className="w-full py-2 rounded-lg bg-[#0078D4] text-white text-sm font-medium hover:bg-[#106EBE] transition-colors"
                        >
                          Upgrade to {plan.name}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pro Features */}
            {authUser?.subscription.plan !== 'free' && (
              <div className="p-5 rounded-xl bg-gradient-to-r from-[#1E3A2F] to-[#1E1E1E] border border-[#2D5A3D]">
                <h4 className="font-semibold text-[#89D185] mb-3 flex items-center gap-2">
                  <Zap size={18} /> Your Pro Features
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Cloud size={18} className="text-[#0078D4]" />
                    <div>
                      <p className="text-sm text-[#E0E0E0]">Cloud Sync</p>
                      <p className="text-xs text-[#858585]">Settings synced across devices</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Cpu size={18} className="text-[#9C27B0]" />
                    <div>
                      <p className="text-sm text-[#E0E0E0]">Advanced AI</p>
                      <p className="text-xs text-[#858585]">Unlimited AI assistance</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield size={18} className="text-[#DCB67A]" />
                    <div>
                      <p className="text-sm text-[#E0E0E0]">Priority Support</p>
                      <p className="text-xs text-[#858585]">Fast response times</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Palette size={18} className="text-[#F48771]" />
                    <div>
                      <p className="text-sm text-[#E0E0E0]">Premium Themes</p>
                      <p className="text-xs text-[#858585]">Exclusive color themes</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Manage Subscription */}
            {authUser && authUser.subscription.plan !== 'free' && getManageSubscriptionUrl() && (
              <SettingItem
                icon={<CreditCard size={18} />}
                title="Manage Subscription"
                description="Update payment method, view invoices, or cancel subscription"
              >
                <button
                  onClick={async () => {
                    const portalUrl = getManageSubscriptionUrl();
                    if (portalUrl) {
                      addNotification({ type: 'info', title: 'Opening portal...', message: 'Redirecting to billing portal' });
                      open(portalUrl);
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-[#2D2D2D] text-[#E0E0E0] text-sm hover:bg-[#3E3E42] transition-colors flex items-center gap-2"
                >
                  <ExternalLink size={16} /> Open Billing Portal
                </button>
              </SettingItem>
            )}
          </div>
        );

      case 'general':
        return (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[#E0E0E0] mb-4">General Settings</h3>

            <SettingItem
              icon={<Monitor size={18} />}
              title="Workspace"
              description="Current working directory for file operations"
            >
              <div className="flex items-center gap-2 p-3 bg-[#1E1E1E] rounded-lg border border-[#3E3E42]">
                <code className="text-sm text-[#4EC9B0] flex-1 truncate font-mono">
                  {workspaceRoot || 'Not set'}
                </code>
              </div>
            </SettingItem>

            <SettingItem
              icon={<Save size={18} />}
              title="Auto Save"
              description="Automatically save files after changes"
            >
              <ToggleSwitch
                checked={settings.autoSave}
                onChange={(checked) => updateSettings({ autoSave: checked })}
              />
            </SettingItem>

            <SettingItem
              icon={<FolderLock size={18} />}
              title="AI Folder Restriction"
              description="Restrict AI operations to a specific folder for security"
            >
              {settings.allowedFolder ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 p-3 bg-[#1E1E1E] rounded-lg border border-[#3E3E42]">
                    <FolderLock size={16} className="text-[#DCB67A]" />
                    <code className="text-sm text-[#4EC9B0] truncate font-mono">
                      {settings.allowedFolder}
                    </code>
                  </div>
                  <button
                    onClick={() => updateSettings({ allowedFolder: undefined })}
                    className="p-2 text-[#858585] hover:text-[#F48771] hover:bg-[#F48771]/10 rounded-lg"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    const selected = await openFolderPicker({
                      title: 'Select Allowed Folder',
                      defaultPath: workspaceRoot,
                    });
                    if (selected) updateSettings({ allowedFolder: selected });
                  }}
                  className="px-4 py-2 bg-[#0078D4] hover:bg-[#106EBE] text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Set Folder Restriction
                </button>
              )}
            </SettingItem>

            <SettingItem
              icon={<Trash2 size={18} />}
              title="Clear Recent Files"
              description={`Clear the list of ${recentFiles.length} recently opened files`}
            >
              <button
                onClick={() => {
                  clearRecentFiles();
                  addNotification({ type: 'success', title: 'Recent files cleared', message: '' });
                }}
                disabled={recentFiles.length === 0}
                className="px-4 py-2 bg-[#3C3C3C] hover:bg-[#4E4E4E] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Clear History
              </button>
            </SettingItem>
          </div>
        );

      case 'editor':
        return (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[#E0E0E0] mb-4">Editor Settings</h3>

            <SettingItem
              icon={<Type size={18} />}
              title="Font Size"
              description="Editor font size in pixels"
            >
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="10"
                  max="24"
                  value={settings.fontSize}
                  onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })}
                  className="flex-1 h-2 bg-[#3C3C3C] rounded-lg appearance-none cursor-pointer accent-[#0078D4]"
                />
                <span className="w-16 text-center text-sm font-mono bg-[#1E1E1E] px-3 py-1.5 rounded-lg border border-[#3E3E42]">
                  {settings.fontSize}px
                </span>
              </div>
            </SettingItem>

            <SettingItem
              icon={<Hash size={18} />}
              title="Tab Size"
              description="Number of spaces per indentation level"
            >
              <div className="flex gap-2">
                {[2, 4, 8].map((size) => (
                  <button
                    key={size}
                    onClick={() => updateSettings({ tabSize: size })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      settings.tabSize === size
                        ? 'bg-[#0078D4] text-white'
                        : 'bg-[#3C3C3C] text-[#CCCCCC] hover:bg-[#4E4E4E]'
                    }`}
                  >
                    {size} spaces
                  </button>
                ))}
              </div>
            </SettingItem>

            <SettingItem
              icon={<WrapText size={18} />}
              title="Word Wrap"
              description="Wrap long lines to fit the viewport"
            >
              <ToggleSwitch
                checked={settings.wordWrap}
                onChange={(checked) => updateSettings({ wordWrap: checked })}
              />
            </SettingItem>

            <SettingItem
              icon={<Map size={18} />}
              title="Minimap"
              description="Show a minimap overview of the code"
            >
              <ToggleSwitch
                checked={settings.minimap}
                onChange={(checked) => updateSettings({ minimap: checked })}
              />
            </SettingItem>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[#E0E0E0] mb-4">Appearance</h3>

            <SettingItem
              icon={<Palette size={18} />}
              title="Color Theme"
              description="Choose a color theme for the editor"
            >
              {availableThemes.length === 0 ? (
                <p className="text-sm text-[#858585] italic">
                  No themes installed. Install from the Extensions panel.
                </p>
              ) : (
                <select
                  value={settings.colorTheme || ''}
                  onChange={(e) => applyColorTheme(e.target.value)}
                  disabled={applyingTheme}
                  className="w-full p-3 bg-[#1E1E1E] border border-[#3E3E42] rounded-lg text-sm text-[#CCCCCC] focus:border-[#0078D4] focus:outline-none"
                >
                  <option value="">Default Theme</option>
                  {availableThemes.map((theme) => (
                    <option key={`${theme.extensionId}:${theme.id}`} value={`${theme.extensionId}:${theme.id}`}>
                      {theme.label}
                    </option>
                  ))}
                </select>
              )}
            </SettingItem>

            <SettingItem
              icon={<FileImage size={18} />}
              title="File Icon Theme"
              description="Choose icons for files and folders"
            >
              {availableIconThemes.length === 0 ? (
                <p className="text-sm text-[#858585] italic">
                  No icon themes installed. Install from the Extensions panel.
                </p>
              ) : (
                <select
                  value={settings.iconTheme || ''}
                  onChange={(e) => applyIconTheme(e.target.value)}
                  className="w-full p-3 bg-[#1E1E1E] border border-[#3E3E42] rounded-lg text-sm text-[#CCCCCC] focus:border-[#0078D4] focus:outline-none"
                >
                  <option value="">Default Icons</option>
                  {availableIconThemes.map((theme) => (
                    <option key={`${theme.extensionId}:${theme.id}`} value={`${theme.extensionId}:${theme.id}`}>
                      {theme.label}
                    </option>
                  ))}
                </select>
              )}
            </SettingItem>
          </div>
        );

      case 'ai':
        return (
          <AIConfigSection
            llmConfigured={llmConfigured}
            llmProvider={llmProvider}
            llmModel={llmModel}
            llmBaseUrl={llmBaseUrl}
            setServerInfo={setServerInfo}
            settings={settings}
            updateSettings={updateSettings}
            addNotification={addNotification}
          />
        );

      case 'extensions':
        // Only show settings for extensions that are actually installed in SentinelOps
        const installedExtensionIds = new Set(installedExtensions.map(ext => ext.id));

        // Consolidate configurations by extension ID (some extensions have multiple config sections)
        type ConsolidatedConfig = { extensionId: string; extensionName: string; title?: string; properties: Record<string, ConfigurationProperty> };
        const consolidatedConfigs: Record<string, ConsolidatedConfig> = {};

        extensionConfigurations
          .filter(config => installedExtensionIds.has(config.extensionId))
          .forEach(config => {
            const existing = consolidatedConfigs[config.extensionId];
            if (existing) {
              // Merge properties into existing config
              existing.properties = { ...existing.properties, ...config.properties };
            } else {
              consolidatedConfigs[config.extensionId] = {
                extensionId: config.extensionId,
                extensionName: config.extensionName,
                title: config.title,
                properties: { ...config.properties },
              };
            }
          });

        const extensionsWithSettings = Object.values(consolidatedConfigs).filter(
          config => Object.keys(config.properties).length > 0
        );

        return (
          <div className="space-y-6">
            {/* Installed Extensions */}
            <div>
              <h3 className="text-lg font-semibold text-[#E0E0E0] mb-4">
                Installed Extensions ({installedExtensions.length})
              </h3>

              {installedExtensions.length === 0 ? (
                <div className="text-center py-12">
                  <Package size={48} className="mx-auto mb-4 text-[#3E3E42]" />
                  <p className="text-[#858585] mb-2">No extensions installed</p>
                  <p className="text-xs text-[#606060]">Browse extensions from the sidebar</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {installedExtensions.map((ext) => (
                    <div
                      key={ext.id}
                      className="flex items-center gap-4 p-4 bg-[#1E1E1E] rounded-lg border border-[#3E3E42] hover:border-[#505050] transition-colors"
                    >
                      <div className="w-12 h-12 rounded-lg bg-[#2D2D2D] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {ext.icon ? (
                          <img src={ext.icon} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package size={24} className="text-[#858585]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#E0E0E0]">{ext.name}</span>
                          <span className="text-xs text-[#858585] bg-[#2D2D2D] px-2 py-0.5 rounded">
                            v{ext.version}
                          </span>
                        </div>
                        <p className="text-sm text-[#858585] truncate">{ext.publisher}</p>
                      </div>
                      <button
                        onClick={() => uninstallExtension(ext)}
                        disabled={uninstallingId === ext.id}
                        className="p-2 text-[#858585] hover:text-[#F48771] hover:bg-[#F48771]/10 rounded-lg transition-colors"
                        title="Uninstall"
                      >
                        {uninstallingId === ext.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Extension Settings */}
            {extensionsWithSettings.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-[#E0E0E0] mb-4">
                  Extension Settings
                </h3>

                <div className="space-y-2">
                  {extensionsWithSettings.map((config) => {
                    const isExpanded = expandedExtension === config.extensionId;
                    const propEntries = Object.entries(config.properties)
                      .filter(([_, prop]) => !prop.deprecated)
                      .sort((a, b) => (a[1].order ?? 999) - (b[1].order ?? 999));

                    return (
                      <div
                        key={config.extensionId}
                        className="bg-[#1E1E1E] rounded-lg border border-[#3E3E42] overflow-hidden"
                      >
                        {/* Extension header */}
                        <button
                          onClick={() => setExpandedExtension(isExpanded ? null : config.extensionId)}
                          className="w-full flex items-center gap-3 p-4 hover:bg-[#2D2D2D] transition-colors"
                        >
                          <ChevronRight
                            size={16}
                            className={`text-[#858585] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                          <div className="flex-1 text-left">
                            <span className="font-medium text-[#E0E0E0]">
                              {cleanDescription(config.extensionName)}
                            </span>
                            {config.title && (
                              <span className="text-sm text-[#858585] ml-2">
                                - {cleanDescription(config.title)}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-[#858585] bg-[#2D2D2D] px-2 py-1 rounded">
                            {propEntries.length} setting{propEntries.length !== 1 ? 's' : ''}
                          </span>
                        </button>

                        {/* Extension settings (expanded) */}
                        {isExpanded && (
                          <div className="border-t border-[#3E3E42] divide-y divide-[#2D2D2D]">
                            {propEntries.map(([key, prop]) => (
                              <div key={key} className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <code className="text-sm font-mono text-[#4EC9B0]">
                                        {key.split('.').pop()}
                                      </code>
                                      {prop.propType && (
                                        <span className="text-xs text-[#858585] bg-[#2D2D2D] px-1.5 py-0.5 rounded">
                                          {prop.propType}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-[#858585] mb-3">
                                      {cleanDescription(prop.markdownDescription || prop.description)}
                                    </p>
                                    {renderSettingControl(key, prop)}
                                  </div>
                                  {prop.default !== undefined && getSettingValue(key, prop.default) !== prop.default && (
                                    <button
                                      onClick={() => resetExtensionSetting(key, prop.default)}
                                      className="text-xs text-[#858585] hover:text-[#CCCCCC] underline"
                                    >
                                      Reset
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case 'keyboard':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#E0E0E0]">Keyboard Shortcuts</h3>
              <button
                onClick={() => {
                  if (confirm('Reset all keyboard shortcuts to defaults?')) {
                    resetKeyboardShortcuts();
                    addNotification({ type: 'success', title: 'Shortcuts reset', message: '' });
                  }
                }}
                className="px-3 py-1.5 text-xs text-[#858585] hover:text-[#CCCCCC] hover:bg-[#2D2D2D] rounded-lg transition-colors"
              >
                Reset to Defaults
              </button>
            </div>

            <p className="text-xs text-[#858585] mb-4">
              Click on a shortcut to edit it. Press the new key combination to save.
            </p>

            <div className="bg-[#1E1E1E] rounded-lg border border-[#3E3E42] overflow-hidden">
              {Object.entries(keyboardShortcuts).map(([action, shortcut], index, arr) => (
                <div
                  key={action}
                  className={`flex items-center justify-between px-4 py-3 ${
                    index !== arr.length - 1 ? 'border-b border-[#2D2D2D]' : ''
                  }`}
                >
                  <span className="text-sm text-[#CCCCCC]">
                    {shortcutLabels[action] || action}
                  </span>
                  <div className="flex items-center gap-2">
                    {editingShortcut === action ? (
                      <input
                        type="text"
                        autoFocus
                        placeholder="Press keys..."
                        className="px-3 py-1.5 w-40 bg-[#094771] rounded-lg text-xs font-mono text-white border border-[#0078D4] focus:outline-none text-center"
                        onKeyDown={(e) => handleShortcutKeyDown(e, action)}
                        onBlur={() => setEditingShortcut(null)}
                        readOnly
                      />
                    ) : (
                      <button
                        onClick={() => setEditingShortcut(action)}
                        className="px-3 py-1.5 bg-[#2D2D2D] rounded-lg text-xs font-mono text-[#858585] border border-[#3E3E42] hover:border-[#505050] hover:text-[#CCCCCC] transition-colors"
                      >
                        {shortcut}
                      </button>
                    )}
                    {keyboardShortcuts[action] !== DEFAULT_KEYBOARD_SHORTCUTS[action] && (
                      <button
                        onClick={() => {
                          updateKeyboardShortcut(action, DEFAULT_KEYBOARD_SHORTCUTS[action]);
                        }}
                        className="text-xs text-[#858585] hover:text-[#CCCCCC] underline"
                        title="Reset to default"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'about':
        return (
          <div className="space-y-8">
            {/* Hero */}
            <div className="text-center pt-4 pb-6">
              <div className="w-24 h-24 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[#0078D4] via-[#00BCF2] to-[#0078D4] flex items-center justify-center shadow-lg shadow-[#0078D4]/25 ring-2 ring-[#0078D4]/30">
                <Sparkles size={40} className="text-white" strokeWidth={2} />
              </div>
              <h2 className="text-3xl font-bold text-[#E0E0E0] tracking-tight mb-2">SentinelOps</h2>
              <p className="text-[#858585] text-sm max-w-md mx-auto mb-4">
                AI-powered development environment. Code, edit, and ship with an intelligent assistant by your side.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#252526] border border-[#3E3E42] text-sm font-mono text-[#4EC9B0]">
                  v{appVersion ?? '…'}
                </span>
                {appPlatform && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#252526] border border-[#3E3E42] text-xs text-[#858585] capitalize">
                    {appPlatform}
                  </span>
                )}
              </div>
            </div>

            {/* Updates */}
            <div className="rounded-xl border border-[#3E3E42] overflow-hidden bg-[#1E1E1E]">
              <div className="px-4 py-3 border-b border-[#3E3E42] flex items-center gap-2">
                <RefreshCw size={18} className="text-[#0078D4]" />
                <h3 className="text-sm font-semibold text-[#E0E0E0]">Updates</h3>
              </div>
              <div className="p-4">
                {updateAvailable ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#89D185] animate-pulse" />
                      <span className="text-sm font-medium text-[#89D185]">Update available: v{updateAvailable.version}</span>
                    </div>
                    {updateAvailable.body && (
                      <div className="text-xs text-[#858585] bg-[#252526] p-3 rounded-lg max-h-28 overflow-y-auto border border-[#2D2D2D]">
                        {updateAvailable.body}
                      </div>
                    )}
                    {isDownloadingUpdate ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-[#858585]">
                          <span>Downloading…</span>
                          <span>{updateProgress?.percent ?? 0}%</span>
                        </div>
                        <div className="w-full h-2 bg-[#2D2D2D] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#0078D4] transition-all duration-300"
                            style={{ width: `${updateProgress?.percent ?? 0}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={downloadAndInstallUpdate}
                        className="w-full px-4 py-2.5 bg-[#0078D4] hover:bg-[#106EBE] text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Download & Install Update
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <span className="text-sm text-[#858585]">
                      {isCheckingUpdate ? 'Checking for updates…' : `You're up to date${appVersion ? ` (v${appVersion})` : ''}`}
                    </span>
                    <button
                      onClick={checkForUpdates}
                      disabled={isCheckingUpdate}
                      className="px-4 py-2 bg-[#2D2D2D] hover:bg-[#3E3E42] disabled:opacity-50 text-[#E0E0E0] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      {isCheckingUpdate && <Loader2 size={14} className="animate-spin" />}
                      Check for Updates
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Tech stack */}
            <div>
              <h3 className="text-sm font-semibold text-[#E0E0E0] mb-3">Built with</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { name: 'Tauri', desc: 'Secure desktop shell', icon: <Cpu size={20} className="text-[#FFC131]" /> },
                  { name: 'React', desc: 'UI framework', icon: <Code2 size={20} className="text-[#61DAFB]" /> },
                  { name: 'TypeScript', desc: 'Type-safe JS', icon: <Type size={20} className="text-[#3178C6]" /> },
                  { name: 'Monaco', desc: 'Code editor', icon: <Code2 size={20} className="text-[#0078D4]" /> },
                  { name: 'Vite', desc: 'Build tooling', icon: <Zap size={20} className="text-[#646CFF]" /> },
                  { name: 'Rust', desc: 'Backend & CLI', icon: <Shield size={20} className="text-[#CE422B]" /> },
                ].map((item) => (
                  <div
                    key={item.name}
                    className="flex items-start gap-3 p-3 rounded-lg bg-[#1E1E1E] border border-[#3E3E42] hover:border-[#505050] transition-colors"
                  >
                    <div className="mt-0.5 text-[#858585]">{item.icon}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#E0E0E0]">{item.name}</p>
                      <p className="text-xs text-[#858585]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Links */}
            <div>
              <h3 className="text-sm font-semibold text-[#E0E0E0] mb-3">Resources</h3>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://github.com/LuminaryxApp/sentinelops"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1E1E1E] border border-[#3E3E42] text-sm text-[#E0E0E0] hover:bg-[#2D2D2D] hover:border-[#505050] transition-colors"
                >
                  <Github size={18} />
                  GitHub
                  <ExternalLink size={14} className="text-[#858585]" />
                </a>
                <a
                  href="https://github.com/LuminaryxApp/sentinelops/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1E1E1E] border border-[#3E3E42] text-sm text-[#E0E0E0] hover:bg-[#2D2D2D] hover:border-[#505050] transition-colors"
                >
                  <BookOpen size={18} />
                  Changelog
                  <ExternalLink size={14} className="text-[#858585]" />
                </a>
                <button
                  onClick={() => setShowSetupWizard(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1E1E1E] border border-[#3E3E42] text-sm text-[#858585] hover:text-[#E0E0E0] hover:bg-[#2D2D2D] hover:border-[#505050] transition-colors"
                >
                  <Settings size={18} />
                  Run Setup Wizard
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-[#2D2D2D] text-center">
              <p className="text-xs text-[#606060] flex items-center justify-center gap-1.5">
                <Heart size={12} className="text-[#F48771]/80" />
                Made with care for developers everywhere
              </p>
            </div>
          </div>
        );

      case 'admin':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#E0E0E0] flex items-center gap-2">
                <BarChart3 size={20} /> Admin Dashboard
              </h3>
              <button
                onClick={loadAdminData}
                disabled={loadingAdminData}
                className="flex items-center gap-2 px-3 py-1.5 text-xs bg-[#3C3C3C] hover:bg-[#4E4E4E] disabled:opacity-50 rounded-lg transition-colors"
              >
                <RefreshCw size={14} className={loadingAdminData ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {loadingAdminData && !adminStats ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-[#0078D4]" />
              </div>
            ) : !tursoService.isInitialized() ? (
              <div className="p-6 rounded-xl bg-[#1E1E1E] border border-[#3E3E42] text-center">
                <Cloud size={48} className="mx-auto mb-4 text-[#858585]" />
                <h4 className="text-lg font-semibold text-[#E0E0E0] mb-2">Database Not Connected</h4>
                <p className="text-sm text-[#858585]">Configure Turso database in the setup wizard to view admin data</p>
              </div>
            ) : (
              <>
                {/* Overview Stats */}
                {adminStats && (
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-[#0078D4]/20 to-[#0078D4]/5 border border-[#0078D4]/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={18} className="text-[#0078D4]" />
                        <span className="text-xs text-[#858585]">Total Users</span>
                      </div>
                      <p className="text-2xl font-bold text-[#E0E0E0]">{adminStats.totalUsers}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-[#9C27B0]/20 to-[#9C27B0]/5 border border-[#9C27B0]/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity size={18} className="text-[#CE93D8]" />
                        <span className="text-xs text-[#858585]">Total Messages</span>
                      </div>
                      <p className="text-2xl font-bold text-[#E0E0E0]">{adminStats.totalMessages.toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-[#00BCD4]/20 to-[#00BCD4]/5 border border-[#00BCD4]/30">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={18} className="text-[#00BCD4]" />
                        <span className="text-xs text-[#858585]">Total Tokens</span>
                      </div>
                      <p className="text-2xl font-bold text-[#E0E0E0]">{(adminStats.totalTokens / 1000000).toFixed(2)}M</p>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-[#F44336]/20 to-[#F44336]/5 border border-[#F44336]/30">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign size={18} className="text-[#F48771]" />
                        <span className="text-xs text-[#858585]">Total Cost</span>
                      </div>
                      <p className="text-2xl font-bold text-[#F48771]">${adminStats.totalCost.toFixed(2)}</p>
                    </div>
                  </div>
                )}

                {/* Users by Plan */}
                {adminStats && adminStats.usersByPlan.length > 0 && (
                  <div className="p-4 rounded-xl bg-[#1E1E1E] border border-[#3E3E42]">
                    <h4 className="text-sm font-medium text-[#E0E0E0] mb-3 flex items-center gap-2">
                      <Crown size={16} className="text-[#DCB67A]" /> Users by Plan
                    </h4>
                    <div className="flex gap-4">
                      {adminStats.usersByPlan.map((item) => (
                        <div key={item.plan} className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${
                            item.plan === 'team' ? 'bg-[#CE93D8]' :
                            item.plan === 'pro' ? 'bg-[#DCB67A]' : 'bg-[#858585]'
                          }`} />
                          <span className="text-sm text-[#858585]">
                            {item.plan.charAt(0).toUpperCase() + item.plan.slice(1)}: <span className="text-[#E0E0E0] font-medium">{item.count}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Activity */}
                {adminStats && adminStats.recentActivity.length > 0 && (
                  <div className="p-4 rounded-xl bg-[#1E1E1E] border border-[#3E3E42]">
                    <h4 className="text-sm font-medium text-[#E0E0E0] mb-3 flex items-center gap-2">
                      <Calendar size={16} className="text-[#0078D4]" /> Last 7 Days Activity
                    </h4>
                    <div className="space-y-2">
                      {adminStats.recentActivity.map((day) => (
                        <div key={day.date} className="flex items-center justify-between text-sm">
                          <span className="text-[#858585]">{new Date(day.date).toLocaleDateString()}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-[#9CDCFE]">{day.messages} msgs</span>
                            <span className="text-[#F48771]">${day.cost.toFixed(4)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All Users Table */}
                <div className="rounded-xl bg-[#1E1E1E] border border-[#3E3E42] overflow-hidden">
                  <div className="p-4 border-b border-[#3E3E42]">
                    <h4 className="text-sm font-medium text-[#E0E0E0] flex items-center gap-2">
                      <Users size={16} /> All Users ({adminUsers.length})
                    </h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#252526] text-left">
                          <th className="px-4 py-3 text-xs font-medium text-[#858585]">User</th>
                          <th className="px-4 py-3 text-xs font-medium text-[#858585]">Plan</th>
                          <th className="px-4 py-3 text-xs font-medium text-[#858585]">Messages</th>
                          <th className="px-4 py-3 text-xs font-medium text-[#858585]">Tokens</th>
                          <th className="px-4 py-3 text-xs font-medium text-[#858585]">Cost</th>
                          <th className="px-4 py-3 text-xs font-medium text-[#858585]">Joined</th>
                          <th className="px-4 py-3 text-xs font-medium text-[#858585]">Last Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminUsers.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-[#858585]">
                              No users found
                            </td>
                          </tr>
                        ) : (
                          adminUsers.map((user) => (
                            <tr key={user.id} className="border-t border-[#2D2D2D] hover:bg-[#252526]">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0078D4] to-[#00BCF2] flex items-center justify-center text-white text-xs font-bold">
                                    {user.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-[#E0E0E0] font-medium">{user.name}</p>
                                    <p className="text-xs text-[#858585] flex items-center gap-1">
                                      <Mail size={10} /> {user.email}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  user.plan === 'team'
                                    ? 'bg-[#9C27B0]/20 text-[#CE93D8]'
                                    : user.plan === 'pro'
                                    ? 'bg-[#DCB67A]/20 text-[#DCB67A]'
                                    : 'bg-[#3E3E42] text-[#858585]'
                                }`}>
                                  {user.plan}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[#9CDCFE]">{user.total_messages.toLocaleString()}</td>
                              <td className="px-4 py-3 text-[#858585]">{(user.total_tokens / 1000).toFixed(1)}K</td>
                              <td className="px-4 py-3 text-[#F48771] font-medium">${user.total_cost.toFixed(4)}</td>
                              <td className="px-4 py-3 text-[#858585]">{new Date(user.created_at).toLocaleDateString()}</td>
                              <td className="px-4 py-3 text-[#858585]">
                                {user.last_active ? new Date(user.last_active).toLocaleDateString() : '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-full bg-[#1E1E1E]">
      {/* Sidebar */}
      <div className="w-56 border-r border-[#3E3E42] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#3E3E42]">
          <h1 className="text-lg font-semibold text-[#E0E0E0] flex items-center gap-2">
            <Settings size={20} />
            Settings
          </h1>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-[#3E3E42]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858585]" />
            <input
              type="text"
              placeholder="Search settings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#2D2D2D] border border-[#3E3E42] rounded-lg text-sm text-[#CCCCCC] placeholder-[#858585] focus:border-[#0078D4] focus:outline-none"
            />
          </div>
        </div>

        {/* Categories */}
        <nav className="flex-1 overflow-y-auto py-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                activeCategory === category.id
                  ? 'bg-[#094771] text-white'
                  : 'text-[#CCCCCC] hover:bg-[#2D2D2D]'
              }`}
            >
              <span className={activeCategory === category.id ? 'text-white' : 'text-[#858585]'}>
                {category.icon}
              </span>
              <span className="flex-1 text-left">{category.label}</span>
              <ChevronRight size={16} className="text-[#858585]" />
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6">
          {renderContent()}
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
