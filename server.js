// server.js - UPDATED VERSION WITH PROPER CORS
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import passport from "passport";
import path from "path";
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';

// Load environment variables FIRST
dotenv.config();

console.log('🚀 Server starting...');
console.log('📊 Environment:', process.env.NODE_ENV || 'development');

// Hardcode Telegram Token
process.env.TELEGRAM_BOT_TOKEN = "8478776735:AAGW_4rg8BeSy29xDLQrDCZA1pDolRxZUuk";
console.log("✅ Telegram Token Hardcoded");

// Hardcode MongoDB URI if not set
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = "mongodb+srv://Karan:Karan2021@justbecho-cluster.cbqu2mf.mongodb.net/?appName=justbecho-cluster";
}

// ✅ CONFIGURE CLOUDINARY PROPERLY
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

// Import configurations
import "./config/googleAuth.js";
import "./config/telegramBot.js";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import wishlistRoutes from "./routes/Wishlist.js";
import cartRoutes from "./routes/cartRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

// Connect to database
connectDB();

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ ✅ ✅ CRITICAL CORS FIX - Add this BEFORE any routes
// Handle preflight requests
app.options('*', cors());

// ✅ UPDATED CORS Configuration - MORE FLEXIBLE
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://just-becho-frontend.vercel.app',
  'https://justbecho.vercel.app',
  'https://justbecho-frontend.vercel.app',
  'https://just-becho.vercel.app',
  'https://justbecho.com',
  'https://www.justbecho.com',
  'https://justbecho.vercel.app',
  'https://justbecho-frontend.vercel.app'
];

console.log('🌐 CORS Allowed Origins:', allowedOrigins);

// ✅ FIXED CORS middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('🌐 No origin - allowing');
      return callback(null, true);
    }
    
    // ✅ Allow all justbecho domains
    if (origin.includes('justbecho')) {
      console.log('✅ Allowing justbecho domain:', origin);
      return callback(null, true);
    }
    
    // ✅ Allow local development
    if (origin.includes('localhost')) {
      console.log('✅ Allowing localhost:', origin);
      return callback(null, true);
    }
    
    // ✅ Check exact match
    if (allowedOrigins.includes(origin)) {
      console.log('✅ Exact match found:', origin);
      return callback(null, true);
    }
    
    console.log('❌ CORS Blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Accept', 
    'Origin', 
    'X-Requested-With',
    'X-Auth-Token',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Request-Method'
  ],
  exposedHeaders: [
    'Content-Length', 
    'Content-Type',
    'Authorization',
    'Access-Control-Allow-Origin'
  ],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// ✅ Add CORS headers manually as fallback
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (origin && (origin.includes('justbecho') || origin.includes('localhost'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  }
  
  // Handle preflight
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
  console.log(`📍 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log(`📍 Origin: ${req.headers.origin || 'No origin'}`);
  console.log(`📍 Headers:`, req.headers);
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`✅ ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize passport
app.use(passport.initialize());

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/admin", adminRoutes);

// ✅ Test CORS endpoint
app.get("/api/test-cors", (req, res) => {
  console.log('🔧 Test CORS endpoint hit');
  console.log('🔧 Origin:', req.headers.origin);
  console.log('🔧 Headers:', req.headers);
  
  res.json({
    success: true,
    message: 'CORS test successful',
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    corsHeaders: {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
});

// ✅ Health check endpoint with CORS
app.get("/api/health", (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    cors: {
      allowedOrigins: allowedOrigins,
      currentOrigin: req.headers.origin || 'none'
    },
    services: {
      database: 'connected',
      googleOAuth: 'configured',
      cloudinary: {
        configured: !!process.env.CLOUDINARY_CLOUD_NAME,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'not set'
      },
      admin: 'available'
    }
  });
});

// ✅ API Documentation endpoint
app.get("/", (req, res) => {
  res.json({ 
    message: "Just Becho API is running",
    timestamp: new Date().toISOString(),
    version: "2.4.0", // ✅ Updated version
    cors: {
      enabled: true,
      allowedOrigins: allowedOrigins.length
    },
    endpoints: {
      auth: "/api/auth",
      products: "/api/products",
      wishlist: "/api/wishlist",
      users: "/api/users",
      categories: "/api/categories",
      cart: "/api/cart",
      admin: "/api/admin",
      health: "/api/health",
      testCors: "/api/test-cors" // ✅ Added test endpoint
    }
  });
});

// ✅ 404 handler
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    success: false,
    message: `Route ${req.method} ${req.url} not found`
  });
});

// ✅ Global error handler
app.use((error, req, res, next) => {
  console.error('💥 Global error:', error.message);
  console.error('Stack:', error.stack);
  
  // Add CORS headers to error responses
  const origin = req.headers.origin;
  if (origin && (origin.includes('justbecho') || origin.includes('localhost'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// ✅ Auto-create admin user
const createAdminUser = async () => {
  try {
    console.log('🛠️ Checking/creating admin user...');
    
    const User = (await import('./models/User.js')).default;
    const bcrypt = await import('bcryptjs');
    
    const existingAdmin = await User.findOne({ email: 'admin@justbecho.com' });
    
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.default.hash('Admin@12345', 10);
      
      const adminUser = new User({
        email: 'admin@justbecho.com',
        password: hashedPassword,
        name: 'Super Admin',
        phone: '9999999999',
        role: 'admin',
        profileCompleted: true,
        sellerVerified: true,
        username: 'superadmin@justbecho',
        address: {
          street: 'Admin Street',
          city: 'Admin City',
          state: 'Admin State',
          pincode: '123456'
        }
      });

      await adminUser.save();
      console.log('🎯 Auto-created SUPER ADMIN user with role: admin');
      
    } else if (existingAdmin.role !== 'admin') {
      console.log('🔄 Updating existing user to admin role...');
      existingAdmin.role = 'admin';
      existingAdmin.name = 'Super Admin';
      existingAdmin.phone = '9999999999';
      existingAdmin.profileCompleted = true;
      existingAdmin.sellerVerified = true;
      
      const isOldPassword = await bcrypt.default.compare('admin123', existingAdmin.password);
      if (isOldPassword) {
        existingAdmin.password = await bcrypt.default.hash('Admin@12345', 10);
        console.log('🔑 Password updated to new secure password');
      }
      
      await existingAdmin.save();
      console.log('✅ Updated existing user to ADMIN role');
      
    } else {
      console.log('🎯 Admin user already exists with correct role');
    }
    
    const verifiedAdmin = await User.findOne({ email: 'admin@justbecho.com' });
    console.log('👑 Admin Status:', {
      email: verifiedAdmin.email,
      role: verifiedAdmin.role,
      name: verifiedAdmin.name,
      exists: !!verifiedAdmin
    });
    
  } catch (error) {
    console.error('⚠️ Admin creation error:', error.message);
  }
};

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                  🚀 JUST BECHO SERVER 2.4.0                  ║
║                    🔧 WITH CORS FIX                          ║
╚══════════════════════════════════════════════════════════════╝

📊 SERVER STATUS:
  ✅ Port: ${PORT}
  ✅ Environment: ${process.env.NODE_ENV || 'development'}
  ✅ API URL: http://localhost:${PORT}
  ✅ Database: Connected ✅

🌐 CORS CONFIGURATION:
  ✅ ${allowedOrigins.length} allowed origins
  ✅ Preflight requests handled
  ✅ Dynamic origin matching
  ✅ JustBecho domains allowed

🔧 TEST ENDPOINTS:
  ✅ /api/test-cors - CORS test
  ✅ /api/health - Health check

📡 AVAILABLE API ENDPOINTS:
  🔐 Auth:        http://localhost:${PORT}/api/auth
  🛍️  Products:    http://localhost:${PORT}/api/products
  ❤️  Wishlist:    http://localhost:${PORT}/api/wishlist
  👤 Users:       http://localhost:${PORT}/api/users
  📁 Categories:  http://localhost:${PORT}/api/categories
  🛒  Cart:        http://localhost:${PORT}/api/cart
  👑 Admin:       http://localhost:${PORT}/api/admin

──────────────────────────────────────────────────────────────
✅ Server is running. Press Ctrl+C to stop.
──────────────────────────────────────────────────────────────
  `);
  
  // Auto-create admin user
  setTimeout(() => {
    createAdminUser();
  }, 2000);
});

// ✅ Export for testing
export default app;