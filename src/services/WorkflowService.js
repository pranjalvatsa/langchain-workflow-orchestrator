const { Workflow } = require('../models');
const LangChainService = require('./LangChainService');
const winston = require('winston');

class WorkflowService {
  constructor() {
    this.langChainService = new LangChainService();
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/workflow.log' })
      ]
    });
  }

  async createWorkflow(workflowData, userId) {
    try {
      const {
        name,
        description,
        nodes = [],
        edges = [],
        configuration = {},
        tags = [],
        category = 'general'
      } = workflowData;

      // Validate workflow structure
      const validation = await this.validateWorkflow({ nodes, edges });
      if (!validation.valid) {
        throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
      }

      // Create workflow
      const workflow = new Workflow({
        name,
        description,
        ownerId: userId,
        nodes: this.processNodes(nodes),
        edges: this.processEdges(edges),
        configuration: {
          maxConcurrentExecutions: configuration.maxConcurrentExecutions || 5,
          timeoutMinutes: configuration.timeoutMinutes || 30,
          retryPolicy: configuration.retryPolicy || 'none',
          ...configuration
        },
        metadata: {
          tags,
          category,
          nodeCount: nodes.length,
          edgeCount: edges.length,
          complexity: this.calculateComplexity(nodes, edges)
        },
        version: '1.0.0',
        status: 'draft'
      });

      await workflow.save();

      this.logger.info(`Workflow created: ${workflow._id} by user ${userId}`);
      return workflow;
    } catch (error) {
      this.logger.error('Error creating workflow:', error);
      throw error;
    }
  }

  async updateWorkflow(workflowId, updates, userId) {
    try {
      const workflow = await Workflow.findById(workflowId);
      
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      if (workflow.ownerId.toString() !== userId) {
        throw new Error('Unauthorized to update this workflow');
      }

      // If updating nodes/edges, validate the workflow
      if (updates.nodes || updates.edges) {
        const nodes = updates.nodes || workflow.nodes;
        const edges = updates.edges || workflow.edges;
        
        const validation = await this.validateWorkflow({ nodes, edges });
        if (!validation.valid) {
          throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
        }

        // Process nodes and edges
        if (updates.nodes) {
          updates.nodes = this.processNodes(updates.nodes);
        }
        if (updates.edges) {
          updates.edges = this.processEdges(updates.edges);
        }

        // Update metadata
        updates.metadata = {
          ...workflow.metadata,
          nodeCount: nodes.length,
          edgeCount: edges.length,
          complexity: this.calculateComplexity(nodes, edges),
          lastModified: new Date()
        };
      }

      // Create new version if major changes
      if (this.isMajorChange(workflow, updates)) {
        updates.version = this.incrementVersion(workflow.version);
        
        // Archive current version
        await this.archiveVersion(workflow);
      }

      const updatedWorkflow = await Workflow.findByIdAndUpdate(
        workflowId,
        { $set: updates },
        { new: true }
      );

      this.logger.info(`Workflow updated: ${workflowId} by user ${userId}`);
      return updatedWorkflow;
    } catch (error) {
      this.logger.error('Error updating workflow:', error);
      throw error;
    }
  }

  async getWorkflow(workflowId, userId) {
    try {
      const workflow = await Workflow.findById(workflowId);
      
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      // Check permissions
      if (workflow.ownerId.toString() !== userId && 
          !workflow.sharing.collaborators.some(c => c.userId.toString() === userId) &&
          workflow.sharing.public !== true) {
        throw new Error('Unauthorized to access this workflow');
      }

      return workflow;
    } catch (error) {
      this.logger.error('Error getting workflow:', error);
      throw error;
    }
  }

  async listWorkflows(userId, filters = {}) {
    try {
      const query = {
        $or: [
          { ownerId: userId },
          { 'sharing.collaborators.userId': userId },
          { 'sharing.public': true }
        ]
      };

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.category) {
        query['metadata.category'] = filters.category;
      }

      if (filters.tags && filters.tags.length > 0) {
        query['metadata.tags'] = { $in: filters.tags };
      }

      if (filters.search) {
        query.$text = { $search: filters.search };
      }

      const workflows = await Workflow.find(query)
        .sort({ 'metadata.lastModified': -1 })
        .limit(filters.limit || 50)
        .skip(filters.offset || 0);

      return workflows;
    } catch (error) {
      this.logger.error('Error listing workflows:', error);
      throw error;
    }
  }

  async deleteWorkflow(workflowId, userId) {
    try {
      const workflow = await Workflow.findById(workflowId);
      
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      if (workflow.ownerId.toString() !== userId) {
        throw new Error('Unauthorized to delete this workflow');
      }

      await Workflow.findByIdAndDelete(workflowId);

      this.logger.info(`Workflow deleted: ${workflowId} by user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error('Error deleting workflow:', error);
      throw error;
    }
  }

  async shareWorkflow(workflowId, userId, sharing) {
    try {
      const workflow = await Workflow.findById(workflowId);
      
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      if (workflow.ownerId.toString() !== userId) {
        throw new Error('Unauthorized to share this workflow');
      }

      workflow.sharing = {
        ...workflow.sharing,
        ...sharing,
        lastUpdated: new Date()
      };

      await workflow.save();

      this.logger.info(`Workflow sharing updated: ${workflowId} by user ${userId}`);
      return workflow;
    } catch (error) {
      this.logger.error('Error sharing workflow:', error);
      throw error;
    }
  }

  async validateWorkflow(workflow) {
    try {
      return await this.langChainService.validateWorkflow(workflow);
    } catch (error) {
      this.logger.error('Error validating workflow:', error);
      return {
        valid: false,
        errors: [error.message],
        warnings: []
      };
    }
  }

  processNodes(nodes) {
    return nodes.map(node => ({
      ...node,
      id: node.id || this.generateNodeId(),
      position: node.position || { x: 0, y: 0 },
      config: {
        ...node.config,
        retryCount: 0
      },
      metadata: {
        ...node.metadata,
        createdAt: new Date(),
        lastModified: new Date()
      }
    }));
  }

  processEdges(edges) {
    return edges.map(edge => ({
      ...edge,
      id: edge.id || this.generateEdgeId(),
      metadata: {
        ...edge.metadata,
        createdAt: new Date()
      }
    }));
  }

  calculateComplexity(nodes, edges) {
    // Simple complexity calculation
    let complexity = 0;
    
    // Base complexity from node count
    complexity += nodes.length;
    
    // Add complexity for different node types
    nodes.forEach(node => {
      switch (node.type) {
        case 'llm':
          complexity += 2;
          break;
        case 'tool':
          complexity += 1;
          break;
        case 'condition':
          complexity += 3;
          break;
        case 'loop':
          complexity += 4;
          break;
        default:
          complexity += 1;
      }
    });

    // Add complexity for branching
    const branchingFactor = edges.length - nodes.length + 1;
    complexity += Math.max(0, branchingFactor * 2);

    return Math.min(complexity, 100); // Cap at 100
  }

  isMajorChange(workflow, updates) {
    // Consider it a major change if:
    // - Adding/removing nodes
    // - Changing node types
    // - Modifying core configuration
    
    if (updates.nodes) {
      if (updates.nodes.length !== workflow.nodes.length) {
        return true;
      }
      
      for (let i = 0; i < updates.nodes.length; i++) {
        const oldNode = workflow.nodes.find(n => n.id === updates.nodes[i].id);
        if (!oldNode || oldNode.type !== updates.nodes[i].type) {
          return true;
        }
      }
    }

    if (updates.configuration && updates.configuration.maxConcurrentExecutions !== workflow.configuration.maxConcurrentExecutions) {
      return true;
    }

    return false;
  }

  incrementVersion(currentVersion) {
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    return `${major + 1}.0.0`;
  }

  async archiveVersion(workflow) {
    // In a real implementation, you might save to a separate collection
    // or use a versioning system
    this.logger.info(`Archiving version ${workflow.version} of workflow ${workflow._id}`);
  }

  generateNodeId() {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateEdgeId() {
    return `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getWorkflowStats(workflowId, userId) {
    try {
      const workflow = await this.getWorkflow(workflowId, userId);
      
      // Get execution statistics
      const { WorkflowExecution } = require('../models');
      const executions = await WorkflowExecution.find({ workflowId });
      
      const stats = {
        totalExecutions: executions.length,
        successfulExecutions: executions.filter(e => e.status === 'completed').length,
        failedExecutions: executions.filter(e => e.status === 'failed').length,
        averageDuration: 0,
        lastExecution: null
      };

      if (executions.length > 0) {
        const completedExecutions = executions.filter(e => e.status === 'completed' && e.metrics.duration);
        
        if (completedExecutions.length > 0) {
          stats.averageDuration = completedExecutions.reduce((sum, e) => sum + e.metrics.duration, 0) / completedExecutions.length;
        }
        
        stats.lastExecution = executions.sort((a, b) => b.metrics.startTime - a.metrics.startTime)[0];
      }

      return stats;
    } catch (error) {
      this.logger.error('Error getting workflow stats:', error);
      throw error;
    }
  }

  async exportWorkflow(workflowId, userId, format = 'json') {
    try {
      const workflow = await this.getWorkflow(workflowId, userId);
      
      const exportData = {
        name: workflow.name,
        description: workflow.description,
        nodes: workflow.nodes,
        edges: workflow.edges,
        configuration: workflow.configuration,
        metadata: workflow.metadata,
        version: workflow.version,
        exportedAt: new Date(),
        exportedBy: userId
      };

      switch (format) {
        case 'json':
          return JSON.stringify(exportData, null, 2);
        case 'yaml':
          const yaml = require('js-yaml');
          return yaml.dump(exportData);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      this.logger.error('Error exporting workflow:', error);
      throw error;
    }
  }

  async importWorkflow(workflowData, userId, format = 'json') {
    try {
      let parsedData;
      
      switch (format) {
        case 'json':
          parsedData = JSON.parse(workflowData);
          break;
        case 'yaml':
          const yaml = require('js-yaml');
          parsedData = yaml.load(workflowData);
          break;
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }

      // Create new workflow from imported data
      const newWorkflow = await this.createWorkflow({
        name: `${parsedData.name} (Imported)`,
        description: parsedData.description,
        nodes: parsedData.nodes,
        edges: parsedData.edges,
        configuration: parsedData.configuration,
        tags: parsedData.metadata?.tags || [],
        category: parsedData.metadata?.category || 'general'
      }, userId);

      this.logger.info(`Workflow imported: ${newWorkflow._id} by user ${userId}`);
      return newWorkflow;
    } catch (error) {
      this.logger.error('Error importing workflow:', error);
      throw error;
    }
  }

  // Universal workflow engine methods
  async getWorkflowById(workflowId) {
    try {
      const workflow = await Workflow.findById(workflowId);
      return workflow;
    } catch (error) {
      this.logger.error('Error fetching workflow by ID:', error);
      throw error;
    }
  }

  async getWorkflowByTemplateId(templateId) {
    try {
      const workflow = await Workflow.findOne({ templateId: templateId });
      return workflow;
    } catch (error) {
      this.logger.error('Error fetching workflow by template ID:', error);
      throw error;
    }
  }

  async getWorkflowsByTriggerType(eventType) {
    try {
      // Find workflows that have trigger configurations for this event type
      const workflows = await Workflow.find({
        'configuration.triggers': {
          $elemMatch: { eventType: eventType, enabled: true }
        },
        status: 'published'
      });
      
      return workflows;
    } catch (error) {
      this.logger.error('Error fetching workflows by trigger type:', error);
      throw error;
    }
  }

  async createWorkflowFromTemplate(templateData, userId) {
    try {
      const {
        templateId,
        name,
        description,
        nodes = [],
        edges = [],
        triggers = [],
        configuration = {},
        category = 'template'
      } = templateData;

      // Validate workflow structure
      const validation = await this.validateWorkflow({ nodes, edges });
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
      }

      // Create workflow from template
      const workflow = new Workflow({
        templateId: templateId,
        name: name,
        description: description,
        ownerId: userId,
        nodes: this.processNodes(nodes),
        edges: this.processEdges(edges),
        configuration: {
          maxConcurrentExecutions: configuration.maxConcurrentExecutions || 5,
          timeoutMinutes: configuration.timeoutMinutes || 30,
          retryPolicy: configuration.retryPolicy || 'exponential',
          triggers: triggers.map(trigger => ({
            eventType: trigger.eventType,
            enabled: trigger.enabled !== false,
            filter: trigger.filter || {},
            priority: trigger.priority || 'normal'
          })),
          ...configuration
        },
        metadata: {
          tags: templateData.tags || [],
          category: category,
          nodeCount: nodes.length,
          edgeCount: edges.length,
          complexity: this.calculateComplexity(nodes, edges),
          isTemplate: true,
          templateVersion: templateData.version || '1.0.0'
        },
        version: templateData.version || '1.0.0',
        status: 'published'
      });

      await workflow.save();

      this.logger.info(`Workflow created from template ${templateId}: ${workflow._id} by user ${userId}`);
      return workflow;
    } catch (error) {
      this.logger.error('Error creating workflow from template:', error);
      throw error;
    }
  }
}

module.exports = WorkflowService;