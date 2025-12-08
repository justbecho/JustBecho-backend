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

// ✅ CRITICAL: DIRECT CATEGORIES ROUTE (ALWAYS AVAILABLE)
app.get("/api/categories", async (req, res) => {
  try {
    console.log("📦 /api/categories endpoint called");
    
    // If DB is connected
    if (mongoose.connection.readyState === 1) {
      try {
        // Dynamically import Category model
        const Category = (await import("./models/Category.js")).default;
        
        const categories = await Category.find({ isActive: true });
        
        if (categories.length > 0) {
          return res.json({
            success: true,
            categories: categories,
            count: categories.length,
            source: "database"
          });
        }
      } catch (dbError) {
        console.log("⚠️ Database error, using fallback categories:", dbError.message);
      }
    }
    
    // ✅ DEFAULT CATEGORIES (FALLBACK)
    const defaultCategories = [
      "Men's Fashion",
      "Women's Fashion", 
      "Footwear",
      "Accessories",
      "Watches",
      "Perfumes",
      "Toys & Collectibles",
      "Kids Fashion"
    ];
    
    res.json({
      success: true,
      categories: defaultCategories,
      count: defaultCategories.length,
      source: "fallback"
    });
    
  } catch (error) {
    console.error("❌ Categories endpoint error:", error);
    
    // ✅ SAFE FALLBACK
    res.json({
      success: true,
      categories: [
        "Men's Fashion",
        "Women's Fashion",
        "Footwear",
        "Accessories",
        "Watches",
        "Perfumes",
        "Toys & Collectibles",
        "Kids Fashion"
      ],
      count: 8,
      source: "error-fallback"
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

// ✅ Load all routes
const loadRoutes = async () => {
  try {
    console.log("📦 Loading all routes...");
    
    // Import routes
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
    app.use("/api/categories", categoryRoutes);
    
    console.log("✅ All routes loaded!");
    return true;
    
  } catch (error) {
    console.error("❌ Routes loading error:", error.message);
    return false;
  }
};

// ✅ Initialize server
const initializeServer = async () => {
  console.log("🚀 Initializing server...");
  
  // Try to connect to DB (non-blocking)
  connectDB().then(connected => {
    if (connected) {
      console.log("✅ MongoDB connection established");
    }
  }).catch(err => {
    console.error("❌ MongoDB connection error:", err);
  });
  
  // Load routes (non-blocking)
  setTimeout(async () => {
    await loadRoutes();
  }, 1000);
};

// Start initialization
initializeServer();

// ✅ 404 Handler (Should be AFTER all routes)
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
    availableRoutes: [
      '/',
      '/api/health',
      '/api/categories',
      '/api/products',
      '/api/products/category/:category',
      '/api/auth/*',
      '/api/cart/*',
      '/api/users/*',
      '/api/wishlist/*'
    ]
  });
});

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error("💥 Server Error:", err.message);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ✅ Export for Vercel
export default app;

// ✅ Local development server
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}