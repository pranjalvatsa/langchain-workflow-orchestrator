#!/usr/bin/env node

/**
 * Demo script for Customer Offer Prediction Workflow
 * This script demonstrates the complete 4-step workflow integration with Noam
 */

const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';
const API_BASE = `${BASE_URL}/api`;

// Demo configuration
const DEMO_CONFIG = {
  customerId: 'CUST_DEMO_12345',
  assignee: 'demo-user@example.com',
  workflowName: 'Demo: Customer Offer Prediction'
};

// Mock user token for demo (in real app, this would come from authentication)
const DEMO_TOKEN = 'demo-jwt-token';

class CustomerOfferWorkflowDemo {
  constructor() {
    this.executionId = null;
    this.taskId = null;
  }

  async runDemo() {
    console.log('🚀 Starting Customer Offer Prediction Workflow Demo\n');
    console.log('=' * 60);
    
    try {
      // Step 1: Start the workflow
      await this.startWorkflow();
      
      // Step 2: Monitor workflow progress
      await this.monitorWorkflow();
      
      // Step 3: Simulate human approval
      await this.simulateHumanApproval();
      
      // Step 4: Check final results
      await this.checkFinalResults();
      
      console.log('\n✅ Demo completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Demo failed:', error.message);
      if (error.response?.data) {
        console.error('Error details:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }

  async startWorkflow() {
    console.log('📋 Step 1: Starting Customer Offer Workflow');
    console.log(`Customer ID: ${DEMO_CONFIG.customerId}`);
    console.log(`Assignee: ${DEMO_CONFIG.assignee}\n`);

    try {
      const response = await axios.post(`${API_BASE}/customer-workflows/offer-prediction`, {
        customerId: DEMO_CONFIG.customerId,
        assignee: DEMO_CONFIG.assignee,
        workflowName: DEMO_CONFIG.workflowName
      }, {
        headers: {
          'Authorization': `Bearer ${DEMO_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      this.executionId = response.data.data.executionId;
      console.log(`✅ Workflow started successfully!`);
      console.log(`   Execution ID: ${this.executionId}`);
      console.log(`   Tracking URL: ${response.data.data.trackingUrl}\n`);
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log('⚠️  Server not running. Starting simplified demo...\n');
        await this.runSimplifiedDemo();
        return;
      }
      throw error;
    }
  }

  async monitorWorkflow() {
    console.log('👀 Step 2: Monitoring Workflow Progress');
    
    let attempts = 0;
    const maxAttempts = 12; // 1 minute with 5-second intervals
    
    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(`${API_BASE}/customer-workflows/executions/${this.executionId}/status`, {
          headers: {
            'Authorization': `Bearer ${DEMO_TOKEN}`
          }
        });

        const execution = response.data.data;
        console.log(`   Status: ${execution.status} | Progress: ${execution.progress}%`);
        
        if (execution.currentStep) {
          console.log(`   Current Step: ${execution.currentStep.nodeName}`);
          if (execution.currentStep.taskId) {
            this.taskId = execution.currentStep.taskId;
            console.log(`   📋 Task Created: ${this.taskId}`);
            console.log(`   ⏳ Waiting for human approval...\n`);
            break;
          }
        }
        
        // Show latest steps
        if (execution.latestSteps.length > 0) {
          console.log('   Recent Steps:');
          execution.latestSteps.forEach(step => {
            const status = step.status === 'completed' ? '✅' : 
                          step.status === 'failed' ? '❌' : '⏳';
            console.log(`     ${status} ${step.nodeName} (${step.status})`);
          });
        }
        
        if (execution.status === 'completed' || execution.status === 'failed') {
          break;
        }
        
        console.log('   Checking again in 5 seconds...');
        await this.sleep(5000);
        attempts++;
        
      } catch (error) {
        console.log(`   ⚠️  Error checking status: ${error.message}`);
        break;
      }
    }
  }

  async simulateHumanApproval() {
    if (!this.taskId) {
      console.log('⚠️  No task found for approval simulation');
      return;
    }

    console.log('🧑‍💼 Step 3: Simulating Human Approval');
    console.log(`Task ID: ${this.taskId}`);
    
    // Simulate thinking time
    console.log('   Human reviewer is analyzing the AI recommendation...');
    await this.sleep(3000);
    
    // Random approval decision for demo
    const decision = Math.random() > 0.3 ? 'approved' : 'rejected';
    const feedback = decision === 'approved' 
      ? 'Offer looks good for this customer profile'
      : 'Discount might be too high, please revise';
    
    console.log(`   Decision: ${decision.toUpperCase()}`);
    console.log(`   Feedback: "${feedback}"\n`);

    try {
      const response = await axios.post(`${API_BASE}/customer-workflows/test/mock-approval`, {
        taskId: this.taskId,
        decision: decision,
        feedback: feedback
      }, {
        headers: {
          'Authorization': `Bearer ${DEMO_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ Human approval processed!`);
      console.log(`   Execution ID: ${response.data.data.executionId}\n`);
      
    } catch (error) {
      console.log(`⚠️  Error processing approval: ${error.message}`);
    }
  }

  async checkFinalResults() {
    console.log('📊 Step 4: Checking Final Results');
    
    if (!this.executionId) {
      console.log('⚠️  No execution ID available');
      return;
    }

    await this.sleep(2000); // Wait for workflow to complete
    
    try {
      const response = await axios.get(`${API_BASE}/customer-workflows/executions/${this.executionId}/status`, {
        headers: {
          'Authorization': `Bearer ${DEMO_TOKEN}`
        }
      });

      const execution = response.data.data;
      console.log(`   Final Status: ${execution.status}`);
      console.log(`   Progress: ${execution.progress}%`);
      console.log(`   Duration: ${execution.metrics.duration || 'N/A'}ms`);
      
      if (execution.outputs) {
        console.log('   Final Output:');
        console.log(JSON.stringify(execution.outputs, null, 4));
      }
      
      console.log('\n📋 Workflow Summary:');
      console.log(`   - Customer Data: ✅ Retrieved`);
      console.log(`   - AI Prediction: ✅ Generated`);
      console.log(`   - Human Review: ✅ Completed`);
      console.log(`   - Final Decision: ${execution.outputs?.finalDecision || 'Unknown'}`);
      
    } catch (error) {
      console.log(`⚠️  Error getting final results: ${error.message}`);
    }
  }

  async runSimplifiedDemo() {
    console.log('🔄 Running Simplified Demo (Server Offline Mode)\n');
    
    // Simulate the 4-step workflow
    console.log('📋 Step 1: START NODE');
    console.log('   ✅ Workflow initialized');
    console.log(`   📥 Input: Customer ID = ${DEMO_CONFIG.customerId}\n`);
    
    await this.sleep(1000);
    
    console.log('🔗 Step 2: CUSTOMER DATA API NODE');
    console.log('   ✅ Mock customer data retrieved');
    console.log('   📊 Customer Profile:');
    console.log('      - Total Spent: $2,949.97');
    console.log('      - Favorite Category: Electronics');
    console.log('      - Recent Purchase: iPhone 15 Pro\n');
    
    await this.sleep(1500);
    
    console.log('🤖 Step 3: AI OFFER PREDICTION NODE');
    console.log('   ✅ OpenAI analysis completed');
    console.log('   🎯 Recommended Offer:');
    console.log('      - Product: AirPods Max');
    console.log('      - Discount: 15%');
    console.log('      - Confidence: 87%');
    console.log('      - Reasoning: Based on premium electronics preference\n');
    
    await this.sleep(1500);
    
    console.log('🧑‍💼 Step 4: HUMAN APPROVAL NODE');
    console.log('   📋 Task created in Noam app');
    console.log('   ⏳ Waiting for human reviewer...');
    
    await this.sleep(2000);
    
    const decision = 'approved';
    console.log(`   ✅ Decision: ${decision.toUpperCase()}`);
    console.log('   💬 Feedback: "Great recommendation for this customer!"');
    console.log('\n🎉 Workflow completed successfully!');
    console.log('   📦 Offer will be sent to customer');
    console.log('   📊 Analytics data recorded for future improvements');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage examples and help
function showUsage() {
  console.log(`
🎯 Customer Offer Prediction Workflow Demo

USAGE:
  node demo.js [options]

OPTIONS:
  --help, -h     Show this help message
  --customer-id  Set custom customer ID (default: CUST_DEMO_12345)
  --assignee     Set task assignee (default: demo-user@example.com)

EXAMPLES:
  node demo.js
  node demo.js --customer-id CUST_999 --assignee john@company.com

API ENDPOINTS TESTED:
  POST /api/customer-workflows/offer-prediction    # Start workflow
  GET  /api/customer-workflows/executions/:id/status  # Monitor progress  
  POST /api/customer-workflows/test/mock-approval     # Simulate approval
  POST /api/customer-workflows/webhooks/noam-task     # Noam webhook

WORKFLOW STEPS:
  1. 🚀 START NODE         - Initialize with customer ID
  2. 🔗 API NODE          - Fetch customer purchase data (mock)
  3. 🤖 LLM NODE          - Generate AI offer prediction
  4. 🧑‍💼 HUMAN APPROVAL   - Create task in Noam for approval

INTEGRATION POINTS:
  - LangChain/OpenAI for AI predictions
  - Noam app for human task management
  - MongoDB for workflow execution tracking
  - Socket.IO for real-time updates
`);
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }
  
  // Parse custom arguments
  const customerIdIndex = args.indexOf('--customer-id');
  if (customerIdIndex !== -1 && args[customerIdIndex + 1]) {
    DEMO_CONFIG.customerId = args[customerIdIndex + 1];
  }
  
  const assigneeIndex = args.indexOf('--assignee');
  if (assigneeIndex !== -1 && args[assigneeIndex + 1]) {
    DEMO_CONFIG.assignee = args[assigneeIndex + 1];
  }
  
  const demo = new CustomerOfferWorkflowDemo();
  await demo.runDemo();
}

// Run demo if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = CustomerOfferWorkflowDemo;