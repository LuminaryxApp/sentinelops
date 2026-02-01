#!/bin/bash

# SentinelOps Universal Linux Build Script
# Supports: Debian/Ubuntu/Kali, Fedora/RHEL, Arch/Manjaro, openSUSE

set -e

echo "============================================"
echo "  SentinelOps Universal Linux Build Script "
echo "============================================"

if [[ "$(uname)" != "Linux" ]]; then
    echo "Error: This script must be run on Linux"
    exit 1
fi

detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO_ID="$ID"
        DISTRO_LIKE="$ID_LIKE"
    elif [ -f /etc/lsb-release ]; then
        . /etc/lsb-release
        DISTRO_ID="$DISTRIB_ID"
    else
        DISTRO_ID="unknown"
    fi
    DISTRO_ID=$(echo "$DISTRO_ID" | tr '[:upper:]' '[:lower:]')
    echo "$DISTRO_ID"
}

install_debian_deps() {
    echo "Detected Debian-based distro, using apt..."
    sudo apt update
    sudo apt install -y \
        libwebkit2gtk-4.1-dev \
        build-essential \
        curl \
        wget \
        file \
        libxdo-dev \
        libssl-dev \
        libayatana-appindicator3-dev \
        librsvg2-dev \
        libgtk-3-dev \
        libsoup-3.0-dev \
        libjavascriptcoregtk-4.1-dev
}

install_fedora_deps() {
    echo "Detected Fedora/RHEL-based distro, using dnf..."
    sudo dnf install -y \
        webkit2gtk4.1-devel \
        openssl-devel \
        curl \
        wget \
        file \
        libxdo-devel \
        libappindicator-gtk3-devel \
        librsvg2-devel \
        gtk3-devel \
        libsoup3-devel \
        javascriptcoregtk4.1-devel \
        gcc \
        gcc-c++ \
        make
}

install_arch_deps() {
    echo "Detected Arch-based distro, using pacman..."
    sudo pacman -Syu --noconfirm
    sudo pacman -S --needed --noconfirm \
        webkit2gtk-4.1 \
        base-devel \
        curl \
        wget \
        file \
        openssl \
        xdotool \
        libappindicator-gtk3 \
        librsvg \
        gtk3 \
        libsoup3
}

install_opensuse_deps() {
    echo "Detected openSUSE, using zypper..."
    sudo zypper install -y \
        webkit2gtk3-soup2-devel \
        libopenssl-devel \
        curl \
        wget \
        file \
        xdotool \
        libappindicator3-devel \
        librsvg-devel \
        gtk3-devel \
        libsoup-devel \
        gcc \
        gcc-c++ \
        make
}

DISTRO=$(detect_distro)
echo ""
echo "Detected distribution: $DISTRO"

echo ""
echo "[1/5] Installing system dependencies..."

case "$DISTRO" in
    debian|ubuntu|kali|linuxmint|pop|elementary|zorin)
        install_debian_deps
        ;;
    fedora|rhel|centos|rocky|alma)
        install_fedora_deps
        ;;
    arch|manjaro|endeavouros|garuda)
        install_arch_deps
        ;;
    opensuse*|suse)
        install_opensuse_deps
        ;;
    *)
        if [[ "$DISTRO_LIKE" == *"debian"* ]] || [[ "$DISTRO_LIKE" == *"ubuntu"* ]]; then
            install_debian_deps
        elif [[ "$DISTRO_LIKE" == *"fedora"* ]] || [[ "$DISTRO_LIKE" == *"rhel"* ]]; then
            install_fedora_deps
        elif [[ "$DISTRO_LIKE" == *"arch"* ]]; then
            install_arch_deps
        elif [[ "$DISTRO_LIKE" == *"suse"* ]]; then
            install_opensuse_deps
        else
            echo "Error: Unsupported distribution: $DISTRO"
            echo "Supported: Debian/Ubuntu/Kali, Fedora/RHEL, Arch/Manjaro, openSUSE"
            echo ""
            echo "You can manually install Tauri dependencies for your distro:"
            echo "https://v2.tauri.app/start/prerequisites/#linux"
            exit 1
        fi
        ;;
esac

echo ""
echo "[2/5] Checking Rust installation..."
if ! command -v cargo &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    echo "Rust is already installed: $(rustc --version)"
fi

source "$HOME/.cargo/env" 2>/dev/null || true

echo ""
echo "[3/5] Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "Installing Node.js via nvm (works on all distros)..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
else
    echo "Node.js is already installed: $(node --version)"
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" 2>/dev/null || true

echo ""
echo "[4/5] Installing npm dependencies..."
npm install

echo ""
echo "[5/5] Building SentinelOps for Linux..."
npm run tauri:build

echo ""
echo "============================================"
echo "  Build Complete!                          "
echo "============================================"
echo ""
echo "Build artifacts located at:"
echo "  AppImage: src-tauri/target/release/bundle/appimage/"
echo "  Deb/RPM:  src-tauri/target/release/bundle/deb/ (or rpm/)"
echo ""
echo "To run the AppImage:"
echo "  chmod +x src-tauri/target/release/bundle/appimage/*.AppImage"
echo "  ./src-tauri/target/release/bundle/appimage/*.AppImage"
