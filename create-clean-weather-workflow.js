require('dotenv').config(    // Create the workflow template with fixed issues
    const template = new WorkflowTemplate({
      name: 'Clean Weather Workflow Fixed',
      description: 'A clean weather workflow with fixed template processing and proper variable resolution',
      category: 'automation',  // Valid enum value
      subcategory: 'weather',
      tags: ['weather', 'api', 'ai', 'clean'],
      templateId: `clean_weather_workflow_${Date.now()}`, // Required unique field
      version: { major: 1, minor: 0, patch: 0 },
      author: testUserId, // Required fieldmongoose = require('mongoose');
const { WorkflowTemplate } = require('./src/models');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const createCleanWeatherWorkflow = async () => {
  try {
    await connectDB();
    
    // Find the user (assuming we have one)
    const testUserId = new mongoose.Types.ObjectId(); // Create a test user ID
    
    // Create the workflow template with fixed issues
    const template = new WorkflowTemplate({
      name: 'Clean Weather Workflow',
      description: 'A clean weather workflow with fixed template processing and proper API parameters',
      version: { major: 1, minor: 0, patch: 0 },
      category: 'weather',
      tags: ['weather', 'api', 'ai', 'clean'],
      isPublic: true,
      authorId: testUserId,
      
      // Nodes - simple array of objects (not JSON strings)
      nodes: [
        {
          id: 'start-1',
          type: 'start',
          position: { x: 100, y: 100 },
          data: {
            label: 'Start',
            description: 'Input parameter for city name',
            parameters: {
              cityName: {
                type: 'string',
                required: true,
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
              url: 'https://api.openweathermap.org/data/2.5/weather?q={{cityName}}&units=metric&appid=43ba63dbdd16b07c99f174720385a571',
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
              systemPrompt: 'You are a friendly weather assistant. Analyze weather data and create clear, helpful summaries.',
              userPrompt: 'Create a friendly weather summary for {{cityName}}. Weather data: {{weather-api-2}}. Include current conditions and practical advice.'
            }
          }
        },
        {
          id: 'response-4',
          type: 'end',
          position: { x: 850, y: 100 },
          data: {
            label: 'Final Response',
            description: 'Format the final weather response',
            output: {
              city: '{{cityName}}',
              summary: '{{ai-agent-3}}',
              timestamp: '{{timestamp}}',
              source: 'OpenWeatherMap API'
            }
          }
        }
      ],
      
      // Edges - simple array of objects (not JSON strings)  
      edges: [
        {
          id: 'e1-2',
          source: 'start-1',
          target: 'weather-api-2',
          type: 'default'
        },
        {
          id: 'e2-3',
          source: 'weather-api-2', 
          target: 'ai-agent-3',
          type: 'default'
        },
        {
          id: 'e3-4',
          source: 'ai-agent-3',
          target: 'response-4',
          type: 'default'
        }
      ],
      
      // Configuration
      config: {
        requiredIntegrations: ['openai', 'openweathermap'],
        complexity: 'beginner',
        estimatedExecutionTime: 15,
        useCase: 'Weather information retrieval and summarization'
      },
      
      // Variables
      variables: [
        {
          name: 'cityName',
          type: 'string',
          description: 'Name of the city to get weather for',
          defaultValue: 'New York',
          required: true
        }
      ],
      
      // Status
      status: 'published',
      isPublic: true,
      publishedAt: new Date()
    });
    
    const savedTemplate = await template.save();
    
    console.log('✅ Clean Weather Workflow created successfully!');
    console.log('📋 Template ID:', savedTemplate._id.toString());
    console.log('👤 Author ID:', testUserId.toString());
    console.log('🔧 Key Fixes Applied:');
    console.log('   - Fixed template variable processing with dot notation');
    console.log('   - Start node outputs actual values instead of schema');
    console.log('   - Simplified variable references ({{cityName}} instead of {{input.cityName}})');
    console.log('   - Enhanced API parameter handling');
    
    return {
      templateId: savedTemplate._id.toString(),
      authorId: testUserId.toString()
    };
    
  } catch (error) {
    console.error('❌ Error creating workflow template:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database connection closed');
  }
};

// Run the script
if (require.main === module) {
  createCleanWeatherWorkflow()
    .then((result) => {
      console.log('\n🎉 Workflow creation completed!');
      console.log('📋 Template ID:', result.templateId);
      console.log('👤 Author ID:', result.authorId);
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed to create workflow:', error);
      process.exit(1);
    });
}

module.exports = createCleanWeatherWorkflow;