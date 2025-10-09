#!/usr/bin/env node

const fs = require('fs');

// Read the WorkflowExecutionService file
const filePath = './src/services/WorkflowExecutionService.js';
const content = fs.readFileSync(filePath, 'utf8');

// Find all instances of { id: executionId } that should be { executionId: executionId }
const lines = content.split('\n');

console.log('🔍 Finding execution ID field mismatches in WorkflowExecutionService:');
console.log('================================================================');

lines.forEach((line, index) => {
  if (line.includes('{ id: executionId }') || line.includes('{id: executionId}')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});

console.log('\n📝 These should be changed to { executionId: executionId }');
console.log('   to match the model schema we fixed earlier.');