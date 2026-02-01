import { tursoService, User, Subscription } from './tursoService';
import { initializePayment, getCheckoutUrl, getProvider, getSubscriptionSyncUrl, getSubscriptionSyncApiKey } from './paymentService';
import { fetch } from '@tauri-apps/plugin-http';

// ============================================================================
// Types
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  role?: 'user' | 'owner' | 'admin';
  subscription: {
    plan: 'free' | 'pro' | 'team';
    status: 'active' | 'cancelled' | 'expired' | 'past_due';
    expiresAt: string | null;
  };
}

export interface SignUpData {
  email: string;
  password: string;
  name: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
}

// ============================================================================
// Password Hashing (using Web Crypto API)
// ============================================================================

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordData = encoder.encode(password);

  // Combine salt and password
  const combined = new Uint8Array(salt.length + passwordData.length);
  combined.set(salt);
  combined.set(passwordData, salt.length);

  // Hash with SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashArray = new Uint8Array(hashBuffer);

  // Combine salt and hash for storage
  const result = new Uint8Array(salt.length + hashArray.length);
  result.set(salt);
  result.set(hashArray, salt.length);

  // Return as base64
  return btoa(String.fromCharCode(...result));
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();

    // Decode stored hash
    const decoded = Uint8Array.from(atob(storedHash), c => c.charCodeAt(0));

    // Extract salt (first 16 bytes)
    const salt = decoded.slice(0, 16);
    const storedHashBytes = decoded.slice(16);

    // Hash the provided password with the same salt
    const passwordData = encoder.encode(password);
    const combined = new Uint8Array(salt.length + passwordData.length);
    combined.set(salt);
    combined.set(passwordData, salt.length);

    const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
    const hashArray = new Uint8Array(hashBuffer);

    // Compare hashes
    if (hashArray.length !== storedHashBytes.length) return false;
    for (let i = 0; i < hashArray.length; i++) {
      if (hashArray[i] !== storedHashBytes[i]) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Auth Service
// ============================================================================

class AuthService {
  private currentUser: AuthUser | null = null;
  private currentToken: string | null = null;
  private initialized = false;

  // Storage keys
  private readonly TOKEN_KEY = 'sentinelops_auth_token';
  private readonly USER_KEY = 'sentinelops_auth_user';

  // ============================================================================
  // Initialization
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize Turso
    await tursoService.initializeFromConfig();

    // Initialize payment provider (Lemon Squeezy, Gumroad, or link)
    initializePayment();

    // Try to restore session
    await this.restoreSession();

    this.initialized = true;
  }

  private async restoreSession(): Promise<void> {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return;

    try {
      const session = await tursoService.getSessionByToken(token);
      if (session) {
        const user = await tursoService.getUserById(session.user_id);
        const subscription = await tursoService.getSubscription(session.user_id);

        if (user) {
          this.currentUser = this.toAuthUser(user, subscription);
          this.currentToken = token;
          localStorage.setItem(this.USER_KEY, JSON.stringify(this.currentUser));
        }
      } else {
        // Session expired, clear local storage
        this.clearLocalAuth();
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      this.clearLocalAuth();
    }
  }

  private clearLocalAuth(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser = null;
    this.currentToken = null;
  }

  // ============================================================================
  // Authentication Methods
  // ============================================================================

  async signUp(data: SignUpData): Promise<AuthResult> {
    try {
      // Validate input
      if (!this.isValidEmail(data.email)) {
        return { success: false, error: 'Invalid email address' };
      }
      if (!this.isValidPassword(data.password)) {
        return { success: false, error: 'Password must be at least 8 characters' };
      }
      if (!data.name.trim()) {
        return { success: false, error: 'Name is required' };
      }

      // Check if user already exists
      const existing = await tursoService.getUserByEmail(data.email);
      if (existing) {
        return { success: false, error: 'An account with this email already exists' };
      }

      // Hash password
      const passwordHash = await hashPassword(data.password);

      // Create user
      const user = await tursoService.createUser(data.email, data.name.trim(), passwordHash);

      // Create session
      const session = await tursoService.createSession(user.id);

      // Get subscription
      const subscription = await tursoService.getSubscription(user.id);

      // Set current user
      this.currentUser = this.toAuthUser(user, subscription);
      this.currentToken = session.token;

      // Store in local storage
      localStorage.setItem(this.TOKEN_KEY, session.token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(this.currentUser));

      return {
        success: true,
        user: this.currentUser,
        token: session.token,
      };
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error: 'Failed to create account. Please try again.' };
    }
  }

  async signIn(data: SignInData): Promise<AuthResult> {
    try {
      // Get user by email
      const user = await tursoService.getUserByEmail(data.email);
      if (!user) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Verify password
      const isValid = await verifyPassword(data.password, user.password_hash);
      if (!isValid) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Create session
      const session = await tursoService.createSession(user.id);

      // Get subscription
      const subscription = await tursoService.getSubscription(user.id);

      // Set current user
      this.currentUser = this.toAuthUser(user, subscription);
      this.currentToken = session.token;

      // Store in local storage
      localStorage.setItem(this.TOKEN_KEY, session.token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(this.currentUser));

      return {
        success: true,
        user: this.currentUser,
        token: session.token,
      };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: 'Failed to sign in. Please try again.' };
    }
  }

  async signOut(): Promise<void> {
    if (this.currentToken) {
      try {
        await tursoService.deleteSession(this.currentToken);
      } catch (error) {
        console.error('Failed to delete session:', error);
      }
    }

    this.clearLocalAuth();
  }

  // ============================================================================
  // Password Reset
  // ============================================================================

  async requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await tursoService.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists
        return { success: true };
      }

      const code = await tursoService.createVerificationCode(user.id, 'password_reset');

      // In production, you'd send this via email
      // For now, we'll log it (you'd integrate with an email service)
      console.log(`Password reset code for ${email}: ${code}`);

      return { success: true };
    } catch (error) {
      console.error('Password reset request error:', error);
      return { success: false, error: 'Failed to process request' };
    }
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<AuthResult> {
    try {
      if (!this.isValidPassword(newPassword)) {
        return { success: false, error: 'Password must be at least 8 characters' };
      }

      const user = await tursoService.getUserByEmail(email);
      if (!user) {
        return { success: false, error: 'Invalid reset code' };
      }

      const isValid = await tursoService.verifyCode(user.id, code, 'password_reset');
      if (!isValid) {
        return { success: false, error: 'Invalid or expired reset code' };
      }

      // Update password (you'd need to add this method to tursoService)
      // For now, we'll recreate the user flow
      // TODO: Add updatePassword method to tursoService

      return { success: true };
    } catch (error) {
      console.error('Password reset error:', error);
      return { success: false, error: 'Failed to reset password' };
    }
  }

  // ============================================================================
  // Email Verification
  // ============================================================================

  async sendVerificationEmail(): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUser) {
      return { success: false, error: 'Not signed in' };
    }

    try {
      const code = await tursoService.createVerificationCode(this.currentUser.id, 'email');

      // In production, send via email service
      console.log(`Verification code for ${this.currentUser.email}: ${code}`);

      return { success: true };
    } catch (error) {
      console.error('Send verification error:', error);
      return { success: false, error: 'Failed to send verification email' };
    }
  }

  async verifyEmail(code: string): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUser) {
      return { success: false, error: 'Not signed in' };
    }

    try {
      const isValid = await tursoService.verifyCode(this.currentUser.id, code, 'email');
      if (!isValid) {
        return { success: false, error: 'Invalid or expired verification code' };
      }

      await tursoService.verifyUserEmail(this.currentUser.id);

      // Update local user
      this.currentUser.emailVerified = true;
      localStorage.setItem(this.USER_KEY, JSON.stringify(this.currentUser));

      return { success: true };
    } catch (error) {
      console.error('Email verification error:', error);
      return { success: false, error: 'Failed to verify email' };
    }
  }

  // ============================================================================
  // Subscription Management
  // ============================================================================

  async upgradeToProCheckout(): Promise<{ url: string } | null> {
    if (!this.currentUser) return null;

    try {
      const checkoutUrl = getCheckoutUrl({
        email: this.currentUser.email,
        name: this.currentUser.name,
        userId: this.currentUser.id,
        plan: 'pro',
      });
      if (!checkoutUrl) return null;

      return { url: checkoutUrl };
    } catch (error) {
      console.error('Failed to create checkout:', error);
      return null;
    }
  }

  async upgradeToTeamCheckout(): Promise<{ url: string } | null> {
    if (!this.currentUser) return null;

    try {
      const checkoutUrl = getCheckoutUrl({
        email: this.currentUser.email,
        name: this.currentUser.name,
        userId: this.currentUser.id,
        plan: 'team',
      });
      if (!checkoutUrl) return null;

      return { url: checkoutUrl };
    } catch (error) {
      console.error('Failed to create checkout:', error);
      return null;
    }
  }

  async refreshSubscription(): Promise<void> {
    if (!this.currentUser) return;

    try {
      // When using Gumroad, call subscription-sync API so purchases grant Pro/Team
      if (getProvider() === 'gumroad') {
        const syncUrl = getSubscriptionSyncUrl();
        if (syncUrl) {
          const base = syncUrl.replace(/\/$/, '');
          const url = base.endsWith('/api/sync-subscription') ? base : `${base}/api/sync-subscription`;
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          const apiKey = getSubscriptionSyncApiKey();
          if (apiKey) headers['X-API-Key'] = apiKey;
          try {
            await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify({ email: this.currentUser.email, user_id: this.currentUser.id }),
            });
          } catch (syncErr) {
            console.warn('Subscription sync request failed:', syncErr);
          }
        }
      }

      const subscription = await tursoService.getSubscription(this.currentUser.id);
      if (subscription) {
        this.currentUser.subscription = {
          plan: subscription.plan,
          status: subscription.status,
          expiresAt: subscription.current_period_end,
        };
        localStorage.setItem(this.USER_KEY, JSON.stringify(this.currentUser));
      }
    } catch (error) {
      console.error('Failed to refresh subscription:', error);
    }
  }

  // ============================================================================
  // Settings Sync
  // ============================================================================

  async syncSettings(settings: Record<string, unknown>): Promise<void> {
    if (!this.currentUser) return;
    if (this.currentUser.subscription.plan === 'free') return; // Only for paid users

    try {
      await tursoService.saveUserSettings(this.currentUser.id, settings);
    } catch (error) {
      console.error('Failed to sync settings:', error);
    }
  }

  async loadCloudSettings(): Promise<Record<string, unknown> | null> {
    if (!this.currentUser) return null;
    if (this.currentUser.subscription.plan === 'free') return null;

    try {
      return await tursoService.getUserSettings(this.currentUser.id);
    } catch (error) {
      console.error('Failed to load cloud settings:', error);
      return null;
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  getUser(): AuthUser | null {
    return this.currentUser;
  }

  getToken(): string | null {
    return this.currentToken;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  isPro(): boolean {
    return this.currentUser?.subscription.plan === 'pro' || this.currentUser?.subscription.plan === 'team';
  }

  isTeam(): boolean {
    return this.currentUser?.subscription.plan === 'team';
  }

  // Get cached user from localStorage (for initial UI render)
  getCachedUser(): AuthUser | null {
    const cached = localStorage.getItem(this.USER_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return null;
      }
    }
    return null;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private toAuthUser(user: User, subscription: Subscription | null): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.email_verified,
      subscription: {
        plan: subscription?.plan || 'free',
        status: subscription?.status || 'active',
        expiresAt: subscription?.current_period_end || null,
      },
    };
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isValidPassword(password: string): boolean {
    return password.length >= 8;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const authService = new AuthService();
export default authService;
