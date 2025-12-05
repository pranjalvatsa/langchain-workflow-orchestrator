const { ChatOpenAI } = require("@langchain/openai");
const { HumanMessage, SystemMessage, AIMessage } = require("@langchain/core/messages");
const { PromptTemplate } = require("@langchain/core/prompts");
const { LLMChain } = require("langchain/chains");
const { Tool } = require("@langchain/core/tools");
const { DynamicTool } = require("@langchain/community/tools/dynamic");
const { Calculator } = require("@langchain/community/tools/calculator");
const { SerpAPI } = require("@langchain/community/tools/serpapi");

class LangChainService {
  constructor() {
    // Initialize models
    this.models = {
      "gpt-4": new ChatOpenAI({
        modelName: "gpt-4",
        temperature: 0.7,
        openAIApiKey: process.env.OPENAI_API_KEY,
      }),
      "gpt-3.5-turbo": new ChatOpenAI({
        modelName: "gpt-3.5-turbo",
        temperature: 0.7,
        openAIApiKey: process.env.OPENAI_API_KEY,
      }),
      "gpt-4-turbo": new ChatOpenAI({
        modelName: "gpt-4-turbo-preview",
        temperature: 0.7,
        openAIApiKey: process.env.OPENAI_API_KEY,
      }),
      "gpt-4o-mini": new ChatOpenAI({
        modelName: "gpt-4o-mini",
        temperature: 0.7,
        openAIApiKey: process.env.OPENAI_API_KEY,
      }),
    };

    // Initialize tools
    this.tools = new Map();
    this.initializeTools();
  }

  initializeTools() {
    // Calculator tool
    this.tools.set("calculator", new Calculator());

    // Search tool
    if (process.env.SERPAPI_API_KEY) {
      this.tools.set(
        "search",
        new SerpAPI(process.env.SERPAPI_API_KEY, {
          location: "Austin,Texas,United States",
          hl: "en",
          gl: "us",
        })
      );
    }

    // Custom tools
    this.tools.set(
      "text_processor",
      new DynamicTool({
        name: "text_processor",
        description: "Process and transform text data",
        func: async (input) => {
          // Custom text processing logic
          return `Processed: ${input}`;
        },
      })
    );

    this.tools.set(
      "data_validator",
      new DynamicTool({
        name: "data_validator",
        description: "Validate data against specified rules",
        func: async (input) => {
          try {
            const data = JSON.parse(input);
            return JSON.stringify({
              valid: true,
              data: data,
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            return JSON.stringify({
              valid: false,
              error: error.message,
              timestamp: new Date().toISOString(),
            });
          }
        },
      })
    );

    this.tools.set(
      "api_caller",
      new DynamicTool({
        name: "api_caller",
        description: "Make HTTP requests to external APIs with enhanced configuration",
        func: async (input) => {
          try {
            const { url, method = "GET", headers = {}, queryParams = {}, body, timeout = 30000, retries = 3 } = JSON.parse(input);
            const fetch = (await import("node-fetch")).default;

            // Build URL with query parameters
            let requestUrl = url;
            if (queryParams && Object.keys(queryParams).length > 0) {
              const urlParams = new URLSearchParams(queryParams);
              requestUrl = `${url}${url.includes("?") ? "&" : "?"}${urlParams.toString()}`;
            }

            let lastError;
            for (let attempt = 0; attempt < retries; attempt++) {
              try {
                const response = await fetch(requestUrl, {
                  method,
                  headers: {
                    "Content-Type": "application/json",
                    ...headers,
                  },
                  body: body ? JSON.stringify(body) : undefined,
                  timeout,
                });

                let responseData;
                const contentType = response.headers.get("content-type");

                if (contentType && contentType.includes("application/json")) {
                  responseData = await response.json();
                } else {
                  responseData = await response.text();
                }

                return JSON.stringify({
                  status: response.status,
                  success: response.ok,
                  data: responseData,
                  headers: Object.fromEntries(response.headers.entries()),
                  attempt: attempt + 1,
                });
              } catch (error) {
                lastError = error;
                if (attempt < retries - 1) {
                  await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
                }
              }
            }

            throw lastError;
          } catch (error) {
            return JSON.stringify({
              error: error.message,
              success: false,
              timestamp: new Date().toISOString(),
            });
          }
        },
      })
    );

    // Customer Data Mock Tool
    this.tools.set(
      "customer_data_api",
      new DynamicTool({
        name: "customer_data_api",
        description: "Fetch customer purchase history and preferences (mock data for now)",
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
                tier: "Gold",
              },
              purchaseHistory: [
                {
                  date: "2024-09-15",
                  orderId: "ORD_001",
                  category: "Electronics",
                  product: "iPhone 15 Pro",
                  amount: 1199.99,
                  quantity: 1,
                },
                {
                  date: "2024-08-20",
                  orderId: "ORD_002",
                  category: "Accessories",
                  product: "AirPods Pro",
                  amount: 249.99,
                  quantity: 1,
                },
                {
                  date: "2024-07-10",
                  orderId: "ORD_003",
                  category: "Electronics",
                  product: "MacBook Air M2",
                  amount: 1499.99,
                  quantity: 1,
                },
              ],
              preferences: ["Electronics", "Apple Products", "Premium Tech"],
              metrics: {
                totalSpent: 2949.97,
                averageOrderValue: 983.32,
                totalOrders: 3,
                favoriteCategory: "Electronics",
                lastPurchaseDate: "2024-09-15",
              },
            };

            return JSON.stringify({
              success: true,
              data: mockCustomerData,
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            return JSON.stringify({
              error: error.message,
              success: false,
              timestamp: new Date().toISOString(),
            });
          }
        },
      })
    );

    // Noam Task Creator Tool
    this.tools.set(
      "noam_task_creator",
      new DynamicTool({
        name: "noam_task_creator",
        description: "Create human approval tasks in Noam app",
        func: async (input) => {
          try {
            const { taskTitle, taskDescription, taskData, priority = "medium", assignee, workflowExecutionId, roleId, timeout = 86400000, noamApiToken, noamApiBaseUrl } = JSON.parse(input);

            // Validate required parameters
            if (!noamApiToken || !noamApiBaseUrl) {
              throw new Error("Missing required API credentials: noamApiToken and noamApiBaseUrl");
            }

            if (!roleId) {
              throw new Error("Missing required parameter: roleId");
            }

            // Calculate due date from timeout
            const dueDate = new Date(Date.now() + timeout).toISOString();

            // Prepare task payload for NoamVisionBE API
            const taskPayload = {
              roleId: roleId,
              title: taskTitle,
              description: taskDescription,
              workflowId: workflowExecutionId,
              nodeId: "human-review-node",
              data: taskData,
              dueDate: dueDate,
              priority: priority,
              assignee: assignee || "",
            };

            // Make actual API call to NoamVisionBE
            const axios = require("axios");
            const response = await axios.post(`${noamApiBaseUrl}/api/tasks`, taskPayload, {
              headers: {
                Authorization: `Bearer ${noamApiToken}`,
                "Content-Type": "application/json",
              },
              timeout: 30000, // 30 second timeout
            });

            if (response.data && response.data.success) {
              return JSON.stringify({
                success: true,
                taskId: response.data.data.id,
                taskData: response.data.data,
                message: "Task created successfully in NoamVisionBE",
                timestamp: new Date().toISOString(),
              });
            } else {
              throw new Error(`API call failed: ${response.data?.message || "Unknown error"}`);
            }
          } catch (error) {
            return JSON.stringify({
              error: error.message,
              success: false,
              timestamp: new Date().toISOString(),
            });
          }
        },
      })
    );

    // Task Status Poller Tool
    this.tools.set(
      "task_status_poller",
      new DynamicTool({
        name: "task_status_poller",
        description: "Poll task status from Noam app and wait for completion",
        func: async (input) => {
          try {
            const { taskId, maxWaitTime = 300000, pollInterval = 5000, noamApiToken, noamApiBaseUrl } = JSON.parse(input); // 5 min max, poll every 5 sec

            // Validate required parameters
            if (!noamApiToken || !noamApiBaseUrl) {
              throw new Error("Missing required API credentials: noamApiToken and noamApiBaseUrl");
            }

            const startTime = Date.now();
            const axios = require("axios");

            while (Date.now() - startTime < maxWaitTime) {
              try {
                // Make actual API call to check task status
                const response = await axios.get(`${noamApiBaseUrl}/api/tasks/${taskId}`, {
                  headers: {
                    Authorization: `Bearer ${noamApiToken}`,
                    "Content-Type": "application/json",
                  },
                  timeout: 10000, // 10 second timeout for each poll
                });

                if (response.data && response.data.success) {
                  const taskData = response.data.data;

                  // Check if task is completed
                  if (taskData.status === "completed" || taskData.status === "approved" || taskData.status === "rejected") {
                    return JSON.stringify({
                      success: true,
                      taskId: taskId,
                      status: "completed",
                      decision: taskData.decision || (taskData.status === "approved" ? "approved" : "rejected"),
                      feedback: taskData.feedback || taskData.comments || "Task completed",
                      completedAt: taskData.completedAt || taskData.updatedAt || new Date().toISOString(),
                      waitTime: Date.now() - startTime,
                    });
                  }

                  // Task is still pending, continue polling
                } else {
                  // Failed to get task status, continue polling
                }
              } catch (pollError) {
                // Continue polling even if one poll fails
              }

              // Wait before next poll
              await new Promise((resolve) => setTimeout(resolve, pollInterval));
            }

            // Timeout reached
            return JSON.stringify({
              success: false,
              error: "Task polling timeout reached",
              taskId: taskId,
              status: "timeout",
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            return JSON.stringify({
              error: error.message,
              success: false,
              timestamp: new Date().toISOString(),
            });
          }
        },
      })
    );

    // Agent Escalation Tool
    this.tools.set(
      "agent_escalation",
      new DynamicTool({
        name: "agent_escalation",
        description: "Escalate call to available human agent",
        func: async (input) => {
          try {
            const { callId, transcription, callerInfo, priority, reason } = JSON.parse(input);

            // Generate escalation ID
            const escalationId = `ESC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const escalationPayload = {
              id: escalationId,
              callId: callId,
              transcription: transcription,
              callerInfo: callerInfo,
              priority: priority || "high",
              reason: reason,
              status: "queued",
              createdAt: new Date().toISOString(),
              estimatedWaitTime: "5-10 minutes",
            };

            // TODO: Replace with actual agent platform API call
            // const response = await this.callAgentPlatformAPI(escalationPayload);

            return JSON.stringify({
              success: true,
              escalationId: escalationId,
              queuePosition: Math.floor(Math.random() * 5) + 1,
              estimatedWaitTime: "5-10 minutes",
              message: "Call escalated to human agent",
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            return JSON.stringify({
              error: error.message,
              success: false,
              timestamp: new Date().toISOString(),
            });
          }
        },
      })
    );

    // Call Response API Tool
    this.tools.set(
      "call_response_api",
      new DynamicTool({
        name: "call_response_api",
        description: "Send response back to caller via call system",
        func: async (input) => {
          try {
            const { callId, response, responseType } = JSON.parse(input);

            const responseId = `RESP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const responsePayload = {
              id: responseId,
              callId: callId,
              response: response,
              responseType: responseType || "automated",
              deliveredAt: new Date().toISOString(),
              status: "delivered",
            };

            // TODO: Replace with actual call system API call
            // const result = await this.callResponseAPI(responsePayload);

            return JSON.stringify({
              success: true,
              responseId: responseId,
              status: "delivered",
              message: "Response sent to caller",
              callId: callId,
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            return JSON.stringify({
              error: error.message,
              success: false,
              timestamp: new Date().toISOString(),
            });
          }
        },
      })
    );

    // Call Transcription Processor Tool
    this.tools.set(
      "call_transcription_processor",
      new DynamicTool({
        name: "call_transcription_processor",
        description: "Process incoming call transcription and extract metadata",
        func: async (input) => {
          try {
            const { audioUrl, callId, metadata, rawTranscription } = JSON.parse(input);

            // TODO: Integrate with transcription service (e.g., OpenAI Whisper, Google Speech-to-Text)
            // For now, return processed transcription
            const processedTranscription = rawTranscription || "Customer called asking about order status and delivery timeline.";

            return JSON.stringify({
              success: true,
              transcription: processedTranscription,
              confidence: 0.95,
              language: "en",
              duration: Math.floor(Math.random() * 120) + 30, // 30-150 seconds
              sentiment: Math.random() > 0.3 ? "neutral" : "frustrated",
              urgency: Math.random() > 0.7 ? "high" : "medium",
              metadata: {
                callId: callId,
                processedAt: new Date().toISOString(),
                audioUrl: audioUrl,
              },
            });
          } catch (error) {
            return JSON.stringify({
              error: error.message,
              success: false,
              timestamp: new Date().toISOString(),
            });
          }
        },
      })
    );

    // Metrics Fetcher Tool (for Insights workflow)
    this.tools.set(
      "metrics_fetcher",
      new DynamicTool({
        name: "metrics_fetcher",
        description: "Fetch metrics and data from various sources for analysis",
        func: async (input) => {
          try {
            const { source, timeRange, metrics } = JSON.parse(input);

            // Mock metrics data - replace with actual data source integrations
            const mockMetrics = {
              source: source,
              timeRange: timeRange,
              data: {
                totalUsers: Math.floor(Math.random() * 10000) + 1000,
                activeUsers: Math.floor(Math.random() * 5000) + 500,
                revenue: Math.floor(Math.random() * 100000) + 10000,
                conversions: Math.floor(Math.random() * 1000) + 100,
                pageViews: Math.floor(Math.random() * 50000) + 5000,
                bounceRate: (Math.random() * 0.5 + 0.2).toFixed(2),
                avgSessionDuration: Math.floor(Math.random() * 300) + 60,
              },
              trends: {
                usersGrowth: (Math.random() * 0.4 - 0.2).toFixed(3), // -20% to +20%
                revenueGrowth: (Math.random() * 0.6 - 0.3).toFixed(3), // -30% to +30%
                conversionGrowth: (Math.random() * 0.8 - 0.4).toFixed(3),
              },
              timestamp: new Date().toISOString(),
            };

            // TODO: Replace with actual integrations
            // - Google Analytics API
            // - Database queries
            // - Third-party APIs
            // - Internal metrics systems

            return JSON.stringify({
              success: true,
              metrics: mockMetrics,
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            return JSON.stringify({
              error: error.message,
              success: false,
              timestamp: new Date().toISOString(),
            });
          }
        },
      })
    );

    // Report Publisher Tool
    this.tools.set(
      "report_publisher",
      new DynamicTool({
        name: "report_publisher",
        description: "Publish reports to various channels (email, Slack, dashboard, etc.)",
        func: async (input) => {
          try {
            const { report, channels, recipients, format } = JSON.parse(input);

            const publishResults = [];

            for (const channel of channels || ["email"]) {
              const result = {
                channel: channel,
                status: "published",
                timestamp: new Date().toISOString(),
                recipients: recipients || ["admin@company.com"],
              };

              // TODO: Replace with actual publishing logic
              switch (channel) {
                case "email":
                  // result.messageId = await sendEmailReport(report, recipients);
                  result.messageId = `EMAIL_${Date.now()}`;
                  break;
                case "slack":
                  // result.messageId = await sendSlackReport(report, recipients);
                  result.messageId = `SLACK_${Date.now()}`;
                  break;
                case "dashboard":
                  // result.dashboardUrl = await publishToDashboard(report);
                  result.dashboardUrl = `https://dashboard.company.com/reports/${Date.now()}`;
                  break;
                default:
                  result.status = "unsupported_channel";
              }

              publishResults.push(result);
            }

            return JSON.stringify({
              success: true,
              published: publishResults,
              reportId: `RPT_${Date.now()}`,
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            return JSON.stringify({
              error: error.message,
              success: false,
              timestamp: new Date().toISOString(),
            });
          }
        },
      })
    );

    // Scheduler Tool
    this.tools.set(
      "scheduler",
      new DynamicTool({
        name: "scheduler",
        description: "Schedule workflows to run at specific times or intervals",
        func: async (input) => {
          try {
            const { workflowId, schedule, timezone = "UTC" } = JSON.parse(input);

            const scheduleId = `SCHED_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // TODO: Integrate with actual scheduling system (cron, node-schedule, etc.)
            const scheduledTask = {
              id: scheduleId,
              workflowId: workflowId,
              schedule: schedule,
              timezone: timezone,
              status: "scheduled",
              nextRun: this.calculateNextRun(schedule),
              createdAt: new Date().toISOString(),
            };

            return JSON.stringify({
              success: true,
              schedule: scheduledTask,
              message: `Workflow ${workflowId} scheduled: ${schedule}`,
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            return JSON.stringify({
              error: error.message,
              success: false,
              timestamp: new Date().toISOString(),
            });
          }
        },
      })
    );

    // Firecrawl Web Scraping Tool
    this.tools.set(
      "firecrawl_scraper",
      new DynamicTool({
        name: "firecrawl_scraper",
        description: "Scrape and crawl websites using Firecrawl API. Supports single page scraping and multi-page crawling with robots.txt compliance.",
        func: async (input) => {
          try {
            const FirecrawlApp = require('@mendable/firecrawl-js').default;
            const firecrawl = new FirecrawlApp({
              apiKey: process.env.FIRECRAWL_API_KEY
            });

            const {
              url,
              mode = 'scrape', // 'scrape' or 'crawl'
              max_pages = 100,
              include_paths = [],
              exclude_paths = [],
              extract_schema = null,
              formats = ['markdown', 'html']
            } = JSON.parse(input);

            if (!process.env.FIRECRAWL_API_KEY) {
              return JSON.stringify({
                success: false,
                error: "FIRECRAWL_API_KEY not configured in environment variables",
                timestamp: new Date().toISOString(),
              });
            }

            if (mode === 'scrape') {
              // Single page scraping
              const result = await firecrawl.scrapeUrl(url, {
                formats: formats,
                onlyMainContent: true,
                includeTags: ['article', 'main', 'section', '.client', '.customer', '.partner', '.testimonial'],
                excludeTags: ['nav', 'footer', 'script', 'style'],
              });

              return JSON.stringify({
                success: true,
                mode: 'scrape',
                url: url,
                data: result,
                timestamp: new Date().toISOString(),
              });

            } else if (mode === 'crawl') {
              // Multi-page crawling
              const crawlOptions = {
                limit: max_pages,
                scrapeOptions: {
                  formats: formats,
                  onlyMainContent: true,
                  includeTags: ['article', 'main', 'section', '.client', '.customer', '.partner', '.testimonial'],
                  excludeTags: ['nav', 'footer', 'script', 'style'],
                }
              };

              if (include_paths.length > 0) {
                crawlOptions.includePaths = include_paths;
              }
              if (exclude_paths.length > 0) {
                crawlOptions.excludePaths = exclude_paths;
              }

              const result = await firecrawl.crawlUrl(url, crawlOptions);

              return JSON.stringify({
                success: true,
                mode: 'crawl',
                url: url,
                pages_crawled: result.data ? result.data.length : 0,
                data: result,
                timestamp: new Date().toISOString(),
              });
            }

            return JSON.stringify({
              success: false,
              error: "Invalid mode. Use 'scrape' or 'crawl'",
              timestamp: new Date().toISOString(),
            });

          } catch (error) {
            return JSON.stringify({
              success: false,
              error: error.message,
              stack: error.stack,
              timestamp: new Date().toISOString(),
            });
          }
        },
      })
    );
  }

  calculateNextRun(schedule) {
    // Simple cron parser - replace with proper cron library in production
    if (schedule === "daily@02:00") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(2, 0, 0, 0);
      return tomorrow.toISOString();
    }
    // Add more schedule patterns as needed
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Default to 24 hours
  }

  async createPromptTemplate(template, inputVariables) {
    try {
      return new PromptTemplate({
        template,
        inputVariables,
      });
    } catch (error) {
      throw error;
    }
  }

  async createChain(modelName, promptTemplate) {
    try {
      const model = this.models[modelName] || this.models["gpt-3.5-turbo"];

      return new LLMChain({
        llm: model,
        prompt: promptTemplate,
      });
    } catch (error) {
      throw error;
    }
  }

  async executeNode(nodeConfig, context = {}) {
    const { type, config, model = "gpt-3.5-turbo" } = nodeConfig;

    try {
      switch (type) {
        case "start":
          return await this.executeStartNode(nodeConfig, context);

        case "end":
          return await this.executeEndNode(nodeConfig, context);

        case "llm":
          return await this.executeLLMNode(nodeConfig.config || config, model, context);

        case "tool":
          return await this.executeToolNode(nodeConfig.config || config, context);

        case "human_review":
          return await this.executeHumanReviewNode(nodeConfig, context);

        case "agent":
          return await this.executeAgentNode(nodeConfig, context);

        case "agent_with_hitl":
          return await this.executeAgentWithHITLNode(nodeConfig, context);

        case "prompt":
          return await this.executePromptNode(config, context);

        case "condition":
          return await this.executeConditionNode(config, context);

        case "transform":
          return await this.executeTransformNode(config, context);

        case "memory":
          return await this.executeMemoryNode(config, context);

        default:
          throw new Error(`Unknown node type: ${type}`);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute an agent node (without HITL)
   * Agents can use tools to complete tasks autonomously
   */
  async executeAgentNode(nodeConfig, context = {}) {
    try {
      const { createReactAgent } = require("@langchain/langgraph/prebuilt");
      const { HumanMessage } = require("@langchain/core/messages");
      
      // Get configuration
      const config = nodeConfig.config || nodeConfig.data || {};
      const prompt = config.prompt || config.systemPrompt || "Complete the task";
      const maxIterations = config.maxIterations || 5;
      
      // Get tools - either from config or all registered tools
      let tools = [];
      if (config.tools && Array.isArray(config.tools)) {
        // Load specific tools from config
        for (const toolConfig of config.tools) {
          const toolName = toolConfig.name || toolConfig.toolName;
          if (toolName === 'search' || toolName === 'serp_api') {
            // SERP API tool
            const { SerpAPI } = require("@langchain/community/tools/serpapi");
            const serpApiKey = process.env.SERP_API_KEY || toolConfig.config?.apiKey?.replace('${SERP_API_KEY}', process.env.SERP_API_KEY);
            if (serpApiKey) {
              tools.push(new SerpAPI(serpApiKey));
            }
          } else if (this.tools.has(toolName)) {
            tools.push(this.tools.get(toolName));
          }
        }
      } else {
        // Use all registered tools
        tools = Array.from(this.tools.values());
      }
      
      // Get LLM model
      const { ChatOpenAI } = require("@langchain/openai");
      const llmConfig = config.llm || {};
      const model = new ChatOpenAI({
        modelName: llmConfig.model || "gpt-4",
        temperature: llmConfig.temperature || 0.7,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
      
      // Create React agent
      const agent = createReactAgent({
        llm: model,
        tools,
      });

      // Process template variables in prompt
      const processedPrompt = this.processTemplate(prompt, context);
      
      // Execute agent
      const messages = [new HumanMessage(processedPrompt)];
      const result = await agent.invoke({ messages });

      // Extract output
      const lastMessage = result.messages[result.messages.length - 1];
      const output = lastMessage.content;
      
      // Try to parse structured output if specified
      let parsedOutput = output;
      if (config.outputFormat) {
        try {
          // Check if output is JSON
          if (typeof output === 'string' && output.trim().startsWith('{')) {
            parsedOutput = JSON.parse(output);
          }
        } catch (e) {
          // Keep as string if not valid JSON
          parsedOutput = output;
        }
      }

      return { 
        success: true, 
        output: parsedOutput,
        rawOutput: output,
        messageCount: result.messages.length
      };
    } catch (error) {
      console.error("Error in executeAgentNode:", error);
      throw new Error(`Agent execution failed: ${error.message}`);
    }
  }

  /**
   * Execute a node using LangChain's Human-in-the-Loop middleware.
   * This node type will pause for human review if configured.
   * NOTE: Requires @langchain/langgraph to be properly installed
   */
  async executeAgentWithHITLNode(nodeConfig, context = {}) {
    try {
      const { createReactAgent } = require("@langchain/langgraph/prebuilt");
      const { MemorySaver } = require("@langchain/langgraph");
      const { HumanMessage } = require("@langchain/core/messages");
      
      // Check if this is a resume operation (has threadId from previous interrupt)
      const isResume = context._isResumeFromHITL === true;
      
      // Get tools for the agent
      const tools = Array.from(this.tools.values());
      
      // Get model - use a fresh instance with explicit API key to avoid placeholder issues
      const { ChatOpenAI } = require("@langchain/openai");
      const model = new ChatOpenAI({
        modelName: "gpt-4o-mini",
        temperature: 0.7,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
      
      // Create agent with checkpointer for state persistence
      const checkpointer = new MemorySaver();
      const agent = createReactAgent({
        llm: model,
        tools,
        checkpointSaver: checkpointer,
      });

      // Create or reuse thread ID for this execution
      const threadId = context.threadId || context.executionId || `thread_${Date.now()}`;
      const config = { 
        configurable: { thread_id: threadId },
        // Configure interruption before tool calls
        interruptBefore: nodeConfig.data?.interruptBefore || ["tools"],
      };

      // For HITL nodes, we ALWAYS interrupt on first execution (not a resume)
      // This ensures human review happens before ANY agent actions
      if (!isResume) {
        console.log('[HITL] First execution - interrupting for human review');
        
        // Prepare input message for agent planning
        const input = nodeConfig.data?.prompt || nodeConfig.data?.input || context.input || "Proceed with workflow step.";
        
        // Return interrupt immediately to pause workflow
        return {
          interrupt: true,
          threadId,
          state: { input, context },
          next: ["human_approval"],
          pendingTools: tools.map(t => t.name),
          message: `Human review required before proceeding with workflow step`,
        };
      }

      // This is a resume - continue agent execution with approval
      console.log('[HITL] Resuming agent execution after approval');
      
      // Prepare input message
      const input = nodeConfig.data?.prompt || nodeConfig.data?.input || context.input || "Proceed with workflow step.";
      const messages = [new HumanMessage(input)];

      // Invoke the agent (will now execute tools since approved)
      const result = await agent.invoke({ messages }, config);

      // Agent completed successfully
      return { 
        success: true, 
        output: result.messages[result.messages.length - 1].content,
        threadId,
      };
    } catch (error) {
      console.error("Error in executeAgentWithHITLNode:", error);
      throw new Error(`HITL Agent execution failed: ${error.message}`);
    }
  }

  async executeLLMNode(config, modelName, context) {
    // Handle different config structures
    const parameters = config.parameters || config;
    const {
      prompt,
      systemPrompt,
      userPrompt,
      model: configModel,
      temperature = 0.7,
      maxTokens = 1000,
      apiKey, // NEW: Custom API key
      responseFormat, // NEW: Response format for structured output
    } = parameters;

    // Use model from config if specified, otherwise use the passed modelName
    const selectedModelName = configModel || modelName || "gpt-3.5-turbo";

    // Use custom API key if provided, otherwise use default model
    let model;
    if (apiKey) {
      // Create a new model instance with custom API key
      model = new ChatOpenAI({
        modelName: selectedModelName,
        temperature: temperature,
        maxTokens: maxTokens,
        openAIApiKey: apiKey,
        ...(responseFormat && { response_format: responseFormat }),
      });
    } else {
      // Use pre-initialized model
      model = this.models[selectedModelName] || this.models["gpt-3.5-turbo"];
      model.temperature = temperature;
      model.maxTokens = maxTokens;
    }

    // Build the prompt - handle different prompt structures
    let finalPrompt;
    if (prompt) {
      // Single prompt field
      finalPrompt = prompt;
    } else if (systemPrompt && userPrompt) {
      // System + user prompt structure
      finalPrompt = `System: ${systemPrompt}\n\nUser: ${userPrompt}`;
    } else if (userPrompt) {
      // Just user prompt
      finalPrompt = userPrompt;
    } else {
      throw new Error('No prompt found. Expected "prompt", "userPrompt", or "systemPrompt + userPrompt"');
    }

    // Replace variables in prompt
    const processedPrompt = this.processPromptVariables(finalPrompt, context);

    const response = await model.invoke([new HumanMessage(processedPrompt)]);

    return {
      success: true,
      output: response.content,
      metadata: {
        model: selectedModelName,
        temperature,
        maxTokens,
        tokens_used: response.usage?.total_tokens || 0,
      },
    };
  }

  async executeToolNode(config, context) {
    // Handle different config structures - toolName or tool field
    const toolName = config.toolName || config.tool;
    const input = config.input || config.parameters || config;

    if (!toolName) {
      throw new Error(`Tool name not specified. Expected 'toolName' or 'tool' field in config.`);
    }

    const tool = this.tools.get(toolName);

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Process input variables
    const processedInput = this.processPromptVariables(input, context);

    // Convert object input to JSON string for tools that expect JSON strings
    let toolInput = processedInput;
    if (typeof processedInput === "object" && processedInput !== null) {
      toolInput = JSON.stringify(processedInput);
    }

    const result = await tool.call(toolInput);

    return {
      success: true,
      output: result,
      metadata: {
        tool: toolName,
        input: processedInput,
      },
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
        context,
      },
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
        context,
      },
    };
  }

  async executeTransformNode(config, context) {
    const { operation, field, value } = config;
    let output = { ...context };

    switch (operation) {
      case "set":
        output[field] = value;
        break;
      case "append":
        output[field] = (output[field] || "") + value;
        break;
      case "extract":
        // Extract data using regex or JSONPath
        output[field] = this.extractData(value, context);
        break;
      case "format":
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
        value,
      },
    };
  }

  async executeMemoryNode(config, context) {
    const { operation, key, value } = config;

    // This would integrate with a memory store (Redis, etc.)
    // For now, using context as simple memory
    let output = { ...context };

    switch (operation) {
      case "store":
        output[`memory_${key}`] = value;
        break;
      case "retrieve":
        output[key] = output[`memory_${key}`] || null;
        break;
      case "clear":
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
        value,
      },
    };
  }

  processPromptVariables(prompt, context) {
    // Handle different data types
    if (typeof prompt === "string") {
      let processed = prompt;

      // Replace {{variable}} patterns - including dot notation
      const variableRegex = /{{([^}]+)}}/g;
      processed = processed.replace(variableRegex, (match, variablePath) => {
        const trimmedPath = variablePath.trim();

        // Handle dot notation like "weather-api-2.output.currentTemp"
        const value = this.getNestedValue(context, trimmedPath);
        return value !== undefined ? String(value) : match; // Keep original if not found
      });

      return processed;
    } else if (Array.isArray(prompt)) {
      // Process arrays recursively
      return prompt.map((item) => this.processPromptVariables(item, context));
    } else if (typeof prompt === "object" && prompt !== null) {
      // Process objects recursively
      const processed = {};
      for (const [key, value] of Object.entries(prompt)) {
        processed[key] = this.processPromptVariables(value, context);
      }
      return processed;
    } else {
      // Return primitive values as-is
      return prompt;
    }
  }

  // Helper function to get nested values from context
  getNestedValue(obj, path) {
    try {
      // First, try to get the value using the full path as a key (for cases like "api-1760068748453.output")
      if (path in obj) {
        return obj[path];
      }

      // Then try nested access
      return path.split(".").reduce((current, key) => {
        if (current && typeof current === "object" && key in current) {
          return current[key];
        }
        return undefined;
      }, obj);
    } catch (error) {
      return undefined;
    }
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
        { regex: /(.+)\s*contains\s*(.+)/, fn: (a, b) => a.includes(b) },
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

        if (node.type === "llm" && !node.config?.prompt) {
          errors.push(`LLM node ${node.id} missing prompt`);
        }

        if (node.type === "tool" && !node.config?.toolName) {
          errors.push(`Tool node ${node.id} missing toolName`);
        }

        if (node.type === "tool" && !this.tools.has(node.config?.toolName)) {
          warnings.push(`Tool ${node.config?.toolName} in node ${node.id} not available`);
        }
      }

      // Validate edges and flow
      const nodeIds = new Set(workflow.nodes.map((n) => n.id));
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
        warnings,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message],
        warnings,
      };
    }
  }

  /**
   * Execute start node - passes through input parameters
   */
  async executeStartNode(nodeConfig, context = {}) {
    const { data = {} } = nodeConfig;
    const { parameters = {} } = data;

    // Start nodes should pass through the actual input values, not the parameter schemas
    // Extract actual values from context based on parameter names
    const result = {};

    // For each parameter, get the actual value from context
    Object.keys(parameters).forEach((paramName) => {
      if (context[paramName] !== undefined) {
        result[paramName] = context[paramName];
      }
    });

    // Also include any other context values
    Object.keys(context).forEach((key) => {
      if (!(key in parameters) && !key.startsWith("_")) {
        result[key] = context[key];
      }
    });

    return {
      success: true,
      output: result,
      metadata: {
        nodeType: "start",
        nodeId: nodeConfig.id,
        executedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Execute end node - collects final output
   */
  async executeEndNode(nodeConfig, context = {}) {
    const { data = {} } = nodeConfig;
    const { output = {} } = data;

    // End nodes format the final output
    // Replace template variables in output with actual values from context
    const result = this.processPromptVariables(output, context);

    return {
      success: true,
      output: result,
      metadata: {
        nodeType: "end",
        nodeId: nodeConfig.id,
        executedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Execute human review node - creates external task and pauses workflow
   */
  async executeHumanReviewNode(nodeConfig, context = {}) {
    const { data = {} } = nodeConfig;
    const { label = "Human Review Required", reviewType = "approval", instructions = "Please review this workflow step", reviewData = {}, externalTask } = data;

    // Process review data with context variables
    const processedReviewData = this.processPromptVariables(reviewData, context);
    const processedInstructions = this.processPromptVariables(instructions, context);

    // Prepare the response that will pause the workflow
    const result = {
      success: true,
      requiresHumanReview: true,
      output: {
        status: "waiting_human_review",
        reviewType,
        instructions: processedInstructions,
        reviewData: processedReviewData,
        nodeId: nodeConfig.id,
        createdAt: new Date().toISOString(),
      },
      metadata: {
        nodeType: "human_review",
        nodeId: nodeConfig.id,
        executedAt: new Date().toISOString(),
        pauseWorkflow: true,
      },
    };

    // Always deep-copy the full externalTask object from nodeConfig.data.externalTask
    // Always hardcode externalTask for human review node
    result.output.externalTask = {
      enabled: true,
      apiConfig: {
        endpoint: "https://noam-vision-backend.onrender.com/api/tasks",
        method: "POST",
        headers: {
          "Authorization": "Bearer {{NOAM_API_TOKEN}}",
          "Content-Type": "application/json"
        }
      },
      body: {
        roleId: "d1a3f53a-c4fd-4eda-a283-97618057b4ea",
        title: `Approval Required: ${context.requestTitle || "{{requestTitle}}"}`,
        description: `Please review and approve this request.\n\nRequest: ${context.requestTitle || "{{requestTitle}}"}\nDescription: ${context.requestDescription || "{{requestDescription}}"}\nRequested by: ${context.requestedBy || "{{requestedBy}}"}\nPriority: ${context.priority || "{{priority}}"}\n\nPlease approve or reject this request.`,
        data: {
          nodeId: nodeConfig.id,
          executionId: context.executionId || "{{executionId}}",
          requestTitle: context.requestTitle || "{{requestTitle}}",
          requestDescription: context.requestDescription || "{{requestDescription}}",
          requestedBy: context.requestedBy || "{{requestedBy}}",
          priority: context.priority || "{{priority}}",
          workflowType: "simple_approval"
        }
      }
    };

    return result;
  }

  /**
   * Process template variables in a string
   * Replaces {{variableName}} with values from context
   */
  processTemplate(template, context) {
    if (typeof template !== 'string') return template;
    
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const keys = path.trim().split('.');
      let value = context;
      for (const key of keys) {
        value = value?.[key];
      }
      return value !== undefined ? value : match;
    });
  }
}

module.exports = LangChainService;
