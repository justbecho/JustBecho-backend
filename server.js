// server.js - UPDATED VERSION WITH ADMIN
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
import adminRoutes from "./routes/adminRoutes.js"; // ✅ ADDED: Admin routes

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
app.use("/api/admin", adminRoutes); // ✅ ADDED: Admin routes

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
      },
      admin: 'available' // ✅ Added admin status
    }
  });
});

// ✅ API Documentation endpoint
app.get("/", (req, res) => {
  res.json({ 
    message: "Just Becho API is running",
    timestamp: new Date().toISOString(),
    version: "2.3.0", // ✅ Updated version
    endpoints: {
      auth: "/api/auth",
      products: "/api/products",
      wishlist: "/api/wishlist",
      users: "/api/users",
      categories: "/api/categories",
      cart: "/api/cart",
      admin: "/api/admin", // ✅ Added admin endpoints
      health: "/api/health"
    },
    services: {
      cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? 'active' : 'inactive',
      adminPanel: 'active' // ✅ Added admin panel status
    },
    admin: { // ✅ Added admin info
      email: "admin@justbecho.com",
      password: "Admin@12345",
      note: "Permanent admin account with full control"
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

// ✅ UPDATED: Auto-create admin user with proper role
const createAdminUser = async () => {
  try {
    console.log('🛠️ Checking/creating admin user...');
    
    const User = (await import('./models/User.js')).default;
    const bcrypt = await import('bcryptjs');
    
    const existingAdmin = await User.findOne({ email: 'admin@justbecho.com' });
    
    if (!existingAdmin) {
      // Create new admin
      const hashedPassword = await bcrypt.default.hash('Admin@12345', 10);
      
      const adminUser = new User({
        email: 'admin@justbecho.com',
        password: hashedPassword,
        name: 'Super Admin',
        phone: '9999999999',
        role: 'admin', // ✅ Set as 'admin' not 'user'
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
      // Update existing user to admin
      console.log('🔄 Updating existing user to admin role...');
      existingAdmin.role = 'admin';
      existingAdmin.name = 'Super Admin';
      existingAdmin.phone = '9999999999';
      existingAdmin.profileCompleted = true;
      existingAdmin.sellerVerified = true;
      
      // Update password if it's the old one
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
    
    // Verify admin exists
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
║                  🚀 JUST BECHO SERVER 2.3.0                  ║
║                    👑 WITH ADMIN PANEL                       ║
╚══════════════════════════════════════════════════════════════╝

📊 SERVER STATUS:
  ✅ Port: ${PORT}
  ✅ Environment: ${process.env.NODE_ENV || 'development'}
  ✅ API URL: http://localhost:${PORT}
  ✅ Database: Connected ✅

👑 ADMIN ACCESS:
  ✅ Email: admin@justbecho.com
  ✅ Password: Admin@12345
  ✅ Role: admin (Full control)

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
  👑 Admin:       http://localhost:${PORT}/api/admin
  ❤️  Health:      http://localhost:${PORT}/api/health

👑 ADMIN PRIVILEGES:
  ✅ Delete any product
  ✅ Delete any user  
  ✅ Change user roles
  ✅ Verify sellers
  ✅ View all statistics
  ✅ Full system control

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