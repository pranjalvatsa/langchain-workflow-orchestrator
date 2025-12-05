#!/bin/bash

# Market Research Scraper - Quick Test with Firecrawl
# Updated to use real web scraping via Firecrawl API

echo "🔧 Testing Market Research Workflow with Firecrawl"
echo "=================================================="
echo ""

# Get auth token (replace with your credentials)
read -p "Enter your email: " EMAIL
read -sp "Enter your password: " PASSWORD
echo ""

TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}" | jq -r '.token // .data.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Login failed. Please check credentials."
  exit 1
fi

echo "✅ Logged in successfully"
echo ""

# Create workflow directly
echo "📝 Creating Market Research Workflow..."
echo ""

WORKFLOW_RESPONSE=$(curl -s -X POST http://localhost:8000/api/workflows/create-direct \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Market Research Scraper with Firecrawl",
    "description": "Real web scraping using Firecrawl API for brand extraction",
    "category": "automation",
    "tags": ["web-scraping", "firecrawl", "market-research"],
    "nodes": [
      {
        "id": "start",
        "type": "start",
        "name": "Start",
        "position": {"x": 100, "y": 100},
        "data": {"label": "Start"}
      },
      {
        "id": "crawl",
        "type": "tool",
        "name": "Firecrawl Scraper",
        "position": {"x": 100, "y": 200},
        "data": {
          "label": "Crawl with Firecrawl",
          "tool": "firecrawl_scraper",
          "parameters": {
            "url": "{{target_url}}",
            "mode": "crawl",
            "max_pages": "{{max_pages}}",
            "formats": ["markdown", "html"],
            "include_paths": ["/clients", "/customers", "/partners", "/case-studies", "/testimonials"],
            "exclude_paths": ["/admin", "/login"]
          },
          "config": {
            "output_key": "crawl_results"
          }
        }
      },
      {
        "id": "extract",
        "type": "llm_task",
        "name": "Extract Brands",
        "position": {"x": 100, "y": 300},
        "data": {
          "label": "Extract Brand Names",
          "config": {
            "model": "gpt-4",
            "prompt": "Extract all company/brand names from: {{crawl_results.data}}",
            "output_key": "brands"
          }
        }
      },
      {
        "id": "end",
        "type": "end",
        "name": "Complete",
        "position": {"x": 100, "y": 400},
        "data": {"label": "Complete"}
      }
    ],
    "edges": [
      {"id": "e1", "source": "start", "target": "crawl"},
      {"id": "e2", "source": "crawl", "target": "extract"},
      {"id": "e3", "source": "extract", "target": "end"}
    ],
    "configuration": {
      "maxConcurrentExecutions": 3,
      "timeoutMinutes": 60
    }
  }')

WORKFLOW_ID=$(echo $WORKFLOW_RESPONSE | jq -r '.workflow._id // .workflow.id // .data._id // .data.id')

if [ -z "$WORKFLOW_ID" ] || [ "$WORKFLOW_ID" = "null" ]; then
  echo "❌ Failed to create workflow"
  echo "Response: $WORKFLOW_RESPONSE"
  exit 1
fi

echo "✅ Workflow created: $WORKFLOW_ID"
echo ""

# Execute the workflow
echo "🚀 Executing workflow..."
read -p "Enter target URL (e.g., https://example.com): " TARGET_URL
read -p "Max pages to crawl (default: 50): " MAX_PAGES
MAX_PAGES=${MAX_PAGES:-50}

EXECUTION_RESPONSE=$(curl -s -X POST http://localhost:8000/api/workflows/$WORKFLOW_ID/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"input\": {
      \"target_url\": \"$TARGET_URL\",
      \"max_pages\": $MAX_PAGES
    }
  }")

EXECUTION_ID=$(echo $EXECUTION_RESPONSE | jq -r '.executionId // .data.executionId // .execution._id')

if [ -z "$EXECUTION_ID" ] || [ "$EXECUTION_ID" = "null" ]; then
  echo "❌ Failed to start execution"
  echo "Response: $EXECUTION_RESPONSE"
  exit 1
fi

echo "✅ Execution started: $EXECUTION_ID"
echo ""
echo "Monitor progress:"
echo "  curl http://localhost:8000/api/executions/$EXECUTION_ID \\"
echo "    -H \"Authorization: Bearer $TOKEN\""
echo ""
echo "View logs:"
echo "  curl http://localhost:8000/api/executions/$EXECUTION_ID/logs \\"
echo "    -H \"Authorization: Bearer $TOKEN\""
echo ""
echo "🎉 Test complete!"
