# SentinelOps VPS Deployment Guide

Deploy SentinelOps website and API to your Ubuntu 24.04 VPS.

## Server Requirements

- Ubuntu 24.04 LTS
- 1GB+ RAM
- 20GB+ storage
- Public IP (e.g., 40.160.241.52)

## Quick Deployment

### 1. Initial Server Setup

SSH into your VPS and run:

```bash
# Download and run setup script
curl -sSL https://raw.githubusercontent.com/your-repo/SentinelOps/master/website/deploy/setup-vps.sh | sudo bash
```

Or manually:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git nodejs npm nginx certbot python3-certbot-nginx
```

### 2. Clone Repository

```bash
cd /var/www
sudo git clone https://github.com/your-username/SentinelOps.git sentinelops
cd sentinelops
```

### 3. Configure Environment

```bash
# Copy template and edit
sudo cp website/deploy/.env.template website/server/.env
sudo nano website/server/.env
```

Required environment variables:
- `TURSO_URL` - Your Turso database URL
- `TURSO_AUTH_TOKEN` - Turso auth token
- `OPENROUTER_API_KEY` - OpenRouter API key for AI chat
- `JWT_SECRET` - Random secret for JWT tokens

### 4. Deploy

```bash
sudo chmod +x website/deploy/deploy.sh
sudo website/deploy/deploy.sh
```

### 5. Set Up SSL (Optional but Recommended)

```bash
sudo certbot --nginx -d sentinelops.org -d www.sentinelops.org
```

## Manual Deployment Steps

### Build Website

```bash
cd /var/www/sentinelops/website
npm ci
npm run build
```

### Build API Server

```bash
cd /var/www/sentinelops/website/server
npm ci
npm run build
```

### Configure Nginx

```bash
sudo cp /var/www/sentinelops/website/deploy/nginx.conf /etc/nginx/sites-available/sentinelops
sudo ln -sf /etc/nginx/sites-available/sentinelops /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### Configure Systemd Service

```bash
sudo cp /var/www/sentinelops/website/deploy/sentinelops-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sentinelops-api
sudo systemctl start sentinelops-api
```

## Useful Commands

```bash
# View API logs
sudo journalctl -u sentinelops-api -f

# Restart API server
sudo systemctl restart sentinelops-api

# Restart Nginx
sudo systemctl restart nginx

# Check service status
sudo systemctl status sentinelops-api
sudo systemctl status nginx

# Check Nginx error logs
sudo tail -f /var/log/nginx/sentinelops.error.log
```

## Updating

```bash
cd /var/www/sentinelops
sudo git pull origin master
sudo website/deploy/deploy.sh
```

## Troubleshooting

### API not responding

1. Check if service is running: `sudo systemctl status sentinelops-api`
2. Check logs: `sudo journalctl -u sentinelops-api -n 100`
3. Verify .env file exists and has correct values

### 502 Bad Gateway

1. API service not running - restart it
2. Wrong port in Nginx config - should be 3001

### CORS errors

Check that your domain is in the CORS whitelist in `server/src/index.ts`

## Architecture

```
                    ┌─────────────────┐
                    │     Nginx       │
                    │   (port 80/443) │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
      ┌───────────┐  ┌───────────┐  ┌───────────┐
      │  Static   │  │    API    │  │    SSE    │
      │  Files    │  │  Routes   │  │  Stream   │
      │  (dist/)  │  │  (/api/*) │  │  (/chat)  │
      └───────────┘  └─────┬─────┘  └─────┬─────┘
                           │              │
                           ▼              ▼
                    ┌─────────────────────────┐
                    │   Express API Server    │
                    │      (port 3001)        │
                    └───────────┬─────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
             ┌───────────┐          ┌───────────┐
             │   Turso   │          │ OpenRouter│
             │  Database │          │    API    │
             └───────────┘          └───────────┘
```
