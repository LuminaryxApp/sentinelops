import { Zap, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface UsageIndicatorProps {
  used: number;
  limit: number;
  plan: 'anonymous' | 'free' | 'pro' | 'team';
  isAuthenticated: boolean;
}

export default function UsageIndicator({
  used,
  limit,
  plan,
  isAuthenticated,
}: UsageIndicatorProps) {
  const remaining = Math.max(0, limit - used);
  const percentage = Math.min(100, (used / limit) * 100);
  const isLow = remaining <= 5 && remaining > 0;
  const isExhausted = remaining === 0;

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap
            size={14}
            className={isExhausted ? 'text-coral' : isLow ? 'text-yellow-500' : 'text-cyan'}
          />
          <span className="text-sm text-slate-300">Daily Messages</span>
        </div>
        <span
          className={`text-sm font-medium ${
            isExhausted ? 'text-coral' : isLow ? 'text-yellow-500' : 'text-white'
          }`}
        >
          {remaining} left
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-midnight-200 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all ${
            isExhausted
              ? 'bg-coral'
              : isLow
              ? 'bg-yellow-500'
              : 'bg-gradient-to-r from-cyan to-purple'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {used} / {limit} used
        </span>
        <span className="capitalize">{plan} plan</span>
      </div>

      {/* Upgrade prompt */}
      {(isExhausted || isLow || !isAuthenticated) && (
        <div className="mt-3 pt-3 border-t border-white/5">
          {!isAuthenticated ? (
            <p className="text-xs text-slate-400 mb-2">
              Sign in for more messages
            </p>
          ) : plan === 'anonymous' || plan === 'free' ? (
            <Link
              to="/pricing"
              className="flex items-center justify-between text-xs text-cyan hover:text-white transition-colors"
            >
              <span>Upgrade for 300 messages/day</span>
              <ArrowRight size={12} />
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
