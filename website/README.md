# SentinelOps Website

Marketing site for [sentinelops.org](https://sentinelops.org).

## Dev

```bash
npm install
npm run dev
```

Runs at http://localhost:5174

## Build

```bash
npm run build
```

Output in `dist/`. Deploy to Vercel, Netlify, or any static host.

## Deploy to Vercel

### Quick Deploy

1. **Connect your repository** to Vercel:
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect the settings

2. **Configure environment variables** (required for auth):
   - In Vercel project settings → Environment Variables
   - Add `TURSO_URL` and `TURSO_AUTH_TOKEN` (same as your main SentinelOps app)
   - Optionally set `CORS_ORIGIN` to your website domain
   - The website uses Vercel serverless functions that connect directly to Turso

3. **Deploy**:
   - Vercel will automatically build and deploy
   - The `vercel.json` file handles SPA routing automatically

### Manual Deploy

```bash
npm install -g vercel
vercel
```

### Environment Variables

**Required for authentication:**

Set these in Vercel dashboard (Settings → Environment Variables):

```env
TURSO_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
```

**Optional:**

```env
CORS_ORIGIN=https://sentinelops.org  # Your website domain (defaults to *)
VITE_AUTH_API_URL=...                # Only if using external auth API instead of local routes
```

**Getting Turso credentials:**
1. Go to [Turso Dashboard](https://turso.tech)
2. Create or select your database
3. Copy the database URL and auth token
4. These should be the **same credentials** used in your main SentinelOps app

The website uses **Vercel serverless functions** (`/api/auth/*`) that connect directly to Turso, sharing the same database as the main app. This means user accounts are shared between the website and the desktop app.

### Database Integration

The website includes:
- **API routes** (`/api/auth/*`) - Vercel serverless functions
- **Turso integration** - Direct connection to your Turso database
- **Shared accounts** - Same users table as the main SentinelOps app
- **Automatic table creation** - Tables are created on first use

The `vercel.json` configuration:
- Handles React Router client-side routing (all routes serve `index.html`)
- Sets up proper caching headers for static assets
- Configures build and output directories
- Routes API requests to serverless functions

### Custom Domain

1. Go to your project settings in Vercel
2. Navigate to "Domains"
3. Add your custom domain (e.g., `sentinelops.org`)
4. Follow DNS configuration instructions
