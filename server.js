import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';

// ✅ Load environment variables FIRST
dotenv.config();

console.log('🚀 Server starting...');
console.log('📊 Environment:', process.env.NODE_ENV || 'development');
console.log('💳 Razorpay Key Available:', !!process.env.RAZORPAY_LIVE_KEY_ID);

// Hardcode Telegram Token if needed
if (!process.env.TELEGRAM_BOT_TOKEN) {
  process.env.TELEGRAM_BOT_TOKEN = "8478776735:AAGW_4rg8BeSy29xDLQrDCZA1pDolRxZUuk";
  console.log("✅ Telegram Token Hardcoded");
}

// ✅ CONFIGURE CLOUDINARY
console.log('☁️ Initializing Cloudinary...');
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

console.log('☁️ Cloudinary Config Status:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing',
  api_key: process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing',
  api_secret: process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing'
});

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ MONGOOSE CONNECTION
const connectDB = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://Karan:Karan2021@justbecho-cluster.cbqu2mf.mongodb.net/justbecho?retryWrites=true&w=majority";
    
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10
    });
    
    console.log('✅ MongoDB Connected Successfully');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

// ✅ IMPORT MODELS
import './models/User.js';
import './models/Product.js';
import './models/Cart.js';
import './models/Order.js'; // ✅ NEW: Order model

// ✅ IMPORT ROUTES
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import wishlistRoutes from "./routes/Wishlist.js";
import cartRoutes from "./routes/cartRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import razorpayOrderRoutes from "./routes/razorpayOrder.js"; // ✅ NEW
import razorpayVerifyRoutes from "./routes/razorpayVerify.js"; // ✅ NEW

const app = express();

// ✅ ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅
// ✅ FIXED CORS CONFIGURATION - WORKING FOR www.justbecho.com
// ✅ ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅

// ✅ METHOD 1: Use cors package (Recommended)
// npm install cors karna hoga pehle

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    console.log('🌐 CORS Origin Check:', origin);
    
    // ✅ ALLOWED DOMAINS
    const allowedDomains = [
      // Production domains
      'https://www.justbecho.com',
      'https://justbecho.com',
      
      // Vercel deployments
      'https://just-becho-frontend.vercel.app',
      'https://justbecho-frontend.vercel.app',
      'https://justbecho.vercel.app',
      'https://just-becho.vercel.app',
      
      // Local development
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      
      // For testing
      'https://just-becho-backend.vercel.app'
    ];
    
    // Check if origin is in allowed domains
    const isAllowed = allowedDomains.includes(origin);
    
    // Also check if it's a subdomain of justbecho.com
    const isJustBechoSubdomain = origin.endsWith('.justbecho.com');
    
    if (isAllowed || isJustBechoSubdomain) {
      console.log(`✅ CORS Allowed: ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS Blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin', 
    'X-Requested-With', 
    'Content-Type', 
    'Accept', 
    'Authorization',
    'X-Auth-Token',
    'X-API-Key'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// ✅ METHOD 2: Manual CORS as backup
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Skip if no origin
  if (!origin) {
    return next();
  }
  
  // Manual CORS headers for specific routes if needed
  const manualAllowedOrigins = [
    'https://www.justbecho.com',
    'https://justbecho.com',
    'http://localhost:3000'
  ];
  
  if (manualAllowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Auth-Token, X-API-Key');
  }
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// ✅ Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  console.log(`📍 ${new Date().toISOString()} - ${req.method} ${req.url} | Origin: ${req.headers.origin || 'No Origin'}`);
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`✅ ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ ALL ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/razorpay", razorpayOrderRoutes); // ✅ NEW: Razorpay routes
app.use("/api/razorpay", razorpayVerifyRoutes); // ✅ NEW: Payment verification

// ✅ ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅
// ✅ CORS DEBUG ENDPOINTS
// ✅ ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅

// Test CORS with detailed response
app.get("/api/test-cors", (req, res) => {
  console.log('🔧 Test CORS endpoint hit');
  console.log('🌐 Headers:', req.headers);
  
  res.json({
    success: true,
    message: 'CORS test successful',
    origin: req.headers.origin,
    host: req.headers.host,
    timestamp: new Date().toISOString(),
    cors: {
      allowed: true,
      method: req.method,
      path: req.path
    },
    server: {
      name: 'JustBecho API',
      version: '2.6.1',
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// Simple health check with CORS
app.get("/api/health", (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      razorpay: !!process.env.RAZORPAY_LIVE_KEY_ID ? 'configured' : 'not configured',
      cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME,
      cors: 'enabled'
    },
    cors: {
      origin: req.headers.origin,
      allowed: true
    }
  });
});

// CORS debug for specific domain check
app.get("/api/cors-check", (req, res) => {
  const origin = req.headers.origin;
  const allowedDomains = [
    'https://www.justbecho.com',
    'https://justbecho.com',
    'https://just-becho-frontend.vercel.app',
    'http://localhost:3000'
  ];
  
  const isAllowed = allowedDomains.includes(origin);
  
  res.json({
    origin: origin,
    isAllowed: isAllowed,
    allowedDomains: allowedDomains,
    serverTime: new Date().toISOString(),
    advice: isAllowed ? '✅ Your domain is allowed' : '❌ Your domain is NOT in allowed list'
  });
});

// ✅ Simple database test
app.get("/api/test-db", async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    res.json({
      success: true,
      database: states[dbState] || 'unknown',
      readyState: dbState,
      connection: mongoose.connection.host || 'unknown'
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// ✅ API Documentation endpoint
app.get("/", (req, res) => {
  const origin = req.headers.origin;
  
  res.json({ 
    message: "Just Becho API is running",
    timestamp: new Date().toISOString(),
    version: "2.6.1",
    cors: {
      status: "enabled",
      origin: origin,
      allowed: true
    },
    endpoints: {
      auth: "/api/auth",
      products: "/api/products",
      wishlist: "/api/wishlist",
      users: "/api/users",
      categories: "/api/categories",
      cart: "/api/cart",
      admin: "/api/admin",
      razorpay: "/api/razorpay",
      health: "/api/health",
      testCors: "/api/test-cors",
      testDb: "/api/test-db",
      corsCheck: "/api/cors-check"
    },
    documentation: "Add /api/{endpoint} to access APIs"
  });
});

// ✅ 404 handler with CORS
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.url} from ${req.headers.origin}`);
  
  // Set CORS headers even for 404
  const origin = req.headers.origin;
  if (origin && origin.includes('justbecho.com') || origin && origin.includes('vercel.app')) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.status(404).json({ 
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
    timestamp: new Date().toISOString()
  });
});

// ✅ Global error handler with CORS
app.use((error, req, res, next) => {
  console.error('💥 Global error:', error.message);
  
  // Set CORS headers for errors
  const origin = req.headers.origin;
  if (origin && origin.includes('justbecho.com') || origin && origin.includes('vercel.app')) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// ✅ START SERVER
const startServer = async () => {
  try {
    await connectDB();
    
    const PORT = process.env.PORT || 8000;
    
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                  🚀 JUST BECHO SERVER 2.6.1                  ║
║                 🌐 CORS FIXED FOR www.justbecho.com          ║
║                 💳 RAZORPAY PAYMENT INTEGRATED               ║
╚══════════════════════════════════════════════════════════════╝

📊 SERVER STATUS:
  ✅ Port: ${PORT}
  ✅ Environment: ${process.env.NODE_ENV || 'development'}
  ✅ Database: Connected
  ✅ CORS: Enabled
  ✅ Razorpay: ${process.env.RAZORPAY_LIVE_KEY_ID ? '✅ Configured' : '❌ Not Configured'}

🌐 CORS ALLOWED DOMAINS:
  ✅ https://www.justbecho.com
  ✅ https://justbecho.com
  ✅ https://just-becho-frontend.vercel.app
  ✅ http://localhost:3000

🔧 TEST ENDPOINTS:
  ✅ /api/test-cors - CORS test
  ✅ /api/health - Health check
  ✅ /api/cors-check - CORS domain check
  ✅ /api/test-db - Database test

📡 AVAILABLE API ENDPOINTS:
  🔐 Auth:        http://localhost:${PORT}/api/auth
  🛍️  Products:    http://localhost:${PORT}/api/products
  ❤️  Wishlist:    http://localhost:${PORT}/api/wishlist
  👤 Users:       http://localhost:${PORT}/api/users
  📁 Categories:  http://localhost:${PORT}/api/categories
  🛒  Cart:        http://localhost:${PORT}/api/cart
  👑 Admin:       http://localhost:${PORT}/api/admin
  💳 Razorpay:   http://localhost:${PORT}/api/razorpay

──────────────────────────────────────────────────────────────
✅ Server is running. Press Ctrl+C to stop.
──────────────────────────────────────────────────────────────
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;