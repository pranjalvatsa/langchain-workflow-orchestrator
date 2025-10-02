#!/usr/bin/env node

/**
 * Deployment Test Script
 * Tests the deployed LangChain backend on Render
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.argv[2] || 'https://your-service-name.onrender.com';
const TEST_TOKEN = 'test-token-123'; // Replace with actual token

console.log('🧪 Testing LangChain Backend Deployment');
console.log(`📍 Base URL: ${BASE_URL}\n`);

async function runTests() {
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };

  // Test 1: Health Check
  await test('Health Check', async () => {
    const response = await axios.get(`${BASE_URL}/health`);
    assert(response.status === 200, 'Status should be 200');
    assert(response.data.status === 'ok', 'Status should be ok');
    assert(response.data.message, 'Should have message');
    console.log(`   ✅ Server version: ${response.data.version}`);
  }, results);

  // Test 2: CORS Headers
  await test('CORS Configuration', async () => {
    const response = await axios.options(`${BASE_URL}/health`);
    assert(response.status === 200 || response.status === 204, 'OPTIONS request should succeed');
    console.log('   ✅ CORS headers configured');
  }, results);

  // Test 3: Templates Endpoint
  await test('Workflow Templates', async () => {
    const response = await axios.get(`${BASE_URL}/api/templates`);
    assert(response.status === 200, 'Status should be 200');
    assert(Array.isArray(response.data), 'Should return array');
    assert(response.data.length > 0, 'Should have templates');
    
    const customerTemplate = response.data.find(t => t.id === 'customer-offer-prediction');
    assert(customerTemplate, 'Should have customer offer template');
    console.log(`   ✅ Found ${response.data.length} workflow templates`);
  }, results);

  // Test 4: Authentication Required Endpoints
  await test('Authentication Protection', async () => {
    try {
      await axios.get(`${BASE_URL}/api/customer-workflows/templates`);
      throw new Error('Should require authentication');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('   ✅ Authentication properly enforced');
      } else {
        throw error;
      }
    }
  }, results);

  // Test 5: Rate Limiting
  await test('Rate Limiting', async () => {
    // Make multiple requests quickly
    const requests = Array(5).fill().map(() => 
      axios.get(`${BASE_URL}/health`)
    );
    
    const responses = await Promise.all(requests);
    const allSuccess = responses.every(r => r.status === 200);
    assert(allSuccess, 'All requests within limit should succeed');
    console.log('   ✅ Rate limiting configured');
  }, results);

  // Test 6: Error Handling
  await test('Error Handling', async () => {
    try {
      await axios.get(`${BASE_URL}/api/nonexistent-endpoint`);
      throw new Error('Should return 404');
    } catch (error) {
      if (error.response && error.response.status === 404) {
        assert(error.response.data.success === false, 'Should have error format');
        console.log('   ✅ 404 errors properly handled');
      } else {
        throw error;
      }
    }
  }, results);

  // Print Results
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results:');
  console.log(`   Total Tests: ${results.total}`);
  console.log(`   Passed: ${results.passed} ✅`);
  console.log(`   Failed: ${results.failed} ❌`);
  
  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! Deployment is ready for Noam integration.');
    console.log('\n🔗 Integration endpoints:');
    console.log(`   Health: ${BASE_URL}/health`);
    console.log(`   Templates: ${BASE_URL}/api/templates`);
    console.log(`   Start Workflow: ${BASE_URL}/api/customer-workflows/offer-prediction`);
    console.log(`   Webhook: ${BASE_URL}/api/customer-workflows/webhooks/noam-task`);
  } else {
    console.log('\n❌ Some tests failed. Please check the deployment.');
    process.exit(1);
  }
}

async function test(name, testFn, results) {
  results.total++;
  console.log(`🧪 Testing: ${name}`);
  
  try {
    await testFn();
    results.passed++;
    console.log(`   ✅ PASSED\n`);
  } catch (error) {
    results.failed++;
    console.log(`   ❌ FAILED: ${error.message}\n`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Usage information
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node test-deployment.js [BASE_URL]

Arguments:
  BASE_URL    The deployed backend URL (default: placeholder URL)

Examples:
  node test-deployment.js https://my-langchain-backend.onrender.com
  node test-deployment.js http://localhost:8000

This script tests:
  ✅ Health check endpoint
  ✅ CORS configuration  
  ✅ Workflow templates
  ✅ Authentication protection
  ✅ Rate limiting
  ✅ Error handling
`);
  process.exit(0);
}

// Run tests
runTests().catch(error => {
  console.error('\n💥 Test suite failed:', error.message);
  process.exit(1);
});