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
// ✅ ULTRA SIMPLE CORS - NO WILDCARD ERRORS
// ✅ ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅

// ✅ SIMPLE CORS Configuration
const corsOptions = {
  origin: [
    'https://www.justbecho.com',
    'https://justbecho.com',
    'https://just-becho-frontend.vercel.app',
    'https://justbecho-frontend.vercel.app',
    'https://justbecho.vercel.app',
    'https://just-becho.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Token']
};

// Apply CORS middleware
app.use(cors(corsOptions));

// ✅ MANUAL CORS HEADERS (Backup)
app.use((req, res, next) => {
  // Add CORS headers to ALL responses
  const origin = req.headers.origin;
  
  // Check if origin is in allowed list
  const allowedOrigins = [
    'https://www.justbecho.com',
    'https://justbecho.com',
    'https://just-becho-frontend.vercel.app',
    'http://localhost:3000'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token');
  
  // Handle preflight requests
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
// ✅ RAZORPAY DEBUG ENDPOINTS
// ✅ ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅

// ✅ RAZORPAY DEBUG - Check if keys are loaded
app.get("/api/razorpay/debug", (req, res) => {
  const keyId = process.env.RAZORPAY_LIVE_KEY_ID;
  const keySecret = process.env.RAZORPAY_LIVE_SECRET_KEY;
  
  console.log('🔐 Razorpay Debug Request');
  console.log('   Key ID exists:', !!keyId);
  console.log('   Key Secret exists:', !!keySecret);
  
  res.json({
    success: true,
    razorpay: {
      keyIdExists: !!keyId,
      keySecretExists: !!keySecret,
      keyIdPrefix: keyId ? keyId.substring(0, 10) + '...' : 'none',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    },
    server: {
      name: 'JustBecho API',
      version: '2.6.4'
    }
  });
});

// ✅ RAZORPAY TEST ORDER (for debugging - No auth required)
app.post("/api/razorpay/test-order", async (req, res) => {
  try {
    console.log('🧪 Razorpay Test Order Request');
    
    // Dynamic import for Razorpay
    const Razorpay = (await import('razorpay')).default;
    
    const keyId = process.env.RAZORPAY_LIVE_KEY_ID;
    const keySecret = process.env.RAZORPAY_LIVE_SECRET_KEY;
    
    console.log('🔐 Test Order - Keys Check:', {
      keyId: keyId ? 'Present' : 'Missing',
      keySecret: keySecret ? 'Present' : 'Missing'
    });
    
    if (!keyId || !keySecret) {
      return res.status(400).json({
        success: false,
        message: 'Razorpay keys missing in environment',
        keys: {
          RAZORPAY_LIVE_KEY_ID: !!keyId,
          RAZORPAY_LIVE_SECRET_KEY: !!keySecret
        }
      });
    }
    
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
    
    console.log('📦 Creating test Razorpay order...');
    
    const testOrder = await razorpay.orders.create({
      amount: 100, // ₹1 test (100 paise)
      currency: 'INR',
      receipt: `test_${Date.now()}`,
      payment_capture: 1
    });
    
    console.log('✅ Test Razorpay order created:', testOrder.id);
    
    res.json({
      success: true,
      message: 'Razorpay test successful',
      order: {
        id: testOrder.id,
        amount: testOrder.amount,
        currency: testOrder.currency,
        receipt: testOrder.receipt,
        status: testOrder.status
      }
    });
  } catch (error) {
    console.error('❌ Razorpay test error:', error.message);
    console.error('Error details:', error.error || error);
    
    res.status(500).json({
      success: false,
      message: 'Razorpay test failed: ' + error.message,
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code,
        details: error.error
      } : undefined
    });
  }
});

// ✅ Health check endpoint
app.get("/api/health", (req, res) => {
  const keyId = process.env.RAZORPAY_LIVE_KEY_ID;
  const keySecret = process.env.RAZORPAY_LIVE_SECRET_KEY;
  
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      razorpay: {
        configured: !!keyId && !!keySecret,
        keyIdPresent: !!keyId,
        keySecretPresent: !!keySecret
      },
      cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME,
      cors: 'enabled'
    }
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
  res.json({ 
    message: "Just Becho API is running",
    timestamp: new Date().toISOString(),
    version: "2.6.4",
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
      testDb: "/api/test-db",
      razorpayDebug: "/api/razorpay/debug",
      razorpayTest: "/api/razorpay/test-order (POST)"
    }
  });
});

// ✅ 404 handler
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
    timestamp: new Date().toISOString()
  });
});

// ✅ Global error handler
app.use((error, req, res, next) => {
  console.error('💥 Global error:', error.message);
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
║                  🚀 JUST BECHO SERVER 2.6.4                  ║
║                🌐 SIMPLE CORS - NO WILDCARD                  ║
║                 💳 RAZORPAY WITH DEBUG ENDPOINTS             ║
╚══════════════════════════════════════════════════════════════╝

📊 SERVER STATUS:
  ✅ Port: ${PORT}
  ✅ Environment: ${process.env.NODE_ENV || 'development'}
  ✅ Database: Connected
  ✅ CORS: Enabled
  ✅ Razorpay Keys: ${process.env.RAZORPAY_LIVE_KEY_ID ? '✅ Loaded' : '❌ Missing'}

🌐 CORS ALLOWED DOMAINS:
  ✅ https://www.justbecho.com
  ✅ https://justbecho.com
  ✅ https://just-becho-frontend.vercel.app
  ✅ http://localhost:3000

🔧 DEBUG ENDPOINTS:
  ✅ /api/razorpay/debug - Check Razorpay keys
  ✅ /api/razorpay/test-order - Test Razorpay API
  ✅ /api/health - Health check
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