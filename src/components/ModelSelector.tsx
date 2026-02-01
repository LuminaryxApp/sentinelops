import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Code, Brain, MessageSquare, Image, Sparkles, Check, Gift, Lock, Crown, Server, Loader2 } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import { api } from '../services/api';

// Price threshold for "premium" models (per 1M input tokens)
// Models costing $1.00+ per 1M input tokens require Pro subscription
const PREMIUM_PRICE_THRESHOLD = 1.00;

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  inputPrice: number;  // per 1M tokens
  outputPrice: number; // per 1M tokens
  description?: string;
}

export interface ModelCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  models: ModelInfo[];
}

export const MODEL_CATEGORIES: ModelCategory[] = [
  {
    id: 'free',
    name: 'Free',
    icon: <Gift className="h-4 w-4" />,
    color: '#89D185',
    models: [
      {
        id: 'meta-llama/llama-3.2-3b-instruct:free',
        name: 'Llama 3.2 3B Free',
        provider: 'Meta (OpenRouter)',
        contextWindow: 131072,
        inputPrice: 0,
        outputPrice: 0,
        description: 'Free tier - rate limited',
      },
    ],
  },
  {
    id: 'coding',
    name: 'Coding',
    icon: <Code className="h-4 w-4" />,
    color: '#007ACC',
    models: [
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'Anthropic',
        contextWindow: 200000,
        inputPrice: 3.00,
        outputPrice: 15.00,
        description: 'Best for complex coding',
      },
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        provider: 'OpenAI',
        contextWindow: 128000,
        inputPrice: 2.50,
        outputPrice: 10.00,
        description: 'Excellent all-around',
      },
      {
        id: 'deepseek/deepseek-chat',
        name: 'DeepSeek V3',
        provider: 'DeepSeek',
        contextWindow: 64000,
        inputPrice: 0.14,
        outputPrice: 0.28,
        description: 'Great value coder',
      },
      {
        id: 'qwen/qwen-2.5-72b-instruct',
        name: 'Qwen 2.5 72B',
        provider: 'Qwen',
        contextWindow: 131072,
        inputPrice: 0.35,
        outputPrice: 0.40,
        description: 'Strong open-source',
      },
      {
        id: 'meta-llama/llama-3.1-70b-instruct',
        name: 'Llama 3.1 70B',
        provider: 'Meta',
        contextWindow: 131072,
        inputPrice: 0.35,
        outputPrice: 0.40,
        description: 'Reliable coder',
      },
      {
        id: 'openai/gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'OpenAI',
        contextWindow: 128000,
        inputPrice: 0.15,
        outputPrice: 0.60,
        description: 'Fast and cheap',
      },
    ],
  },
  {
    id: 'reasoning',
    name: 'Reasoning',
    icon: <Brain className="h-4 w-4" />,
    color: '#9C27B0',
    models: [
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'Anthropic',
        contextWindow: 200000,
        inputPrice: 3.00,
        outputPrice: 15.00,
        description: 'Best value reasoning',
      },
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        provider: 'OpenAI',
        contextWindow: 128000,
        inputPrice: 2.50,
        outputPrice: 10.00,
        description: 'Strong reasoner',
      },
      {
        id: 'google/gemini-pro-1.5',
        name: 'Gemini 1.5 Pro',
        provider: 'Google',
        contextWindow: 2097152,
        inputPrice: 1.25,
        outputPrice: 5.00,
        description: '2M context window!',
      },
      {
        id: 'meta-llama/llama-3.1-405b-instruct',
        name: 'Llama 3.1 405B',
        provider: 'Meta',
        contextWindow: 131072,
        inputPrice: 2.00,
        outputPrice: 2.00,
        description: 'Largest open model',
      },
      {
        id: 'mistralai/mistral-large',
        name: 'Mistral Large',
        provider: 'Mistral',
        contextWindow: 128000,
        inputPrice: 2.00,
        outputPrice: 6.00,
        description: 'Strong European',
      },
      {
        id: 'qwen/qwen-2.5-72b-instruct',
        name: 'Qwen 2.5 72B',
        provider: 'Qwen',
        contextWindow: 131072,
        inputPrice: 0.35,
        outputPrice: 0.40,
        description: 'Great value',
      },
    ],
  },
  {
    id: 'chat',
    name: 'Chat',
    icon: <MessageSquare className="h-4 w-4" />,
    color: '#4CAF50',
    models: [
      {
        id: 'openai/gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'OpenAI',
        contextWindow: 128000,
        inputPrice: 0.15,
        outputPrice: 0.60,
        description: 'Best value chat',
      },
      {
        id: 'anthropic/claude-3-haiku',
        name: 'Claude 3 Haiku',
        provider: 'Anthropic',
        contextWindow: 200000,
        inputPrice: 0.25,
        outputPrice: 1.25,
        description: 'Fast and smart',
      },
      {
        id: 'meta-llama/llama-3.1-8b-instruct',
        name: 'Llama 3.1 8B',
        provider: 'Meta',
        contextWindow: 131072,
        inputPrice: 0.055,
        outputPrice: 0.055,
        description: 'Ultra affordable',
      },
      {
        id: 'mistralai/mistral-7b-instruct',
        name: 'Mistral 7B',
        provider: 'Mistral',
        contextWindow: 32768,
        inputPrice: 0.055,
        outputPrice: 0.055,
        description: 'Fast small model',
      },
      {
        id: 'google/gemma-2-9b-it',
        name: 'Gemma 2 9B',
        provider: 'Google',
        contextWindow: 8192,
        inputPrice: 0.08,
        outputPrice: 0.08,
        description: 'Efficient',
      },
      {
        id: 'deepseek/deepseek-chat',
        name: 'DeepSeek Chat',
        provider: 'DeepSeek',
        contextWindow: 64000,
        inputPrice: 0.14,
        outputPrice: 0.28,
        description: 'Great value',
      },
    ],
  },
  {
    id: 'vision',
    name: 'Vision',
    icon: <Image className="h-4 w-4" />,
    color: '#FF9800',
    models: [
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        provider: 'OpenAI',
        contextWindow: 128000,
        inputPrice: 2.50,
        outputPrice: 10.00,
        description: 'Best vision model',
      },
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'Anthropic',
        contextWindow: 200000,
        inputPrice: 3.00,
        outputPrice: 15.00,
        description: 'Great vision + code',
      },
      {
        id: 'google/gemini-pro-1.5',
        name: 'Gemini 1.5 Pro',
        provider: 'Google',
        contextWindow: 2097152,
        inputPrice: 1.25,
        outputPrice: 5.00,
        description: 'Long context vision',
      },
      {
        id: 'openai/gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'OpenAI',
        contextWindow: 128000,
        inputPrice: 0.15,
        outputPrice: 0.60,
        description: 'Affordable vision',
      },
      {
        id: 'google/gemini-flash-1.5',
        name: 'Gemini 1.5 Flash',
        provider: 'Google',
        contextWindow: 1000000,
        inputPrice: 0.075,
        outputPrice: 0.30,
        description: 'Fast and cheap',
      },
      {
        id: 'meta-llama/llama-3.2-11b-vision-instruct',
        name: 'Llama 3.2 11B Vision',
        provider: 'Meta',
        contextWindow: 131072,
        inputPrice: 0.055,
        outputPrice: 0.055,
        description: 'Open-source vision',
      },
    ],
  },
];

// Get all models as flat list
export const ALL_MODELS = MODEL_CATEGORIES.flatMap((cat) =>
  cat.models.map((m) => ({ ...m, category: cat.id }))
);

// Find model by ID
export const findModel = (modelId: string): ModelInfo | undefined => {
  for (const category of MODEL_CATEGORIES) {
    const model = category.models.find((m) => m.id === modelId);
    if (model) return model;
  }
  return undefined;
};

// Check if a model is premium (requires paid subscription)
export const isModelPremium = (model: ModelInfo): boolean => {
  return model.inputPrice >= PREMIUM_PRICE_THRESHOLD;
};

const LOCAL_CATEGORY_ID = 'local';

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  onUpgradeClick?: () => void;
  /** When set, shows a Local category with models from this server (Ollama/LM Studio) */
  llmBaseUrl?: string;
  llmProvider?: string;
}

export default function ModelSelector({ value, onChange, disabled, onUpgradeClick, llmBaseUrl, llmProvider }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('coding');
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { authUser } = useStore();
  const isLocalConfigured = llmBaseUrl && (llmBaseUrl.includes('localhost') || llmBaseUrl.includes('127.0.0.1'));
  // Owners and admins have access to all models regardless of subscription
  const isOwnerOrAdmin = authUser?.role === 'owner' || authUser?.role === 'admin';
  const isFreeTier = !isOwnerOrAdmin && (!authUser || authUser.subscription.plan === 'free');

  // Fetch local models when dropdown opens, default to Local tab when configured
  useEffect(() => {
    if (!isOpen) return;
    if (isLocalConfigured) {
      setActiveCategory(LOCAL_CATEGORY_ID);
      setLoadingLocal(true);
      api.listLocalModels(llmBaseUrl!)
        .then((res) => {
          const models = res.ok && res.data ? res.data : [];
          setLocalModels(models);
        })
        .catch(() => setLocalModels([]))
        .finally(() => setLoadingLocal(false));
    }
  }, [isOpen, isLocalConfigured, llmBaseUrl]);

  // Build local category from fetched models (show tab when configured, even while loading)
  const localCategory: ModelCategory | null = isLocalConfigured
    ? {
        id: LOCAL_CATEGORY_ID,
        name: 'Local',
        icon: <Server className="h-4 w-4" />,
        color: '#7B68EE',
        models: localModels.map((name) => ({
          id: name,
          name,
          provider: llmProvider || 'Local',
          contextWindow: 8192,
          inputPrice: 0,
          outputPrice: 0,
          description: 'Runs on your machine',
        })),
      }
    : null;

  const allCategories = localCategory
    ? [localCategory, ...MODEL_CATEGORIES]
    : MODEL_CATEGORIES;

  const selectedModel = findModel(value) ?? (localCategory?.models.find((m) => m.id === value));
  const selectedCategory = allCategories.find((c) => c.models.some((m) => m.id === value));

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const formatPrice = (input: number, output: number) => {
    if (input === output) {
      return `$${input.toFixed(2)}/M`;
    }
    return `$${input.toFixed(2)}/$${output.toFixed(2)}/M`;
  };

  const formatContext = (ctx: number) => {
    if (ctx >= 1000000) return `${(ctx / 1000000).toFixed(1)}M`;
    if (ctx >= 1000) return `${Math.round(ctx / 1000)}K`;
    return ctx.toString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border transition-all w-full
          ${isOpen ? 'border-[#007ACC] bg-[#1E1E1E]' : 'border-[#3E3E42] bg-[#252526]'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#007ACC] cursor-pointer'}
        `}
      >
        {selectedCategory && (
          <span style={{ color: selectedCategory.color }}>{selectedCategory.icon}</span>
        )}
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium truncate">
            {selectedModel?.name || value || 'Select Model'}
          </div>
          <div className="text-xs text-[#858585] truncate">
            {selectedModel
              ? selectedCategory?.id === LOCAL_CATEGORY_ID
                ? `${selectedModel.provider} • Free`
                : `${selectedModel.provider} • ${formatContext(selectedModel.contextWindow)} ctx`
              : 'Choose a model'}
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-[#858585] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1E1E1E] border border-[#3E3E42] rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Category Tabs */}
          <div className="flex overflow-x-auto border-b border-[#3E3E42] scrollbar-thin">
            {allCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`
                  flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap
                  transition-colors border-b-2 min-w-fit
                  ${activeCategory === category.id
                    ? 'border-current text-white'
                    : 'border-transparent text-[#858585] hover:text-white'
                  }
                `}
                style={{ color: activeCategory === category.id ? category.color : undefined }}
              >
                {category.icon}
                <span>{category.name}</span>
              </button>
            ))}
          </div>

          {/* Model List */}
          <div className="max-h-[320px] overflow-y-auto">
            {activeCategory === LOCAL_CATEGORY_ID && loadingLocal ? (
              <div className="flex items-center justify-center gap-2 py-8 text-[#858585]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading models…</span>
              </div>
            ) : activeCategory === LOCAL_CATEGORY_ID && localModels.length === 0 ? (
              <div className="py-8 text-center text-sm text-[#858585]">
                <p>No models found. Make sure Ollama or LM Studio is running.</p>
                <p className="text-xs mt-2">Configure in Settings → AI</p>
              </div>
            ) : (
            allCategories.find((c) => c.id === activeCategory)?.models.map((model) => {
              const isLocal = activeCategory === LOCAL_CATEGORY_ID;
              const isPremium = !isLocal && isModelPremium(model);
              const isLocked = !isLocal && isFreeTier && isPremium;

              return (
                <button
                  key={model.id}
                  onClick={() => {
                    if (isLocked) {
                      setIsOpen(false);
                      onUpgradeClick?.();
                    } else {
                      onChange(model.id);
                      if (isLocal && llmBaseUrl) {
                        api.setLocalLlmConfig(llmBaseUrl, model.id).catch(() => {});
                      }
                      setIsOpen(false);
                    }
                  }}
                  className={`
                    w-full px-3 py-2.5 text-left transition-colors flex items-start gap-3 relative
                    ${isLocked ? 'opacity-60' : ''}
                    ${value === model.id && !isLocked ? 'bg-[#094771]' : 'hover:bg-[#2A2D2E]'}
                  `}
                >
                  {/* Lock overlay for premium models */}
                  {isLocked && (
                    <div className="absolute inset-0 flex items-center justify-end pr-3 pointer-events-none">
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#0078D4]/20 text-[#0078D4] text-xs font-medium">
                        <Crown className="h-3 w-3" />
                        <span>Pro</span>
                      </div>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${isLocked ? 'line-through text-[#858585]' : ''}`}>
                        {model.name}
                      </span>
                      {isLocked && <Lock className="h-3 w-3 text-[#858585]" />}
                      {value === model.id && !isLocked && <Check className="h-3 w-3 text-[#89D185]" />}
                    </div>
                    <div className="text-xs text-[#858585] mt-0.5">{model.description}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs">
                      <span className="text-[#9CDCFE]">{model.provider}</span>
                      <span className="text-[#CE9178]">{formatContext(model.contextWindow)} ctx</span>
                      {!isLocal && (
                        <span className={isPremium ? 'text-[#DCB67A]' : 'text-[#89D185]'}>
                          {formatPrice(model.inputPrice, model.outputPrice)}
                        </span>
                      )}
                      {isLocal && <span className="text-[#89D185]">Free</span>}
                    </div>
                  </div>
                </button>
              );
            }) )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-[#3E3E42] bg-[#252526]">
            <div className="flex items-center gap-2 text-xs text-[#858585]">
              <Sparkles className="h-3 w-3" />
              <span>Prices from OpenRouter • Updated regularly</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
