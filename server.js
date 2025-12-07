import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';

// STEP 1: Load env first
dotenv.config();

// ✅ FIX: Hardcode Telegram Token
process.env.TELEGRAM_BOT_TOKEN = "8478776735:AAGW_4rg8BeSy29xDLQrDCZA1pDolRxZUuk";
console.log("✅ Telegram Token Hardcoded");

// ✅ FIX: Hardcode MongoDB URI
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = "mongodb+srv://Karan:Karan2021@justbecho-cluster.cbqu2mf.mongodb.net/?appName=justbecho-cluster";
}

// STEP 2: Import DB connection
import connectDB from "./config/db.js";

// STEP 3: Connect DB first
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

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Origin'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Debug middleware - request logging
app.use((req, res, next) => {
  console.log(`📍 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ✅ IMPORT ROUTES AFTER DB CONNECTION
// Using dynamic imports to avoid circular dependencies
let authRoutes, productRoutes, wishlistRoutes, cartRoutes, userRoutes, categoryRoutes;

(async () => {
  try {
    // Import routes dynamically
    authRoutes = (await import("./routes/authRoutes.js")).default;
    productRoutes = (await import("./routes/productRoutes.js")).default;
    wishlistRoutes = (await import("./routes/Wishlist.js")).default;
    cartRoutes = (await import("./routes/cartRoutes.js")).default;
    userRoutes = (await import("./routes/userRoutes.js")).default;
    categoryRoutes = (await import("./routes/categoryRoutes.js")).default;
    
    // Import passport configs
    await import("./config/googleAuth.js");
    await import("./config/telegramBot.js");
    
    // Initialize passport
    const passport = (await import("passport")).default;
    app.use(passport.initialize());
    
    console.log("✅ All routes imported successfully");
  } catch (error) {
    console.error("❌ Error importing routes:", error.message);
  }
})();

// ✅ Routes (will be set after dynamic imports)
setTimeout(() => {
  app.use("/api/auth", authRoutes || ((req, res) => res.status(503).json({ message: "Routes loading..." })));
  app.use("/api/products", productRoutes || ((req, res) => res.status(503).json({ message: "Routes loading..." })));
  app.use("/api/wishlist", wishlistRoutes || ((req, res) => res.status(503).json({ message: "Routes loading..." })));
  app.use("/api/users", userRoutes || ((req, res) => res.status(503).json({ message: "Routes loading..." })));
  app.use("/api/categories", categoryRoutes || ((req, res) => res.status(503).json({ message: "Routes loading..." })));
  app.use("/api/cart", cartRoutes || ((req, res) => res.status(503).json({ message: "Routes loading..." })));
}, 1000);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cors: {
      allowedOrigins: allowedOrigins,
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// API Documentation endpoint
app.get("/", (req, res) => {
  res.json({ 
    message: "Just Becho API running...",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    cors: {
      allowedOrigins: allowedOrigins,
      note: "Frontend should be hosted on one of these origins"
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

// 404 handler for undefined routes
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    message: `Route ${req.method} ${req.url} not found`,
    success: false,
    allowedOrigins: allowedOrigins
  });
});

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('💥 Global error handler:', error);
  
  // CORS errors
  if (error.message.includes('CORS policy')) {
    return res.status(403).json({ 
      message: error.message,
      success: false,
      allowedOrigins: allowedOrigins
    });
  }
  
  // Multer errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ 
      message: 'File too large. Maximum size is 5MB.',
      success: false
    });
  }
  
  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ 
      message: 'Too many files. Maximum 5 images allowed.',
      success: false
    });
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ 
      message: 'Unexpected file field.',
      success: false
    });
  }
  
  // Mongoose CastError (ObjectId format)
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  // Mongoose ValidationError
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({
      success: false,
      message: messages.join(', ')
    });
  }
  
  // Default error response
  res.status(error.status || 500).json({
    message: error.message || 'Internal server error',
    success: false,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// ✅ AUTO-ADMIN CREATION FUNCTION
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
      console.log('🎯 AUTO-CREATED: Admin user!');
      console.log('📧 Email: admin@justbecho.com');
      console.log('🔑 Password: admin123');
      console.log('👤 Role: admin');
    } else {
      console.log('ℹ️ Admin user already exists');
    }
  } catch (error) {
    console.log('⚠️ Admin creation skipped:', error.message);
  }
};

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                  🚀 JUST BECHO SERVER                    ║
╚══════════════════════════════════════════════════════════╝

📊 SERVER STATUS:
  ✅ Port: ${PORT}
  ✅ Environment: ${process.env.NODE_ENV || 'development'}
  ✅ API URL: http://localhost:${PORT}
  ✅ Database: Connected ✅

🌐 CORS CONFIGURATION:
${allowedOrigins.map(origin => `  ✅ ${origin}`).join('\n')}

🤖 TELEGRAM BOT STATUS:
  ✅ Bot Token: HARDCODED ✅
  🤖 Bot Name: Just Becho Bot
  🔑 Token: 8478776735:AAGW_4rg8BeSy29xDLQrDCZA1pDolRxZUuk
  
📡 AVAILABLE API ENDPOINTS:
  🔐 Auth:        http://localhost:${PORT}/api/auth
  🛍️  Products:    http://localhost:${PORT}/api/products
  ❤️  Wishlist:    http://localhost:${PORT}/api/wishlist
  👤 Users:       http://localhost:${PORT}/api/users
  📁 Categories:  http://localhost:${PORT}/api/categories
  🛒  Cart:        http://localhost:${PORT}/api/cart
  ❤️  Health:      http://localhost:${PORT}/api/health

📁 UPLOADS DIRECTORY:
  ${path.join(__dirname, 'uploads')}

──────────────────────────────────────────────────────────
✅ Server is running. Press Ctrl+C to stop.
──────────────────────────────────────────────────────────
  `);
  
  // ✅ CALL AUTO-ADMIN FUNCTION AFTER SERVER STARTS
  setTimeout(() => {
    createAdminUser();
  }, 2000);
});

export default app;