const https = require('https');

class CallDeflectionTester {
  constructor(baseUrl = 'https://langchain-workflow-orchestrator.onrender.com') {
    this.baseUrl = baseUrl;
  }

  async makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CallDeflectionTester/1.0'
        }
      };

      if (data && method !== 'GET') {
        const postData = JSON.stringify(data);
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: parsed
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: responseData
            });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (data && method !== 'GET') {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  async testSimpleQuestion() {
    console.log('\n🧪 Testing Simple Question Scenario...');
    
    const testData = {
      scenario: 'simple_question'
    };

    try {
      const response = await this.makeRequest('/api/webhooks/call-test', 'POST', testData);
      
      if (response.status === 200) {
        console.log('✅ Simple question test successful');
        console.log(`Test Call ID: ${response.data.data?.testCallId}`);
        console.log(`Execution ID: ${response.data.data?.executionId}`);
        return response.data.data;
      } else {
        console.log('❌ Simple question test failed');
        console.log(`Status: ${response.status}`);
        console.log(`Response:`, response.data);
        return null;
      }
    } catch (error) {
      console.error('❌ Simple question test error:', error.message);
      return null;
    }
  }

  async testComplexIssue() {
    console.log('\n🧪 Testing Complex Issue Scenario...');
    
    const testData = {
      scenario: 'complex_issue'
    };

    try {
      const response = await this.makeRequest('/api/webhooks/call-test', 'POST', testData);
      
      if (response.status === 200) {
        console.log('✅ Complex issue test successful');
        console.log(`Test Call ID: ${response.data.data?.testCallId}`);
        console.log(`Execution ID: ${response.data.data?.executionId}`);
        return response.data.data;
      } else {
        console.log('❌ Complex issue test failed');
        console.log(`Status: ${response.status}`);
        console.log(`Response:`, response.data);
        return null;
      }
    } catch (error) {
      console.error('❌ Complex issue test error:', error.message);
      return null;
    }
  }

  async testAngryCustomer() {
    console.log('\n🧪 Testing Angry Customer Scenario...');
    
    const testData = {
      scenario: 'angry_customer'
    };

    try {
      const response = await this.makeRequest('/api/webhooks/call-test', 'POST', testData);
      
      if (response.status === 200) {
        console.log('✅ Angry customer test successful');
        console.log(`Test Call ID: ${response.data.data?.testCallId}`);
        console.log(`Execution ID: ${response.data.data?.executionId}`);
        return response.data.data;
      } else {
        console.log('❌ Angry customer test failed');
        console.log(`Status: ${response.status}`);
        console.log(`Response:`, response.data);
        return null;
      }
    } catch (error) {
      console.error('❌ Angry customer test error:', error.message);
      return null;
    }
  }

  async checkCallStatus(callId) {
    console.log(`\n📊 Checking status for call: ${callId}`);
    
    try {
      const response = await this.makeRequest(`/api/webhooks/call-status/${callId}`, 'GET');
      
      if (response.status === 200) {
        console.log('✅ Status check successful');
        console.log(`Status: ${response.data.data?.status}`);
        console.log(`Stage: ${response.data.data?.stage}`);
        console.log(`Progress: ${response.data.data?.progress}%`);
        return response.data.data;
      } else {
        console.log('❌ Status check failed');
        console.log(`Status: ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error('❌ Status check error:', error.message);
      return null;
    }
  }

  async testDirectTranscription() {
    console.log('\n🧪 Testing Direct Call Transcription...');
    
    const testData = {
      callId: `DIRECT_TEST_${Date.now()}`,
      transcription: "Hello, I'm having trouble with my recent order. The tracking says it was delivered but I never received it. Can you help me figure out what happened?",
      callerInfo: {
        phone: "+1234567890",
        customerId: "CUST_DIRECT_001", 
        name: "Test Customer",
        tier: "gold"
      },
      metadata: {
        testType: 'direct_transcription',
        timestamp: new Date().toISOString()
      }
    };

    try {
      const response = await this.makeRequest('/api/webhooks/call-transcription', 'POST', testData);
      
      if (response.status === 200) {
        console.log('✅ Direct transcription test successful');
        console.log(`Call ID: ${testData.callId}`);
        console.log(`Execution ID: ${response.data.data?.executionId}`);
        return { ...response.data.data, testCallId: testData.callId };
      } else {
        console.log('❌ Direct transcription test failed');
        console.log(`Status: ${response.status}`);
        console.log(`Response:`, response.data);
        return null;
      }
    } catch (error) {
      console.error('❌ Direct transcription test error:', error.message);
      return null;
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Call Deflection Workflow Tests...');
    console.log(`Testing against: ${this.baseUrl}`);
    
    const results = {
      simpleQuestion: null,
      complexIssue: null,
      angryCustomer: null,
      directTranscription: null,
      statusChecks: []
    };

    // Test all scenarios
    results.simpleQuestion = await this.testSimpleQuestion();
    results.complexIssue = await this.testComplexIssue();
    results.angryCustomer = await this.testAngryCustomer();
    results.directTranscription = await this.testDirectTranscription();

    // Check statuses for successful tests
    const callIds = [
      results.simpleQuestion?.testCallId,
      results.complexIssue?.testCallId,
      results.angryCustomer?.testCallId,
      results.directTranscription?.testCallId
    ].filter(Boolean);

    for (const callId of callIds) {
      const status = await this.checkCallStatus(callId);
      if (status) {
        results.statusChecks.push({ callId, status });
      }
    }

    // Summary
    console.log('\n📋 Test Summary:');
    console.log('================');
    console.log(`Simple Question: ${results.simpleQuestion ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Complex Issue: ${results.complexIssue ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Angry Customer: ${results.angryCustomer ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Direct Transcription: ${results.directTranscription ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Status Checks: ${results.statusChecks.length}/${callIds.length} successful`);

    const totalTests = 4;
    const passedTests = [
      results.simpleQuestion,
      results.complexIssue,
      results.angryCustomer,
      results.directTranscription
    ].filter(Boolean).length;

    console.log(`\nOverall: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);

    if (passedTests === totalTests) {
      console.log('🎉 All tests passed! Call Deflection workflow is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Check the logs above for details.');
    }

    return results;
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new CallDeflectionTester();
  tester.runAllTests().then(() => {
    console.log('\n✨ Testing complete!');
  }).catch((error) => {
    console.error('❌ Testing failed:', error);
  });
}

module.exports = CallDeflectionTester;