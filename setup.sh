#!/bin/bash

# Bluesky Custom Feed - Quick Start Script

echo "🚀 Starting Bluesky Custom Media Feed..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Installing dependencies...${NC}"

# Install backend dependencies
echo "Installing backend packages..."
cd backend
npm install --silent
cd ..

# Install frontend dependencies
echo "Installing frontend packages..."
cd frontend
npm install --silent
cd ..

echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""
echo -e "${BLUE}🎯 Next steps:${NC}"
echo ""
echo "1. Create app password at: https://bsky.app/settings/app-passwords"
echo ""
echo "2. Start the application in VS Code:"
echo "   - Press Ctrl+Shift+B (or Cmd+Shift+B on Mac)"
echo "   - Select 'Full Stack: Start Both Servers'"
echo ""
echo "3. Open your browser to: http://localhost:3000"
echo ""
echo "4. Login with your Bluesky handle and app password"
echo ""
echo -e "${GREEN}✨ Happy filtering!${NC}"
