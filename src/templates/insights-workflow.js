/**
 * Insights Workflow Template
 * 
 * This workflow template demonstrates the Universal Workflow Engine approach.
 * It can be deployed without any code changes - just configuration!
 * 
               recipients: '\\${input.recipients || [\"team@company.com\"]}',             recipients: '\\${input.recipients || [\"team@company.com\"]}', Features:
 * - Scheduled data collection
 * - Multi-source analytics
 * - Automated reporting
 * - Cross-platform publishing
 */

const insightsWorkflowTemplate = {
  templateId: 'insights-analytics-v1',
  name: 'Business Insights Analytics',
  description: 'Automated data collection, analysis, and reporting workflow for business insights',
  version: '1.0.0',
  category: 'analytics',
  
  // Trigger configuration - no custom endpoints needed!
  triggers: [
    {
      eventType: 'scheduled_report',
      enabled: true,
      priority: 'high',
      filter: {
        reportType: ['daily', 'weekly', 'monthly']
      }
    },
    {
      eventType: 'data_request',
      enabled: true,
      priority: 'normal',
      filter: {
        source: ['dashboard', 'api', 'manual']
      }
    }
  ],

  // Workflow nodes - uses existing tools in LangChain service
  nodes: [
    {
      id: 'start',
      type: 'start',
      position: { x: 100, y: 100 },
      data: {
        label: 'Insights Request',
        description: 'Workflow triggered for data analysis'
      }
    },
    {
      id: 'validate-request',
      type: 'tool',
      position: { x: 300, y: 100 },
      data: {
        label: 'Validate Request',
        tool: 'api_call',
        parameters: {
          url: 'https://api.internal.com/validate-request',
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ${INSIGHTS_API_KEY}',
            'Content-Type': 'application/json'
          },
          body: {
            requestId: '\${input.requestId}',
            requestType: '\${input.reportType}',
            timestamp: '\${input.timestamp}'
          }
        },
        outputMapping: {
          isValid: 'response.valid',
          requestDetails: 'response.details'
        }
      }
    },
    {
      id: 'fetch-metrics',
      type: 'tool',
      position: { x: 500, y: 100 },
      data: {
        label: 'Fetch Business Metrics',
        tool: 'metrics_fetcher',
        parameters: {
          sources: ['sales', 'marketing', 'support', 'product'],
          timeRange: '\${input.timeRange || "last_7_days"}',
          metrics: [
            'revenue',
            'conversion_rate',
            'customer_satisfaction',
            'user_engagement'
          ],
          filters: {
            status: 'active',
            region: '\${input.region || "all"}'
          }
        },
        outputMapping: {
          rawMetrics: 'metrics',
          dataQuality: 'quality_score',
          lastUpdated: 'last_updated'
        }
      }
    },
    {
      id: 'analyze-data',
      type: 'llm',
      position: { x: 700, y: 100 },
      data: {
        label: 'AI Data Analysis',
        model: 'gpt-4o',
        systemPrompt: `You are a business intelligence analyst. Analyze the provided metrics data and generate insights.

Focus on:
1. Key performance trends
2. Notable patterns or anomalies
3. Actionable recommendations
4. Risk factors or opportunities

Return your analysis in JSON format with:
- summary: Brief overview
- insights: Array of key findings
- recommendations: Array of actionable items
- risks: Array of potential concerns
- opportunities: Array of growth areas`,
        userPrompt: `Please analyze these business metrics:

Metrics Data: \${node.fetch-metrics.rawMetrics}
Time Range: \${input.timeRange}
Region: \${input.region}
Request Type: \${input.reportType}

Data Quality Score: \${node.fetch-metrics.dataQuality}
Last Updated: \${node.fetch-metrics.lastUpdated}`,
        outputMapping: {
          analysis: 'response',
          summary: 'response.summary',
          insights: 'response.insights',
          recommendations: 'response.recommendations'
        }
      }
    },
    {
      id: 'generate-report',
      type: 'tool',
      position: { x: 900, y: 100 },
      data: {
        label: 'Generate Report',
        tool: 'api_call',
        parameters: {
          url: 'https://api.reports.com/generate',
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ${REPORTS_API_KEY}',
            'Content-Type': 'application/json'
          },
          body: {
            template: 'business-insights',
            data: {
              metrics: '\${node.fetch-metrics.rawMetrics}',
              analysis: '\${node.analyze-data.analysis}',
              timeRange: '\${input.timeRange}',
              generatedAt: '\${new Date().toISOString()}'
            },
            format: '\${input.format || "pdf"}',
            title: 'Business Insights Report - \${input.reportType}'
          }
        },
        outputMapping: {
          reportUrl: 'response.reportUrl',
          reportId: 'response.id',
          downloadLink: 'response.downloadUrl'
        }
      }
    },
    {
      id: 'publish-report',
      type: 'tool',
      position: { x: 1100, y: 100 },
      data: {
        label: 'Publish Report',
        tool: 'report_publisher',
        parameters: {
          reportId: '\${node.generate-report.reportId}',
          reportUrl: '\${node.generate-report.reportUrl}',
          title: 'Business Insights Report - \${input.reportType}',
          summary: '\${node.analyze-data.summary}',
          channels: [
            {
              type: 'email',
              recipients: '\${input.recipients || ["team@company.com"]}',
              subject: 'New Business Insights Report Available'
            },
            {
              type: 'slack',
              channel: '\${input.slackChannel || "#insights"}',
              message: 'New insights report ready for review'
            },
            {
              type: 'dashboard',
              location: 'main-dashboard',
              section: 'recent-reports'
            }
          ],
          metadata: {
            type: 'insights',
            timeRange: '\${input.timeRange}',
            generatedBy: 'automated-workflow'
          }
        },
        outputMapping: {
          publishedChannels: 'published',
          notifications: 'notifications_sent'
        }
      }
    },
    {
      id: 'schedule-next',
      type: 'tool',
      position: { x: 1300, y: 100 },
      data: {
        label: 'Schedule Next Run',
        tool: 'scheduler',
        parameters: {
          workflowId: '\${workflow.id}',
          schedule: '\${input.nextSchedule || "daily@09:00"}',
          timezone: '\${input.timezone || "UTC"}',
          input: {
            reportType: '\${input.reportType}',
            timeRange: 'last_7_days',
            format: '\${input.format}',
            recipients: '\${input.recipients}',
            automated: true
          }
        },
        outputMapping: {
          nextRun: 'schedule.nextRun',
          scheduleId: 'schedule.id'
        }
      }
    },
    {
      id: 'end',
      type: 'end',
      position: { x: 1500, y: 100 },
      data: {
        label: 'Workflow Complete',
        description: 'Insights report generated and published'
      }
    }
  ],

  // Workflow edges - define the flow
  edges: [
    { id: 'e1', source: 'start', target: 'validate-request' },
    { id: 'e2', source: 'validate-request', target: 'fetch-metrics' },
    { id: 'e3', source: 'fetch-metrics', target: 'analyze-data' },
    { id: 'e4', source: 'analyze-data', target: 'generate-report' },
    { id: 'e5', source: 'generate-report', target: 'publish-report' },
    { id: 'e6', source: 'publish-report', target: 'schedule-next' },
    { id: 'e7', source: 'schedule-next', target: 'end' }
  ],

  // Configuration for the universal engine
  configuration: {
    maxConcurrentExecutions: 3,
    timeoutMinutes: 45,
    retryPolicy: 'exponential',
    
    // Define required environment variables
    requiredEnvironment: [
      'INSIGHTS_API_KEY',
      'REPORTS_API_KEY',
      'SLACK_BOT_TOKEN'
    ],
    
    // Default input schema
    inputSchema: {
      type: 'object',
      properties: {
        requestId: { type: 'string' },
        reportType: { 
          type: 'string', 
          enum: ['daily', 'weekly', 'monthly'],
          default: 'daily'
        },
        timeRange: {
          type: 'string',
          enum: ['last_24h', 'last_7_days', 'last_30_days'],
          default: 'last_7_days'
        },
        region: { type: 'string', default: 'all' },
        format: {
          type: 'string',
          enum: ['pdf', 'html', 'json'],
          default: 'pdf'
        },
        recipients: {
          type: 'array',
          items: { type: 'string' },
          default: ['team@company.com']
        },
        slackChannel: { type: 'string', default: '#insights' },
        timezone: { type: 'string', default: 'UTC' }
      },
      required: ['reportType']
    }
  },

  // Metadata for the template
  metadata: {
    tags: ['analytics', 'reporting', 'insights', 'scheduled'],
    category: 'business-intelligence',
    complexity: 'medium',
    estimatedRuntime: '5-10 minutes',
    author: 'LangChain Workflow Orchestrator',
    documentation: 'https://docs.example.com/workflows/insights',
    
    // Usage examples
    examples: [
      {
        name: 'Daily Sales Report',
        description: 'Generate daily sales insights',
        input: {
          reportType: 'daily',
          timeRange: 'last_24h',
          recipients: ['sales@company.com'],
          slackChannel: '#sales'
        }
      },
      {
        name: 'Weekly Marketing Analysis',
        description: 'Weekly marketing performance insights',
        input: {
          reportType: 'weekly',
          timeRange: 'last_7_days',
          recipients: ['marketing@company.com'],
          format: 'html'
        }
      }
    ]
  }
};

module.exports = insightsWorkflowTemplate;