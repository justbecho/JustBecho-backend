// server.js - COMPLETE WITH B2C WAREHOUSE AUTOMATION
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';

// ✅ Load environment variables
dotenv.config();

console.log(`
╔══════════════════════════════════════════════════════════════╗
║           🚀 JUST BECHO SERVER - B2C WAREHOUSE FLOW         ║
║          📦 B2C: SELLER → WAREHOUSE → BUYER                ║
║           ⚡ AUTO-FORWARD WHEN DELIVERED TO WAREHOUSE       ║
╚══════════════════════════════════════════════════════════════╝
`);

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

// ✅ CONFIGURE CLOUDINARY
console.log('☁️ Initializing Cloudinary...');
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

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

// ==============================================
// ✅ B2C WAREHOUSE AUTOMATION SYSTEM
// ==============================================

let isCheckingWarehouse = false;
let warehouseCheckInterval = null;

// ✅ B2C WAREHOUSE CHECK FUNCTION
async function checkB2CWarehouseShipments() {
  if (isCheckingWarehouse) {
    console.log('⏳ Warehouse check already in progress, skipping...');
    return;
  }
  
  isCheckingWarehouse = true;
  console.log('\n🕐 [B2C WAREHOUSE] ========== STARTING AUTO CHECK ==========');
  
  try {
    // Dynamically import to avoid circular dependencies
    const Order = (await import('./models/Order.js')).default;
    const nimbuspostService = (await import('./services/nimbuspostService.js')).default;
    const User = (await import('./models/User.js')).default;
    const Product = (await import('./models/Product.js')).default;
    
    // STEP 1: Find all orders with incoming shipments to warehouse
    const orders = await Order.find({
      'nimbuspostShipments': {
        $elemMatch: {
          shipmentType: 'seller_to_warehouse',
          status: { $nin: ['cancelled', 'failed'] },
          awbNumber: { $exists: true, $ne: null }
        }
      },
      'shippingLegs': {
        $elemMatch: {
          leg: 'seller_to_warehouse',
          status: { $in: ['pending', 'in_transit', 'completed'] }
        }
      },
      'shippingLegs': {
        $not: {
          $elemMatch: {
            leg: 'warehouse_to_buyer',
            status: { $in: ['completed', 'in_transit'] }
          }
        }
      }
    })
    .populate('buyer', 'name phone email address city state pincode')
    .populate('user', 'name phone email address')
    .populate('products', 'productName brand weight finalPrice images dimensions');
    
    console.log(`📊 Found ${orders.length} orders with incoming shipments to check`);
    
    let forwardedCount = 0;
    let deliveredCount = 0;
    let errorCount = 0;
    
    // STEP 2: Process each order
    for (const order of orders) {
      try {
        console.log(`\n📦 Processing Order: ${order._id}`);
        console.log(`   📍 Buyer: ${order.buyer?.name || order.user?.name}`);
        
        // Get incoming shipments for this order
        const incomingShipments = order.nimbuspostShipments.filter(s => 
          s.shipmentType === 'seller_to_warehouse' && 
          s.awbNumber && 
          !s.error
        );
        
        console.log(`   📬 Found ${incomingShipments.length} incoming shipments`);
        
        for (const shipment of incomingShipments) {
          try {
            console.log(`   🔍 Checking AWB: ${shipment.awbNumber}`);
            
            // Check if outgoing already exists for this incoming
            const existingOutgoing = order.nimbuspostShipments.find(s => 
              s.parentAWB === shipment.awbNumber && 
              s.shipmentType === 'warehouse_to_buyer'
            );
            
            if (existingOutgoing) {
              console.log(`   ⚠️  Outgoing already exists: ${existingOutgoing.awbNumber}`);
              continue;
            }
            
            // ✅ CRITICAL: Check if shipment is DELIVERED to warehouse
            console.log(`   📞 Checking delivery status for ${shipment.awbNumber}...`);
            
            let tracking;
            try {
              tracking = await nimbuspostService.trackShipment(shipment.awbNumber);
            } catch (trackError) {
              console.log(`   ❌ Tracking error: ${trackError.message}`);
              
              // Try with B2C method
              try {
                tracking = await nimbuspostService.trackB2CShipment(shipment.awbNumber);
              } catch (error) {
                console.log(`   ❌ Both tracking methods failed`);
                continue;
              }
            }
            
            const isDelivered = tracking?.status === 'delivered' || 
                               tracking?.current_status === 'Delivered' ||
                               (tracking?.tracking && Array.isArray(tracking.tracking) && 
                                tracking.tracking.some(t => t.status === 'Delivered')) ||
                               tracking?.data?.status === 'delivered';
            
            console.log(`   📦 Status: ${tracking?.current_status || tracking?.status || 'Unknown'}, Delivered: ${isDelivered}`);
            
            if (isDelivered) {
              deliveredCount++;
              console.log(`   🎉 SHIPMENT DELIVERED TO WAREHOUSE!`);
            } else {
              console.log(`   ⏳ Not delivered yet, skipping...`);
              continue;
            }
            
            // ✅ SHIPMENT IS DELIVERED TO WAREHOUSE - CREATE OUTGOING
            console.log(`   🚀 Creating Warehouse → Buyer shipment...`);
            
            // Get product
            const product = order.products.find(p => 
              p._id.toString() === shipment.productId?.toString()
            ) || order.products[0];
            
            if (!product) {
              console.log(`   ❌ No product found for this shipment`);
              continue;
            }
            
            // Get buyer info
            const buyer = order.buyer || order.user;
            const buyerAddress = order.shippingAddress || buyer?.address || {
              street: 'Address not provided',
              city: 'City',
              state: 'State',
              pincode: '110001'
            };
            
            // Create outgoing shipment
            const outgoingResult = await nimbuspostService.createWarehouseToBuyerB2C(
              {
                orderId: `JB-OUT-${order._id}-${shipment.productId || product._id}`,
                totalAmount: product.finalPrice || order.totalAmount || 0
              },
              {
                productName: product.productName || 'Product',
                price: product.finalPrice || 0,
                weight: product.weight || 500,
                dimensions: product.dimensions || { length: 20, breadth: 15, height: 10 },
                productId: shipment.productId || product._id
              },
              {
                name: buyer?.name || 'Customer',
                phone: buyer?.phone || order.shippingAddress?.phone || '9876543210',
                email: buyer?.email || '',
                address: buyerAddress,
                pincode: buyerAddress.pincode || '110001',
                city: buyerAddress.city || 'City',
                state: buyerAddress.state || 'State'
              }
            );
            
            if (outgoingResult.success) {
              console.log(`   ✅ Outgoing created: ${outgoingResult.awbNumber} via ${outgoingResult.courierName}`);
              
              // Update order with outgoing shipment
              order.nimbuspostShipments.push({
                productId: shipment.productId || product._id,
                awbNumber: outgoingResult.awbNumber,
                shipmentId: outgoingResult.shipmentId,
                shipmentMode: 'B2C',
                shipmentType: 'warehouse_to_buyer',
                parentAWB: shipment.awbNumber,
                status: 'booked',
                createdAt: new Date(),
                trackingUrl: outgoingResult.trackingUrl,
                labelUrl: outgoingResult.labelUrl,
                courierName: outgoingResult.courierName,
                shipmentDetails: {
                  weight: product.weight || 500,
                  charges: outgoingResult.charges || { freight: 0, total: 0 },
                  estimatedDelivery: outgoingResult.estimatedDelivery
                },
                notes: 'Auto-created when incoming delivered to warehouse',
                direction: 'outgoing',
                warehouseDetails: nimbuspostService.getWarehouseInfo()
              });
              
              // Update shipping legs
              let warehouseLeg = order.shippingLegs.find(l => l.leg === 'seller_to_warehouse');
              if (!warehouseLeg) {
                warehouseLeg = {
                  leg: 'seller_to_warehouse',
                  awbNumbers: [shipment.awbNumber],
                  status: 'completed',
                  createdAt: new Date(),
                  completedAt: new Date(),
                  notes: 'Shipment delivered to warehouse'
                };
                order.shippingLegs.push(warehouseLeg);
              } else {
                warehouseLeg.status = 'completed';
                warehouseLeg.completedAt = new Date();
                warehouseLeg.notes = `Delivered & auto-forwarded (${outgoingResult.awbNumber})`;
                if (!warehouseLeg.awbNumbers.includes(shipment.awbNumber)) {
                  warehouseLeg.awbNumbers.push(shipment.awbNumber);
                }
              }
              
              // Add outgoing leg
              order.shippingLegs.push({
                leg: 'warehouse_to_buyer',
                awbNumbers: [outgoingResult.awbNumber],
                status: 'pending',
                startedAt: new Date(),
                courierName: outgoingResult.courierName,
                notes: 'Auto-forwarded from warehouse',
                parentAWB: shipment.awbNumber
              });
              
              // Update order status
              order.status = 'forwarded';
              order.forwardedAt = new Date();
              
              // Add timeline entry
              order.timeline = order.timeline || [];
              order.timeline.push({
                event: 'auto_forwarded',
                description: `Shipment ${shipment.awbNumber} delivered to warehouse, auto-forwarded to buyer: ${outgoingResult.awbNumber}`,
                status: 'forwarded',
                timestamp: new Date(),
                metadata: {
                  incomingAWB: shipment.awbNumber,
                  outgoingAWB: outgoingResult.awbNumber,
                  productId: product._id
                }
              });
              
              // Save order
              await order.save({ validateBeforeSave: false });
              
              console.log(`   📋 Order updated successfully!`);
              forwardedCount++;
              
              // Update product shipping status
              try {
                await Product.findByIdAndUpdate(product._id, {
                  shippingStatus: 'forwarded_from_warehouse',
                  forwardedAt: new Date(),
                  warehouseAWB: shipment.awbNumber,
                  buyerAWB: outgoingResult.awbNumber
                });
                console.log(`   ✅ Product shipping status updated`);
              } catch (productError) {
                console.log(`   ⚠️  Product update error: ${productError.message}`);
              }
              
              // Send notification (optional)
              console.log(`   📢 Notification: ${shipment.awbNumber} → ${outgoingResult.awbNumber}`);
              
            } else {
              console.log(`   ❌ Failed to create outgoing shipment`);
              errorCount++;
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
    console.log(`   📬 Incoming shipments delivered: ${deliveredCount}`);
    console.log(`   🚀 Packages forwarded: ${forwardedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`🕐 [WAREHOUSE] ========== CHECK COMPLETE ==========\n`);
    
  } catch (error) {
    console.error('❌ [WAREHOUSE] FATAL ERROR:', error);
  } finally {
    isCheckingWarehouse = false;
  }
}

// ✅ SETUP AUTO-CHECK INTERVAL
function setupWarehouseAutoCheck() {
  // Clear existing interval
  if (warehouseCheckInterval) {
    clearInterval(warehouseCheckInterval);
  }
  
  const CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes
  
  console.log(`🏭 Setting up warehouse auto-check (every ${CHECK_INTERVAL / 60000} minutes)...`);
  
  // Run check immediately after 15 seconds
  setTimeout(() => {
    console.log('🚀 Running initial warehouse check in 15 seconds...');
    setTimeout(() => {
      checkB2CWarehouseShipments().catch(console.error);
    }, 15000);
  }, 1000);
  
  // Run check every X minutes
  warehouseCheckInterval = setInterval(() => {
    checkB2CWarehouseShipments().catch(console.error);
  }, CHECK_INTERVAL);
  
  console.log(`✅ Warehouse auto-check scheduled every ${CHECK_INTERVAL / 60000} minutes`);
}

// ==============================================
// ✅ API ENDPOINTS FOR MANUAL CONTROL
// ==============================================

// ✅ MANUAL CHECK ENDPOINT
app.post("/api/warehouse/check-now", async (req, res) => {
  try {
    console.log('🚀 Manual warehouse check triggered via API');
    
    await checkB2CWarehouseShipments();
    
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

// ✅ MANUAL FORWARD ENDPOINT
app.post("/api/warehouse/forward/:awb", async (req, res) => {
  try {
    const { awb } = req.params;
    
    console.log(`🚀 MANUAL FORWARD: Creating shipment for incoming AWB ${awb}`);
    
    const Order = (await import('./models/Order.js')).default;
    const nimbuspostService = (await import('./services/nimbuspostService.js')).default;
    
    // Find order with this incoming AWB
    const order = await Order.findOne({
      'nimbuspostShipments.awbNumber': awb,
      'nimbuspostShipments.shipmentType': 'seller_to_warehouse'
    })
    .populate('buyer', 'name phone email address')
    .populate('products', 'productName weight finalPrice images dimensions')
    .populate('user', 'name phone email');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `No incoming shipment found with AWB: ${awb}`
      });
    }
    
    const shipment = order.nimbuspostShipments.find(s => s.awbNumber === awb);
    const product = order.products.find(p => 
      p._id.toString() === shipment.productId?.toString()
    ) || order.products[0];
    
    const buyer = order.buyer || order.user;
    const buyerAddress = order.shippingAddress || buyer?.address || {
      street: 'Address not provided',
      city: 'City',
      state: 'State',
      pincode: '110001'
    };
    
    // Create outgoing shipment
    const outgoingResult = await nimbuspostService.createWarehouseToBuyerB2C(
      {
        orderId: `JB-OUT-MANUAL-${order._id}-${product._id}`,
        totalAmount: product.finalPrice || order.totalAmount || 0
      },
      {
        productName: product.productName || 'Product',
        price: product.finalPrice || 0,
        weight: product.weight || 500,
        dimensions: product.dimensions || { length: 20, breadth: 15, height: 10 },
        productId: product._id
      },
      {
        name: buyer?.name || 'Customer',
        phone: buyer?.phone || '9876543210',
        email: buyer?.email || '',
        address: buyerAddress,
        pincode: buyerAddress.pincode || '110001'
      }
    );
    
    if (outgoingResult.success) {
      // Update order with outgoing
      order.nimbuspostShipments.push({
        productId: product._id,
        awbNumber: outgoingResult.awbNumber,
        shipmentId: outgoingResult.shipmentId,
        shipmentMode: 'B2C',
        shipmentType: 'warehouse_to_buyer',
        parentAWB: awb,
        status: 'booked',
        createdAt: new Date(),
        trackingUrl: outgoingResult.trackingUrl,
        labelUrl: outgoingResult.labelUrl,
        courierName: outgoingResult.courierName,
        shipmentDetails: {
          weight: product.weight || 500,
          charges: outgoingResult.charges || { freight: 0, total: 0 },
          estimatedDelivery: outgoingResult.estimatedDelivery
        },
        notes: 'Manually created from warehouse',
        direction: 'outgoing',
        warehouseDetails: nimbuspostService.getWarehouseInfo()
      });
      
      // Update shipping legs
      const warehouseLeg = order.shippingLegs.find(l => l.leg === 'seller_to_warehouse');
      if (warehouseLeg) {
        warehouseLeg.status = 'completed';
        warehouseLeg.completedAt = new Date();
        warehouseLeg.notes = `Manually forwarded (${outgoingResult.awbNumber})`;
      }
      
      order.shippingLegs.push({
        leg: 'warehouse_to_buyer',
        awbNumbers: [outgoingResult.awbNumber],
        status: 'pending',
        startedAt: new Date(),
        courierName: outgoingResult.courierName,
        notes: 'Manual forwarding',
        parentAWB: awb
      });
      
      order.status = 'forwarded';
      order.forwardedAt = new Date();
      
      await order.save();
      
      res.json({
        success: true,
        message: 'Outgoing shipment created successfully!',
        incomingAWB: awb,
        outgoingAWB: outgoingResult.awbNumber,
        trackingUrl: outgoingResult.trackingUrl,
        orderId: order._id,
        productId: product._id,
        courier: outgoingResult.courierName
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to create outgoing shipment'
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
      interval: "15 minutes",
      isRunning: isCheckingWarehouse,
      lastCheck: new Date().toISOString()
    },
    warehouse: {
      name: "JustBecho Warehouse",
      location: "Indore, Madhya Pradesh",
      address: "103 Dilpasand grand, Behind Rafael tower",
      pincode: "452001",
      contact: "Devansh Kothari - 9301847748"
    },
    endpoints: {
      checkNow: "POST /api/warehouse/check-now",
      manualForward: "POST /api/warehouse/forward/:awb"
    }
  });
});

// ==============================================
// ✅ ADDITIONAL SERVER ENDPOINTS
// ==============================================

// ✅ Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    warehouseAutomation: {
      status: "ACTIVE",
      method: "setInterval",
      interval: "15 minutes",
      isRunning: isCheckingWarehouse
    }
  });
});

// ✅ API Documentation
app.get("/", (req, res) => {
  res.json({ 
    message: "🚀 Just Becho API with Warehouse Automation",
    timestamp: new Date().toISOString(),
    version: "4.0.0",
    warehouse: {
      name: "JustBecho Warehouse",
      location: "Indore, Madhya Pradesh",
      automation: "WAREHOUSE AUTO-FORWARD FLOW"
    },
    automation: {
      check: "Every 15 minutes",
      trigger: "When incoming shipment marked as 'Delivered'",
      action: "Auto-create outgoing shipment to buyer",
      endpoints: {
        checkNow: "POST /api/warehouse/check-now",
        status: "GET /api/warehouse/status",
        manualForward: "POST /api/warehouse/forward/:awb"
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

// ==============================================
// ✅ START SERVER
// ==============================================

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
║            🏭 WAREHOUSE AUTOMATION ENABLED                  ║
║      🔄 SELLER → WAREHOUSE → BUYER (AUTO-FORWARD)          ║
╚══════════════════════════════════════════════════════════════╝

📊 SERVER STATUS:
  ✅ Port: ${PORT}
  ✅ Warehouse Automation: ACTIVE
  ✅ Auto-check: Every 15 minutes
  ✅ Auto-forward: ENABLED
  ✅ Database: Connected

🏭 WAREHOUSE FLOW (AUTOMATIC):
  1️⃣ Seller → Warehouse ✅
  2️⃣ ✅ WHEN DELIVERED TO WAREHOUSE → Auto-check triggers
  3️⃣ Warehouse → Buyer ✅
  4️⃣ Buyer receives package ✅

🔧 MANUAL ENDPOINTS:
  POST /api/warehouse/check-now    - Force check now
  POST /api/warehouse/forward/:awb - Manual forward specific AWB
  GET  /api/warehouse/status       - Check automation status
  GET  /api/health                 - Health check

📦 SHIPMENT DETAILS:
  📮 Shipment Mode: B2C
  🔄 Flow: Two-leg via Warehouse
  ⚡ Automation: Fully Automatic
  📊 Tracking: Real-time updates

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