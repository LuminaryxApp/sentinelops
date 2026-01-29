import { fetch } from '@tauri-apps/plugin-http';

// ============================================================================
// Types
// ============================================================================

export interface LemonSqueezyConfig {
  apiKey: string;
  storeId: string;
  proVariantId: string;
  teamVariantId: string;
  webhookSecret?: string;
}

export interface CheckoutOptions {
  email: string;
  name?: string;
  userId: string;
  plan: 'pro' | 'team';
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutResponse {
  url: string;
  checkoutId: string;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  status: string;
  created_at: string;
}

export interface LemonSubscription {
  id: string;
  status: 'on_trial' | 'active' | 'paused' | 'past_due' | 'unpaid' | 'cancelled' | 'expired';
  variant_id: number;
  customer_id: number;
  product_id: number;
  renews_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  meta: {
    event_name: string;
    webhook_id: string;
    custom_data?: {
      user_id?: string;
    };
  };
  data: {
    id: string;
    type: string;
    attributes: Record<string, unknown>;
  };
}

// ============================================================================
// LemonSqueezy Service
// ============================================================================

class LemonSqueezyService {
  private config: LemonSqueezyConfig | null = null;
  private baseUrl = 'https://api.lemonsqueezy.com/v1';

  // Initialize with your LemonSqueezy credentials
  initialize(config: LemonSqueezyConfig): void {
    this.config = config;
  }

  // Initialize from environment/config
  initializeFromConfig(): void {
    const apiKey = import.meta.env.VITE_LEMON_API_KEY;
    const storeId = import.meta.env.VITE_LEMON_STORE_ID;
    const proVariantId = import.meta.env.VITE_LEMON_PRO_VARIANT_ID;
    const teamVariantId = import.meta.env.VITE_LEMON_TEAM_VARIANT_ID;

    if (!apiKey || !storeId) {
      console.warn('LemonSqueezy credentials not configured');
      return;
    }

    this.initialize({
      apiKey,
      storeId,
      proVariantId: proVariantId || '',
      teamVariantId: teamVariantId || '',
    });
  }

  private getConfig(): LemonSqueezyConfig {
    if (!this.config) {
      throw new Error('LemonSqueezy not initialized. Call initialize() first.');
    }
    return this.config;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const config = this.getConfig();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LemonSqueezy API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  // ============================================================================
  // Checkout Operations
  // ============================================================================

  async createCheckout(options: CheckoutOptions): Promise<CheckoutResponse> {
    const config = this.getConfig();
    const variantId = options.plan === 'pro' ? config.proVariantId : config.teamVariantId;

    const response = await this.request<{ data: { id: string; attributes: { url: string } } }>(
      '/checkouts',
      {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'checkouts',
            attributes: {
              checkout_data: {
                email: options.email,
                name: options.name,
                custom: {
                  user_id: options.userId,
                },
              },
              checkout_options: {
                dark: true,
                success_url: options.successUrl,
                cancel_url: options.cancelUrl,
              },
              product_options: {
                redirect_url: options.successUrl,
              },
            },
            relationships: {
              store: {
                data: {
                  type: 'stores',
                  id: config.storeId,
                },
              },
              variant: {
                data: {
                  type: 'variants',
                  id: variantId,
                },
              },
            },
          },
        }),
      }
    );

    return {
      url: response.data.attributes.url,
      checkoutId: response.data.id,
    };
  }

  // Get checkout URL directly (simpler approach using hosted checkout)
  getCheckoutUrl(options: CheckoutOptions): string {
    const config = this.getConfig();
    const variantId = options.plan === 'pro' ? config.proVariantId : config.teamVariantId;

    // Build LemonSqueezy hosted checkout URL
    const params = new URLSearchParams({
      'checkout[email]': options.email,
      'checkout[custom][user_id]': options.userId,
    });

    if (options.name) {
      params.append('checkout[name]', options.name);
    }

    return `https://${config.storeId}.lemonsqueezy.com/checkout/buy/${variantId}?${params.toString()}`;
  }

  // ============================================================================
  // Subscription Operations
  // ============================================================================

  async getSubscription(subscriptionId: string): Promise<LemonSubscription | null> {
    try {
      const response = await this.request<{ data: { id: string; attributes: Omit<LemonSubscription, 'id'> } }>(
        `/subscriptions/${subscriptionId}`
      );
      return {
        id: response.data.id,
        ...response.data.attributes,
      };
    } catch {
      return null;
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    try {
      await this.request(`/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
      });
      return true;
    } catch {
      return false;
    }
  }

  async resumeSubscription(subscriptionId: string): Promise<boolean> {
    try {
      await this.request(`/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: {
            type: 'subscriptions',
            id: subscriptionId,
            attributes: {
              cancelled: false,
            },
          },
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async updateSubscription(subscriptionId: string, variantId: string): Promise<boolean> {
    try {
      await this.request(`/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: {
            type: 'subscriptions',
            id: subscriptionId,
            attributes: {
              variant_id: parseInt(variantId),
            },
          },
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Customer Operations
  // ============================================================================

  async getCustomer(customerId: string): Promise<Customer | null> {
    try {
      const response = await this.request<{ data: { id: string; attributes: Omit<Customer, 'id'> } }>(
        `/customers/${customerId}`
      );
      return {
        id: response.data.id,
        ...response.data.attributes,
      };
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Customer Portal
  // ============================================================================

  async getCustomerPortalUrl(customerId: string): Promise<string | null> {
    try {
      const response = await this.request<{ data: { attributes: { urls: { customer_portal: string } } } }>(
        `/customers/${customerId}`
      );
      return response.data.attributes.urls.customer_portal;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Webhook Verification
  // ============================================================================

  async verifyWebhookSignature(
    payload: string,
    signature: string
  ): Promise<boolean> {
    const config = this.getConfig();
    if (!config.webhookSecret) {
      console.warn('Webhook secret not configured');
      return false;
    }

    try {
      // Create HMAC signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(config.webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(payload)
      );

      const computedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      return computedSignature === signature;
    } catch {
      return false;
    }
  }

  // Parse webhook event
  parseWebhookEvent(payload: string): WebhookEvent {
    return JSON.parse(payload) as WebhookEvent;
  }

  // ============================================================================
  // Plan Helpers
  // ============================================================================

  getPlanFromVariantId(variantId: string): 'free' | 'pro' | 'team' {
    const config = this.getConfig();
    if (variantId === config.proVariantId) return 'pro';
    if (variantId === config.teamVariantId) return 'team';
    return 'free';
  }

  // ============================================================================
  // Pricing Display
  // ============================================================================

  getPlans() {
    return [
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
  }

  isInitialized(): boolean {
    return this.config !== null;
  }
}

export const lemonSqueezyService = new LemonSqueezyService();
export default lemonSqueezyService;
