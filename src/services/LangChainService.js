const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, SystemMessage, AIMessage } = require('@langchain/core/messages');
const { PromptTemplate } = require('@langchain/core/prompts');
const { LLMChain } = require('langchain/chains');
const { Tool } = require('@langchain/core/tools');
const { DynamicTool } = require('@langchain/community/tools/dynamic');
const { Calculator } = require('@langchain/community/tools/calculator');
const { SerpAPI } = require('@langchain/community/tools/serpapi');
const winston = require('winston');

class LangChainService {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/langchain.log' })
      ]
    });

    // Initialize models
    this.models = {
      'gpt-4': new ChatOpenAI({
        modelName: 'gpt-4',
        temperature: 0.7,
        openAIApiKey: process.env.OPENAI_API_KEY
      }),
      'gpt-3.5-turbo': new ChatOpenAI({
        modelName: 'gpt-3.5-turbo',
        temperature: 0.7,
        openAIApiKey: process.env.OPENAI_API_KEY
      }),
      'gpt-4-turbo': new ChatOpenAI({
        modelName: 'gpt-4-turbo-preview',
        temperature: 0.7,
        openAIApiKey: process.env.OPENAI_API_KEY
      })
    };

    // Initialize tools
    this.tools = new Map();
    this.initializeTools();
  }

  initializeTools() {
    // Calculator tool
    this.tools.set('calculator', new Calculator());

    // Search tool
    if (process.env.SERPAPI_API_KEY) {
      this.tools.set('search', new SerpAPI(process.env.SERPAPI_API_KEY, {
        location: "Austin,Texas,United States",
        hl: "en",
        gl: "us"
      }));
    }

    // Custom tools
    this.tools.set('text_processor', new DynamicTool({
      name: 'text_processor',
      description: 'Process and transform text data',
      func: async (input) => {
        // Custom text processing logic
        return `Processed: ${input}`;
      }
    }));

    this.tools.set('data_validator', new DynamicTool({
      name: 'data_validator',
      description: 'Validate data against specified rules',
      func: async (input) => {
        try {
          const data = JSON.parse(input);
          return JSON.stringify({
            valid: true,
            data: data,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          return JSON.stringify({
            valid: false,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    }));

    this.tools.set('api_caller', new DynamicTool({
      name: 'api_caller',
      description: 'Make HTTP requests to external APIs with enhanced configuration',
      func: async (input) => {
        try {
          const { url, method = 'GET', headers = {}, body, timeout = 30000, retries = 3 } = JSON.parse(input);
          const fetch = (await import('node-fetch')).default;
          
          let lastError;
          for (let attempt = 0; attempt < retries; attempt++) {
            try {
              const response = await fetch(url, {
                method,
                headers: {
                  'Content-Type': 'application/json',
                  ...headers
                },
                body: body ? JSON.stringify(body) : undefined,
                timeout
              });

              let responseData;
              const contentType = response.headers.get('content-type');
              
              if (contentType && contentType.includes('application/json')) {
                responseData = await response.json();
              } else {
                responseData = await response.text();
              }

              return JSON.stringify({
                status: response.status,
                success: response.ok,
                data: responseData,
                headers: Object.fromEntries(response.headers.entries()),
                attempt: attempt + 1
              });
            } catch (error) {
              lastError = error;
              if (attempt < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
              }
            }
          }
          
          throw lastError;
        } catch (error) {
          return JSON.stringify({
            error: error.message,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
      }
    }));

    // Customer Data Mock Tool
    this.tools.set('customer_data_api', new DynamicTool({
      name: 'customer_data_api',
      description: 'Fetch customer purchase history and preferences (mock data for now)',
      func: async (input) => {
        try {
          const { customerId } = JSON.parse(input);
          
          // Mock customer data - replace with real API call later
          const mockCustomerData = {
            customerId: customerId,
            profile: {
              name: `Customer ${customerId}`,
              email: `customer${customerId}@example.com`,
              joinDate: "2023-01-15",
              tier: "Gold"
            },
            purchaseHistory: [
              {
                date: "2024-09-15",
                orderId: "ORD_001",
                category: "Electronics",
                product: "iPhone 15 Pro",
                amount: 1199.99,
                quantity: 1
              },
              {
                date: "2024-08-20",
                orderId: "ORD_002", 
                category: "Accessories",
                product: "AirPods Pro",
                amount: 249.99,
                quantity: 1
              },
              {
                date: "2024-07-10",
                orderId: "ORD_003",
                category: "Electronics",
                product: "MacBook Air M2",
                amount: 1499.99,
                quantity: 1
              }
            ],
            preferences: ["Electronics", "Apple Products", "Premium Tech"],
            metrics: {
              totalSpent: 2949.97,
              averageOrderValue: 983.32,
              totalOrders: 3,
              favoriteCategory: "Electronics",
              lastPurchaseDate: "2024-09-15"
            }
          };

          return JSON.stringify({
            success: true,
            data: mockCustomerData,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          return JSON.stringify({
            error: error.message,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
      }
    }));

    // Noam Task Creator Tool
    this.tools.set('noam_task_creator', new DynamicTool({
      name: 'noam_task_creator',
      description: 'Create human approval tasks in Noam app',
      func: async (input) => {
        try {
          const { 
            taskTitle, 
            taskDescription, 
            taskData, 
            priority = 'medium',
            assignee,
            workflowExecutionId 
          } = JSON.parse(input);

          // For now, simulate task creation - replace with actual Noam API call
          const mockTaskId = `TASK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          const taskPayload = {
            id: mockTaskId,
            title: taskTitle,
            description: taskDescription,
            data: taskData,
            priority: priority,
            assignee: assignee || 'unassigned',
            status: 'pending',
            workflowExecutionId: workflowExecutionId,
            createdAt: new Date().toISOString(),
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
          };

          // TODO: Replace with actual Noam API call
          // const response = await this.callNoamTaskAPI(taskPayload);

          return JSON.stringify({
            success: true,
            taskId: mockTaskId,
            taskData: taskPayload,
            message: 'Task created successfully in Noam app',
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          return JSON.stringify({
            error: error.message,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
      }
    }));

    // Task Status Poller Tool
    this.tools.set('task_status_poller', new DynamicTool({
      name: 'task_status_poller',
      description: 'Poll task status from Noam app and wait for completion',
      func: async (input) => {
        try {
          const { taskId, maxWaitTime = 300000, pollInterval = 5000 } = JSON.parse(input); // 5 min max, poll every 5 sec
          
          const startTime = Date.now();
          
          while (Date.now() - startTime < maxWaitTime) {
            // TODO: Replace with actual Noam API call to check task status
            // For now, simulate random completion after some time
            const elapsedTime = Date.now() - startTime;
            
            if (elapsedTime > 10000) { // Simulate task completion after 10 seconds
              const mockDecision = Math.random() > 0.3 ? 'approved' : 'rejected';
              
              return JSON.stringify({
                success: true,
                taskId: taskId,
                status: 'completed',
                decision: mockDecision,
                feedback: mockDecision === 'approved' 
                  ? 'Offer looks good, approved for customer' 
                  : 'Offer needs refinement, rejected',
                completedAt: new Date().toISOString(),
                waitTime: elapsedTime
              });
            }
            
            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }
          
          // Timeout reached
          return JSON.stringify({
            success: false,
            error: 'Task polling timeout reached',
            taskId: taskId,
            status: 'timeout',
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          return JSON.stringify({
            error: error.message,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
      }
    }));

    this.logger.info(`Initialized ${this.tools.size} tools`);
  }

  async createPromptTemplate(template, inputVariables) {
    try {
      return new PromptTemplate({
        template,
        inputVariables
      });
    } catch (error) {
      this.logger.error('Error creating prompt template:', error);
      throw error;
    }
  }

  async createChain(modelName, promptTemplate) {
    try {
      const model = this.models[modelName] || this.models['gpt-3.5-turbo'];
      
      return new LLMChain({
        llm: model,
        prompt: promptTemplate
      });
    } catch (error) {
      this.logger.error('Error creating chain:', error);
      throw error;
    }
  }

  async executeNode(nodeConfig, context = {}) {
    const { type, config, model = 'gpt-3.5-turbo' } = nodeConfig;
    
    try {
      switch (type) {
        case 'llm':
          return await this.executeLLMNode(config, model, context);
        
        case 'tool':
          return await this.executeToolNode(config, context);
        
        case 'prompt':
          return await this.executePromptNode(config, context);
        
        case 'condition':
          return await this.executeConditionNode(config, context);
        
        case 'transform':
          return await this.executeTransformNode(config, context);
        
        case 'memory':
          return await this.executeMemoryNode(config, context);
        
        default:
          throw new Error(`Unknown node type: ${type}`);
      }
    } catch (error) {
      this.logger.error(`Error executing node ${nodeConfig.id}:`, error);
      throw error;
    }
  }

  async executeLLMNode(config, modelName, context) {
    const { prompt, temperature = 0.7, maxTokens = 1000 } = config;
    const model = this.models[modelName] || this.models['gpt-3.5-turbo'];
    
    // Update model temperature if specified
    model.temperature = temperature;
    model.maxTokens = maxTokens;

    // Replace variables in prompt
    const processedPrompt = this.processPromptVariables(prompt, context);
    
    const response = await model.invoke([
      new HumanMessage(processedPrompt)
    ]);

    return {
      success: true,
      output: response.content,
      metadata: {
        model: modelName,
        temperature,
        maxTokens,
        tokens_used: response.usage?.total_tokens || 0
      }
    };
  }

  async executeToolNode(config, context) {
    const { toolName, input } = config;
    const tool = this.tools.get(toolName);
    
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Process input variables
    const processedInput = this.processPromptVariables(input, context);
    
    const result = await tool.call(processedInput);
    
    return {
      success: true,
      output: result,
      metadata: {
        tool: toolName,
        input: processedInput
      }
    };
  }

  async executePromptNode(config, context) {
    const { template, variables } = config;
    
    const promptTemplate = await this.createPromptTemplate(template, variables);
    const formattedPrompt = await promptTemplate.format(context);
    
    return {
      success: true,
      output: formattedPrompt,
      metadata: {
        template,
        variables,
        context
      }
    };
  }

  async executeConditionNode(config, context) {
    const { condition, truthyPath, falsyPath } = config;
    
    // Evaluate condition
    const result = this.evaluateCondition(condition, context);
    
    return {
      success: true,
      output: result,
      nextPath: result ? truthyPath : falsyPath,
      metadata: {
        condition,
        result,
        context
      }
    };
  }

  async executeTransformNode(config, context) {
    const { operation, field, value } = config;
    let output = { ...context };
    
    switch (operation) {
      case 'set':
        output[field] = value;
        break;
      case 'append':
        output[field] = (output[field] || '') + value;
        break;
      case 'extract':
        // Extract data using regex or JSONPath
        output[field] = this.extractData(value, context);
        break;
      case 'format':
        // Format data according to template
        output[field] = this.processPromptVariables(value, context);
        break;
      default:
        throw new Error(`Unknown transform operation: ${operation}`);
    }
    
    return {
      success: true,
      output: output,
      metadata: {
        operation,
        field,
        value
      }
    };
  }

  async executeMemoryNode(config, context) {
    const { operation, key, value } = config;
    
    // This would integrate with a memory store (Redis, etc.)
    // For now, using context as simple memory
    let output = { ...context };
    
    switch (operation) {
      case 'store':
        output[`memory_${key}`] = value;
        break;
      case 'retrieve':
        output[key] = output[`memory_${key}`] || null;
        break;
      case 'clear':
        delete output[`memory_${key}`];
        break;
      default:
        throw new Error(`Unknown memory operation: ${operation}`);
    }
    
    return {
      success: true,
      output: output,
      metadata: {
        operation,
        key,
        value
      }
    };
  }

  processPromptVariables(prompt, context) {
    let processed = prompt;
    
    // Replace {{variable}} patterns
    Object.keys(context).forEach(key => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      processed = processed.replace(regex, context[key] || '');
    });
    
    return processed;
  }

  evaluateCondition(condition, context) {
    try {
      // Simple condition evaluation
      // In production, use a safer evaluation library
      const processedCondition = this.processPromptVariables(condition, context);
      
      // Basic comparisons
      const comparisons = [
        { regex: /(.+)\s*==\s*(.+)/, fn: (a, b) => a === b },
        { regex: /(.+)\s*!=\s*(.+)/, fn: (a, b) => a !== b },
        { regex: /(.+)\s*>\s*(.+)/, fn: (a, b) => parseFloat(a) > parseFloat(b) },
        { regex: /(.+)\s*<\s*(.+)/, fn: (a, b) => parseFloat(a) < parseFloat(b) },
        { regex: /(.+)\s*>=\s*(.+)/, fn: (a, b) => parseFloat(a) >= parseFloat(b) },
        { regex: /(.+)\s*<=\s*(.+)/, fn: (a, b) => parseFloat(a) <= parseFloat(b) },
        { regex: /(.+)\s*contains\s*(.+)/, fn: (a, b) => a.includes(b) }
      ];
      
      for (const comp of comparisons) {
        const match = processedCondition.match(comp.regex);
        if (match) {
          const [, left, right] = match;
          return comp.fn(left.trim(), right.trim());
        }
      }
      
      // If no comparison found, treat as boolean
      return Boolean(processedCondition);
    } catch (error) {
      this.logger.error('Error evaluating condition:', error);
      return false;
    }
  }

  extractData(pattern, context) {
    try {
      // Simple regex extraction
      const regex = new RegExp(pattern);
      const contextString = JSON.stringify(context);
      const match = contextString.match(regex);
      return match ? match[1] || match[0] : null;
    } catch (error) {
      this.logger.error('Error extracting data:', error);
      return null;
    }
  }

  async getAvailableModels() {
    return Object.keys(this.models);
  }

  async getAvailableTools() {
    return Array.from(this.tools.keys());
  }

  async validateWorkflow(workflow) {
    const errors = [];
    const warnings = [];
    
    try {
      // Validate nodes
      for (const node of workflow.nodes) {
        if (!node.type) {
          errors.push(`Node ${node.id} missing type`);
        }
        
        if (node.type === 'llm' && !node.config?.prompt) {
          errors.push(`LLM node ${node.id} missing prompt`);
        }
        
        if (node.type === 'tool' && !node.config?.toolName) {
          errors.push(`Tool node ${node.id} missing toolName`);
        }
        
        if (node.type === 'tool' && !this.tools.has(node.config?.toolName)) {
          warnings.push(`Tool ${node.config?.toolName} in node ${node.id} not available`);
        }
      }
      
      // Validate edges and flow
      const nodeIds = new Set(workflow.nodes.map(n => n.id));
      for (const edge of workflow.edges) {
        if (!nodeIds.has(edge.source)) {
          errors.push(`Edge references unknown source node: ${edge.source}`);
        }
        if (!nodeIds.has(edge.target)) {
          errors.push(`Edge references unknown target node: ${edge.target}`);
        }
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      this.logger.error('Error validating workflow:', error);
      return {
        valid: false,
        errors: [error.message],
        warnings
      };
    }
  }
}

module.exports = LangChainService;