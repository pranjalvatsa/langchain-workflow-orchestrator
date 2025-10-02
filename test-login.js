const https = require('https');

async function testLogin() {
  try {
    console.log('Testing login...');
    
    const postData = JSON.stringify({
      email: 'test1759403259605@example.com', // Use the email from our successful registration
      password: 'password123'
    });

    const options = {
      hostname: 'langchain-workflow-orchestrator.onrender.com',
      port: 443,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        
        console.log('Status:', res.statusCode);
        console.log('Headers:', res.headers);

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          console.log('Raw response:', data);
          
          try {
            const json = JSON.parse(data);
            console.log('Parsed JSON:', JSON.stringify(json, null, 2));
          } catch (e) {
            console.log('Could not parse as JSON');
          }
          resolve(data);
        });
      });

      req.on('error', (error) => {
        console.error('Request error:', error);
        reject(error);
      });

      req.write(postData);
      req.end();
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLogin();