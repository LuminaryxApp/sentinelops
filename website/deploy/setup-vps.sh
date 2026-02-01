#!/bin/bash
# SentinelOps VPS Initial Setup
# Run this first on a fresh Ubuntu 24.04 server

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}SentinelOps VPS Initial Setup${NC}"
echo -e "${GREEN}========================================${NC}"

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Update system
echo -e "${YELLOW}Updating system...${NC}"
apt update && apt upgrade -y

# Install essential packages
echo -e "${YELLOW}Installing essential packages...${NC}"
apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg

# Install Node.js 20.x
echo -e "${YELLOW}Installing Node.js 20.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Nginx
echo -e "${YELLOW}Installing Nginx...${NC}"
apt install -y nginx

# Install Certbot for SSL
echo -e "${YELLOW}Installing Certbot...${NC}"
apt install -y certbot python3-certbot-nginx

# Configure firewall
echo -e "${YELLOW}Configuring firewall...${NC}"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# Create deploy directory
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p /var/www/sentinelops

# Set permissions
chown -R www-data:www-data /var/www/sentinelops

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Initial Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}Versions installed:${NC}"
echo "  Node.js: $(node -v)"
echo "  npm: $(npm -v)"
echo "  Nginx: $(nginx -v 2>&1)"

echo -e "\n${YELLOW}Next steps:${NC}"
echo "  1. Clone your repository to /var/www/sentinelops"
echo "  2. Run deploy.sh to deploy the application"
echo "  3. Set up SSL with Certbot"

echo -e "\n${GREEN}To deploy from your local machine:${NC}"
echo "  scp -r ./website/deploy root@40.160.241.52:/tmp/"
echo "  ssh root@40.160.241.52 'chmod +x /tmp/deploy/*.sh && /tmp/deploy/deploy.sh'"
