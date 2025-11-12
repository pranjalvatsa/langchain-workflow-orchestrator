# LangGraph Quick Start

## Enable LangGraph

```bash
# .env
USE_LANGGRAPH=true
```

Restart server:
```bash
npm start
```

You should see:
```
🔧 Workflow Execution Engine: LangGraph (Native)
```

## What's Different?

### Architecture

**Before**:
```
Workflow JSON → Custom Graph Traversal → Node Execution
```

**After**:
```
Workflow JSON → LangGraph StateGraph → Node Execution
```

### Code Comparison

#### Custom Engine (Old)
```javascript
// WorkflowExecutionService.js
async executeNodeSequence(nodes, executionState) {
  for (const nodeId of nodes) {
    const result = await this.executeNode(node, context);
    const nextNodes = this.getNextNodes(nodeId, edgeMap, nodeMap, result);
    await this.executeNodeSequence(nextNodes, executionState);
  }
}
```

#### LangGraph (New)
```javascript
// LangGraphWorkflowService.js
async buildStateGraph(workflow) {
  const graph = new StateGraph(StateAnnotation);
  
  workflow.nodes.forEach(node => {
    graph.addNode(node.id, async (state) => {
      return await this.executeNodeInGraph(node, state);
    });
  });
  
  workflow.edges.forEach(edge => {
    if (edge.condition) {
      graph.addConditionalEdges(edge.source, routingFn, routingMap);
    } else {
      graph.addEdge(edge.source, edge.target);
    }
  });
  
  return graph.compile({ checkpointer: this.checkpointer });
}
```

## Testing Checklist

- [ ] Enable `USE_LANGGRAPH=true` in `.env`
- [ ] Restart server
- [ ] Execute a simple workflow (no HITL)
- [ ] Execute workflow with HITL node
- [ ] Approve HITL task via API
- [ ] Verify workflow completes
- [ ] Check logs for errors
- [ ] Test conditional edges
- [ ] Test parallel nodes (if any)

## Common Issues

### Issue: Workflow not completing

**Check**: Look for nodes with no outgoing edges
```javascript
// Add explicit end
graph.addEdge('last-node', END);
```

### Issue: HITL not pausing

**Check**: Node is in `interruptBefore` list
```javascript
const app = graph.compile({
  checkpointer: this.checkpointer,
  interruptBefore: ['human-approval-node'] // Add your HITL node ID
});
```

### Issue: "Execution not found"

**Check**: For production, use PostgresSaver
```javascript
// Development (default)
checkpointer: new MemorySaver()

// Production
checkpointer: new PostgresSaver({
  connectionString: process.env.POSTGRES_CHECKPOINT_URL
})
```

## Key Benefits

1. **Less Code**: ~400 lines removed from WorkflowExecutionService
2. **Native Features**: Streaming, parallel execution, time-travel debugging
3. **Better HITL**: Native checkpointing, no Redis/BullMQ needed
4. **Production Ready**: Battle-tested by LangChain community
5. **Easier Debugging**: LangGraph Studio integration coming soon

## API Unchanged

All existing API calls work exactly the same:

```bash
# Start execution
curl -X POST http://localhost:8000/api/executions \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "workflow-123",
    "inputs": {"test": "data"}
  }'

# Approve HITL
curl -X POST http://localhost:8000/api/human-review/complete \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-123",
    "actionId": "approve",
    "feedback": "Looks good"
  }'
```

## Rollback

If you encounter issues:

```bash
# .env
USE_LANGGRAPH=false
```

Restart server - back to legacy engine.

## Next Steps

1. Test with your workflows
2. Report any issues
3. Consider PostgresSaver for production
4. Explore streaming features
5. Add parallel node execution where possible

## Learn More

- [Full Migration Guide](./LANGGRAPH_MIGRATION_GUIDE.md)
- [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
- [StateGraph API](https://langchain-ai.github.io/langgraph/reference/graphs/)
