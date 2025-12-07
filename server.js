import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";

// Load environment variables
dotenv.config();

const app = express();

// ✅ CORS Configuration
app.use(cors({
  origin: '*', // Sab allow karo for now
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ IMMEDIATELY AVAILABLE ROUTES (ALWAYS WORK)
app.get("/", (req, res) => {
  res.json({ 
    message: "🚀 Just Becho API is running",
    version: "1.0.0"
  });
});

app.get("/api/health", (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// ✅ CRITICAL FIX: Categories ALWAYS available
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

// ✅ Connect to MongoDB (WITH TIMEOUT)
const connectDB = async () => {
  try {
    console.log("🔗 Attempting MongoDB connection...");
    
    const mongoURI = process.env.MONGODB_URI || "mongodb+srv://Karan:Karan2021@justbecho-cluster.cbqu2mf.mongodb.net/justbecho?retryWrites=true&w=majority";
    
    // 5 second timeout
    const connectionPromise = mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    
    // Timeout set karo
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('MongoDB connection timeout')), 5000)
    );
    
    await Promise.race([connectionPromise, timeoutPromise]);
    
    console.log("✅ MongoDB Connected!");
    return true;
    
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    return false;
  }
};

// ✅ Load routes EVEN IF DB FAILS
const loadRoutes = async () => {
  try {
    console.log("📦 Loading routes...");
    
    // Import routes (sync - no await needed)
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
    app.use("/api/categories", categoryRoutes); // Override the simple one
    
    console.log("✅ All routes loaded!");
    return true;
    
  } catch (error) {
    console.error("❌ Routes loading error:", error.message);
    return false;
  }
};

// ✅ Initialize server
const initializeServer = async () => {
  // Try to connect DB
  const dbConnected = await connectDB();
  
  // Load routes REGARDLESS of DB connection
  const routesLoaded = await loadRoutes();
  
  if (!dbConnected) {
    console.log("⚠️ Running without database connection");
  }
  
  if (!routesLoaded) {
    console.log("⚠️ Some routes may not be available");
  }
};

// Start initialization
initializeServer();

// ✅ 404 Handler
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`
  });
});

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error("💥 Error:", err.message);
  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});

const PORT = process.env.PORT || 8000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;