const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const winston = require("winston");
const path = require("path");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

// Production environment configuration
const isProduction = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 8000;

// CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [process.env.FRONTEND_URL, process.env.NOAM_APP_URL, "http://localhost:3000", "http://localhost:3001"].filter(Boolean);

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
};

const io = socketIo(server, {
  cors: corsOptions,
});

// Configure Winston logger for production
const logTransports = [
  new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
  }),
];

// Add file logging in production
if (isProduction) {
  logTransports.push(
    new winston.transports.File({
      filename: path.join(__dirname, "logs", "error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "logs", "combined.log"),
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
  transports: logTransports,
});

// Ensure logs directory exists
const fs = require("fs");
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Security middleware with production settings
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

app.use(compression());

// Enhanced rate limiting for production
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: "Too many requests",
    message: "Please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS with production configuration
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// MongoDB connection
// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      connectTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 30000, // 30 seconds
      maxPoolSize: 10,
      retryWrites: true,
      w: "majority",
    });
    logger.info(`📊 MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error("Database connection failed:", error);
    logger.error("MongoDB URI (redacted):", process.env.MONGODB_URI?.replace(/mongodb\+srv:\/\/[^:]+:[^@]+@/, "mongodb+srv://***:***@"));
    process.exit(1);
  }
};

// Initialize database connection
connectDB();

// Import routes
const authRoutes = require("./src/routes/auth");
const executionRoutes = require("./src/routes/executions");
const userRoutes = require("./src/routes/users");
const webhookRoutes = require("./src/routes/webhooks");
const apiKeyRoutes = require("./src/routes/apiKeys");
const workflowRoutes = require("./src/routes/workflows");

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "LangChain Backend is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/executions", executionRoutes);
app.use("/api/users", userRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/keys", apiKeyRoutes);
app.use("/api/universal", require("./src/routes/universal"));
app.use("/api/templates", require("./src/routes/templates"));
app.use("/api/workflows", workflowRoutes);

// Legacy endpoints for backward compatibility
app.post("/api/workflows/execute", async (req, res) => {
  try {
    const { workflowId, nodes, edges, context } = req.body;

    // Import LangChain modules dynamically
    const { ChatOpenAI } = await import("@langchain/openai");
    const { PromptTemplate } = await import("@langchain/core/prompts");

    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-3.5-turbo",
      temperature: 0.7,
    });

    // Simple workflow execution logic
    const results = [];

    for (const node of nodes) {
      if (node.data.langchainType === "agent") {
        const prompt = PromptTemplate.fromTemplate(node.data.prompt || "Process this: {input}");
        const chain = prompt.pipe(llm);

        const result = await chain.invoke({
          input: context.input || "Hello, world!",
        });

        results.push({
          nodeId: node.id,
          type: "agent",
          result: result.content,
          timestamp: new Date().toISOString(),
        });
      }
    }

    res.json({
      executionId: `exec-${Date.now()}`,
      workflowId,
      status: "completed",
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Workflow execution error:", error);
    res.status(500).json({
      error: "Workflow execution failed",
      message: error.message,
    });
  }
});

// Agent execution endpoint
app.post("/api/agents/execute", async (req, res) => {
  try {
    const { prompt, model = "gpt-3.5-turbo", temperature = 0.7, input } = req.body;

    const { ChatOpenAI } = await import("@langchain/openai");
    const { PromptTemplate } = await import("@langchain/core/prompts");

    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: model,
      temperature,
    });

    const promptTemplate = PromptTemplate.fromTemplate(prompt);
    const chain = promptTemplate.pipe(llm);

    const result = await chain.invoke({ input });

    res.json({
      result: result.content,
      model,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Agent execution error:", error);
    res.status(500).json({
      error: "Agent execution failed",
      message: error.message,
    });
  }
});

// Workflow templates endpoint
app.get("/api/templates", (req, res) => {
  const templates = [
    {
      id: "customer-offer-prediction",
      name: "Customer Offer Prediction",
      description: "AI-powered customer offer prediction with human approval",
      category: "customer-engagement",
      nodes: [
        {
          id: "start-1",
          type: "trigger",
          data: { label: "Start", langchainType: "trigger" },
        },
        {
          id: "api-1",
          type: "tool",
          data: { label: "Customer Data API", langchainType: "tool" },
        },
        {
          id: "agent-1",
          type: "agent",
          data: {
            label: "AI Offer Prediction",
            langchainType: "agent",
            prompt: "Analyze customer data and generate personalized offer: {input}",
          },
        },
        {
          id: "human-1",
          type: "humanReview",
          data: { label: "Human Approval", langchainType: "humanReview" },
        },
      ],
    },
    {
      id: "support-template",
      name: "AI Customer Support",
      description: "Automated customer support workflow",
      category: "support",
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          data: { label: "Support Ticket", langchainType: "trigger" },
        },
        {
          id: "agent-1",
          type: "agent",
          data: {
            label: "Issue Classifier",
            langchainType: "agent",
            prompt: "Classify this support issue and provide a helpful response: {input}",
          },
        },
      ],
    },
  ];

  res.json(templates);
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on("join_execution", (executionId) => {
    socket.join(`execution_${executionId}`);
    logger.info(`Client ${socket.id} joined execution room: ${executionId}`);
  });

  socket.on("disconnect", () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error("Unhandled error:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.message : "Something went wrong",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on("join_execution", (executionId) => {
    socket.join(`execution_${executionId}`);
    logger.info(`Client ${socket.id} joined execution room: ${executionId}`);
  });

  socket.on("disconnect", () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error("Unhandled error:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.message : "Something went wrong",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});

server.listen(PORT, () => {
  logger.info(`🚀 LangChain Backend running on http://localhost:${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  logger.info(`🎯 Customer Workflows: http://localhost:${PORT}/api/customer-workflows`);
});

module.exports = { app, server, io };
