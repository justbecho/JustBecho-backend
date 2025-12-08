import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // ✅ REMOVE deprecated options - NEW MONGOOSE VERSION
    const conn = await mongoose.connect(process.env.MONGO_URI);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    return conn;
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    
    // Don't exit in production - allow fallback data
    if (process.env.NODE_ENV === 'production') {
      console.log("⚠️ Continuing without MongoDB (using fallback data)");
      return null;
    } else {
      process.exit(1);
    }
  }
};

export default connectDB;