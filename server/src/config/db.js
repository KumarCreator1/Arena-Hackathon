/**
 * MongoDB Connection
 * 
 * Connects to MongoDB with retry logic. Reads MONGO_URI from .env.
 * Exports a connect function for use in server startup.
 */

import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`🗄️  MongoDB connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`❌ MongoDB connection error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;
