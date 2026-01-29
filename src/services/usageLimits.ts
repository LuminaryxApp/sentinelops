// ============================================================================
// Usage Limits Configuration
// ============================================================================

export const USAGE_LIMITS = {
  free: {
    dailyMessages: 25,
    description: 'Free tier - 25 messages/day',
  },
  pro: {
    dailyMessages: 300,
    description: 'Pro tier - 300 messages/day',
  },
  team: {
    dailyMessages: 1000,
    description: 'Team tier - 1000 messages/day',
  },
} as const;

// Token pack options for purchase
export const TOKEN_PACKS = [
  {
    id: 'pack_25',
    messages: 25,
    price: 2.99,
    popular: false,
    description: 'Quick top-up',
  },
  {
    id: 'pack_100',
    messages: 100,
    price: 9.99,
    popular: true,
    savings: '17%',
    description: 'Best value',
  },
  {
    id: 'pack_500',
    messages: 500,
    price: 39.99,
    popular: false,
    savings: '33%',
    description: 'Power user pack',
  },
] as const;

export type SubscriptionPlan = 'free' | 'pro' | 'team';
export type UserRole = 'user' | 'owner' | 'admin';

export interface UsageStatus {
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  isLimitReached: boolean;
  bonusAvailable: number;
  canSendMessage: boolean;
  isUnlimited: boolean;
}

/**
 * Get the daily message limit for a subscription plan
 */
export function getDailyLimit(plan: SubscriptionPlan): number {
  return USAGE_LIMITS[plan]?.dailyMessages || USAGE_LIMITS.free.dailyMessages;
}

/**
 * Calculate usage status for a user
 * Owners and admins have unlimited access
 */
export function getUsageStatus(
  plan: SubscriptionPlan,
  dailyMessageCount: number,
  bonusMessages: number,
  role: UserRole = 'user'
): UsageStatus {
  // Owners and admins have unlimited access
  const isUnlimited = role === 'owner' || role === 'admin';

  if (isUnlimited) {
    return {
      used: dailyMessageCount,
      limit: Infinity,
      remaining: Infinity,
      percentUsed: 0,
      isLimitReached: false,
      bonusAvailable: bonusMessages,
      canSendMessage: true,
      isUnlimited: true,
    };
  }

  const limit = getDailyLimit(plan);
  const remaining = Math.max(0, limit - dailyMessageCount);
  const percentUsed = Math.min(100, (dailyMessageCount / limit) * 100);
  const isLimitReached = dailyMessageCount >= limit;
  const canSendMessage = !isLimitReached || bonusMessages > 0;

  return {
    used: dailyMessageCount,
    limit,
    remaining,
    percentUsed,
    isLimitReached,
    bonusAvailable: bonusMessages,
    canSendMessage,
    isUnlimited: false,
  };
}

/**
 * Get warning thresholds
 */
export function getWarningLevel(percentUsed: number): 'normal' | 'warning' | 'critical' | 'exceeded' {
  if (percentUsed >= 100) return 'exceeded';
  if (percentUsed >= 90) return 'critical';
  if (percentUsed >= 75) return 'warning';
  return 'normal';
}

/**
 * Format remaining messages for display
 */
export function formatRemaining(status: UsageStatus): string {
  if (status.isUnlimited) {
    return 'Unlimited';
  }
  if (status.isLimitReached) {
    if (status.bonusAvailable > 0) {
      return `${status.bonusAvailable} bonus left`;
    }
    return 'Limit reached';
  }
  return `${status.remaining} left today`;
}
