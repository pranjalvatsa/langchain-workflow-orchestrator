#!/usr/bin/env node

/**
 * Test Script for LangChain Workflow Orchestrator API
 * Usage: node test-api.js
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BASE_URL = 'https://langchain-workflow-orchestrator.onrender.com';
let accessToken = '';

// Test configuration
const testUser = {
  email: 'test@noamapp.com',
  password: 'TestPassword123',
  firstName: 'Test',
  lastName: 'User',
  noamUserId: 'noam_test_user'
};

const testCustomer = {
  customerId: 'customer_test_123'
};

// Utility function for API calls
async function apiCall(endpoint, method = 'GET', body = null, auth = true) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  
  const options = {
    method,
    headers,
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  console.log(`\n🔗 ${method} ${url}`);
  if (body) console.log('📤 Body:', JSON.stringify(body, null, 2));
  
  try {
    const response = await fetch(url, options);
    const result = await response.json();
    
    console.log(`📊 Status: ${response.status}`);
    console.log('📥 Response:', JSON.stringify(result, null, 2));
    
    return { response, result, status: response.status };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { error: error.message };
  }
}

// Test functions
async function testHealthCheck() {
  console.log('\n🏥 Testing Health Check...');
  return await apiCall('/health', 'GET', null, false);
}

async function testRegisterUser() {
  console.log('\n👤 Testing User Registration...');
  const result = await apiCall('/api/auth/register', 'POST', testUser, false);
  
  if (result.result && result.result.success) {
    accessToken = result.result.data.tokens.accessToken;
    console.log('✅ Registration successful, access token saved');
  }
  
  return result;
}

async function testLogin() {
  console.log('\n🔐 Testing User Login...');
  const result = await apiCall('/api/auth/login', 'POST', {
    email: testUser.email,
    password: testUser.password
  }, false);
  
  if (result.result && result.result.success) {
    accessToken = result.result.data.tokens.accessToken;
    console.log('✅ Login successful, access token saved');
  }
  
  return result;
}

async function testStartWorkflow() {
  console.log('\n🚀 Testing Start Customer Offer Workflow...');
  const result = await apiCall('/api/customer-workflows/offer-prediction', 'POST', {
    customerId: testCustomer.customerId,
    assignee: 'test_assignee',
    workflowName: 'Test Customer Offer Generation'
  });
  
  return result;
}

async function testGetWorkflowStatus(executionId) {
  console.log('\n📊 Testing Get Workflow Status...');
  return await apiCall(`/api/customer-workflows/status/${executionId}`);
}

async function testMockApproval(taskId) {
  console.log('\n✅ Testing Mock Approval...');
  return await apiCall('/api/customer-workflows/test/mock-approval', 'POST', {
    taskId: taskId,
    decision: 'approved',
    feedback: 'Test approval from API test script'
  });
}

async function testNoamWebhook(taskId, executionId) {
  console.log('\n🔄 Testing Noam Webhook...');
  return await apiCall('/api/customer-workflows/webhooks/noam-task', 'POST', {
    taskId: taskId,
    status: 'completed',
    decision: 'approved',
    feedback: 'Approved via webhook test',
    completedBy: 'test_user',
    completedAt: new Date().toISOString(),
    workflowExecutionId: executionId
  });
}

// Main test sequence
async function runAllTests() {
  console.log('🧪 Starting LangChain Workflow Orchestrator API Tests...');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  
  try {
    // 1. Health check
    await testHealthCheck();
    
    // 2. Try to register user (might fail if already exists)
    let registrationResult = await testRegisterUser();
    
    // 3. If registration fails, try login
    if (!registrationResult.result || !registrationResult.result.success) {
      console.log('\n📝 Registration failed (user might exist), trying login...');
      await testLogin();
    }
    
    // 4. Start workflow
    const workflowResult = await testStartWorkflow();
    
    if (!workflowResult.result || !workflowResult.result.success) {
      console.log('❌ Workflow start failed, stopping tests');
      return;
    }
    
    const executionId = workflowResult.result.data.executionId;
    console.log(`✅ Workflow started with execution ID: ${executionId}`);
    
    // 5. Check workflow status
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    const statusResult = await testGetWorkflowStatus(executionId);
    
    if (statusResult.result && statusResult.result.success) {
      const status = statusResult.result.data;
      console.log(`📈 Workflow Status: ${status.status}, Progress: ${status.progress}%`);
      
      // 6. If waiting for approval, test mock approval
      if (status.status === 'waiting' && status.currentStep && status.currentStep.taskId) {
        const taskId = status.currentStep.taskId;
        console.log(`⏳ Workflow waiting for approval, task ID: ${taskId}`);
        
        // Wait a bit more for the task to be fully created
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test webhook
        await testNoamWebhook(taskId, executionId);
        
        // Check final status
        await new Promise(resolve => setTimeout(resolve, 2000));
        await testGetWorkflowStatus(executionId);
      }
    }
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run tests
if (require.main === module) {
  runAllTests();
}

module.exports = {
  apiCall,
  testHealthCheck,
  testRegisterUser,
  testLogin,
  testStartWorkflow,
  testGetWorkflowStatus,
  testMockApproval,
  testNoamWebhook,
  BASE_URL
};