#!/usr/bin/env node

/**
 * Create Weather Summary Workflow Template
 * Directly saves to MongoDB without API calls
 */

const mongoose = require('mongoose');
const WorkflowTemplate = require('./src/models/WorkflowTemplate');
const User = require('./src/models/User');
require('dotenv').config();

const weatherWorkflowTemplate = {
  templateId: 'weather-summary-v3',
  name: 'Weather Summary Workflow v3',
  description: 'Enhanced weather workflow - Fetch current weather data for any city and generate AI-powered friendly summary using OpenWeatherMap API and GPT-4o-mini',
  version: '1.0.0',
  
  nodes: [
    {
      id: 'start-1',
      type: 'start',
      position: { x: 100, y: 100 },
      data: {
        label: 'City Input',
        description: 'Workflow starts with city name input',
        parameters: {
          cityName: {
            type: 'string',
            required: true,
            default: 'Mumbai',
            description: 'Name of the city to get weather for'
          }
        }
      }
    },
    {
      id: 'weather-api-2',
      type: 'tool',
      position: { x: 350, y: 100 },
      data: {
        label: 'Fetch Weather Data',
        description: 'Call OpenWeatherMap API to get current weather conditions',
        tool: 'api_caller',
        parameters: {
          url: 'https://api.openweathermap.org/data/2.5/weather?q={{input.cityName}}&units=metric&appid=43ba63dbdd16b07c99f174720385a571',
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000,
          retries: 2
        }
      }
    },
    {
      id: 'ai-agent-3',
      type: 'llm',
      position: { x: 600, y: 100 },
      data: {
        label: 'AI Weather Summarizer',
        description: 'Generate user-friendly weather summary using AI',
        tool: 'llm_chat',
        parameters: {
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 400,
          systemPrompt: 'You are a friendly weather assistant. Analyze weather data and create clear, helpful summaries that are easy to understand. Focus on what people need to know: current conditions, temperature, comfort level, and practical advice.',
          userPrompt: 'Please create a friendly weather summary for {{input.cityName}} based on this data: {{weather-api-2.output}}. Include: current temperature, feels-like temperature, weather conditions, humidity, and a brief practical advice for the day.'
        }
      }
    },
    {
      id: 'response-4',
      type: 'end',
      position: { x: 850, y: 100 },
      data: {
        label: 'Weather Summary Response',
        description: 'Return formatted weather summary to user',
        output: {
          city: '{{input.cityName}}',
          summary: '{{ai-agent-3.output}}',
          timestamp: '{{timestamp}}',
          source: 'OpenWeatherMap API'
        }
      }
    }
  ],
  
  edges: [
    {
      id: 'e1-2',
      source: 'start-1',
      target: 'weather-api-2'
    },
    {
      id: 'e2-3',
      source: 'weather-api-2',
      target: 'ai-agent-3'
    },
    {
      id: 'e3-4',
      source: 'ai-agent-3',
      target: 'response-4'
    }
  ],
  
  configuration: {
    maxConcurrentExecutions: 5,
    timeoutMinutes: 10,
    retryPolicy: 'exponential',
    inputSchema: {
      cityName: {
        type: 'string',
        required: true,
        description: 'City name to get weather for'
      }
    },
    triggers: [
      {
        eventType: 'manual',
        enabled: true,
        priority: 'normal'
      },
      {
        eventType: 'api_request',
        enabled: true,
        priority: 'normal'
      }
    ]
  },
  
  triggers: [
    {
      type: 'manual',
      description: 'Manual execution with city name'
    },
    {
      type: 'api',
      description: 'API endpoint for weather requests'
    }
  ],
  
  metadata: {
    category: 'automation',
    tags: ['weather', 'ai', 'api', 'automation', 'openweathermap', 'gpt4o', 'enhanced'],
    complexity: 'medium',
    estimatedRuntime: '5-15 seconds',
    isPublic: true,
    featured: false,
    toolsUsed: ['api_caller', 'llm_chat'],
    integrations: ['OpenWeatherMap API', 'OpenAI GPT-4o-mini'],
    nodeCount: 4,
    edgeCount: 3
  }
};

async function createWeatherWorkflow() {
  try {
    console.log('🌤️  Creating Weather Summary Workflow...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/langchain-workflows');
    console.log('✅ Connected to MongoDB');

    // Get or create system user
    let systemUser = await User.findOne({ email: 'system@langchain-orchestrator.com' });
    if (!systemUser) {
      systemUser = new User({
        email: 'system@langchain-orchestrator.com',
        name: 'Weather Workflow Creator',
        role: 'admin',
        isActive: true,
        noamAccountId: 'weather-system',
        noamUserId: 'weather-creator'
      });
      await systemUser.save();
      console.log('✅ Created system user');
    }

    // Check if workflow already exists
    let template = await WorkflowTemplate.findOne({ templateId: weatherWorkflowTemplate.templateId });
    
    if (template) {
      console.log('⚠️  Template exists, updating...');
      Object.assign(template, weatherWorkflowTemplate);
      await template.save();
    } else {
      console.log('✨ Creating new weather template...');
      template = new WorkflowTemplate({
        ...weatherWorkflowTemplate,
        createdBy: systemUser._id,
        status: 'published'
      });
      await template.save();
    }

    console.log('🌤️  Weather Workflow v3 Created Successfully! 🎉');
    console.log('✅ Enhanced weather workflow template saved successfully!');
    console.log(`   Template ID: ${template.templateId}`);
    console.log(`   MongoDB ID: ${template._id}`);
    console.log(`   Name: ${template.name}`);
    console.log(`   Status: ${template.status}`);
    console.log(`   Category: ${template.metadata.category}`);
    console.log(`   Tools Used: ${template.metadata.toolsUsed.join(', ')}`);

    console.log('\n🧪 Test the workflow:');
    console.log('====================');
    console.log('curl -X POST http://localhost:8000/api/universal/workflows/execute \\');
    console.log('  -H "X-API-Key: YOUR_API_KEY" \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"templateId":"weather-summary-v3","input":{"cityName":"Mumbai"}}\'');

    console.log('\n🌐 Production Test:');
    console.log('==================');
    console.log('curl -X POST https://langchain-workflow-orchestrator.onrender.com/api/universal/workflows/execute \\');
    console.log('  -H "X-API-Key: lwo_5c73d37ba4a2843408fc231508ee0f2f_55644d7ad59d2bc1abed33e5a17f34f3fdd03a0206e954259979fa6d4722d622" \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"templateId":"weather-summary-v3","input":{"cityName":"London"}}\'');

    console.log('\n🌍 Try different cities:');
    console.log('========================');
    console.log('• Mumbai: {"cityName": "Mumbai"}');
    console.log('• London: {"cityName": "London"}');
    console.log('• New York: {"cityName": "New York"}');
    console.log('• Tokyo: {"cityName": "Tokyo"}');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Failed to create weather workflow:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createWeatherWorkflow();
}

module.exports = createWeatherWorkflow;