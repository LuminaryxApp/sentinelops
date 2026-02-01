import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Lock, Crown, Code, Brain, MessageSquare, Image, Gift, Sparkles } from 'lucide-react';
import { MODEL_CATEGORIES, findModel, isModelPremium, type ModelInfo } from '../../services/chatService';

interface ModelSelectorProps {
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  isPro?: boolean;
}

const categoryIcons: Record<string, React.ReactNode> = {
  free: <Gift size={14} />,
  coding: <Code size={14} />,
  reasoning: <Brain size={14} />,
  chat: <MessageSquare size={14} />,
  vision: <Image size={14} />,
};

export default function ModelSelector({
  selectedModel,
  onSelectModel,
  isPro = false,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('free');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedModelInfo = findModel(selectedModel);
  const selectedCategory = MODEL_CATEGORIES.find((c) =>
    c.models.some((m) => m.id === selectedModel)
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (model: ModelInfo) => {
    const premium = isModelPremium(model.id);
    if (premium && !isPro) return;
    onSelectModel(model.id);
    setIsOpen(false);
  };

  const formatPrice = (input: number, output: number) => {
    if (input === 0 && output === 0) return 'Free';
    if (input === output) return `$${input.toFixed(2)}/M`;
    return `$${input.toFixed(2)}/$${output.toFixed(2)}/M`;
  };

  const formatContext = (ctx: number) => {
    if (ctx >= 1000000) return `${(ctx / 1000000).toFixed(1)}M`;
    if (ctx >= 1000) return `${Math.round(ctx / 1000)}K`;
    return ctx.toString();
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 glass-card rounded-xl hover:border-cyan/30 transition-colors min-w-[200px]"
      >
        {selectedCategory && (
          <span style={{ color: selectedCategory.color }}>
            {categoryIcons[selectedCategory.id]}
          </span>
        )}
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm text-white truncate">
            {selectedModelInfo?.name || 'Select model'}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {selectedModelInfo?.provider || 'Choose a model'}
          </div>
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 glass-card rounded-xl overflow-hidden z-50 border border-white/10">
          {/* Category Tabs */}
          <div className="flex overflow-x-auto border-b border-white/5 bg-midnight-200">
            {MODEL_CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                  activeCategory === category.id
                    ? 'border-current'
                    : 'border-transparent text-slate-500 hover:text-white'
                }`}
                style={{ color: activeCategory === category.id ? category.color : undefined }}
              >
                {categoryIcons[category.id]}
                <span>{category.name}</span>
              </button>
            ))}
          </div>

          {/* Model List */}
          <div className="max-h-[320px] overflow-y-auto">
            {MODEL_CATEGORIES.find((c) => c.id === activeCategory)?.models.map((model) => {
              const premium = isModelPremium(model.id);
              const isLocked = premium && !isPro;

              return (
                <button
                  key={model.id}
                  onClick={() => handleSelect(model)}
                  disabled={isLocked}
                  className={`w-full px-3 py-3 text-left transition-colors flex items-start gap-3 relative ${
                    isLocked ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/5'
                  } ${selectedModel === model.id && !isLocked ? 'bg-cyan/10' : ''}`}
                >
                  {/* Lock overlay for premium models */}
                  {isLocked && (
                    <div className="absolute inset-0 flex items-center justify-end pr-3 pointer-events-none">
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-purple/20 text-purple text-xs font-medium">
                        <Crown size={12} />
                        <span>Pro</span>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${isLocked ? 'text-slate-500' : 'text-white'}`}>
                        {model.name}
                      </span>
                      {isLocked && <Lock size={12} className="text-slate-600" />}
                      {selectedModel === model.id && !isLocked && (
                        <Check size={12} className="text-cyan" />
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{model.description}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs">
                      <span className="text-cyan">{model.provider}</span>
                      <span className="text-slate-500">{formatContext(model.contextWindow)} ctx</span>
                      <span className={premium ? 'text-yellow-500' : 'text-green-400'}>
                        {formatPrice(model.inputPrice, model.outputPrice)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-white/5 bg-midnight-200">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Sparkles size={12} />
              <span>Prices from OpenRouter</span>
            </div>
          </div>

          {/* Upgrade prompt */}
          {!isPro && (
            <div className="px-3 py-2 border-t border-white/5 bg-purple/5">
              <a
                href="/pricing"
                className="flex items-center justify-center gap-2 text-xs text-purple hover:text-white transition-colors"
              >
                <Crown size={12} />
                Upgrade to Pro for all models
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
