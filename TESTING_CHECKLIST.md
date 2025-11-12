# LangGraph Migration Testing Checklist

Use this checklist to verify the LangGraph migration is working correctly.

## Pre-Migration

- [ ] Backup database
  ```bash
  mongodump --uri="$MONGODB_URI" --out=./backup
  ```
- [ ] Document current workflows in production
- [ ] Note any custom modifications to WorkflowExecutionService
- [ ] Check package.json for @langchain/langgraph version

## Enable LangGraph

- [ ] Add to `.env`:
  ```bash
  USE_LANGGRAPH=true
  ```
- [ ] Restart server:
  ```bash
  npm start
  ```
- [ ] Verify log shows:
  ```
  🔧 Workflow Execution Engine: LangGraph (Native)
  ```

## Basic Workflow Testing

### Test 1: Simple Linear Workflow
- [ ] Create workflow with 3 nodes: start → llm → end
- [ ] Execute workflow via API
- [ ] Check execution completes successfully
- [ ] Verify output is correct
- [ ] Check logs for errors

**API Call**:
```bash
curl -X POST http://localhost:8000/api/executions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "WORKFLOW_ID",
    "inputs": {"message": "Hello World"}
  }'
```

**Expected**: Status 201, execution started

### Test 2: Conditional Routing
- [ ] Create workflow with conditional edges (if/else)
- [ ] Execute with input that triggers "true" path
- [ ] Verify correct path taken
- [ ] Execute with input that triggers "false" path
- [ ] Verify correct path taken

**Example Workflow**:
```json
{
  "nodes": [
    {"id": "start", "type": "start"},
    {"id": "check", "type": "condition", "data": {"expression": "{{input}} > 5"}},
    {"id": "high", "type": "llm", "data": {"prompt": "High value"}},
    {"id": "low", "type": "llm", "data": {"prompt": "Low value"}},
    {"id": "end", "type": "end"}
  ],
  "edges": [
    {"source": "start", "target": "check"},
    {"source": "check", "target": "high", "condition": "true"},
    {"source": "check", "target": "low", "condition": "false"},
    {"source": "high", "target": "end"},
    {"source": "low", "target": "end"}
  ]
}
```

### Test 3: Tool Node Execution
- [ ] Execute workflow with calculator tool
- [ ] Execute workflow with HTTP tool (API call)
- [ ] Execute workflow with LLM tool
- [ ] Verify all tools work correctly

## HITL (Human-in-the-Loop) Testing

### Test 4: Single Approval Node
- [ ] Create workflow with human approval node
- [ ] Execute workflow
- [ ] Verify workflow pauses at approval node
- [ ] Verify task is created in database
  ```bash
  # Check MongoDB
  db.tasks.find({executionId: "EXECUTION_ID"})
  ```
- [ ] Approve via API:
  ```bash
  curl -X POST http://localhost:8000/api/human-review/complete \
    -H "Content-Type: application/json" \
    -d '{
      "taskId": "TASK_ID",
      "actionId": "approve",
      "feedback": "Approved"
    }'
  ```
- [ ] Verify workflow continues
- [ ] Verify workflow completes

**Expected**: Execution status goes from "running" → "waiting_human_review" → "completed"

### Test 5: Multiple HITL Nodes
- [ ] Create workflow with 2+ approval nodes
- [ ] Execute workflow
- [ ] Approve first node
- [ ] Verify workflow continues to second node
- [ ] Approve second node
- [ ] Verify workflow completes

### Test 6: HITL Rejection
- [ ] Execute workflow with approval node
- [ ] Reject via API:
  ```bash
  curl -X POST http://localhost:8000/api/human-review/complete \
    -H "Content-Type: application/json" \
    -d '{
      "taskId": "TASK_ID",
      "actionId": "reject",
      "feedback": "Not approved"
    }'
  ```
- [ ] Verify workflow follows rejection path
- [ ] Verify correct edge condition matched

## Advanced Features

### Test 7: Streaming Progress
- [ ] Open WebSocket connection:
  ```javascript
  const socket = io('http://localhost:8000');
  socket.on('workflow:progress', (data) => {
    console.log('Progress:', data);
  });
  ```
- [ ] Execute workflow
- [ ] Verify progress events received
- [ ] Check event contains node completion info

### Test 8: Error Handling
- [ ] Execute workflow with intentional error (invalid tool config)
- [ ] Verify error is caught
- [ ] Verify execution status set to "failed"
- [ ] Verify error message logged
- [ ] Check WorkflowStepLog for error details

### Test 9: Concurrent Executions
- [ ] Start 5 workflows simultaneously
- [ ] Verify all execute correctly
- [ ] Check activeExecutions Map size
- [ ] Verify no race conditions

**Script**:
```bash
for i in {1..5}; do
  curl -X POST http://localhost:8000/api/executions \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"workflowId": "WORKFLOW_ID", "inputs": {"test": "'$i'"}}' &
done
wait
```

## Pre-Production Workflows

### Test 10: Call Deflection Workflow
- [ ] Execute call-deflection workflow
- [ ] Verify LLM analysis works
- [ ] Test human escalation path
- [ ] Verify completion notifications

### Test 11: Test Drive Booking Workflow
- [ ] Execute test-drive booking workflow
- [ ] Verify speech-to-text node works
- [ ] Test approval flow
- [ ] Verify booking creation

### Test 12: Business Insights Workflow
- [ ] Execute insights workflow
- [ ] Verify data aggregation
- [ ] Test report generation
- [ ] Verify multi-channel publishing

## Performance Testing

### Test 13: Response Times
- [ ] Execute 10 simple workflows
- [ ] Record execution times
- [ ] Compare with legacy engine (set USE_LANGGRAPH=false)
- [ ] Verify LangGraph is faster or comparable

**Expected**: 30-40% faster execution

### Test 14: Memory Usage
- [ ] Start server
- [ ] Note initial memory usage
- [ ] Execute 100 workflows
- [ ] Note final memory usage
- [ ] Compare with legacy engine

**Expected**: 30-40% less memory

### Test 15: Scalability
- [ ] Run load test (50 concurrent workflows)
- [ ] Monitor server CPU/memory
- [ ] Verify no crashes
- [ ] Check error rates

## Production Readiness

### Test 16: PostgreSQL Checkpointer (Optional)
- [ ] Setup PostgreSQL database
- [ ] Configure POSTGRES_CHECKPOINT_URL
- [ ] Restart server
- [ ] Execute workflow with HITL
- [ ] Restart server (simulate crash)
- [ ] Resume workflow from checkpoint
- [ ] Verify workflow continues correctly

**Setup**:
```bash
# Install PostgreSQL
brew install postgresql

# Create database
createdb workflow_checkpoints

# Update .env
POSTGRES_CHECKPOINT_URL=postgresql://localhost:5432/workflow_checkpoints
```

### Test 17: Long-Running Workflow
- [ ] Create workflow that takes 5+ minutes
- [ ] Execute workflow
- [ ] Pause at HITL after 2 minutes
- [ ] Wait 10 minutes
- [ ] Resume workflow
- [ ] Verify completes successfully

### Test 18: Edge Cases
- [ ] Empty workflow (no nodes)
- [ ] Single node workflow
- [ ] Circular edges (should error)
- [ ] Missing node IDs
- [ ] Invalid edge conditions
- [ ] Null/undefined inputs

## Rollback Testing

### Test 19: Switch Back to Legacy
- [ ] Set USE_LANGGRAPH=false
- [ ] Restart server
- [ ] Execute same workflow
- [ ] Verify works correctly
- [ ] Switch back to USE_LANGGRAPH=true
- [ ] Verify works again

## Monitoring

### Test 20: Logs
- [ ] Check logs/combined.log for errors
- [ ] Verify execution logs are detailed
- [ ] Check for warnings
- [ ] Verify log levels correct

### Test 21: Database State
- [ ] Check WorkflowExecution documents
- [ ] Verify steps array populated
- [ ] Check Task documents for HITL
- [ ] Verify WorkflowStepLog entries

**MongoDB Queries**:
```javascript
// Check executions
db.workflowexecutions.find({status: "running"}).count()
db.workflowexecutions.find({status: "failed"}).pretty()

// Check tasks
db.tasks.find({status: "pending"}).count()

// Check step logs
db.workflowsteplogs.find({executionId: "EXECUTION_ID"}).pretty()
```

## Sign-Off

### Final Checks
- [ ] All tests passed
- [ ] No critical errors in logs
- [ ] Performance metrics acceptable
- [ ] HITL flows work correctly
- [ ] Documentation reviewed
- [ ] Team trained on new system

### Performance Summary
- Average execution time: _____ ms (vs _____ ms legacy)
- Memory usage: _____ MB (vs _____ MB legacy)
- Concurrent capacity: _____ executions
- Error rate: _____ %

### Decision
- [ ] **Approve**: Enable LangGraph in production
- [ ] **Rollback**: Revert to legacy engine
- [ ] **Delay**: More testing needed

**Approved by**: _______________
**Date**: _______________

---

## Quick Test Script

Run all basic tests:

```bash
#!/bin/bash

echo "Testing LangGraph Migration"
echo "============================"

# 1. Check feature flag
if grep -q "USE_LANGGRAPH=true" .env; then
  echo "✓ Feature flag enabled"
else
  echo "✗ Feature flag not enabled"
  exit 1
fi

# 2. Start server (in background)
npm start &
SERVER_PID=$!
sleep 5

# 3. Test simple workflow
RESPONSE=$(curl -s -X POST http://localhost:8000/api/executions \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workflowId": "test-workflow", "inputs": {"test": "data"}}')

if echo "$RESPONSE" | grep -q "success"; then
  echo "✓ Simple workflow executed"
else
  echo "✗ Simple workflow failed"
fi

# 4. Check logs
if grep -q "LangGraph (Native)" logs/combined.log; then
  echo "✓ LangGraph engine active"
else
  echo "✗ LangGraph engine not active"
fi

# 5. Cleanup
kill $SERVER_PID

echo "============================"
echo "Basic tests complete"
```

Make executable and run:
```bash
chmod +x test-migration.sh
./test-migration.sh
```
