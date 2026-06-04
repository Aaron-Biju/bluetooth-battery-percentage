#!/usr/bin/env bash

# Color codes for premium terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

UUID="headphone-battery-percentage@aaron.biju"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}   Headphone Battery Percentage Widget Installer    ${NC}"
echo -e "${CYAN}====================================================${NC}"

# Check GNOME version
GNOME_VER=$(gnome-shell --version)
echo -e "${BLUE}[*] Detected: $GNOME_VER${NC}"

# Create destination directory
echo -e "${BLUE}[*] Creating extension directory...${NC}"
mkdir -p "$EXTENSION_DIR"

# Copy files
echo -e "${BLUE}[*] Installing extension files...${NC}"
cp metadata.json "$EXTENSION_DIR/"
cp extension.js "$EXTENSION_DIR/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}[+] Extension files installed successfully at:${NC}"
    echo -e "    $EXTENSION_DIR"
else
    echo -e "${RED}[-] Error copying extension files. Please check permissions.${NC}"
    exit 1
fi

# Enable extension (or queue for enablement after next login)
echo -e "${BLUE}[*] Enabling GNOME Shell extension...${NC}"
gnome-extensions enable "$UUID" 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}[+] Extension enabled successfully!${NC}"
else
    echo -e "${YELLOW}[!] Queued extension for enablement. Since you are on Wayland,${NC}"
    echo -e "${YELLOW}    GNOME Shell needs to restart/reload before enabling.${NC}"
fi

echo -e "\n${CYAN}====================================================${NC}"
echo -e "${GREEN}                  INSTALLATION COMPLETE!             ${NC}"
echo -e "${CYAN}====================================================${NC}"
echo -e "${YELLOW}IMPORTANT STEP TO ACTIVATE IT:${NC}"
echo -e "Because your system is running on ${BLUE}Wayland${NC}, GNOME Shell cannot be"
echo -e "hot-reloaded. You must ${GREEN}Log Out${NC} of your desktop and ${GREEN}Log Back In${NC}."
echo -e ""
echo -e "Once you log back in, the battery percentage of your device"
echo -e "will automatically appear next to Bluetooth icon"
echo -e "in the top panel!"
echo -e "${CYAN}====================================================${NC}"
