# Payments & Subscriptions

## Do I need a business to run subscriptions in the US?

**No.** You do **not** need an LLC or formal business to accept subscription payments in the United States.

- You can operate as a **sole proprietor** (your name). No business registration required.
- Payment providers (Lemon Squeezy, Gumroad, Stripe, etc.) will send you a **1099** for tax purposes. You report that income on your personal return.
- If you prefer to keep things even simpler, use a **Merchant of Record** (MoR) like Gumroad or Paddle—they act as the seller and handle more of the compliance.

## Supported providers in this app

The app supports multiple payment backends so you can choose what fits you.

| Provider        | Best for              | Business required? | Notes                                      |
|----------------|------------------------|--------------------|--------------------------------------------|
| **Lemon Squeezy** | Full API, webhooks     | No (sole prop OK)  | Store + variant IDs, API key, webhooks      |
| **Gumroad**       | Individuals, creators | No (individual OK) | Product permalinks only; no API key needed for checkout links |
| **Link-only**     | No payment setup yet   | N/A                | Upgrade buttons open a URL you configure   |

Set `VITE_PAYMENT_PROVIDER=lemonsqueezy` or `gumroad` or `link` in `.env`.

---

## Lemon Squeezy

- Create a store and products at [lemonsqueezy.com](https://lemonsqueezy.com).
- Create two subscription products (e.g. Pro and Team) and note **Store ID**, **Pro variant ID**, **Team variant ID**.
- In [Settings → API](https://app.lemonsqueezy.com/settings/api) create an API key.
- Optional: create a webhook and set `VITE_LEMON_WEBHOOK_SECRET` for subscription sync.

**.env:**

```env
VITE_PAYMENT_PROVIDER=lemonsqueezy
VITE_LEMON_API_KEY=your-api-key
VITE_LEMON_STORE_ID=your-store-id
VITE_LEMON_PRO_VARIANT_ID=pro-variant-id
VITE_LEMON_TEAM_VARIANT_ID=team-variant-id
VITE_LEMON_WEBHOOK_SECRET=your-webhook-secret
```

---

## Gumroad

- Create an account at [gumroad.com](https://gumroad.com). You can use an **Individual** account (no company needed).
- Create two **membership** products (e.g. Pro and Team) with recurring billing.
- Copy each product’s **short link** (e.g. `https://yourname.gumroad.com/l/sentinelops-pro`).

**.env:**

```env
VITE_PAYMENT_PROVIDER=gumroad
VITE_GUMROAD_PRO_URL=https://yourname.gumroad.com/l/your-pro-permalink
VITE_GUMROAD_TEAM_URL=https://yourname.gumroad.com/l/your-team-permalink
```

Checkout links will prefill the customer’s email. For webhooks (subscription started/ended), configure Gumroad’s Ping in your Gumroad dashboard and point it at your backend; the app’s Turso subscription state can be updated from those events if you add a small webhook handler.

---

## Link-only (no payment provider)

If you don’t want to configure Lemon Squeezy or Gumroad yet:

```env
VITE_PAYMENT_PROVIDER=link
VITE_UPGRADE_URL=https://your-website.com/pricing
```

“Upgrade” buttons will open that URL. You can later point it at Gumroad, a custom page, or another provider.

---

## Switching providers

1. Set `VITE_PAYMENT_PROVIDER` and the corresponding env vars for the new provider.
2. Restart the app. The UI will use the new provider for checkout links and plan display.
3. Your Turso `subscriptions` table is provider-agnostic (plan, status, etc.). If you use webhooks, update your webhook endpoint to the new provider’s format when you switch.
