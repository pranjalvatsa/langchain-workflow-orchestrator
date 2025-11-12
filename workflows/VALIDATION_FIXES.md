# Blog Workflow Validation Fixes

## What Changed

### 1. Switched to LangGraph Validation
- **Before**: Used `LangChainService.validateWorkflow()` (legacy custom engine)
- **After**: Uses `LangGraphWorkflowService.validateWorkflow()` (LangGraph native)
- **Why**: Validates according to LangGraph/StateGraph requirements, not custom engine

### 2. Node Structure Corrections

#### Agent Nodes
**Before** (config in `data`):
```json
{
  "type": "agent",
  "data": {
    "label": "...",
    "prompt": "...",
    "tools": [...]
  }
}
```

**After** (config in `config`):
```json
{
  "type": "agent",
  "data": {
    "label": "...",
    "description": "..."
  },
  "config": {
    "prompt": "...",
    "tools": [...]
  }
}
```

#### HITL Nodes
**Before**:
```json
{
  "type": "agent_with_hitl",  // Wrong type
  "data": {
    "reviewMessage": "...",
    "actions": [...]
  }
}
```

**After**:
```json
{
  "type": "hitl",  // Correct type
  "data": {
    "label": "...",
    "description": "..."
  },
  "config": {
    "instructions": "...",
    "reviewMessage": "...",
    "actions": [...]
  }
}
```

#### LLM Nodes
Already correct - no changes needed:
```json
{
  "type": "llm",
  "data": { "label": "..." },
  "config": { "prompt": "...", "llm": {...} }
}
```

### 3. Conditional Edge Structure

**Before** (simple string):
```json
{
  "source": "keyword-review",
  "target": "topic-generation",
  "condition": "approve"
}
```

**After** (structured object):
```json
{
  "source": "keyword-review",
  "target": "topic-generation",
  "condition": {
    "field": "action",
    "operator": "equals",
    "value": "approve"
  }
}
```

## Validation Rules (LangGraph)

### Node Type Requirements

| Node Type | Required in `config` | Notes |
|-----------|---------------------|-------|
| `llm` | `prompt` | LLM settings optional (uses defaults) |
| `agent` | `tools` OR `prompt` | At least one required |
| `tool` | `toolName` | Tool identifier |
| `code` | `code` | Code to execute |
| `hitl` | `instructions` | Human review instructions |
| `start` | None | Always valid |
| `end` | None | Always valid |

### Edge Requirements

- **Basic edges**: `source`, `target`
- **Conditional edges**: Must have `condition` object with:
  - `field`: State field to check
  - `operator`: Comparison operator (`equals`, `contains`, `greaterThan`, etc.)
  - `value`: (optional) Value to compare against

## Files Modified

1. ✅ `src/services/LangGraphWorkflowService.js` - Added `validateWorkflow()` method
2. ✅ `src/services/WorkflowService.js` - Switched to LangGraph validation
3. ✅ `workflows/blog-post-generation-workflow.json` - Fixed all node and edge structures

## Testing

```bash
# Start server
node server.js

# Look for this log:
🔍 WorkflowService initialized: Using LangGraph validation (legacy LangChain validation disabled)

# Test workflow creation
curl -X POST http://localhost:8000/api/workflows/create-direct \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d @workflows/blog-post-generation-workflow.json

# Should return: {"success": true, "workflow": {...}}
```

## Benefits of LangGraph Validation

1. **Accurate**: Validates exactly what LangGraph StateGraph expects
2. **Comprehensive**: Checks graph structure (cycles, disconnected nodes)
3. **Helpful warnings**: Identifies potential issues without failing validation
4. **Metadata**: Returns node counts, cycle detection, HITL count

## Next Steps

1. ✅ Validation passes
2. ⏳ Test workflow execution with real API keys
3. ⏳ Test HITL approval/rejection flows
4. ⏳ Test rejection loops (verify cycles work correctly)
