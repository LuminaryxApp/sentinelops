/**
 * Unified payment service. Supports Lemon Squeezy, Gumroad, or a simple link.
 * Set VITE_PAYMENT_PROVIDER=lemonsqueezy | gumroad | link in .env.
 * See docs/PAYMENTS.md for setup and US/business requirements.
 */

import { lemonSqueezyService } from './lemonSqueezyService';

export type PaymentProvider = 'lemonsqueezy' | 'gumroad' | 'link';

export interface CheckoutOptions {
  email: string;
  name?: string;
  userId: string;
  plan: 'pro' | 'team';
  successUrl?: string;
  cancelUrl?: string;
}

export interface PlanInfo {
  id: string;
  name: string;
  price: number;
  interval: string | null;
  features: string[];
}

const PLANS: PlanInfo[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: null,
    features: [
      'Basic code editing',
      'Local file management',
      'Syntax highlighting',
      'Basic AI assistance (limited)',
      'Community support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 12,
    interval: 'month',
    features: [
      'Everything in Free',
      'Unlimited AI assistance',
      'Cloud settings sync',
      'Priority support',
      'Advanced AI models',
      'Custom themes',
      'Extension marketplace',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    price: 29,
    interval: 'month',
    features: [
      'Everything in Pro',
      'Team collaboration',
      'Shared workspaces',
      'Admin dashboard',
      'SSO/SAML',
      'Audit logs',
      'Dedicated support',
    ],
  },
];

function getProvider(): PaymentProvider {
  const p = (import.meta.env.VITE_PAYMENT_PROVIDER ?? 'lemonsqueezy') as string;
  if (p === 'gumroad' || p === 'link') return p;
  return 'lemonsqueezy';
}

function getGumroadProUrl(): string {
  return (import.meta.env.VITE_GUMROAD_PRO_URL ?? '').trim();
}

function getGumroadTeamUrl(): string {
  return (import.meta.env.VITE_GUMROAD_TEAM_URL ?? '').trim();
}

function getUpgradeUrl(): string {
  return (import.meta.env.VITE_UPGRADE_URL ?? '').trim();
}

function buildGumroadCheckoutUrl(baseUrl: string, email: string): string {
  const trimmed = (baseUrl ?? '').trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    url.searchParams.set('wanted', 'true');
    if (email) url.searchParams.set('email', email);
    return url.toString();
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initializePayment(): void {
  if (getProvider() === 'lemonsqueezy') {
    lemonSqueezyService.initializeFromConfig();
  }
}

export function getCheckoutUrl(options: CheckoutOptions): string {
  const provider = getProvider();

  if (provider === 'lemonsqueezy' && lemonSqueezyService.isInitialized()) {
    return lemonSqueezyService.getCheckoutUrl(options);
  }

  if (provider === 'gumroad') {
    const proUrl = getGumroadProUrl();
    const teamUrl = getGumroadTeamUrl();
    const base = options.plan === 'team' ? teamUrl : proUrl;
    return buildGumroadCheckoutUrl(base, options.email);
  }

  if (provider === 'link') {
    return getUpgradeUrl();
  }

  return '';
}

export function getPlans(): PlanInfo[] {
  return PLANS;
}

export function isPaymentInitialized(): boolean {
  const provider = getProvider();

  if (provider === 'lemonsqueezy') {
    return lemonSqueezyService.isInitialized();
  }

  if (provider === 'gumroad') {
    return !!getGumroadProUrl() && !!getGumroadTeamUrl();
  }

  if (provider === 'link') {
    return !!getUpgradeUrl();
  }

  return false;
}

/** URL for "Manage subscription" / billing portal, or null if not available. */
export function getManageSubscriptionUrl(): string | null {
  const provider = getProvider();

  if (provider === 'lemonsqueezy') {
    return 'https://app.lemonsqueezy.com/my-orders';
  }

  if (provider === 'gumroad') {
    return 'https://gumroad.com/library';
  }

  return null;
}
