#!/usr/bin/env node

/**
 * Production API Key Generation Script
 * Generates API keys for Noam integration on the production environment
 */

const axios = require('axios');

const PRODUCTION_URL = 'https://langchain-workflow-orchestrator.onrender.com';
const API_BASE = `${PRODUCTION_URL}/api`;

// Configuration for production API key
const productionUser = {
  email: 'noam-production@yourcompany.com',
  password: 'ProductionPassword123!',
  firstName: 'Noam',
  lastName: 'Production',
  noamUserId: 'noam_production_user'
};

const apiKeyConfig = {
  name: 'Noam Production Integration Key',
  description: 'API key for Noam app to access Universal Workflow Engine in production',
  noamAccountId: 'noam_production_account',
  expiresIn: '1y'
};

async function generateProductionApiKey() {
  console.log('🚀 Generating API Key for Production Environment\n');
  
  try {
    // Step 1: Register user in production (or login if exists)
    console.log('1️⃣ Registering/Login user in production...');
    let accessToken;
    
    try {
      const registerResponse = await axios.post(`${API_BASE}/auth/register`, productionUser);
      if (registerResponse.data.success) {
        accessToken = registerResponse.data.data.tokens.accessToken;
        console.log(`✅ User registered: ${productionUser.email}`);
      }
    } catch (registerError) {
      if (registerError.response?.status === 400 && registerError.response.data.message?.includes('already exists')) {
        // User exists, try to login
        console.log('   User already exists, attempting login...');
        const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
          email: productionUser.email,
          password: productionUser.password
        });
        
        if (loginResponse.data.success) {
          accessToken = loginResponse.data.data.tokens.accessToken;
          console.log(`✅ User logged in: ${productionUser.email}`);
        }
      } else {
        throw registerError;
      }
    }

    if (!accessToken) {
      throw new Error('Failed to get access token');
    }

    // Step 2: Generate API key in production
    console.log('\n2️⃣ Generating API key in production...');
    const apiKeyResponse = await axios.post(`${API_BASE}/keys/generate`, apiKeyConfig, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (apiKeyResponse.data.success) {
      const apiKeyData = apiKeyResponse.data.data;
      
      console.log('✅ Production API key generated successfully!\n');
      console.log('📋 API Key Details:');
      console.log(`   Name: ${apiKeyData.name}`);
      console.log(`   Key ID: ${apiKeyData.keyId}`);
      console.log(`   Preview: ${apiKeyData.keyPreview}`);
      console.log(`   Expires: ${apiKeyData.expiresAt}`);
      console.log(`   Noam Account: ${apiKeyData.noamAccountId}\n`);
      
      console.log('🔑 PRODUCTION API KEY (save this securely):');
      console.log(`${apiKeyData.apiKey}\n`);
      
      console.log('🎯 Integration Instructions for Noam:');
      console.log('1. Store this API key securely in Noam environment variables');
      console.log('2. Use it with production Universal Workflow Engine:');
      console.log(`   Base URL: ${PRODUCTION_URL}/api`);
      console.log('3. Header: X-API-Key: [your-production-api-key]');
      console.log('\n📝 Example usage:');
      console.log(`curl -X GET ${PRODUCTION_URL}/api/universal/tools \\`);
      console.log(`  -H "X-API-Key: ${apiKeyData.apiKey}"`);
      
      console.log('\n🔧 Available endpoints:');
      apiKeyData.integration.endpoints && Object.entries(apiKeyData.integration.endpoints).forEach(([key, endpoint]) => {
        console.log(`   ${key}: ${PRODUCTION_URL}${endpoint}`);
      });
      
      return apiKeyData.apiKey;
      
    } else {
      throw new Error('Failed to generate API key');
    }

  } catch (error) {
    console.error('\n❌ Error generating production API key:');
    console.error(`Message: ${error.response?.data?.message || error.message}`);
    
    if (error.response?.status === 404) {
      console.error('\n💡 This might indicate that:');
      console.error('1. The production server is not running');
      console.error('2. The API key generation endpoint is not deployed');
      console.error('3. The URL is incorrect');
      console.error('\nPlease check your production deployment.');
    }
    
    if (error.response?.data) {
      console.error('Full response:', JSON.stringify(error.response.data, null, 2));
    }
    
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  generateProductionApiKey();
}

module.exports = { generateProductionApiKey };