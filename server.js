// ✅ server.js - UPDATED VERSION (hardcoded route removed)

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";

// Load environment variables
dotenv.config();

const app = express();

// ✅ CORS Configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://justbecho.vercel.app', 'https://just-becho-frontend.vercel.app'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ Favicon handler
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ✅ IMMEDIATELY AVAILABLE ROUTES
app.get("/", (req, res) => {
  res.json({ 
    message: "🚀 Just Becho API",
    version: "1.0.0",
    status: 'healthy'
  });
});

app.get("/api/health", (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// ❌❌❌ HARDCODED CATEGORIES ROUTE REMOVED ❌❌❌
// Aapke categoryRoutes.js wali route database se categories legi

// ✅ CRITICAL FIX: Add missing route that frontend expects
app.get("/api/products/category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 4 } = req.query;
    
    console.log(`📦 Products by category: ${category}, limit: ${limit}`);
    
    // If DB not connected, return empty
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        category: category,
        products: [],
        message: "Database initializing"
      });
    }
    
    // Import Product model
    const Product = (await import("./models/Product.js")).default;
    
    // Build query
    let query = { 
      status: 'active', 
      expiresAt: { $gt: new Date() },
      category: new RegExp(category, 'i')
    };
    
    const products = await Product.find(query)
      .populate('seller', 'name email avatar username')
      .sort({ createdAt: -1 })
      .limit(Number(limit));
    
    res.json({
      success: true,
      category: category,
      products: products,
      count: products.length
    });
    
  } catch (error) {
    console.error(`❌ /api/products/category error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ✅ FIXED: Also support query parameter route
app.get("/api/products", async (req, res) => {
  try {
    const { category, limit = 20, page = 1, search } = req.query;
    
    console.log(`📦 Products query: category=${category}, limit=${limit}`);
    
    // If DB not connected, return empty
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        products: [],
        totalPages: 0,
        currentPage: 1,
        total: 0
      });
    }
    
    // Import Product model
    const Product = (await import("./models/Product.js")).default;
    
    // Build query
    let query = { 
      status: 'active', 
      expiresAt: { $gt: new Date() }
    };
    
    if (category) {
      query.category = new RegExp(category, 'i');
    }
    
    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const limitNum = parseInt(limit);
    const skip = (parseInt(page) - 1) * limitNum;
    
    const products = await Product.find(query)
      .populate('seller', 'name email avatar username')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);
    
    const total = await Product.countDocuments(query);
    
    res.json({
      success: true,
      products: products,
      totalPages: Math.ceil(total / limitNum),
      currentPage: parseInt(page),
      total: total
    });
    
  } catch (error) {
    console.error(`❌ /api/products error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ✅ Connect to MongoDB
const connectDB = async () => {
  try {
    console.log("🔗 Connecting to MongoDB...");
    
    const mongoURI = process.env.MONGODB_URI || "mongodb+srv://Karan:Karan2021@justbecho-cluster.cbqu2mf.mongodb.net/justbecho?retryWrites=true&w=majority";
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log("✅ MongoDB Connected!");
    return true;
    
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    return false;
  }
};

// ✅ Load routes
const loadRoutes = async () => {
  try {
    console.log("📦 Loading routes...");
    
    const authRoutes = (await import("./routes/authRoutes.js")).default;
    const productRoutes = (await import("./routes/productRoutes.js")).default;
    const cartRoutes = (await import("./routes/cartRoutes.js")).default;
    const userRoutes = (await import("./routes/userRoutes.js")).default;
    const wishlistRoutes = (await import("./routes/Wishlist.js")).default;
    const categoryRoutes = (await import("./routes/categoryRoutes.js")).default;
    
    // Register routes
    app.use("/api/auth", authRoutes);
    app.use("/api/products", productRoutes);
    app.use("/api/cart", cartRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/wishlist", wishlistRoutes);
    app.use("/api/categories", categoryRoutes); // ✅ Yeh ab database se categories legi
    
    console.log("✅ All routes loaded!");
    return true;
    
  } catch (error) {
    console.error("❌ Routes loading error:", error.message);
    return false;
  }
};

// ✅ Initialize
const initializeServer = async () => {
  await connectDB();
  await loadRoutes();
};

initializeServer();

// ✅ 404 Handler
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
    availableRoutes: [
      '/',
      '/api/health',
      '/api/categories', // ✅ Ab yeh database route hai
      '/api/products',
      '/api/products/category/:category',
      '/api/auth/*',
      '/api/cart/*',
      '/api/users/*',
      '/api/wishlist/*'
    ]
  });
});

// ✅ Error Handler
app.use((err, req, res, next) => {
  console.error("💥 Error:", err.message);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 8000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;