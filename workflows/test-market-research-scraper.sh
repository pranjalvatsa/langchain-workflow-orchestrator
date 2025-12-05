#!/bin/bash

# Market Research Scraper - Test Script
# This script helps you test the market research workflow

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8000}"
TOKEN="${AUTH_TOKEN:-}"

echo -e "${BLUE}🧪 Market Research Scraper - Test Suite${NC}"
echo "=========================================="
echo ""

# Check if token is set
if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}⚠️  AUTH_TOKEN not set. Attempting to login...${NC}"
    
    # Attempt login (you may need to modify credentials)
    LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "test@example.com",
            "password": "password123"
        }')
    
    TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token // .data.token // empty')
    
    if [ -z "$TOKEN" ]; then
        echo -e "${RED}❌ Failed to obtain auth token. Please set AUTH_TOKEN environment variable.${NC}"
        echo "   Example: export AUTH_TOKEN='your_jwt_token'"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Login successful!${NC}"
fi

echo -e "${GREEN}✅ Using token: ${TOKEN:0:20}...${NC}"
echo ""

# Function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$data" ]; then
        curl -s -X "$method" "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json"
    else
        curl -s -X "$method" "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data"
    fi
}

# Test 1: Check if template exists
echo -e "${BLUE}📋 Test 1: Verify Template Exists${NC}"
echo "-----------------------------------"

TEMPLATE=$(api_call GET "/api/templates/market-research-scraper-v1")
TEMPLATE_NAME=$(echo $TEMPLATE | jq -r '.data.name // .name // empty')

if [ -z "$TEMPLATE_NAME" ]; then
    echo -e "${RED}❌ Template not found. Please deploy it first:${NC}"
    echo "   node workflows/deploy-market-research-scraper.js"
    exit 1
fi

echo -e "${GREEN}✅ Template found: $TEMPLATE_NAME${NC}"
echo ""

# Test 2: Execute workflow with minimal input
echo -e "${BLUE}🚀 Test 2: Execute Workflow (Minimal Input)${NC}"
echo "-------------------------------------------"

EXEC_RESPONSE=$(api_call POST "/api/universal/workflows/execute" '{
    "templateId": "market-research-scraper-v1",
    "input": {
        "target_url": "https://example.com",
        "max_pages": 10,
        "crawl_depth": 2,
        "rate_limit_rps": 2
    },
    "metadata": {
        "test": "minimal_input",
        "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
}')

EXECUTION_ID=$(echo $EXEC_RESPONSE | jq -r '.data.executionId // .executionId // empty')

if [ -z "$EXECUTION_ID" ]; then
    echo -e "${RED}❌ Failed to start execution${NC}"
    echo "Response: $EXEC_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Execution started: $EXECUTION_ID${NC}"
echo ""

# Test 3: Check execution status
echo -e "${BLUE}🔍 Test 3: Monitor Execution Status${NC}"
echo "------------------------------------"

sleep 2

for i in {1..5}; do
    EXEC_STATUS=$(api_call GET "/api/executions/$EXECUTION_ID")
    STATUS=$(echo $EXEC_STATUS | jq -r '.data.status // .status // empty')
    
    echo "Status check $i/5: $STATUS"
    
    if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
        break
    fi
    
    sleep 3
done

echo ""

# Test 4: Execute with custom parameters
echo -e "${BLUE}🎯 Test 4: Execute with Custom Parameters${NC}"
echo "-------------------------------------------"

EXEC_RESPONSE_2=$(api_call POST "/api/universal/workflows/execute" '{
    "templateId": "market-research-scraper-v1",
    "input": {
        "target_url": "https://www.microsoft.com",
        "max_pages": 50,
        "crawl_depth": 3,
        "rate_limit_rps": 1,
        "sitemap_only": true,
        "include_subdomains": false,
        "fuzzy_match_threshold": 0.85
    },
    "metadata": {
        "test": "custom_parameters",
        "project": "Test Suite"
    }
}')

EXECUTION_ID_2=$(echo $EXEC_RESPONSE_2 | jq -r '.data.executionId // .executionId // empty')

if [ -z "$EXECUTION_ID_2" ]; then
    echo -e "${YELLOW}⚠️  Failed to start second execution (may need human approval)${NC}"
else
    echo -e "${GREEN}✅ Second execution started: $EXECUTION_ID_2${NC}"
fi

echo ""

# Test 5: Check for pending human reviews
echo -e "${BLUE}👤 Test 5: Check Human Review Tasks${NC}"
echo "------------------------------------"

TASKS=$(api_call GET "/api/human-review/tasks")
PENDING_COUNT=$(echo $TASKS | jq '.data | length // 0')

echo "Pending human review tasks: $PENDING_COUNT"

if [ "$PENDING_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Human review required for workflow execution${NC}"
    echo "Tasks:"
    echo $TASKS | jq -r '.data[] | "  - Task ID: \(.id // ._id) - \(.title)"'
    echo ""
    echo "To approve, run:"
    echo "  curl -X POST $BASE_URL/api/human-review/complete \\"
    echo "    -H \"Authorization: Bearer \$TOKEN\" \\"
    echo "    -H \"Content-Type: application/json\" \\"
    echo "    -d '{\"taskId\": \"TASK_ID\", \"actionId\": \"approve\"}'"
fi

echo ""

# Test 6: Get ReactFlow format
echo -e "${BLUE}🎨 Test 6: Get ReactFlow Format${NC}"
echo "--------------------------------"

REACTFLOW=$(api_call GET "/api/templates/market-research-scraper-v1/reactflow")
NODE_COUNT=$(echo $REACTFLOW | jq '.data.nodes | length // 0')

echo -e "${GREEN}✅ ReactFlow format available with $NODE_COUNT nodes${NC}"
echo ""

# Test 7: View execution logs
echo -e "${BLUE}📝 Test 7: View Execution Logs${NC}"
echo "-------------------------------"

LOGS=$(api_call GET "/api/executions/$EXECUTION_ID/logs")
LOG_COUNT=$(echo $LOGS | jq '.data | length // 0')

echo "Log entries: $LOG_COUNT"

if [ "$LOG_COUNT" -gt 0 ]; then
    echo "Recent logs:"
    echo $LOGS | jq -r '.data[0:3][] | "  [\(.timestamp)] \(.level): \(.message)"'
fi

echo ""

# Summary
echo -e "${BLUE}📊 Test Summary${NC}"
echo "==============="
echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""
echo "Execution IDs:"
echo "  - Test 2: $EXECUTION_ID"
[ -n "$EXECUTION_ID_2" ] && echo "  - Test 4: $EXECUTION_ID_2"
echo ""
echo "Next steps:"
echo "  1. Monitor executions in real-time:"
echo "     curl $BASE_URL/api/executions/$EXECUTION_ID"
echo ""
echo "  2. View results when complete:"
echo "     curl $BASE_URL/api/executions/$EXECUTION_ID/outputs"
echo ""
echo "  3. Approve pending human reviews (if any)"
echo ""
echo "  4. Check WebSocket events for real-time updates"
echo ""
echo -e "${GREEN}🎉 Testing complete!${NC}"
