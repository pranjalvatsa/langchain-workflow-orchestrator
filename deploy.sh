#!/bin/bash

# Deploy LangChain Workflow Backend to Render
echo "🚀 Deploying LangChain Workflow Backend to Render..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Check if render.yaml exists
if [ ! -f "render.yaml" ]; then
    echo "❌ Error: render.yaml not found. Please create the render.yaml file first."
    exit 1
fi

# Check for required environment variables
echo "📋 Checking required environment variables..."

required_vars=("OPENAI_API_KEY" "MONGODB_URI")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "⚠️  Warning: The following environment variables are not set:"
    printf '   - %s\n' "${missing_vars[@]}"
    echo "   Make sure to set these in your Render dashboard."
fi

# Build check
echo "🔧 Running build check..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Error: npm install failed"
    exit 1
fi

# Test the application
echo "🧪 Testing application..."
npm test --passWithNoTests
if [ $? -ne 0 ]; then
    echo "⚠️  Warning: Tests failed, but continuing with deployment..."
fi

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit for LangChain Workflow Backend"
fi

echo "✅ Pre-deployment checks complete!"
echo ""
echo "📋 Next steps:"
echo "1. Push this code to your GitHub repository"
echo "2. Connect your GitHub repo to Render"
echo "3. Set environment variables in Render dashboard:"
echo "   - OPENAI_API_KEY"
echo "   - MONGODB_URI (or create a MongoDB Atlas cluster)"
echo "   - JWT_SECRET (will be auto-generated if not provided)"
echo "   - FRONTEND_URL (your Noam app URL)"
echo ""
echo "4. Your API will be available at: https://your-service-name.onrender.com"
echo ""
echo "🎯 Endpoints for Noam integration:"
echo "   - Health Check: https://your-service-name.onrender.com/health"
echo "   - Templates: https://your-service-name.onrender.com/api/templates"
echo "   - Customer Workflows: https://your-service-name.onrender.com/api/customer-workflows"