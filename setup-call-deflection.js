#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Call Deflection Workflow...\n');

// Step 1: Check if we have the required files
const requiredFiles = [
  'src/services/LangChainService.js',
  'src/routes/webhooks.js',
  'src/services/WorkflowExecutionService.js'
];

console.log('📋 Checking required files...');
for (const file of requiredFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} - Found`);
  } else {
    console.log(`❌ ${file} - Missing`);
  }
}

// Step 2: Environment variables guidance
console.log('\n📝 Environment Variables Setup:');
console.log('Add these to your .env file or environment:');
console.log('');
console.log('# Call Deflection Workflow');
console.log('CALL_DEFLECTION_WORKFLOW_ID=call-deflection-v1');
console.log('');
console.log('# Optional: If you have these services');
console.log('# NOAM_APP_URL=https://your-noam-app.com');
console.log('# AGENT_PLATFORM_API_URL=https://your-agent-platform.com/api');
console.log('# CALL_SYSTEM_API_URL=https://your-call-system.com/api');

// Step 3: Create .env template if it doesn't exist
if (!fs.existsSync('.env')) {
  console.log('\n📄 Creating .env template...');
  const envTemplate = `# LangChain Workflow Orchestrator Environment Variables

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/langchain-workflows

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# JWT Configuration
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# Call Deflection Workflow
CALL_DEFLECTION_WORKFLOW_ID=call-deflection-v1

# Optional External Integrations
# NOAM_APP_URL=https://your-noam-app.com
# AGENT_PLATFORM_API_URL=https://your-agent-platform.com/api
# CALL_SYSTEM_API_URL=https://your-call-system.com/api

# Webhook Security (optional)
# WEBHOOK_SECRET=your-webhook-secret
# NOAM_WEBHOOK_SECRET=your-noam-webhook-secret

# Server Configuration
PORT=8000
NODE_ENV=development
`;

  fs.writeFileSync('.env', envTemplate);
  console.log('✅ .env template created');
  console.log('⚠️  Please update the API keys and URLs in .env file');
} else {
  console.log('\n📄 .env file already exists - please add the Call Deflection variables');
}

// Step 4: Package.json scripts
console.log('\n📦 Checking package.json scripts...');
if (fs.existsSync('package.json')) {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  const newScripts = {
    'import-call-deflection': 'node import-call-deflection.js',
    'test-call-deflection': 'node test-call-deflection.js'
  };

  let scriptsAdded = false;
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  for (const [scriptName, scriptCommand] of Object.entries(newScripts)) {
    if (!packageJson.scripts[scriptName]) {
      packageJson.scripts[scriptName] = scriptCommand;
      scriptsAdded = true;
      console.log(`✅ Added script: ${scriptName}`);
    } else {
      console.log(`✅ Script already exists: ${scriptName}`);
    }
  }

  if (scriptsAdded) {
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    console.log('📦 package.json updated with new scripts');
  }
} else {
  console.log('❌ package.json not found');
}

// Step 5: Instructions
console.log('\n🎯 Next Steps:');
console.log('==============');
console.log('');
console.log('1. Update your .env file with the correct API keys');
console.log('2. Import the Call Deflection workflow template:');
console.log('   npm run import-call-deflection');
console.log('');
console.log('3. Start your server and test the workflow:');
console.log('   npm start');
console.log('   npm run test-call-deflection');
console.log('');
console.log('4. Integration endpoints:');
console.log('   POST /api/webhooks/call-transcription  (production use)');
console.log('   POST /api/webhooks/call-test           (testing)');
console.log('   GET  /api/webhooks/call-status/:callId (status check)');
console.log('');

// Step 6: Webhook integration guide
console.log('🔗 Webhook Integration Guide:');
console.log('=============================');
console.log('');
console.log('To integrate with your call system:');
console.log('');
console.log('1. Configure your call transcription service to POST to:');
console.log('   https://your-domain.com/api/webhooks/call-transcription');
console.log('');
console.log('2. Required payload format:');
console.log('   {');
console.log('     "callId": "unique-call-id",');
console.log('     "transcription": "customer speech as text",');
console.log('     "callerInfo": {');
console.log('       "phone": "+1234567890",');
console.log('       "customerId": "CUST_001",');
console.log('       "name": "Customer Name",');
console.log('       "tier": "gold"');
console.log('     },');
console.log('     "audioUrl": "optional-audio-file-url",');
console.log('     "metadata": {}');
console.log('   }');
console.log('');

// Step 7: Testing guide
console.log('🧪 Testing Guide:');
console.log('================');
console.log('');
console.log('Use the test endpoint to simulate different scenarios:');
console.log('');
console.log('Simple Question (auto-resolve):');
console.log('  curl -X POST your-domain.com/api/webhooks/call-test \\');
console.log('    -H "Content-Type: application/json" \\');
console.log('    -d \'{"scenario": "simple_question"}\'');
console.log('');
console.log('Complex Issue (human review):');
console.log('  curl -X POST your-domain.com/api/webhooks/call-test \\');
console.log('    -H "Content-Type: application/json" \\');
console.log('    -d \'{"scenario": "complex_issue"}\'');
console.log('');
console.log('Angry Customer (escalation):');
console.log('  curl -X POST your-domain.com/api/webhooks/call-test \\');
console.log('    -H "Content-Type: application/json" \\');
console.log('    -d \'{"scenario": "angry_customer"}\'');
console.log('');

console.log('✨ Setup complete! Follow the next steps above to get started.');
console.log('');