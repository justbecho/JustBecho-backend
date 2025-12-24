// server.js - FIXED WAREHOUSE AUTOMATION
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
  res.header('Access-Control-Allow-Methods', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type', 'Authorization', 'x-api-key', 'X-Auth-Token');
  
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
// ✅ FIXED B2C WAREHOUSE AUTOMATION SYSTEM
// ==============================================

let isCheckingWarehouse = false;
let warehouseCheckInterval = null;

// ✅ FIXED: B2C WAREHOUSE CHECK FUNCTION
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
    const Product = (await import('./models/Product.js')).default;
    
    // ✅ FIXED QUERY: Find orders with delivered incoming shipments to warehouse
    const orders = await Order.find({
      'nimbuspostShipments.shipmentType': 'seller_to_warehouse',
      'nimbuspostShipments.status': 'delivered',
      'nimbuspostShipments.awbNumber': { $exists: true, $ne: null },
      'nimbuspostShipments.isMock': { $ne: true },
      $or: [
        { 'metadata.autoForwardEnabled': true },
        { 'metadata.autoForwardEnabled': { $exists: false } }
      ]
    })
    .populate('buyer', 'name email phone address')
    .populate('products', 'productName finalPrice weight dimensions images')
    .populate('user', 'name email phone');
    
    console.log(`📊 Found ${orders.length} orders with delivered shipments to warehouse`);
    
    let forwardedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    // Process each order
    for (const order of orders) {
      try {
        console.log(`\n📦 Processing Order: ${order._id}`);
        
        // Get DELIVERED incoming shipments for this order
        const deliveredShipments = order.nimbuspostShipments.filter(s => 
          s.shipmentType === 'seller_to_warehouse' && 
          s.status === 'delivered' && 
          s.awbNumber && 
          !s.isMock
        );
        
        console.log(`   📬 Found ${deliveredShipments.length} delivered incoming shipments`);
        
        for (const shipment of deliveredShipments) {
          try {
            console.log(`   🔍 Processing AWB: ${shipment.awbNumber}`);
            
            // Check if outgoing already exists for this incoming
            const existingOutgoing = order.nimbuspostShipments.find(s => 
              s.parentAWB === shipment.awbNumber || 
              (s.shipmentType === 'warehouse_to_buyer' && s.parentAWB === shipment.awbNumber)
            );
            
            if (existingOutgoing) {
              console.log(`   ⚠️  Outgoing already exists: ${existingOutgoing.awbNumber}`);
              skippedCount++;
              continue;
            }
            
            // ✅ SHIPMENT IS DELIVERED TO WAREHOUSE - CREATE OUTGOING
            console.log(`   🚀 Creating Warehouse → Buyer shipment...`);
            
            // Get product
            const product = order.products.find(p => 
              shipment.productId && p._id.toString() === shipment.productId.toString()
            ) || order.products[0];
            
            if (!product) {
              console.log(`   ❌ No product found for this shipment`);
              errorCount++;
              continue;
            }
            
            // Get buyer info
            const buyer = order.buyer || order.user;
            const buyerAddress = order.shippingAddress || (buyer?.address ? {
              street: buyer.address.street || buyer.address || 'Address not provided',
              city: buyer.address.city || 'City',
              state: buyer.address.state || 'State',
              pincode: buyer.address.pincode || '110001'
            } : {
              street: 'Address not provided',
              city: 'City',
              state: 'State',
              pincode: '110001'
            });
            
            // ✅ Create outgoing shipment
            const outgoingResult = await nimbuspostService.createWarehouseToBuyerB2C(
              {
                orderId: `${order._id}-${shipment.productId || product._id}`.substring(0, 50),
                totalAmount: product.finalPrice || order.totalAmount || 0
              },
              {
                productName: product.productName || 'Product',
                price: product.finalPrice || 0,
                weight: product.weight || 500,
                dimensions: product.dimensions || { length: 20, breadth: 15, height: 10 },
                productId: shipment.productId || product._id,
                quantity: 1
              },
              {
                name: buyer?.name || order.shippingAddress?.name || 'Customer',
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
                orderId: outgoingResult.orderId,
                shipmentMode: 'B2C',
                shipmentType: 'warehouse_to_buyer',
                parentAWB: shipment.awbNumber,
                status: outgoingResult.status || 'booked',
                createdAt: new Date(),
                trackingUrl: outgoingResult.trackingUrl,
                labelUrl: outgoingResult.labelUrl,
                courierName: outgoingResult.courierName,
                shipmentDetails: {
                  weight: product.weight || 500,
                  charges: outgoingResult.charges || { freight: 0, total: 0 },
                  estimatedDelivery: outgoingResult.estimatedDelivery
                },
                notes: outgoingResult.isMock 
                  ? 'MOCK: Auto-created when incoming delivered to warehouse' 
                  : 'Auto-created when incoming delivered to warehouse',
                direction: 'outgoing',
                isMock: outgoingResult.isMock || false,
                warehouseDetails: nimbuspostService.getWarehouseInfo()
              });
              
              // Update shipping legs
              let warehouseLeg = order.shippingLegs?.find(l => l.leg === 'seller_to_warehouse');
              if (!warehouseLeg) {
                warehouseLeg = {
                  leg: 'seller_to_warehouse',
                  awbNumbers: [shipment.awbNumber],
                  status: 'completed',
                  startedAt: new Date(),
                  completedAt: new Date(),
                  notes: 'Shipment delivered to warehouse'
                };
                order.shippingLegs = order.shippingLegs || [];
                order.shippingLegs.push(warehouseLeg);
              } else {
                warehouseLeg.status = 'completed';
                warehouseLeg.completedAt = new Date();
                warehouseLeg.notes = `Delivered & auto-forwarded (${outgoingResult.awbNumber})`;
                warehouseLeg.awbNumbers = warehouseLeg.awbNumbers || [];
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
                notes: outgoingResult.isMock ? 'MOCK forwarding' : 'Auto-forwarded from warehouse',
                parentAWB: shipment.awbNumber
              });
              
              // Update order status
              if (order.status !== 'delivered' && order.status !== 'shipped') {
                order.status = 'processing';
              }
              
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
                  productId: product._id,
                  isMock: outgoingResult.isMock || false
                }
              });
              
              // Save order
              await order.save({ validateBeforeSave: false });
              
              console.log(`   📋 Order updated successfully!`);
              forwardedCount++;
              
              // Update product shipping status
              try {
                await Product.findByIdAndUpdate(product._id, {
                  $set: {
                    shippingStatus: 'forwarded_from_warehouse',
                    forwardedAt: new Date(),
                    warehouseAWB: shipment.awbNumber,
                    buyerAWB: outgoingResult.awbNumber,
                    isMockForwarded: outgoingResult.isMock || false
                  }
                });
                console.log(`   ✅ Product shipping status updated`);
              } catch (productError) {
                console.log(`   ⚠️  Product update error: ${productError.message}`);
              }
              
            } else {
              console.log(`   ❌ Failed to create outgoing shipment: ${outgoingResult.message}`);
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
    console.log(`   📦 Total orders processed: ${orders.length}`);
    console.log(`   🚀 Packages forwarded: ${forwardedCount}`);
    console.log(`   ⏭️  Already forwarded (skipped): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
    if (forwardedCount > 0) {
      console.log(`   🎉 Successfully auto-forwarded ${forwardedCount} shipments!`);
    } else if (skippedCount > 0) {
      console.log(`   ℹ️  ${skippedCount} shipments already forwarded`);
    } else {
      console.log(`   ℹ️  No shipments ready for forwarding`);
    }
    
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
  
  // Run check immediately after 10 seconds
  setTimeout(() => {
    console.log('🚀 Running initial warehouse check in 10 seconds...');
    setTimeout(() => {
      checkB2CWarehouseShipments().catch(console.error);
    }, 10000);
  }, 1000);
  
  // Run check every X minutes
  warehouseCheckInterval = setInterval(() => {
    console.log('\n⏰ Scheduled warehouse check triggered...');
    checkB2CWarehouseShipments().catch(console.error);
  }, CHECK_INTERVAL);
  
  console.log(`✅ Warehouse auto-check scheduled every ${CHECK_INTERVAL / 60000} minutes`);
}

// ==============================================
// ✅ FIXED API ENDPOINTS FOR MANUAL CONTROL
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

// ✅ FIXED: MANUAL FORWARD ENDPOINT
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
    .populate('buyer', 'name email phone address')
    .populate('products', 'productName finalPrice weight dimensions images')
    .populate('user', 'name email phone');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `No incoming shipment found with AWB: ${awb}`
      });
    }
    
    const shipment = order.nimbuspostShipments.find(s => s.awbNumber === awb);
    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: `Shipment not found for AWB: ${awb}`
      });
    }
    
    const product = order.products.find(p => 
      shipment.productId && p._id.toString() === shipment.productId.toString()
    ) || order.products[0];
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found for this shipment'
      });
    }
    
    const buyer = order.buyer || order.user;
    const buyerAddress = order.shippingAddress || (buyer?.address ? {
      street: buyer.address.street || buyer.address || 'Address not provided',
      city: buyer.address.city || 'City',
      state: buyer.address.state || 'State',
      pincode: buyer.address.pincode || '110001'
    } : {
      street: 'Address not provided',
      city: 'City',
      state: 'State',
      pincode: '110001'
    });
    
    // Create outgoing shipment
    const outgoingResult = await nimbuspostService.createWarehouseToBuyerB2C(
      {
        orderId: `MANUAL-${order._id}-${product._id}`.substring(0, 50),
        totalAmount: product.finalPrice || order.totalAmount || 0
      },
      {
        productName: product.productName || 'Product',
        price: product.finalPrice || 0,
        weight: product.weight || 500,
        dimensions: product.dimensions || { length: 20, breadth: 15, height: 10 },
        productId: product._id,
        quantity: 1
      },
      {
        name: buyer?.name || 'Customer',
        phone: buyer?.phone || '9876543210',
        email: buyer?.email || '',
        address: buyerAddress,
        pincode: buyerAddress.pincode || '110001',
        city: buyerAddress.city || 'City',
        state: buyerAddress.state || 'State'
      }
    );
    
    if (outgoingResult.success) {
      // Update order with outgoing
      order.nimbuspostShipments.push({
        productId: product._id,
        awbNumber: outgoingResult.awbNumber,
        shipmentId: outgoingResult.shipmentId,
        orderId: outgoingResult.orderId,
        shipmentMode: 'B2C',
        shipmentType: 'warehouse_to_buyer',
        parentAWB: awb,
        status: outgoingResult.status || 'booked',
        createdAt: new Date(),
        trackingUrl: outgoingResult.trackingUrl,
        labelUrl: outgoingResult.labelUrl,
        courierName: outgoingResult.courierName,
        shipmentDetails: {
          weight: product.weight || 500,
          charges: outgoingResult.charges || { freight: 0, total: 0 },
          estimatedDelivery: outgoingResult.estimatedDelivery
        },
        notes: outgoingResult.isMock ? 'MOCK: Manually created from warehouse' : 'Manually created from warehouse',
        direction: 'outgoing',
        isMock: outgoingResult.isMock || false,
        warehouseDetails: nimbuspostService.getWarehouseInfo()
      });
      
      // Update shipping legs
      let warehouseLeg = order.shippingLegs?.find(l => l.leg === 'seller_to_warehouse');
      if (warehouseLeg) {
        warehouseLeg.status = 'completed';
        warehouseLeg.completedAt = new Date();
        warehouseLeg.notes = `Manually forwarded (${outgoingResult.awbNumber})`;
      } else {
        order.shippingLegs = order.shippingLegs || [];
        order.shippingLegs.push({
          leg: 'seller_to_warehouse',
          awbNumbers: [awb],
          status: 'completed',
          startedAt: new Date(),
          completedAt: new Date(),
          notes: 'Manually forwarded'
        });
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
      
      if (order.status !== 'delivered' && order.status !== 'shipped') {
        order.status = 'processing';
      }
      
      await order.save({ validateBeforeSave: false });
      
      res.json({
        success: true,
        message: 'Outgoing shipment created successfully!',
        incomingAWB: awb,
        outgoingAWB: outgoingResult.awbNumber,
        trackingUrl: outgoingResult.trackingUrl,
        orderId: order._id,
        productId: product._id,
        courier: outgoingResult.courierName,
        isMock: outgoingResult.isMock || false
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to create outgoing shipment: ' + (outgoingResult.message || 'Unknown error')
      });
    }
    
  } catch (error) {
    console.error('Manual forward error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'JustBecho API',
    version: '5.0.0',
    warehouseAutomation: {
      status: warehouseCheckInterval ? "ACTIVE" : "INACTIVE",
      method: "setInterval",
      interval: "15 minutes",
      isRunning: isCheckingWarehouse,
      lastCheck: new Date().toISOString()
    },
    services: {
      mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      warehouseAutoForward: "enabled"
    }
  });
});

// ✅ API Documentation
app.get("/", (req, res) => {
  res.json({ 
    message: "🚀 Just Becho API with B2C Warehouse Automation",
    timestamp: new Date().toISOString(),
    version: "5.0.0",
    warehouse: {
      name: "JustBecho Warehouse",
      location: "Indore, Madhya Pradesh",
      automation: "B2C WAREHOUSE AUTO-FORWARD FLOW"
    },
    automation: {
      check: "Every 15 minutes",
      trigger: "When incoming B2C shipment marked as 'Delivered' to warehouse",
      action: "Auto-create B2C outgoing shipment to buyer",
      flow: "Seller → Warehouse (B2C) → Auto-check → Warehouse → Buyer (B2C)"
    },
    endpoints: {
      health: "GET /api/health",
      warehouse: {
        checkNow: "POST /api/warehouse/check-now",
        forward: "POST /api/warehouse/forward/:awb"
      },
      orders: {
        create: "POST /api/razorpay/create-order",
        verify: "POST /api/razorpay/verify-payment"
      }
    }
  });
});

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
    timestamp: new Date().toISOString(),
    suggestion: 'Check / endpoint for available routes'
  });
});

// ✅ Global error handler
app.use((error, req, res, next) => {
  console.error('💥 Global error:', error.message);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    timestamp: new Date().toISOString(),
    errorType: error.name
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
║                  🚀 JUST BECHO SERVER 5.0.0                  ║
║            🏭 B2C WAREHOUSE AUTOMATION ENABLED              ║
║      🔄 SELLER → WAREHOUSE → BUYER (AUTO-FORWARD)          ║
╚══════════════════════════════════════════════════════════════╝

📊 SERVER STATUS:
  ✅ Port: ${PORT}
  ✅ Warehouse Automation: ACTIVE
  ✅ Auto-check: Every 15 minutes
  ✅ Auto-forward: ENABLED
  ✅ Database: Connected
  ✅ B2C Flow: Seller → Warehouse → Buyer

🏭 B2C WAREHOUSE FLOW (AUTOMATIC):
  1️⃣ B2C: Seller → Warehouse ✅
  2️⃣ ✅ WHEN DELIVERED TO WAREHOUSE → Auto-check triggers
  3️⃣ B2C: Warehouse → Buyer ✅
  4️⃣ Buyer receives package via B2C ✅

🔧 WAREHOUSE ENDPOINTS:
  POST /api/warehouse/check-now          - Force check now
  POST /api/warehouse/forward/:awb       - Manual forward specific AWB
  GET  /api/health                       - Check server status

📦 SHIPMENT DETAILS:
  📮 Shipment Mode: B2C
  🔄 Flow: Two-leg B2C via Warehouse
  ⚡ Automation: Fully Automatic
  📊 Tracking: Real-time via NimbusPost API

──────────────────────────────────────────────────────────────
✅ Server is running. B2C Warehouse automation ACTIVE.
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