#!/usr/bin/env node

/**
 * MongoDB Connection Test Script
 * Usage: node test-mongodb.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const testMongoConnection = async () => {
  console.log('🔍 Testing MongoDB Connection...');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  
  // Check if MONGODB_URI is set
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable is not set');
    process.exit(1);
  }
  
  // Redacted URI for security
  const redactedUri = process.env.MONGODB_URI.replace(/mongodb\+srv:\/\/[^:]+:[^@]+@/, 'mongodb+srv://***:***@');
  console.log('📍 MongoDB URI (redacted):', redactedUri);
  
  try {
    console.log('⏳ Attempting to connect...');
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // 10 seconds
      connectTimeoutMS: 10000,
      socketTimeoutMS: 10000,
      maxPoolSize: 5,
      retryWrites: true,
      w: 'majority'
    });
    
    console.log('✅ MongoDB Connected Successfully!');
    console.log('🏠 Host:', conn.connection.host);
    console.log('📊 Database:', conn.connection.name);
    console.log('🔗 Ready State:', conn.connection.readyState); // 1 = connected
    
    // Test a simple operation
    const collections = await conn.connection.db.listCollections().toArray();
    console.log('📂 Collections found:', collections.length);
    
    // Close connection
    await mongoose.connection.close();
    console.log('🔒 Connection closed successfully');
    
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    
    if (error.message.includes('IP') || error.message.includes('whitelist')) {
      console.log('\n🛠️  SOLUTION:');
      console.log('1. Go to MongoDB Atlas Dashboard (cloud.mongodb.com)');
      console.log('2. Navigate to "Network Access"');
      console.log('3. Click "Add IP Address"');
      console.log('4. Select "Allow Access from Anywhere" (0.0.0.0/0)');
      console.log('5. Save and wait 1-2 minutes for changes to take effect');
    }
    
    process.exit(1);
  }
};

// Run the test
if (require.main === module) {
  testMongoConnection();
}

module.exports = { testMongoConnection };