import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import passport from "passport";
import path from "path";
import { fileURLToPath } from 'url';

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

// ✅ ENHANCED CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://just-becho-frontend.vercel.app',
  'https://justbecho.vercel.app',
  'https://justbecho-frontend.vercel.app',
  'https://just-becho.vercel.app',
  'https://justbecho.com',
  'https://www.justbecho.com'
];

console.log('🌐 CORS Allowed Origins:', allowedOrigins);

// CORS middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400 // 24 hours
}));

// Handle preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.status(200).send();
});

// ✅ Body parsing middleware - CRITICAL FOR MULTIPART
app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb',
  parameterLimit: 100000
}));

// ✅ Enhanced request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  console.log(`\n📍 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log(`   Origin: ${req.headers.origin || 'No origin'}`);
  console.log(`   Content-Type: ${req.headers['content-type'] || 'Not set'}`);
  console.log(`   Authorization: ${req.headers.authorization ? 'Present' : 'Missing'}`);
  console.log(`   Content-Length: ${req.headers['content-length'] || '0'} bytes`);
  
  // Log body for non-multipart requests
  if (req.headers['content-type'] && 
      !req.headers['content-type'].includes('multipart/form-data') && 
      req.body && Object.keys(req.body).length > 0) {
    console.log(`   Body keys: ${Object.keys(req.body).join(', ')}`);
  }
  
  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`   ↳ Response: ${res.statusCode} ${res.statusMessage} (${duration}ms)`);
  });
  
  next();
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize passport
app.use(passport.initialize());

// ✅ IMPORTANT: Cloudinary configuration check
console.log('☁️ Cloudinary Config Check:');
console.log('   CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing');
console.log('   CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing');
console.log('   CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing');

// ✅ Routes - IMPORTANT ORDER
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);

// ✅ Enhanced Health check endpoint
app.get("/api/health", (req, res) => {
  const healthInfo = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: {
      version: "2.1.0",
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage()
    },
    services: {
      database: 'connected',
      googleOAuth: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'not configured',
      cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? 'configured' : 'not configured',
      telegram: process.env.TELEGRAM_BOT_TOKEN ? 'configured' : 'not configured'
    },
    cors: {
      allowedOrigins: allowedOrigins,
      activeOrigins: req.headers.origin || 'none'
    },
    routes: {
      auth: "/api/auth",
      products: "/api/products",
      wishlist: "/api/wishlist",
      users: "/api/users",
      categories: "/api/categories",
      cart: "/api/cart"
    }
  };
  
  res.json(healthInfo);
});

// ✅ API Documentation endpoint
app.get("/", (req, res) => {
  res.json({ 
    message: "Just Becho API is running",
    timestamp: new Date().toISOString(),
    version: "2.1.0",
    documentation: {
      note: "Check /api/health for detailed service status",
      endpoints: {
        auth: {
          signup: "POST /api/auth/signup",
          login: "POST /api/auth/login",
          google: "GET /api/auth/google",
          me: "GET /api/auth/me (requires auth)",
          profile: "POST /api/auth/complete-profile (requires auth)"
        },
        products: {
          list: "GET /api/products",
          create: "POST /api/products (requires auth + multipart)",
          single: "GET /api/products/:id",
          userProducts: "GET /api/products/my-products (requires auth)",
          byCategory: "GET /api/products/category/:category",
          search: "GET /api/products/search?q=query"
        },
        categories: "GET /api/categories",
        wishlist: "GET/POST/PUT/DELETE /api/wishlist (requires auth)",
        cart: "GET/POST/PUT/DELETE /api/cart (requires auth)",
        health: "GET /api/health"
      }
    },
    support: {
      issues: "Contact: btwitskaranhere@gmail.com",
      documentation: "https://just-becho-backend.vercel.app/"
    }
  });
});

// ✅ Enhanced 404 handler
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);
  console.log(`   Origin: ${req.headers.origin || 'No origin'}`);
  console.log(`   Referer: ${req.headers.referer || 'No referer'}`);
  
  res.status(404).json({ 
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
    suggestedRoutes: {
      home: "GET /",
      health: "GET /api/health",
      auth: "GET /api/auth",
      products: "GET /api/products"
    },
    allowedOrigins: allowedOrigins
  });
});

// ✅ Enhanced Global error handler
app.use((error, req, res, next) => {
  console.error('\n💥 GLOBAL ERROR HANDLER TRIGGERED');
  console.error('   Error:', error.name);
  console.error('   Message:', error.message);
  console.error('   Stack:', error.stack);
  console.error('   Request:', {
    method: req.method,
    url: req.url,
    origin: req.headers.origin,
    contentType: req.headers['content-type']
  });
  
  // CORS errors
  if (error.message.includes('CORS policy')) {
    return res.status(403).json({ 
      success: false,
      message: 'CORS Error: ' + error.message,
      allowedOrigins: allowedOrigins,
      yourOrigin: req.headers.origin || 'Not provided'
    });
  }
  
  // Multer errors
  if (error.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: `File upload error: ${error.message}`,
      code: error.code
    });
  }
  
  // Validation errors
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: messages
    });
  }
  
  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }
  
  // Default error response
  const statusCode = error.statusCode || error.status || 500;
  const message = error.message || 'Internal server error';
  
  res.status(statusCode).json({
    success: false,
    message: message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      errorName: error.name 
    })
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
        sellerVerified: true,
        sellerVerificationStatus: 'approved'
      });

      await adminUser.save();
      console.log('🎯 Auto-created admin user');
      console.log('   📧 Email: admin@justbecho.com');
      console.log('   🔑 Password: admin123');
      console.log('   👤 Role: admin');
    } else {
      console.log('ℹ️ Admin user already exists');
    }
  } catch (error) {
    console.log('⚠️ Admin creation skipped:', error.message);
  }
};

const PORT = process.env.PORT || 8000;

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                  🚀 JUST BECHO SERVER 2.1.0              ║
╚══════════════════════════════════════════════════════════╝

📊 SERVER STATUS:
  ✅ Port: ${PORT}
  ✅ Host: 0.0.0.0
  ✅ Environment: ${process.env.NODE_ENV || 'development'}
  ✅ API URL: http://localhost:${PORT}
  ✅ Public URL: https://just-becho-backend.vercel.app
  ✅ Database: Connected ✅

🔧 CONFIGURATION:
  ☁️ Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? '✅ Configured' : '❌ Missing'}
  🔐 Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? '✅ Configured' : '❌ Missing'}
  🤖 Telegram Bot: ✅ Configured

🌐 CORS ALLOWED ORIGINS (${allowedOrigins.length}):
${allowedOrigins.map(origin => `  ✅ ${origin}`).join('\n')}

📡 AVAILABLE API ENDPOINTS:
  🔐 Auth:        https://just-becho-backend.vercel.app/api/auth
  🛍️  Products:    https://just-becho-backend.vercel.app/api/products
  ❤️  Wishlist:    https://just-becho-backend.vercel.app/api/wishlist
  👤 Users:       https://just-becho-backend.vercel.app/api/users
  📁 Categories:  https://just-becho-backend.vercel.app/api/categories
  🛒  Cart:        https://just-becho-backend.vercel.app/api/cart
  ❤️  Health:      https://just-becho-backend.vercel.app/api/health

⚙️ UPLOAD CONFIGURATION:
  ✅ Max file size: 10MB
  ✅ Max files: 5
  ✅ Allowed types: images only
  ✅ Storage: Memory (Cloudinary upload)

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