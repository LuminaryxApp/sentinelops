import { fetch } from '@tauri-apps/plugin-http';

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'free' | 'pro' | 'team';
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  lemon_customer_id: string | null;
  lemon_subscription_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  settings_json: string;
  synced_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface UsageLog {
  id: string;
  user_id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
  created_at: string;
}

export interface UserWithStats {
  id: string;
  email: string;
  name: string;
  email_verified: boolean;
  created_at: string;
  plan: string;
  status: string;
  total_messages: number;
  total_tokens: number;
  total_cost: number;
  last_active: string | null;
}

interface TursoResult {
  columns: string[];
  rows: Array<unknown[]>;
  affected_row_count: number;
  last_insert_rowid: string | null;
}

// ============================================================================
// Turso HTTP Client
// ============================================================================

class TursoService {
  private url: string = '';
  private authToken: string = '';
  private initialized = false;

  // Initialize with your Turso credentials
  async initialize(url: string, authToken: string): Promise<void> {
    if (this.initialized) return;

    this.url = url.replace('libsql://', 'https://');
    this.authToken = authToken;

    await this.createTables();
    this.initialized = true;
  }

  // Initialize from environment/config
  async initializeFromConfig(): Promise<void> {
    const url = localStorage.getItem('turso_url') || import.meta.env.VITE_TURSO_URL;
    const token = localStorage.getItem('turso_token') || import.meta.env.VITE_TURSO_AUTH_TOKEN;

    if (!url || !token) {
      console.warn('Turso credentials not configured');
      return;
    }

    await this.initialize(url, token);
  }

  private async execute(sql: string, args: (string | number | boolean | null)[] = []): Promise<TursoResult> {
    if (!this.url || !this.authToken) {
      throw new Error('Turso not initialized');
    }

    // Convert args to Turso format
    const tursoArgs = args.map(arg => {
      if (arg === null) return { type: 'null', value: null };
      if (typeof arg === 'number') return { type: 'integer', value: String(arg) };
      if (typeof arg === 'boolean') return { type: 'integer', value: arg ? '1' : '0' };
      return { type: 'text', value: String(arg) };
    });

    const response = await fetch(`${this.url}/v2/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            type: 'execute',
            stmt: {
              sql,
              args: tursoArgs,
            },
          },
          { type: 'close' },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Turso error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    // Debug: log response structure
    console.log('Turso response:', JSON.stringify(data, null, 2));

    // Check for errors in response
    const firstResult = data.results?.[0];
    if (firstResult?.type === 'error' && firstResult.error) {
      throw new Error(`Turso SQL error: ${firstResult.error.message}`);
    }

    // Handle different response formats
    // Format 1: { results: [{ response: { result: { cols, rows } } }] }
    // Format 2: { results: [{ results: { cols, rows } }] }
    const result = firstResult?.response?.result || firstResult?.results || firstResult?.result;

    if (result) {
      // Extract column names from cols array (format: [{ name: "col1", decltype: "TEXT" }, ...])
      let columns: string[] = [];
      const cols = result.columns || result.cols || [];
      if (cols.length > 0) {
        if (typeof cols[0] === 'string') {
          columns = cols;
        } else if (cols[0]?.name) {
          columns = cols.map((c: { name: string }) => c.name);
        }
      }

      return {
        columns,
        rows: result.rows || [],
        affected_row_count: result.affected_row_count || result.rowsAffected || 0,
        last_insert_rowid: result.last_insert_rowid || null,
      };
    }

    // Return empty result for statements that don't return data
    return {
      columns: [],
      rows: [],
      affected_row_count: 0,
      last_insert_rowid: null,
    };
  }

  private rowToObject<T>(columns: string[], row: unknown[]): T {
    const obj: Record<string, unknown> = {};
    if (!columns || !Array.isArray(columns)) {
      console.error('rowToObject: columns is not an array', columns);
      return obj as T;
    }
    columns.forEach((col, i) => {
      const cell = row[i];
      // Handle different value formats from Turso
      if (cell && typeof cell === 'object' && 'value' in cell) {
        obj[col] = (cell as { value: unknown }).value ?? null;
      } else {
        obj[col] = cell ?? null;
      }
    });
    return obj as T;
  }

  // ============================================================================
  // Schema Setup
  // ============================================================================

  private async createTables(): Promise<void> {
    // Users table
    await this.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        email_verified INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Subscriptions table
    await this.execute(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        plan TEXT DEFAULT 'free',
        status TEXT DEFAULT 'active',
        lemon_customer_id TEXT,
        lemon_subscription_id TEXT,
        current_period_end TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // User settings (for cloud sync)
    await this.execute(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        settings_json TEXT NOT NULL,
        synced_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Sessions table
    await this.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Verification codes
    await this.execute(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        code TEXT NOT NULL,
        type TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Usage logs for tracking AI costs per user
    await this.execute(`
      CREATE TABLE IF NOT EXISTS usage_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        cost REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create indexes (ignore if exists)
    try {
      await this.execute(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
      await this.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);
      await this.execute(`CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id)`);
      await this.execute(`CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON usage_logs(user_id)`);
      await this.execute(`CREATE INDEX IF NOT EXISTS idx_usage_logs_created ON usage_logs(created_at)`);
    } catch {
      // Indexes might already exist
    }
  }

  // ============================================================================
  // User Operations
  // ============================================================================

  async createUser(email: string, name: string, passwordHash: string): Promise<User> {
    const id = crypto.randomUUID();

    await this.execute(
      `INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)`,
      [id, email.toLowerCase(), name, passwordHash]
    );

    // Create default free subscription
    await this.createSubscription(id, 'free');

    const user = await this.getUserById(id);
    if (!user) throw new Error('Failed to create user');
    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.execute(
      `SELECT * FROM users WHERE email = ?`,
      [email.toLowerCase()]
    );

    if (!result.rows?.length) return null;
    return this.rowToObject<User>(result.columns, result.rows[0]);
  }

  async getUserById(id: string): Promise<User | null> {
    const result = await this.execute(
      `SELECT * FROM users WHERE id = ?`,
      [id]
    );

    if (!result.rows?.length) return null;
    const rawUser = this.rowToObject<Omit<User, 'email_verified'> & { email_verified: number }>(
      result.columns,
      result.rows[0]
    );
    return {
      ...rawUser,
      email_verified: Boolean(rawUser.email_verified),
    };
  }

  async updateUser(id: string, updates: Partial<Pick<User, 'name' | 'email_verified'>>): Promise<void> {
    const sets: string[] = [];
    const args: (string | number)[] = [];

    if (updates.name !== undefined) {
      sets.push('name = ?');
      args.push(updates.name);
    }
    if (updates.email_verified !== undefined) {
      sets.push('email_verified = ?');
      args.push(updates.email_verified ? 1 : 0);
    }

    if (sets.length === 0) return;

    sets.push("updated_at = datetime('now')");
    args.push(id);

    await this.execute(
      `UPDATE users SET ${sets.join(', ')} WHERE id = ?`,
      args
    );
  }

  async verifyUserEmail(userId: string): Promise<void> {
    await this.updateUser(userId, { email_verified: true });
  }

  // ============================================================================
  // Session Operations
  // ============================================================================

  async createSession(userId: string, expiresInDays = 30): Promise<Session> {
    const id = crypto.randomUUID();
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    await this.execute(
      `INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
      [id, userId, token, expiresAt]
    );

    return { id, user_id: userId, token, expires_at: expiresAt, created_at: new Date().toISOString() };
  }

  async getSessionByToken(token: string): Promise<Session | null> {
    const result = await this.execute(
      `SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')`,
      [token]
    );

    if (!result.rows?.length) return null;
    return this.rowToObject<Session>(result.columns, result.rows[0]);
  }

  async deleteSession(token: string): Promise<void> {
    await this.execute(`DELETE FROM sessions WHERE token = ?`, [token]);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.execute(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
  }

  // ============================================================================
  // Subscription Operations
  // ============================================================================

  async createSubscription(userId: string, plan: Subscription['plan'] = 'free'): Promise<Subscription> {
    const id = crypto.randomUUID();

    await this.execute(
      `INSERT INTO subscriptions (id, user_id, plan, status) VALUES (?, ?, ?, 'active')`,
      [id, userId, plan]
    );

    const sub = await this.getSubscription(userId);
    if (!sub) throw new Error('Failed to create subscription');
    return sub;
  }

  async getSubscription(userId: string): Promise<Subscription | null> {
    const result = await this.execute(
      `SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (!result.rows?.length) return null;
    return this.rowToObject<Subscription>(result.columns, result.rows[0]);
  }

  async updateSubscription(
    userId: string,
    updates: Partial<Pick<Subscription, 'plan' | 'status' | 'lemon_customer_id' | 'lemon_subscription_id' | 'current_period_end'>>
  ): Promise<void> {
    const sets: string[] = [];
    const args: (string | null)[] = [];

    if (updates.plan !== undefined) {
      sets.push('plan = ?');
      args.push(updates.plan);
    }
    if (updates.status !== undefined) {
      sets.push('status = ?');
      args.push(updates.status);
    }
    if (updates.lemon_customer_id !== undefined) {
      sets.push('lemon_customer_id = ?');
      args.push(updates.lemon_customer_id);
    }
    if (updates.lemon_subscription_id !== undefined) {
      sets.push('lemon_subscription_id = ?');
      args.push(updates.lemon_subscription_id);
    }
    if (updates.current_period_end !== undefined) {
      sets.push('current_period_end = ?');
      args.push(updates.current_period_end);
    }

    if (sets.length === 0) return;

    sets.push("updated_at = datetime('now')");
    args.push(userId);

    await this.execute(
      `UPDATE subscriptions SET ${sets.join(', ')} WHERE user_id = ?`,
      args
    );
  }

  // ============================================================================
  // Settings Sync Operations
  // ============================================================================

  async saveUserSettings(userId: string, settings: Record<string, unknown>): Promise<void> {
    const id = crypto.randomUUID();
    const settingsJson = JSON.stringify(settings);

    // Try update first, then insert
    const updateResult = await this.execute(
      `UPDATE user_settings SET settings_json = ?, synced_at = datetime('now') WHERE user_id = ?`,
      [settingsJson, userId]
    );

    if (!updateResult.affected_row_count) {
      await this.execute(
        `INSERT INTO user_settings (id, user_id, settings_json) VALUES (?, ?, ?)`,
        [id, userId, settingsJson]
      );
    }
  }

  async getUserSettings(userId: string): Promise<Record<string, unknown> | null> {
    const result = await this.execute(
      `SELECT settings_json FROM user_settings WHERE user_id = ?`,
      [userId]
    );

    if (!result.rows?.length) return null;
    const cell = result.rows[0][0];
    const value = cell && typeof cell === 'object' && 'value' in cell ? (cell as { value: unknown }).value : cell;
    return JSON.parse(value as string);
  }

  // ============================================================================
  // Verification Code Operations
  // ============================================================================

  async createVerificationCode(userId: string, type: 'email' | 'password_reset'): Promise<string> {
    const id = crypto.randomUUID();
    const code = this.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await this.execute(
      `INSERT INTO verification_codes (id, user_id, code, type, expires_at) VALUES (?, ?, ?, ?, ?)`,
      [id, userId, code, type, expiresAt]
    );

    return code;
  }

  async verifyCode(userId: string, code: string, type: 'email' | 'password_reset'): Promise<boolean> {
    const result = await this.execute(
      `SELECT * FROM verification_codes WHERE user_id = ? AND code = ? AND type = ? AND used = 0 AND expires_at > datetime('now')`,
      [userId, code, type]
    );

    if (!result.rows?.length) return false;

    // Mark as used
    await this.execute(
      `UPDATE verification_codes SET used = 1 WHERE user_id = ? AND code = ?`,
      [userId, code]
    );

    return true;
  }

  // ============================================================================
  // Usage Logging Operations
  // ============================================================================

  async logUsage(
    userId: string,
    model: string,
    promptTokens: number,
    completionTokens: number,
    cost: number
  ): Promise<void> {
    const id = crypto.randomUUID();
    const totalTokens = promptTokens + completionTokens;

    await this.execute(
      `INSERT INTO usage_logs (id, user_id, model, prompt_tokens, completion_tokens, total_tokens, cost) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, model, promptTokens, completionTokens, totalTokens, cost]
    );
  }

  async getUserUsageStats(userId: string): Promise<{ total_messages: number; total_tokens: number; total_cost: number }> {
    const result = await this.execute(
      `SELECT COUNT(*) as total_messages, COALESCE(SUM(total_tokens), 0) as total_tokens, COALESCE(SUM(cost), 0) as total_cost FROM usage_logs WHERE user_id = ?`,
      [userId]
    );

    if (!result.rows?.length) {
      return { total_messages: 0, total_tokens: 0, total_cost: 0 };
    }

    const row = result.rows[0];
    return {
      total_messages: Number(this.extractValue(row[0])) || 0,
      total_tokens: Number(this.extractValue(row[1])) || 0,
      total_cost: Number(this.extractValue(row[2])) || 0,
    };
  }

  // ============================================================================
  // Admin Operations (Owner Only)
  // ============================================================================

  async getAllUsersWithStats(): Promise<UserWithStats[]> {
    const result = await this.execute(`
      SELECT
        u.id,
        u.email,
        u.name,
        u.email_verified,
        u.created_at,
        s.plan,
        s.status,
        COALESCE((SELECT COUNT(*) FROM usage_logs ul WHERE ul.user_id = u.id), 0) as total_messages,
        COALESCE((SELECT SUM(total_tokens) FROM usage_logs ul WHERE ul.user_id = u.id), 0) as total_tokens,
        COALESCE((SELECT SUM(cost) FROM usage_logs ul WHERE ul.user_id = u.id), 0) as total_cost,
        (SELECT MAX(created_at) FROM usage_logs ul WHERE ul.user_id = u.id) as last_active
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id
      ORDER BY u.created_at DESC
    `);

    if (!result.rows?.length) return [];

    return result.rows.map(row => ({
      id: this.extractValue(row[0]) as string,
      email: this.extractValue(row[1]) as string,
      name: this.extractValue(row[2]) as string,
      email_verified: Boolean(this.extractValue(row[3])),
      created_at: this.extractValue(row[4]) as string,
      plan: (this.extractValue(row[5]) as string) || 'free',
      status: (this.extractValue(row[6]) as string) || 'active',
      total_messages: Number(this.extractValue(row[7])) || 0,
      total_tokens: Number(this.extractValue(row[8])) || 0,
      total_cost: Number(this.extractValue(row[9])) || 0,
      last_active: this.extractValue(row[10]) as string | null,
    }));
  }

  async getAdminStats(): Promise<{
    totalUsers: number;
    totalMessages: number;
    totalTokens: number;
    totalCost: number;
    usersByPlan: { plan: string; count: number }[];
    recentActivity: { date: string; messages: number; cost: number }[];
  }> {
    // Total users
    const usersResult = await this.execute(`SELECT COUNT(*) FROM users`);
    const totalUsers = Number(this.extractValue(usersResult.rows?.[0]?.[0])) || 0;

    // Total usage stats
    const usageResult = await this.execute(`
      SELECT COUNT(*) as messages, COALESCE(SUM(total_tokens), 0) as tokens, COALESCE(SUM(cost), 0) as cost
      FROM usage_logs
    `);
    const totalMessages = Number(this.extractValue(usageResult.rows?.[0]?.[0])) || 0;
    const totalTokens = Number(this.extractValue(usageResult.rows?.[0]?.[1])) || 0;
    const totalCost = Number(this.extractValue(usageResult.rows?.[0]?.[2])) || 0;

    // Users by plan
    const planResult = await this.execute(`
      SELECT COALESCE(plan, 'free') as plan, COUNT(*) as count
      FROM subscriptions
      GROUP BY plan
    `);
    const usersByPlan = (planResult.rows || []).map(row => ({
      plan: (this.extractValue(row[0]) as string) || 'free',
      count: Number(this.extractValue(row[1])) || 0,
    }));

    // Recent activity (last 7 days)
    const activityResult = await this.execute(`
      SELECT DATE(created_at) as date, COUNT(*) as messages, COALESCE(SUM(cost), 0) as cost
      FROM usage_logs
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    const recentActivity = (activityResult.rows || []).map(row => ({
      date: this.extractValue(row[0]) as string,
      messages: Number(this.extractValue(row[1])) || 0,
      cost: Number(this.extractValue(row[2])) || 0,
    }));

    return {
      totalUsers,
      totalMessages,
      totalTokens,
      totalCost,
      usersByPlan,
      recentActivity,
    };
  }

  private extractValue(cell: unknown): unknown {
    if (cell && typeof cell === 'object' && 'value' in cell) {
      return (cell as { value: unknown }).value;
    }
    return cell;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const tursoService = new TursoService();
export default tursoService;
