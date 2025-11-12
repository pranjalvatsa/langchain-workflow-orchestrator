#!/bin/bash

# LangGraph Migration Activation Script
# This script helps you safely enable LangGraph and verify it's working

set -e  # Exit on error

echo "🚀 LangGraph Migration Activation"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}✗ .env file not found${NC}"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo -e "${YELLOW}⚠ Please update .env with your configuration${NC}"
    exit 1
fi

echo "Step 1: Checking dependencies..."
if ! npm list @langchain/langgraph &> /dev/null; then
    echo -e "${RED}✗ @langchain/langgraph not installed${NC}"
    echo "Installing..."
    npm install --legacy-peer-deps
fi
echo -e "${GREEN}✓ Dependencies OK${NC}"
echo ""

echo "Step 2: Enabling LangGraph..."
# Check if USE_LANGGRAPH already exists
if grep -q "USE_LANGGRAPH" .env; then
    # Update existing line
    sed -i.bak 's/USE_LANGGRAPH=.*/USE_LANGGRAPH=true/' .env
else
    # Add new line
    echo "USE_LANGGRAPH=true" >> .env
fi
echo -e "${GREEN}✓ Feature flag enabled in .env${NC}"
echo ""

echo "Step 3: Verifying configuration..."
if grep -q "USE_LANGGRAPH=true" .env; then
    echo -e "${GREEN}✓ USE_LANGGRAPH=true confirmed${NC}"
else
    echo -e "${RED}✗ Feature flag not set correctly${NC}"
    exit 1
fi
echo ""

echo "Step 4: Checking if server is running..."
if lsof -ti:8000 &> /dev/null; then
    echo -e "${YELLOW}⚠ Server already running on port 8000${NC}"
    echo "Would you like to restart it? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "Stopping existing server..."
        kill $(lsof -ti:8000) || true
        sleep 2
    else
        echo "Please manually restart the server for changes to take effect"
        exit 0
    fi
fi
echo -e "${GREEN}✓ Port 8000 is available${NC}"
echo ""

echo "Step 5: Starting server..."
npm start > server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"
echo "Waiting for server to start..."
sleep 5

# Check if server started successfully
if ps -p $SERVER_PID > /dev/null; then
    echo -e "${GREEN}✓ Server started successfully${NC}"
else
    echo -e "${RED}✗ Server failed to start${NC}"
    echo "Check server.log for details"
    exit 1
fi
echo ""

echo "Step 6: Verifying LangGraph is active..."
sleep 2
if grep -q "LangGraph (Native)" server.log; then
    echo -e "${GREEN}✓ LangGraph engine is active!${NC}"
else
    echo -e "${YELLOW}⚠ Could not confirm LangGraph in logs${NC}"
    echo "Check server.log manually"
fi
echo ""

echo "Step 7: Health check..."
if curl -s http://localhost:8000/health | grep -q "ok"; then
    echo -e "${GREEN}✓ Server is healthy${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "Server may not be running correctly"
fi
echo ""

echo "=================================="
echo -e "${GREEN}🎉 Migration activation complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Run test workflows to verify everything works"
echo "2. Check TESTING_CHECKLIST.md for comprehensive tests"
echo "3. Monitor logs: tail -f server.log"
echo "4. Review logs/combined.log for any errors"
echo ""
echo "To stop the server: kill $SERVER_PID"
echo "To rollback: Set USE_LANGGRAPH=false in .env and restart"
echo ""
echo "Server log file: server.log"
echo "Application logs: logs/combined.log"
echo ""
echo -e "${YELLOW}📚 Documentation:${NC}"
echo "- MIGRATION_SUMMARY.md - Overview of changes"
echo "- LANGGRAPH_QUICKSTART.md - Quick start guide"
echo "- LANGGRAPH_MIGRATION_GUIDE.md - Detailed guide"
echo "- TESTING_CHECKLIST.md - Testing procedures"
echo ""

# Save server PID for later
echo $SERVER_PID > .server.pid
echo "Server PID saved to .server.pid"
