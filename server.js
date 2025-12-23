// server.js - COMPLETE UPDATED VERSION WITH SETINTERVAL (NO NODE-CRON)
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';

// ✅ Load environment variables FIRST
dotenv.config();

console.log(`
╔══════════════════════════════════════════════════════════════╗
║           🚀 JUST BECHO SERVER - WAREHOUSE AUTOMATION        ║
║                📦 SELLER → WAREHOUSE → BUYER                 ║
║              ⏰ AUTO-CHECK WITH SETINTERVAL                   ║
╚══════════════════════════════════════════════════════════════╝
`);

console.log('📊 Environment:', process.env.NODE_ENV || 'development');
console.log('💳 Razorpay Key Available:', !!process.env.RAZORPAY_LIVE_KEY_ID);
console.log('🏭 Warehouse: JustBecho Warehouse, Indore');

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
    
    console.log('🔌 Connecting to MongoDB...');
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
console.log('📂 Loading models...');
import './models/User.js';
import './models/Product.js';
import './models/Cart.js';
import './models/Order.js';
import './models/Wishlist.js';
import './models/Category.js';

// ✅ IMPORT ROUTES
console.log('🛣️  Loading routes...');
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import wishlistRoutes from "./routes/Wishlist.js";
import cartRoutes from "./routes/cartRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import razorpayOrderRoutes from "./routes/razorpayOrder.js";
import razorpayVerifyRoutes from "./routes/razorpayVerify.js";
import orderRoutes from "./routes/orderRoutes.js";
import nimbuspostTestRoutes from "./routes/nimbuspostTest.js";
import shippingRoutes from "./routes/shippingRoutes.js";

const app = express();

// ✅ CORS Configuration
const corsOptions = {
  origin: [
    'https://www.justbecho.com',
    'https://justbecho.com',
    'https://just-becho-frontend.vercel.app',
    'https://justbecho-frontend.vercel.app',
    'https://justbecho.vercel.app',
    'https://just-becho.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-Auth-Token']
};

app.use(cors(corsOptions));

// ✅ Manual CORS Headers
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  const allowedOrigins = [
    'https://www.justbecho.com',
    'https://justbecho.com',
    'https://just-becho-frontend.vercel.app',
    'https://justbecho-frontend.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, X-Auth-Token');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// ✅ Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ Request logging
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

// ✅ ALL ROUTES
console.log('🔗 Registering routes...');
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/razorpay", razorpayOrderRoutes);
app.use("/api/razorpay", razorpayVerifyRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/shipping", shippingRoutes);
app.use("/api/nimbuspost", nimbuspostTestRoutes);

// ✅ WAREHOUSE AUTOMATION WITH SETINTERVAL
let isCheckingWarehouse = false;

// ✅ WAREHOUSE CHECK FUNCTION (Using setInterval)
async function checkWarehouseShipments() {
  if (isCheckingWarehouse) {
    console.log('⏳ Warehouse check already in progress, skipping...');
    return;
  }
  
  isCheckingWarehouse = true;
  
  try {
    console.log('🕐 [WAREHOUSE] Starting automatic check...');
    
    // Dynamically import to avoid circular dependencies
    const Order = (await import('./models/Order.js')).default;
    const nimbuspostService = (await import('./services/nimbuspostService.js')).default;
    
    // Find orders with incoming shipments at warehouse
    const orders = await Order.find({
      'nimbuspostShipments.shipmentType': 'incoming',
      'shippingLegs': {
        $elemMatch: {
          leg: 'seller_to_warehouse',
          status: { $in: ['pending', 'in_transit'] }
        }
      }
    })
    .populate('buyer', 'name phone address')
    .populate('products', 'productName weight finalPrice');
    
    console.log(`📊 [WAREHOUSE] Found ${orders.length} orders with incoming shipments`);
    
    let processed = 0;
    let errors = 0;
    
    for (const order of orders) {
      const incomingShipments = order.nimbuspostShipments.filter(s => 
        s.shipmentType === 'incoming' && s.awbNumber
      );
      
      for (const shipment of incomingShipments) {
        try {
          console.log(`🔍 Checking AWB: ${shipment.awbNumber}`);
          
          // Check if shipment is delivered to warehouse
          const status = await nimbuspostService.isShipmentDelivered(shipment.awbNumber);
          
          if (status.delivered) {
            console.log(`✅ AWB ${shipment.awbNumber} delivered to warehouse!`);
            
            // Check if outgoing already exists
            const existingOutgoing = order.nimbuspostShipments.find(s => 
              s.parentAWB === shipment.awbNumber && s.shipmentType === 'outgoing'
            );
            
            if (existingOutgoing) {
              console.log(`⚠️  Outgoing already exists: ${existingOutgoing.awbNumber}`);
              continue;
            }
            
            // Get product
            const product = order.products.find(p => 
              p._id.toString() === shipment.productId?.toString()
            );
            
            if (!product || !order.buyer) {
              console.error('❌ Product or buyer not found');
              continue;
            }
            
            // Create outgoing shipment (Warehouse → Buyer)
            console.log(`🚀 Creating outgoing shipment for AWB ${shipment.awbNumber}`);
            
            const outgoingResult = await nimbuspostService.createB2BShipment(
              {
                orderId: `${order._id}-${shipment.productId}-OUT`,
                totalAmount: order.totalAmount || 0
              },
              {
                productName: product.productName,
                price: product.finalPrice || 0,
                weight: product.weight || 500
              },
              nimbuspostService.WAREHOUSE_DETAILS, // Pickup from warehouse
              {
                name: order.buyer.name || 'Customer',
                phone: order.buyer.phone || '',
                address: order.shippingAddress || order.buyer.address || 'Address not provided'
              },
              'warehouse_to_buyer'
            );
            
            if (outgoingResult.success) {
              // Update order
              order.nimbuspostShipments.push({
                productId: shipment.productId,
                awbNumber: outgoingResult.awbNumber,
                shipmentId: outgoingResult.shipmentId,
                shipmentType: 'outgoing',
                parentAWB: shipment.awbNumber,
                status: 'booked',
                createdAt: new Date(),
                trackingUrl: outgoingResult.trackingUrl,
                labelUrl: outgoingResult.labelUrl,
                courierName: outgoingResult.courierName
              });
              
              // Update shipping legs
              const warehouseLeg = order.shippingLegs.find(l => l.leg === 'seller_to_warehouse');
              if (warehouseLeg) {
                warehouseLeg.status = 'completed';
                warehouseLeg.completedAt = new Date();
                warehouseLeg.notes = `Auto-forwarded to buyer (${outgoingResult.awbNumber})`;
              }
              
              // Add outgoing leg
              order.shippingLegs.push({
                leg: 'warehouse_to_buyer',
                awbNumbers: [outgoingResult.awbNumber],
                status: 'pending',
                createdAt: new Date(),
                notes: 'Auto-created: Warehouse → Buyer'
              });
              
              // Update order status
              order.status = 'processing';
              
              await order.save();
              
              console.log(`✅ Auto-forwarded: ${shipment.awbNumber} → ${outgoingResult.awbNumber}`);
              processed++;
              
              // Send notification (you can implement this)
              console.log(`📧 Notification: Order ${order._id} forwarded to buyer`);
            }
          } else {
            console.log(`⏳ AWB ${shipment.awbNumber} status: ${status.status}`);
          }
        } catch (error) {
          console.error(`❌ Error processing AWB ${shipment.awbNumber}:`, error.message);
          errors++;
        }
      }
    }
    
    console.log(`✅ [WAREHOUSE] Check completed: ${processed} forwarded, ${errors} errors`);
    
  } catch (error) {
    console.error('❌ [WAREHOUSE] Check error:', error);
  } finally {
    isCheckingWarehouse = false;
  }
}

// ✅ SETUP WAREHOUSE AUTO-CHECK INTERVAL
function setupWarehouseAutoCheck() {
  const CHECK_INTERVAL = process.env.WAREHOUSE_CHECK_INTERVAL || 30 * 60 * 1000; // 30 minutes default
  
  console.log(`🏭 Setting up warehouse auto-check (every ${CHECK_INTERVAL / 60000} minutes)...`);
  
  // Run check every X minutes
  const intervalId = setInterval(() => {
    checkWarehouseShipments().catch(console.error);
  }, CHECK_INTERVAL);
  
  // Run initial check after 30 seconds
  setTimeout(() => {
    console.log('🚀 Running initial warehouse check...');
    checkWarehouseShipments().catch(console.error);
  }, 30000);
  
  // Store interval ID for cleanup
  app.locals.warehouseIntervalId = intervalId;
  
  return intervalId;
}

// ✅ MANUAL TRIGGER ENDPOINT
app.post("/api/warehouse/check-now", async (req, res) => {
  try {
    console.log('🚀 Manual warehouse check triggered');
    
    await checkWarehouseShipments();
    
    res.json({
      success: true,
      message: 'Warehouse check completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ GET WAREHOUSE STATUS
app.get("/api/warehouse/status", (req, res) => {
  res.json({
    success: true,
    status: {
      autoCheck: process.env.DISABLE_AUTO_CHECK !== 'true',
      interval: process.env.WAREHOUSE_CHECK_INTERVAL || '30 minutes',
      lastCheck: new Date().toISOString(),
      isRunning: isCheckingWarehouse
    },
    warehouse: {
      name: "JustBecho Warehouse",
      address: "103 Dilpasand grand, Behind Rafael tower, Indore, MP - 452001",
      contact: "Devansh Kothari - 9301847748"
    },
    endpoints: {
      checkNow: "POST /api/warehouse/check-now",
      triggerOutgoing: "POST /api/razorpay/trigger-outgoing/:awb",
      dashboard: "GET /api/razorpay/warehouse-dashboard"
    }
  });
});

// ✅ WAREHOUSE INFO ENDPOINT
app.get("/api/warehouse/info", (req, res) => {
  res.json({
    success: true,
    warehouse: {
      name: "JustBecho Warehouse",
      address: "103 Dilpasand grand, Behind Rafael tower, Indore, Madhya Pradesh - 452001",
      contactPerson: "Devansh Kothari",
      phone: "9301847748",
      email: "warehouse@justbecho.com",
      manager: "Devansh Kothari"
    },
    automation: {
      status: "ACTIVE",
      method: "setInterval (No external dependencies)",
      interval: process.env.WAREHOUSE_CHECK_INTERVAL || "30 minutes",
      flow: "Seller → Warehouse → Buyer",
      features: [
        "✅ Auto-check shipments every 30 minutes",
        "✅ Auto-create outgoing when delivered to warehouse",
        "✅ Manual trigger available",
        "✅ Real-time tracking",
        "✅ No cron package needed"
      ]
    }
  });
});

// ✅ RAZORPAY DEBUG ENDPOINTS
app.get("/api/razorpay/debug", (req, res) => {
  res.json({
    success: true,
    razorpay: {
      keyIdExists: !!process.env.RAZORPAY_LIVE_KEY_ID,
      keySecretExists: !!process.env.RAZORPAY_LIVE_SECRET_KEY,
      environment: process.env.NODE_ENV || 'development'
    },
    nimbuspost: {
      emailExists: !!process.env.NIMBUSPOST_EMAIL,
      passwordExists: !!process.env.NIMBUSPOST_PASSWORD,
      apiKeyExists: !!process.env.NIMBUSPOST_API_KEY
    },
    warehouse: {
      configured: true,
      name: "JustBecho Warehouse, Indore",
      automation: "ACTIVE (setInterval)",
      autoCheck: process.env.DISABLE_AUTO_CHECK !== 'true'
    }
  });
});

// ✅ Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      razorpay: !!process.env.RAZORPAY_LIVE_KEY_ID && !!process.env.RAZORPAY_LIVE_SECRET_KEY,
      nimbuspost: !!process.env.NIMBUSPOST_EMAIL && !!process.env.NIMBUSPOST_PASSWORD,
      cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME,
      warehouseAutoCheck: process.env.DISABLE_AUTO_CHECK !== 'true'
    },
    warehouseAutomation: {
      status: "ACTIVE",
      method: "setInterval",
      interval: process.env.WAREHOUSE_CHECK_INTERVAL || "30 minutes",
      flow: 'seller → warehouse → buyer',
      lastCheck: new Date().toISOString()
    }
  });
});

// ✅ TEST DATABASE
app.get("/api/test-db", async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    
    res.json({
      success: true,
      database: states[dbState] || 'unknown',
      readyState: dbState,
      connection: mongoose.connection.host || 'unknown',
      databaseName: mongoose.connection.name || 'unknown'
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ✅ API Documentation
app.get("/", (req, res) => {
  res.json({ 
    message: "🚀 Just Becho API with Warehouse Automation",
    timestamp: new Date().toISOString(),
    version: "3.2.0",
    warehouse: {
      name: "JustBecho Warehouse",
      location: "Indore, Madhya Pradesh",
      address: "103 Dilpasand grand, Behind Rafael tower",
      contact: "Devansh Kothari - 9301847748",
      automation: "Seller → Warehouse → Buyer (Auto)"
    },
    automation: {
      method: "setInterval (No external packages)",
      interval: "Every 30 minutes",
      endpoints: {
        checkNow: "POST /api/warehouse/check-now",
        status: "GET /api/warehouse/status",
        info: "GET /api/warehouse/info"
      }
    },
    features: [
      "Warehouse Automation (Two-Leg Shipments)",
      "NimbusPost B2B Shipping Integration",
      "Razorpay Payment Processing",
      "Order & Shipment Tracking",
      "Auto-check every 30 minutes"
    ],
    endpoints: {
      auth: "/api/auth",
      products: "/api/products",
      cart: "/api/cart",
      orders: "/api/orders",
      shipping: "/api/shipping",
      razorpay: "/api/razorpay",
      warehouse: "/api/warehouse/status",
      health: "/api/health",
      testDb: "/api/test-db"
    }
  });
});

// ✅ 404 handler
app.use((req, res) => {
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
    timestamp: new Date().toISOString()
  });
});

// ✅ CLEANUP ON EXIT
process.on('SIGINT', () => {
  console.log('🔴 Shutting down server...');
  
  // Clear warehouse interval
  if (app.locals.warehouseIntervalId) {
    clearInterval(app.locals.warehouseIntervalId);
    console.log('✅ Warehouse auto-check stopped');
  }
  
  mongoose.connection.close();
  console.log('✅ MongoDB connection closed');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🔴 Received SIGTERM, shutting down gracefully...');
  
  if (app.locals.warehouseIntervalId) {
    clearInterval(app.locals.warehouseIntervalId);
  }
  
  mongoose.connection.close();
  process.exit(0);
});

// ✅ START SERVER
const startServer = async () => {
  try {
    await connectDB();
    
    const PORT = process.env.PORT || 8000;
    
    // Setup warehouse auto-check (only if not disabled)
    if (process.env.DISABLE_AUTO_CHECK !== 'true') {
      setupWarehouseAutoCheck();
    } else {
      console.log('⚠️  Warehouse auto-check disabled (DISABLE_AUTO_CHECK=true)');
    }
    
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                  🚀 JUST BECHO SERVER 3.2.0                  ║
║                🏭 WAREHOUSE AUTOMATION ENABLED               ║
║                🔄 SELLER → WAREHOUSE → BUYER                 ║
║                ⏰ AUTO-CHECK WITH SETINTERVAL                ║
╚══════════════════════════════════════════════════════════════╝

📊 SERVER STATUS:
  ✅ Port: ${PORT}
  ✅ Environment: ${process.env.NODE_ENV || 'development'}
  ✅ Database: Connected
  ✅ Warehouse: JustBecho, Indore
  ✅ Auto-check: ${process.env.DISABLE_AUTO_CHECK !== 'true' ? '✅ ENABLED' : '❌ DISABLED'}

🏭 WAREHOUSE DETAILS:
  📍 Address: 103 Dilpasand grand, Behind Rafael tower
  🏙️  City: Indore, Madhya Pradesh
  📮 Pincode: 452001
  👤 Contact: Devansh Kothari
  📞 Phone: 9301847748

📦 AUTOMATION FLOW:
  1️⃣ Payment → Create Incoming (Seller → Warehouse)
  2️⃣ Auto-check every 30 minutes
  3️⃣ When delivered → Create Outgoing (Warehouse → Buyer)
  4️⃣ Complete! 🎉

🔄 AUTO-CHECK DETAILS:
  Method: setInterval (No external packages)
  Interval: Every ${process.env.WAREHOUSE_CHECK_INTERVAL ? parseInt(process.env.WAREHOUSE_CHECK_INTERVAL) / 60000 + ' minutes' : '30 minutes'}
  Status: ${isCheckingWarehouse ? 'Running now' : 'Waiting'}
  Manual Trigger: POST /api/warehouse/check-now

🔧 TEST ENDPOINTS:
  ✅ /api/warehouse/status - Check automation status
  ✅ /api/warehouse/check-now - Manual trigger
  ✅ /api/health - Health check
  ✅ /api/test-db - Database test

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