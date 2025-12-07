import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";

// Load environment variables
dotenv.config();

const app = express();

// ✅ CORS Configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://just-becho-frontend.vercel.app',
    'https://justbecho.vercel.app',
    'https://justbecho-frontend.vercel.app',
    'https://just-becho.vercel.app',
    'https://justbecho.com',
    'https://www.justbecho.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ IMMEDIATELY AVAILABLE ROUTES (Work even before DB connects)
app.get("/", (req, res) => {
  res.json({ 
    message: "🚀 Just Becho API is running",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      products: "/api/products",
      cart: "/api/cart",
      categories: "/api/categories",
      health: "/api/health"
    }
  });
});

app.get("/api/health", (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'connecting'
  });
});

app.get("/api/categories", (req, res) => {
  res.json({
    success: true,
    categories: [
      "Mobile Phones", "Laptops", "Tablets", "Smart Watches",
      "Headphones", "Cameras", "Gaming Consoles", "TVs",
      "Home Appliances", "Fashion", "Books", "Sports Equipment",
      "Musical Instruments", "Furniture", "Other"
    ]
  });
});

// ✅ Connect to MongoDB and load other routes
const initializeApp = async () => {
  try {
    console.log("🔗 Connecting to MongoDB...");
    
    const mongoURI = process.env.MONGODB_URI || "mongodb+srv://Karan:Karan2021@justbecho-cluster.cbqu2mf.mongodb.net/justbecho?retryWrites=true&w=majority";
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log("✅ MongoDB Connected!");
    
    // ✅ Import all routes
    console.log("📦 Loading routes...");
    
    const authRoutes = (await import("./routes/authRoutes.js")).default;
    const productRoutes = (await import("./routes/productRoutes.js")).default;
    const cartRoutes = (await import("./routes/cartRoutes.js")).default;
    const userRoutes = (await import("./routes/userRoutes.js")).default;
    const wishlistRoutes = (await import("./routes/Wishlist.js")).default;
    const categoryRoutes = (await import("./routes/categoryRoutes.js")).default;
    
    // ✅ Register routes
    app.use("/api/auth", authRoutes);
    app.use("/api/products", productRoutes);
    app.use("/api/cart", cartRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/wishlist", wishlistRoutes);
    app.use("/api/categories", categoryRoutes);
    
    console.log("✅ All routes loaded successfully!");
    
  } catch (error) {
    console.error("❌ Initialization error:", error.message);
    console.log("⚠️ Server running with basic routes only");
    
    // Provide fallback for cart route to prevent 404
    app.use("/api/cart", (req, res) => {
      res.status(503).json({
        success: false,
        message: "Server initializing, please try again in a moment"
      });
    });
  }
};

// Start initialization (non-blocking)
initializeApp();

// ✅ 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
    availableRoutes: [
      "/",
      "/api/health",
      "/api/categories",
      "/api/auth",
      "/api/products",
      "/api/cart",
      "/api/users",
      "/api/wishlist"
    ]
  });
});

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error("💥 Server Error:", err);
  
  // Don't crash the server on Vercel
  res.status(500).json({
    success: false,
    message: "Internal server error",
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

// ✅ Start server for local development
const PORT = process.env.PORT || 8000;

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                  🚀 JUST BECHO SERVER                    ║
╚══════════════════════════════════════════════════════════╝
📊 Server running on port ${PORT}
🌐 API URL: http://localhost:${PORT}
📁 Environment: ${process.env.NODE_ENV || 'development'}
──────────────────────────────────────────────────────────
    `);
  });
}

// ✅ MUST BE AT THE END: Export for Vercel
export default app;