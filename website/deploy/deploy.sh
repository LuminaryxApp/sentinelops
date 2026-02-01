#!/bin/bash
# SentinelOps VPS Deployment Script
# Target: Ubuntu 24.04 on 40.160.241.52

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}SentinelOps VPS Deployment${NC}"
echo -e "${GREEN}========================================${NC}"

# Configuration
DEPLOY_DIR="/var/www/sentinelops"
REPO_URL="https://github.com/your-username/SentinelOps.git"  # Update this
BRANCH="master"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run with sudo${NC}"
    exit 1
fi

# Update system
echo -e "${YELLOW}Updating system packages...${NC}"
apt update && apt upgrade -y

# Install Node.js 20.x
echo -e "${YELLOW}Installing Node.js 20.x...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# Install Nginx
echo -e "${YELLOW}Installing Nginx...${NC}"
apt install -y nginx

# Install Git
apt install -y git

# Create deploy directory
echo -e "${YELLOW}Setting up deployment directory...${NC}"
mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

# Clone or pull repository
if [ -d "$DEPLOY_DIR/.git" ]; then
    echo -e "${YELLOW}Pulling latest changes...${NC}"
    git fetch origin
    git reset --hard origin/$BRANCH
else
    echo -e "${YELLOW}Cloning repository...${NC}"
    git clone -b $BRANCH $REPO_URL .
fi

# Build website
echo -e "${YELLOW}Building website...${NC}"
cd $DEPLOY_DIR/website
npm ci
npm run build

# Build API server
echo -e "${YELLOW}Building API server...${NC}"
cd $DEPLOY_DIR/website/server
npm ci
npm run build

# Check for .env file
if [ ! -f "$DEPLOY_DIR/website/server/.env" ]; then
    echo -e "${RED}WARNING: .env file not found!${NC}"
    echo -e "${YELLOW}Please create $DEPLOY_DIR/website/server/.env with your configuration${NC}"
    echo -e "${YELLOW}See deploy/.env.template for required variables${NC}"
fi

# Set permissions
echo -e "${YELLOW}Setting permissions...${NC}"
chown -R www-data:www-data $DEPLOY_DIR
chmod -R 755 $DEPLOY_DIR

# Copy Nginx config
echo -e "${YELLOW}Configuring Nginx...${NC}"
cp $DEPLOY_DIR/website/deploy/nginx.conf /etc/nginx/sites-available/sentinelops
ln -sf /etc/nginx/sites-available/sentinelops /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx config
nginx -t

# Copy systemd service
echo -e "${YELLOW}Configuring systemd service...${NC}"
cp $DEPLOY_DIR/website/deploy/sentinelops-api.service /etc/systemd/system/
systemctl daemon-reload

# Start/restart services
echo -e "${YELLOW}Starting services...${NC}"
systemctl enable sentinelops-api
systemctl restart sentinelops-api
systemctl restart nginx

# Check status
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}Service Status:${NC}"
systemctl status sentinelops-api --no-pager -l || true
echo ""
systemctl status nginx --no-pager -l || true

echo -e "\n${YELLOW}Quick commands:${NC}"
echo "  View API logs: journalctl -u sentinelops-api -f"
echo "  Restart API:   systemctl restart sentinelops-api"
echo "  Restart Nginx: systemctl restart nginx"

echo -e "\n${GREEN}Website should be accessible at:${NC}"
echo "  http://40.160.241.52"
echo "  http://sentinelops.org (if DNS is configured)"

echo -e "\n${YELLOW}Don't forget to:${NC}"
echo "  1. Create .env file at $DEPLOY_DIR/website/server/.env"
echo "  2. Set up SSL with: certbot --nginx -d sentinelops.org -d www.sentinelops.org"
