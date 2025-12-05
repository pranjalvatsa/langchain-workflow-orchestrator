# Market Research Scraper - Quick Start Guide

## 🚀 Quick Start (5 minutes)

### Step 1: Deploy the Workflow

```bash
# From the project root directory
node workflows/deploy-market-research-scraper.js
```

You should see:
```
✅ Template deployed successfully!
   Template ID: market-research-scraper-v1
   Name: Market Research & Data-Scraping Agent
   Version: 1.0.0
```

### Step 2: Test the Workflow

```bash
# Set your auth token
export AUTH_TOKEN="your_jwt_token_here"

# Run test suite
./workflows/test-market-research-scraper.sh
```

### Step 3: Execute Your First Crawl

```bash
# Simple example
curl -X POST http://localhost:8000/api/universal/workflows/execute \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "market-research-scraper-v1",
    "input": {
      "target_url": "https://www.example.com"
    }
  }'
```

Save the `executionId` from the response!

### Step 4: Monitor Progress

```bash
# Check status
curl http://localhost:8000/api/executions/{executionId} \
  -H "Authorization: Bearer $AUTH_TOKEN"

# View logs
curl http://localhost:8000/api/executions/{executionId}/logs \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

### Step 5: Handle Human Review (if required)

If the workflow pauses for human approval:

```bash
# List pending tasks
curl http://localhost:8000/api/human-review/tasks \
  -H "Authorization: Bearer $AUTH_TOKEN"

# Approve the crawl
curl -X POST http://localhost:8000/api/human-review/complete \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task_id_from_list",
    "actionId": "approve",
    "feedback": "Approved for market research"
  }'
```

### Step 6: Get Results

Once execution completes:

```bash
# Get full results
curl http://localhost:8000/api/executions/{executionId} \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  > results.json

# The output includes:
# - JSON with all brand mentions
# - CSV export data
# - Executive summary
# - Statistics and analysis
```

## 📋 Common Use Cases

### Case 1: Competitor Analysis

```bash
curl -X POST http://localhost:8000/api/universal/workflows/execute \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "market-research-scraper-v1",
    "input": {
      "target_url": "https://competitor.com",
      "max_pages": 500,
      "crawl_depth": 4
    },
    "metadata": {
      "project": "Q4 Competitive Intelligence",
      "target_company": "Competitor Inc"
    }
  }'
```

### Case 2: Quick Client List Extraction

```bash
curl -X POST http://localhost:8000/api/universal/workflows/execute \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "market-research-scraper-v1",
    "input": {
      "target_url": "https://www.company.com/clients",
      "max_pages": 50,
      "crawl_depth": 2,
      "sitemap_only": true
    }
  }'
```

### Case 3: Deep Market Research

```bash
curl -X POST http://localhost:8000/api/universal/workflows/execute \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "market-research-scraper-v1",
    "input": {
      "target_url": "https://industry-leader.com",
      "max_pages": 1000,
      "crawl_depth": 5,
      "include_subdomains": true,
      "rate_limit_rps": 1,
      "fuzzy_match_threshold": 0.9
    },
    "metadata": {
      "project": "Market Landscape Analysis 2025",
      "analyst": "research-team@company.com"
    }
  }'
```

## 🎨 Visual Workflow Editor

### Import to React Flow Canvas

```bash
# Get workflow in ReactFlow format for visual editing
curl http://localhost:8000/api/templates/market-research-scraper-v1/reactflow \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  > workflow-canvas.json

# Import this into your React Flow / Noam canvas UI
```

### Customize and Re-deploy

1. Edit the workflow in React Flow canvas
2. Export modified workflow
3. Re-import:

```bash
curl -X POST http://localhost:8000/api/templates/import/reactflow \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d @modified-workflow.json
```

## 🔍 Real-time Monitoring

### WebSocket Connection

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:8000');

// Listen for execution events
socket.on('execution_started', (data) => {
  console.log('Crawl started:', data);
});

socket.on('node_completed', (data) => {
  console.log(`Node "${data.nodeName}" completed`);
  console.log('Progress:', data.progress);
});

socket.on('human_review_required', (data) => {
  alert('Human approval needed!');
  // Show approval UI
});

socket.on('execution_completed', (data) => {
  console.log('Brands found:', data.outputs.statistics.total_brands);
  // Download results
});

socket.on('execution_failed', (data) => {
  console.error('Execution failed:', data.error);
});
```

## 🛠️ Troubleshooting

### Issue: "Template not found"

**Solution:** Deploy the template first
```bash
node workflows/deploy-market-research-scraper.js
```

### Issue: "Crawling disallowed by robots.txt"

**Solution:** The target site's robots.txt blocks crawlers. This is expected and the workflow respects this. Try a different site or contact the site owner for permission.

### Issue: Workflow stuck on "Human Review"

**Solution:** Approve the pending task
```bash
# List tasks
curl http://localhost:8000/api/human-review/tasks \
  -H "Authorization: Bearer $AUTH_TOKEN"

# Approve
curl -X POST http://localhost:8000/api/human-review/complete \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"taskId": "xxx", "actionId": "approve"}'
```

### Issue: "No brands found"

**Possible reasons:**
- Site doesn't have client/partner sections
- Content is behind authentication
- Brand names not in expected format
- Pages were disallowed by robots.txt

**Solution:** Check the executive summary in the output for detailed explanation.

### Issue: Execution taking too long

**Solution:** Reduce parameters
```json
{
  "max_pages": 100,
  "crawl_depth": 2,
  "rate_limit_rps": 2
}
```

## 📊 Understanding the Output

### Brand Mention Object

```json
{
  "canonical_name": "Acme Corporation",
  "aliases": ["ACME", "Acme Inc."],
  "total_mentions": 12,
  "source_urls": ["https://example.com/clients"],
  "page_types": ["clients", "case-study"],
  "best_context_snippet": "Acme Corporation has been...",
  "confidence_score": 0.95,
  "first_seen": "2025-12-05T10:32:15Z",
  "languages": ["en"]
}
```

**Field Meanings:**
- `canonical_name`: Most complete/common version of the brand name
- `aliases`: Other variations found (ACME, Acme Inc., etc.)
- `total_mentions`: How many times mentioned across all pages
- `source_urls`: All pages where mentioned
- `page_types`: Types of pages (clients, case-study, blog, etc.)
- `confidence_score`: 0-1 score (1.0 = logo section, 0.6 = blog mention)
- `best_context_snippet`: Most informative surrounding text

### Statistics Interpretation

```json
{
  "total_brands": 67,        // Unique brands after deduplication
  "total_mentions": 87,      // Total mentions before deduplication
  "pages_crawled": 450,      // Successfully crawled
  "pages_skipped": 50        // Could not access
}
```

## 🔐 Security Best Practices

1. **Never commit tokens:** Use environment variables
   ```bash
   export AUTH_TOKEN="token"
   ```

2. **Respect rate limits:** Don't set `rate_limit_rps` too high

3. **Check robots.txt first:** Workflow does this automatically

4. **Don't scrape authenticated content:** Unless you have permission

5. **Use for legitimate purposes:** Market research, not data theft

## 📚 Next Steps

1. **Read full documentation:** `workflows/MARKET_RESEARCH_SCRAPER_README.md`
2. **Customize workflow:** Edit JSON and redeploy
3. **Integrate with your app:** Use WebSocket events for real-time UI
4. **Set up scheduled crawls:** Use `/api/universal/workflows/schedule`
5. **Export to vector DB:** Configure `VECTOR_DB_ENDPOINT` in `.env`

## 🆘 Need Help?

- Check logs: `/api/executions/{executionId}/logs`
- Review template: `/api/templates/market-research-scraper-v1`
- Test execution: `./workflows/test-market-research-scraper.sh`
- Open an issue on GitHub

---

**Happy Crawling! 🕷️📊**
