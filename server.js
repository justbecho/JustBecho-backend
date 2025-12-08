// server.js - UPDATED VERSION
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

// Connect to database
connectDB();

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://just-becho-frontend.vercel.app',
  'https://justbecho.vercel.app',
  'https://justbecho-frontend.vercel.app',
  'https://just-becho.vercel.app',
  'https://justbecho.com',
  'https://www.justbecho.com'
];

console.log('🌐 CORS Allowed Origins:', allowedOrigins.length);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Length']
}));

// ✅ Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  console.log(`📍 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  
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

// ✅ Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: 'connected',
      googleOAuth: 'configured',
      cloudinary: {
        configured: !!process.env.CLOUDINARY_CLOUD_NAME,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'not set'
      }
    }
  });
});

// ✅ API Documentation endpoint
app.get("/", (req, res) => {
  res.json({ 
    message: "Just Becho API is running",
    timestamp: new Date().toISOString(),
    version: "2.2.0",
    endpoints: {
      auth: "/api/auth",
      products: "/api/products",
      wishlist: "/api/wishlist",
      users: "/api/users",
      categories: "/api/categories",
      cart: "/api/cart",
      health: "/api/health"
    },
    services: {
      cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? 'active' : 'inactive'
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
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// ✅ Auto-create admin user
const createAdminUser = async () => {
  try {
    const User = (await import('./models/User.js')).default;
    const bcrypt = await import('bcryptjs');
    
    const existingAdmin = await User.findOne({ email: 'admin@justbecho.com' });
    
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.default.hash('admin123', 10);
      
      const adminUser = new User({
        email: 'admin@justbecho.com',
        password: hashedPassword,
        name: 'Super Admin',
        phone: '9999999999',
        role: 'admin',
        profileCompleted: true,
        sellerVerified: true
      });

      await adminUser.save();
      console.log('🎯 Auto-created admin user');
    }
  } catch (error) {
    console.log('⚠️ Admin creation skipped:', error.message);
  }
};

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                  🚀 JUST BECHO SERVER 2.2.0              ║
╚══════════════════════════════════════════════════════════╝

📊 SERVER STATUS:
  ✅ Port: ${PORT}
  ✅ Environment: ${process.env.NODE_ENV || 'development'}
  ✅ API URL: http://localhost:${PORT}
  ✅ Database: Connected ✅

☁️ CLOUDINARY STATUS:
  ${process.env.CLOUDINARY_CLOUD_NAME ? '✅ Configured' : '❌ Not Configured'}

🌐 CORS CONFIGURATION:
  ✅ ${allowedOrigins.length} allowed origins

📡 AVAILABLE API ENDPOINTS:
  🔐 Auth:        http://localhost:${PORT}/api/auth
  🛍️  Products:    http://localhost:${PORT}/api/products
  ❤️  Wishlist:    http://localhost:${PORT}/api/wishlist
  👤 Users:       http://localhost:${PORT}/api/users
  📁 Categories:  http://localhost:${PORT}/api/categories
  🛒  Cart:        http://localhost:${PORT}/api/cart
  ❤️  Health:      http://localhost:${PORT}/api/health

──────────────────────────────────────────────────────────
✅ Server is running. Press Ctrl+C to stop.
──────────────────────────────────────────────────────────
  `);
  
  // Auto-create admin user
  setTimeout(() => {
    createAdminUser();
  }, 2000);
});

export default app;