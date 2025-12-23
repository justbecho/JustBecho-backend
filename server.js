// server.js - COMPLETE WORKING VERSION WITH AUTO WAREHOUSE → BUYER
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
║              ⚡ AUTO-FORWARD WHEN DELIVERED                  ║
╚══════════════════════════════════════════════════════════════╝
`);

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
import warehouseRoutes from "./routes/warehouseRoutes.js";

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
app.use("/api/warehouse", warehouseRoutes);

// ✅ WAREHOUSE AUTOMATION SYSTEM
let isCheckingWarehouse = false;
let warehouseCheckInterval = null;

// ✅ WAREHOUSE CHECK FUNCTION - COMPLETE WORKING VERSION
async function checkWarehouseShipments() {
  if (isCheckingWarehouse) {
    console.log('⏳ Warehouse check already in progress, skipping...');
    return;
  }
  
  isCheckingWarehouse = true;
  console.log('🕐 [WAREHOUSE] ========== STARTING AUTO CHECK ==========');
  
  try {
    // Dynamically import to avoid circular dependencies
    const Order = (await import('./models/Order.js')).default;
    const nimbuspostService = (await import('./services/nimbuspostService.js')).default;
    const User = (await import('./models/User.js')).default;
    
    // STEP 1: Find all orders with incoming shipments that might be at warehouse
    const orders = await Order.find({
      'nimbuspostShipments': {
        $elemMatch: {
          shipmentType: 'incoming',
          awbNumber: { $exists: true, $ne: null }
        }
      },
      $or: [
        { 'shippingLegs.leg': 'seller_to_warehouse', 'shippingLegs.status': 'pending' },
        { 'shippingLegs.leg': 'seller_to_warehouse', 'shippingLegs.status': 'in_transit' },
        { 'shippingLegs': { $size: 0 } }
      ]
    })
    .populate('buyer', 'name phone email')
    .populate('user', 'name phone email address')
    .populate('products', 'productName weight finalPrice images');
    
    console.log(`📊 Found ${orders.length} orders to check`);
    
    let forwardedCount = 0;
    let errorCount = 0;
    
    // STEP 2: Process each order
    for (const order of orders) {
      try {
        console.log(`\n📦 Processing Order: ${order._id}`);
        
        // Get all incoming shipments for this order
        const incomingShipments = order.nimbuspostShipments.filter(s => 
          s.shipmentType === 'incoming' && s.awbNumber && !s.error
        );
        
        console.log(`   📬 Found ${incomingShipments.length} incoming shipments`);
        
        for (const shipment of incomingShipments) {
          try {
            console.log(`   🔍 Checking AWB: ${shipment.awbNumber}`);
            
            // Check if outgoing already exists for this incoming
            const existingOutgoing = order.nimbuspostShipments.find(s => 
              s.parentAWB === shipment.awbNumber && s.shipmentType === 'outgoing'
            );
            
            if (existingOutgoing) {
              console.log(`   ⚠️  Outgoing already exists: ${existingOutgoing.awbNumber}`);
              continue;
            }
            
            // ✅ CRITICAL: Check if shipment is DELIVERED to warehouse
            console.log(`   📞 Checking delivery status for ${shipment.awbNumber}...`);
            const tracking = await nimbuspostService.trackShipment(shipment.awbNumber);
            
            const isDelivered = tracking?.current_status === 'Delivered' || 
                               tracking?.status === 'Delivered' ||
                               (tracking?.tracking && Array.isArray(tracking.tracking) && 
                                tracking.tracking.some(t => t.status === 'Delivered'));
            
            console.log(`   📦 Status: ${tracking?.current_status || tracking?.status || 'Unknown'}, Delivered: ${isDelivered}`);
            
            if (!isDelivered) {
              console.log(`   ⏳ Not delivered yet, skipping...`);
              continue;
            }
            
            // ✅ SHIPMENT IS DELIVERED TO WAREHOUSE - CREATE OUTGOING
            console.log(`   🎉 SHIPMENT DELIVERED! Creating outgoing...`);
            
            // Get product
            const product = order.products.find(p => 
              p._id.toString() === shipment.productId?.toString()
            ) || order.products[0];
            
            // Get buyer info
            const buyer = order.buyer || order.user || { 
              name: 'Customer', 
              phone: '9876543210',
              address: order.shippingAddress || 'Address not provided'
            };
            
            // Prepare buyer address
            let buyerAddress = buyer.address;
            if (!buyerAddress && order.shippingAddress) {
              buyerAddress = order.shippingAddress;
            }
            if (!buyerAddress && typeof buyer === 'object') {
              buyerAddress = {
                street: buyer.street || 'Address not provided',
                city: buyer.city || 'City',
                state: buyer.state || 'State',
                pincode: buyer.pincode || '110001'
              };
            }
            
            // Create outgoing shipment
            console.log(`   🚀 Creating warehouse → buyer shipment...`);
            
            const outgoingResult = await nimbuspostService.createB2BShipment(
              {
                orderId: `${order._id}-${shipment.productId || 'OUT'}`,
                totalAmount: order.totalAmount || product?.finalPrice || 0
              },
              {
                productName: product?.productName || 'Product',
                price: product?.finalPrice || 0,
                weight: product?.weight || 500,
                dimensions: { length: 20, breadth: 15, height: 10 }
              },
              nimbuspostService.WAREHOUSE_DETAILS, // Pickup from warehouse
              {
                name: buyer.name || 'Customer',
                phone: buyer.phone || '9876543210',
                email: buyer.email || '',
                address: buyerAddress
              },
              'warehouse_to_buyer'
            );
            
            if (outgoingResult.success) {
              console.log(`   ✅ Outgoing created: ${outgoingResult.awbNumber}`);
              
              // Update order with outgoing shipment
              order.nimbuspostShipments.push({
                productId: shipment.productId || product?._id,
                awbNumber: outgoingResult.awbNumber,
                shipmentId: outgoingResult.shipmentId,
                shipmentType: 'outgoing',
                parentAWB: shipment.awbNumber,
                status: 'booked',
                createdAt: new Date(),
                trackingUrl: outgoingResult.trackingUrl,
                labelUrl: outgoingResult.labelUrl,
                courierName: outgoingResult.courierName,
                notes: 'Auto-created when incoming delivered to warehouse'
              });
              
              // Update shipping legs
              let warehouseLeg = order.shippingLegs.find(l => l.leg === 'seller_to_warehouse');
              if (!warehouseLeg) {
                warehouseLeg = {
                  leg: 'seller_to_warehouse',
                  awbNumbers: [shipment.awbNumber],
                  status: 'completed',
                  createdAt: new Date(),
                  completedAt: new Date()
                };
                order.shippingLegs.push(warehouseLeg);
              } else {
                warehouseLeg.status = 'completed';
                warehouseLeg.completedAt = new Date();
                if (!warehouseLeg.awbNumbers.includes(shipment.awbNumber)) {
                  warehouseLeg.awbNumbers.push(shipment.awbNumber);
                }
                warehouseLeg.notes = `Delivered & auto-forwarded (${outgoingResult.awbNumber})`;
              }
              
              // Add outgoing leg
              const outgoingLeg = order.shippingLegs.find(l => l.leg === 'warehouse_to_buyer');
              if (!outgoingLeg) {
                order.shippingLegs.push({
                  leg: 'warehouse_to_buyer',
                  awbNumbers: [outgoingResult.awbNumber],
                  status: 'pending',
                  createdAt: new Date(),
                  notes: 'Auto-created: Warehouse → Buyer'
                });
              } else {
                if (!outgoingLeg.awbNumbers.includes(outgoingResult.awbNumber)) {
                  outgoingLeg.awbNumbers.push(outgoingResult.awbNumber);
                }
                outgoingLeg.status = 'pending';
              }
              
              // Update order status
              order.status = 'processing';
              order.notes = order.notes || [];
              order.notes.push({
                note: `Package forwarded from warehouse to buyer. Outgoing AWB: ${outgoingResult.awbNumber}`,
                createdAt: new Date()
              });
              
              // Save order
              await order.save({ validateBeforeSave: false });
              
              console.log(`   📋 Order updated successfully!`);
              forwardedCount++;
              
              // Send notification
              console.log(`   📢 Notification: ${shipment.awbNumber} → ${outgoingResult.awbNumber}`);
            }
            
          } catch (shipmentError) {
            console.error(`   ❌ Error processing AWB ${shipment.awbNumber}:`, shipmentError.message);
            errorCount++;
          }
        }
        
      } catch (orderError) {
        console.error(`❌ Error processing order ${order._id}:`, orderError.message);
        errorCount++;
      }
    }
    
    console.log(`\n✅ [WAREHOUSE] AUTO CHECK COMPLETED`);
    console.log(`   📦 Orders processed: ${orders.length}`);
    console.log(`   🚀 Packages forwarded: ${forwardedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`🕐 [WAREHOUSE] ========== CHECK COMPLETE ==========\n`);
    
  } catch (error) {
    console.error('❌ [WAREHOUSE] FATAL ERROR:', error);
  } finally {
    isCheckingWarehouse = false;
  }
}

// ✅ SETUP WAREHOUSE AUTO-CHECK INTERVAL
function setupWarehouseAutoCheck() {
  // Clear existing interval
  if (warehouseCheckInterval) {
    clearInterval(warehouseCheckInterval);
  }
  
  const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes for testing, production mein 30 mins rakho
  
  console.log(`🏭 Setting up warehouse auto-check (every ${CHECK_INTERVAL / 60000} minutes)...`);
  
  // Run check immediately after 10 seconds
  setTimeout(() => {
    console.log('🚀 Running initial warehouse check in 10 seconds...');
    setTimeout(() => {
      checkWarehouseShipments().catch(console.error);
    }, 10000);
  }, 1000);
  
  // Run check every X minutes
  warehouseCheckInterval = setInterval(() => {
    checkWarehouseShipments().catch(console.error);
  }, CHECK_INTERVAL);
  
  console.log(`✅ Warehouse auto-check scheduled every ${CHECK_INTERVAL / 60000} minutes`);
}

// ✅ MANUAL TRIGGER ENDPOINT
app.post("/api/warehouse/check-now", async (req, res) => {
  try {
    console.log('🚀 Manual warehouse check triggered via API');
    
    await checkWarehouseShipments();
    
    res.json({
      success: true,
      message: 'Warehouse check completed',
      timestamp: new Date().toISOString(),
      note: 'Check console logs for details'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ IMMEDIATE TEST ENDPOINT
app.post("/api/warehouse/test-forward/:awb", async (req, res) => {
  try {
    const { awb } = req.params;
    
    console.log(`🚀 TEST: Manual forward for AWB ${awb}`);
    
    const Order = (await import('./models/Order.js')).default;
    const nimbuspostService = (await import('./services/nimbuspostService.js')).default;
    
    // Find order with this AWB
    const order = await Order.findOne({
      'nimbuspostShipments.awbNumber': awb,
      'nimbuspostShipments.shipmentType': 'incoming'
    })
    .populate('buyer')
    .populate('products')
    .populate('user');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `No order found with incoming AWB: ${awb}`
      });
    }
    
    const shipment = order.nimbuspostShipments.find(s => s.awbNumber === awb);
    const product = order.products[0];
    const buyer = order.buyer || order.user;
    
    // Create outgoing
    const outgoingResult = await nimbuspostService.createB2BShipment(
      {
        orderId: `${order._id}-TEST`,
        totalAmount: order.totalAmount || 0
      },
      {
        productName: product?.productName || 'Product',
        price: product?.finalPrice || 0,
        weight: 500
      },
      nimbuspostService.WAREHOUSE_DETAILS,
      {
        name: buyer?.name || 'Customer',
        phone: buyer?.phone || '9876543210',
        address: order.shippingAddress || 'Address not provided'
      },
      'warehouse_to_buyer'
    );
    
    if (outgoingResult.success) {
      // Update order
      order.nimbuspostShipments.push({
        productId: product?._id,
        awbNumber: outgoingResult.awbNumber,
        shipmentId: outgoingResult.shipmentId,
        shipmentType: 'outgoing',
        parentAWB: awb,
        status: 'booked',
        createdAt: new Date(),
        trackingUrl: outgoingResult.trackingUrl
      });
      
      await order.save();
      
      res.json({
        success: true,
        message: 'Outgoing shipment created!',
        incomingAWB: awb,
        outgoingAWB: outgoingResult.awbNumber,
        trackingUrl: outgoingResult.trackingUrl,
        orderId: order._id
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to create outgoing'
      });
    }
    
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
      autoCheck: true,
      interval: "5 minutes",
      isRunning: isCheckingWarehouse,
      lastCheck: new Date().toISOString()
    },
    warehouse: {
      name: "JustBecho Warehouse",
      address: "103 Dilpasand grand, Behind Rafael tower, Indore, MP - 452001",
      contact: "Devansh Kothari - 9301847748"
    },
    endpoints: {
      checkNow: "POST /api/warehouse/check-now",
      testForward: "POST /api/warehouse/test-forward/:awb",
      dashboard: "GET /api/warehouse/dashboard"
    }
  });
});

// ✅ Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    warehouseAutomation: {
      status: "ACTIVE",
      method: "setInterval",
      interval: "5 minutes",
      isRunning: isCheckingWarehouse,
      flow: 'seller → warehouse → buyer (AUTO)'
    }
  });
});

// ✅ API Documentation
app.get("/", (req, res) => {
  res.json({ 
    message: "🚀 Just Becho API with FULL Warehouse Automation",
    timestamp: new Date().toISOString(),
    version: "4.0.0",
    warehouse: {
      name: "JustBecho Warehouse",
      location: "Indore, Madhya Pradesh",
      automation: "FULLY AUTOMATED - Seller → Warehouse → Buyer"
    },
    automation: {
      check: "Every 5 minutes",
      trigger: "When incoming marked as 'Delivered'",
      action: "Auto-create outgoing shipment",
      endpoints: {
        checkNow: "POST /api/warehouse/check-now",
        status: "GET /api/warehouse/status",
        testForward: "POST /api/warehouse/test-forward/:awb"
      }
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
  
  if (warehouseCheckInterval) {
    clearInterval(warehouseCheckInterval);
    console.log('✅ Warehouse auto-check stopped');
  }
  
  mongoose.connection.close();
  console.log('✅ MongoDB connection closed');
  process.exit(0);
});

// ✅ START SERVER
const startServer = async () => {
  try {
    await connectDB();
    
    const PORT = process.env.PORT || 8000;
    
    // ✅ START WAREHOUSE AUTOMATION
    setupWarehouseAutoCheck();
    
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                  🚀 JUST BECHO SERVER 4.0.0                  ║
║             🏭 FULL WAREHOUSE AUTOMATION ENABLED             ║
║         🔄 SELLER → WAREHOUSE → BUYER (AUTO-FORWARD)         ║
╚══════════════════════════════════════════════════════════════╝

📊 SERVER STATUS:
  ✅ Port: ${PORT}
  ✅ Warehouse Automation: ACTIVE
  ✅ Auto-check: Every 5 minutes
  ✅ Auto-forward: ENABLED
  ✅ Database: Connected

🏭 WAREHOUSE FLOW (AUTOMATIC):
  1️⃣ Seller → Warehouse (Incoming) ✅
  2️⃣ ✅ WHEN DELIVERED → Auto-check triggers
  3️⃣ Warehouse → Buyer (Outgoing) ✅
  4️⃣ Buyer receives package ✅

🔧 TEST ENDPOINTS:
  POST /api/warehouse/check-now       - Force check now
  POST /api/warehouse/test-forward/AWB - Manual forward
  GET  /api/warehouse/status          - Check automation status
  GET  /api/health                    - Health check

📞 WAREHOUSE CONTACT:
  📍 Address: 103 Dilpasand grand, Behind Rafael tower
  🏙️  City: Indore, Madhya Pradesh
  📮 Pincode: 452001
  👤 Contact: Devansh Kothari
  📞 Phone: 9301847748

──────────────────────────────────────────────────────────────
✅ Server is running. Warehouse automation ACTIVE.
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