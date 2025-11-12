#!/bin/bash

# VAPI Integration Test Script
# Tests the test-drive workflow with VAPI webhook

echo "🧪 Testing VAPI Integration for Test Drive Booking"
echo "=================================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVER_URL="http://localhost:3000"

echo ""
echo "${YELLOW}Step 1: Testing VAPI webhook endpoint${NC}"
echo "--------------------------------------"

# Test the webhook with sample VAPI payload
RESPONSE=$(curl -s -X POST "$SERVER_URL/api/vapi/create-booking" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "functionCall": {
        "name": "create_booking",
        "parameters": {
          "customerName": "John Doe",
          "customerPhone": "+1-555-0123",
          "customerEmail": "john.doe@example.com",
          "vehicleType": "electric",
          "vehicleModel": "Tesla Model 3",
          "preferredDate": "2025-11-10",
          "preferredTime": "14:00",
          "additionalNotes": "Interested in long range version"
        }
      },
      "call": {
        "id": "test-call-12345",
        "type": "inbound"
      }
    }
  }')

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Check if response contains result
if echo "$RESPONSE" | grep -q "result"; then
  echo ""
  echo "${GREEN}✅ Webhook endpoint working!${NC}"
  
  # Extract execution ID
  EXECUTION_ID=$(echo "$RESPONSE" | jq -r '.metadata.executionId' 2>/dev/null)
  
  if [ "$EXECUTION_ID" != "null" ] && [ -n "$EXECUTION_ID" ]; then
    echo "${GREEN}✅ Workflow execution started: $EXECUTION_ID${NC}"
    
    echo ""
    echo "${YELLOW}Step 2: Checking for pending approval task${NC}"
    echo "--------------------------------------"
    
    sleep 2
    
    TASKS=$(curl -s "$SERVER_URL/api/human-review/tasks?status=pending")
    echo "$TASKS" | jq '.' 2>/dev/null || echo "$TASKS"
    
    TASK_ID=$(echo "$TASKS" | jq -r '.tasks[0].taskId' 2>/dev/null)
    
    if [ "$TASK_ID" != "null" ] && [ -n "$TASK_ID" ]; then
      echo ""
      echo "${GREEN}✅ Task created: $TASK_ID${NC}"
      
      echo ""
      echo "${YELLOW}Step 3: Approving the booking${NC}"
      echo "--------------------------------------"
      
      APPROVAL=$(curl -s -X POST "$SERVER_URL/api/human-review/complete" \
        -H "Content-Type: application/json" \
        -d "{
          \"taskId\": \"$TASK_ID\",
          \"actionId\": \"approve\",
          \"feedback\": \"Vehicle available, booking confirmed\"
        }")
      
      echo "$APPROVAL" | jq '.' 2>/dev/null || echo "$APPROVAL"
      
      if echo "$APPROVAL" | grep -q "success"; then
        echo ""
        echo "${GREEN}✅ Booking approved successfully!${NC}"
        echo ""
        echo "${GREEN}🎉 VAPI Integration Test PASSED!${NC}"
      else
        echo ""
        echo "${RED}❌ Failed to approve booking${NC}"
      fi
    else
      echo ""
      echo "${RED}❌ No pending task found${NC}"
    fi
  else
    echo ""
    echo "${RED}❌ No execution ID in response${NC}"
  fi
else
  echo ""
  echo "${RED}❌ Webhook endpoint failed${NC}"
fi

echo ""
echo "=================================================="
echo ""
echo "📋 Next Steps:"
echo "1. Set up VAPI account at https://vapi.ai"
echo "2. Create assistant with function calling"
echo "3. Configure webhook URL to point to your server"
echo "4. Test with real voice call!"
echo ""
echo "📖 See VAPI-INTEGRATION-GUIDE.md for full setup"
echo ""
