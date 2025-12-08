import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import passport from "passport";
import path from "path";
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Hardcode Telegram Token
process.env.TELEGRAM_BOT_TOKEN = "8478776735:AAGW_4rg8BeSy29xDLQrDCZA1pDolRxZUuk";
console.log("✅ Telegram Token Hardcoded");

// Hardcode MongoDB URI if not set
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = "mongodb+srv://Karan:Karan2021@justbecho-cluster.cbqu2mf.mongodb.net/?appName=justbecho-cluster";
}

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

// ✅ SIMPLIFIED CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://just-becho-frontend.vercel.app',
  'https://justbecho.vercel.app',
  'https://justbecho-frontend.vercel.app',
  'https://just-becho.vercel.app',
  'https://justbecho.com',
  'https://www.justbecho.com'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize passport
app.use(passport.initialize());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📍 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cors: {
      allowedOrigins: allowedOrigins,
      environment: process.env.NODE_ENV || 'development'
    },
    googleOAuth: {
      clientId: '711574038874-r069ib4ureqbir5sukg69at13hspa9a8.apps.googleusercontent.com',
      callbackUrl: 'https://just-becho-backend.vercel.app/api/auth/google/callback',
      configured: true
    }
  });
});

// API Documentation endpoint
app.get("/", (req, res) => {
  res.json({ 
    message: "Just Becho API running...",
    timestamp: new Date().toISOString(),
    version: "2.0.1",
    cors: {
      allowedOrigins: allowedOrigins,
      note: "Frontend should be hosted on one of these origins"
    },
    googleOAuth: {
      clientId: '711574038874-r069ib4ureqbir5sukg69at13hspa9a8.apps.googleusercontent.com',
      authUrl: 'https://just-becho-backend.vercel.app/api/auth/google',
      callbackUrl: 'https://just-becho-backend.vercel.app/api/auth/google/callback',
      debugUrl: 'https://just-becho-backend.vercel.app/api/auth/google/debug'
    },
    routes: {
      auth: "/api/auth",
      products: "/api/products", 
      wishlist: "/api/wishlist",
      users: "/api/users",
      categories: "/api/categories",
      cart: "/api/cart",
      health: "/api/health"
    }
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    message: `Route ${req.method} ${req.url} not found`,
    success: false,
    allowedOrigins: allowedOrigins
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('💥 Global error handler:', error);
  
  if (error.message.includes('CORS policy')) {
    return res.status(403).json({ 
      message: error.message,
      success: false,
      allowedOrigins: allowedOrigins
    });
  }
  
  res.status(error.status || 500).json({
    message: error.message || 'Internal server error',
    success: false
  });
});

// Auto-create admin user
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
║                  🚀 JUST BECHO SERVER 2.0.1              ║
╚══════════════════════════════════════════════════════════╝

📊 SERVER STATUS:
  ✅ Port: ${PORT}
  ✅ Environment: ${process.env.NODE_ENV || 'development'}
  ✅ API URL: http://localhost:${PORT}
  ✅ Database: Connected ✅

🔐 GOOGLE OAUTH:
  ✅ Client ID: 711574038874...a9a8.apps.googleusercontent.com
  ✅ Callback URL: https://just-becho-backend.vercel.app/api/auth/google/callback
  ✅ Auth URL: https://just-becho-backend.vercel.app/api/auth/google
  ✅ Debug URL: https://just-becho-backend.vercel.app/api/auth/google/debug

🌐 CORS ALLOWED ORIGINS:
${allowedOrigins.map(origin => `  ✅ ${origin}`).join('\n')}

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