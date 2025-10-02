#!/usr/bin/env node

/**
 * Detailed API Diagnostic Test
 * Tests specific endpoints with better error reporting
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BASE_URL = 'https://langchain-workflow-orchestrator.onrender.com';

async function detailedApiTest(endpoint, method = 'GET', body = null, auth = false) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
  };
  
  const options = {
    method,
    headers,
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  console.log(`\n🔍 Testing: ${method} ${endpoint}`);
  if (body) console.log('📤 Request Body:', JSON.stringify(body, null, 2));
  
  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Content-Type: ${contentType}`);
    
    let result;
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      result = await response.text();
    }
    
    console.log('📥 Response:', typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
    return { status: response.status, result, headers: response.headers };
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return { error: error.message };
  }
}

async function runDiagnostics() {
  console.log('🏥 Starting Detailed API Diagnostics...');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  
  // Test 1: Health Check
  await detailedApiTest('/health');
  
  // Test 2: Try a simple GET to auth routes (should return method not allowed, not 500)
  await detailedApiTest('/api/auth/register', 'GET');
  
  // Test 3: Test user registration with minimal data
  await detailedApiTest('/api/auth/register', 'POST', {
    email: 'simple@test.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User'
  });
  
  // Test 4: Test with missing required fields (should give validation error, not 500)
  await detailedApiTest('/api/auth/register', 'POST', {
    email: 'incomplete@test.com'
  });
  
  // Test 5: Test login with non-existent user
  await detailedApiTest('/api/auth/login', 'POST', {
    email: 'nonexistent@test.com',
    password: 'password123'
  });
  
  // Test 6: Check if we can access any protected route without auth
  await detailedApiTest('/api/customer-workflows/status/test-id');
  
  console.log('\n✅ Diagnostics Complete!');
}

runDiagnostics().catch(console.error);