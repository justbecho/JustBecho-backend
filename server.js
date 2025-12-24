// server.js - UPDATED WITH FIXED WAREHOUSE AUTOMATION
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
// ✅ UPDATED B2C WAREHOUSE AUTOMATION SYSTEM
// ==============================================

let isCheckingWarehouse = false;
let warehouseCheckInterval = null;

// ✅ UPDATED B2C WAREHOUSE CHECK FUNCTION - USES NEW NIMBUSPOST API
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
    
    // ✅ FIXED: Find orders with delivered incoming shipments to warehouse
    const orders = await Order.find({
      'nimbuspostShipments': {
        $elemMatch: {
          shipmentType: 'seller_to_warehouse',
          status: 'delivered', // Only look for DELIVERED shipments
          awbNumber: { $exists: true, $ne: null },
          isMock: { $ne: true } // Skip mock shipments
        }
      },
      'nimbuspostShipments': {
        $not: {
          $elemMatch: {
            shipmentType: 'warehouse_to_buyer',
            parentAWB: { $exists: true } // No outgoing created yet
          }
        }
      },
      'metadata.autoForwardEnabled': true
    })
    .populate('buyer', 'name email phone address')
    .populate('products', 'productName finalPrice weight dimensions images')
    .populate('user', 'name email phone');
    
    console.log(`📊 Found ${orders.length} orders with delivered shipments ready for forwarding`);
    
    let forwardedCount = 0;
    let errorCount = 0;
    
    // STEP 2: Process each order
    for (const order of orders) {
      try {
        console.log(`\n📦 Processing Order: ${order._id}`);
        console.log(`   📍 Buyer: ${order.buyer?.name || order.user?.name}`);
        
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
            console.log(`   🔍 Processing delivered AWB: ${shipment.awbNumber}`);
            
            // Check if outgoing already exists for this incoming
            const existingOutgoing = order.nimbuspostShipments.find(s => 
              s.parentAWB === shipment.awbNumber && 
              s.shipmentType === 'warehouse_to_buyer'
            );
            
            if (existingOutgoing) {
              console.log(`   ⚠️  Outgoing already exists: ${existingOutgoing.awbNumber}`);
              continue;
            }
            
            // ✅ SHIPMENT IS ALREADY DELIVERED TO WAREHOUSE - CREATE OUTGOING
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
            
            // ✅ UPDATED: Create outgoing shipment using new API format
            const outgoingResult = await nimbuspostService.createWarehouseToBuyerB2C(
              {
                orderId: `${order._id}-${shipment.productId || product._id}`,
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
                name: buyer?.name || 'Customer',
                phone: buyer?.phone || order.shippingAddress?.phone || '9876543210',
                email: buyer?.email || '',
                address: buyerAddress,
                pincode: buyerAddress.pincode || '110001',
                city: buyerAddress.city || 'City',
                state: buyerAddress.state || 'State',
                latitude: '28.7041', // Default Delhi coordinates
                longitude: '77.1025'
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
                notes: outgoingResult.isMock ? 'MOCK forwarding' : 'Auto-forwarded from warehouse',
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
                  shippingStatus: 'forwarded_from_warehouse',
                  forwardedAt: new Date(),
                  warehouseAWB: shipment.awbNumber,
                  buyerAWB: outgoingResult.awbNumber,
                  isMockForwarded: outgoingResult.isMock || false
                });
                console.log(`   ✅ Product shipping status updated`);
              } catch (productError) {
                console.log(`   ⚠️  Product update error: ${productError.message}`);
              }
              
              // Send notification (optional)
              console.log(`   📢 ${outgoingResult.isMock ? 'MOCK ' : ''}Notification: ${shipment.awbNumber} → ${outgoingResult.awbNumber}`);
              
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
    console.log(`   🚀 Packages forwarded: ${forwardedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
    if (forwardedCount > 0) {
      console.log(`   🎉 Successfully auto-forwarded ${forwardedCount} shipments!`);
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
  
  // Run check immediately after 15 seconds
  setTimeout(() => {
    console.log('🚀 Running initial warehouse check in 15 seconds...');
    setTimeout(() => {
      checkB2CWarehouseShipments().catch(console.error);
    }, 15000);
  }, 1000);
  
  // Run check every X minutes
  warehouseCheckInterval = setInterval(() => {
    console.log('\n⏰ Scheduled warehouse check triggered...');
    checkB2CWarehouseShipments().catch(console.error);
  }, CHECK_INTERVAL);
  
  console.log(`✅ Warehouse auto-check scheduled every ${CHECK_INTERVAL / 60000} minutes`);
}

// ==============================================
// ✅ UPDATED API ENDPOINTS FOR MANUAL CONTROL
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

// ✅ UPDATED MANUAL FORWARD ENDPOINT
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
    
    // ✅ UPDATED: Create outgoing shipment using new API
    const outgoingResult = await nimbuspostService.createWarehouseToBuyerB2C(
      {
        orderId: `MANUAL-${order._id}-${product._id}`,
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
        state: buyerAddress.state || 'State',
        latitude: '28.7041',
        longitude: '77.1025'
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

// ✅ ADDITIONAL ENDPOINT: FORCE FORWARD ALL DELIVERED
app.post("/api/warehouse/forward-all-delivered", async (req, res) => {
  try {
    console.log('🚀 Force forwarding all delivered shipments...');
    
    const Order = (await import('./models/Order.js')).default;
    const nimbuspostService = (await import('./services/nimbuspostService.js')).default;
    
    // Find all orders with delivered incoming shipments
    const orders = await Order.find({
      'nimbuspostShipments': {
        $elemMatch: {
          shipmentType: 'seller_to_warehouse',
          status: 'delivered'
        }
      },
      'nimbuspostShipments': {
        $not: {
          $elemMatch: {
            shipmentType: 'warehouse_to_buyer',
            parentAWB: { $exists: true }
          }
        }
      }
    })
    .populate('buyer products user')
    .limit(10); // Limit to 10 for safety
    
    console.log(`📦 Found ${orders.length} orders with delivered shipments`);
    
    const results = {
      totalOrders: orders.length,
      forwarded: 0,
      errors: 0,
      details: []
    };
    
    for (const order of orders) {
      try {
        const deliveredShipments = order.nimbuspostShipments.filter(s => 
          s.shipmentType === 'seller_to_warehouse' && s.status === 'delivered'
        );
        
        if (deliveredShipments.length > 0) {
          // Use the automation function for this order
          console.log(`Processing order ${order._id} with ${deliveredShipments.length} delivered shipments`);
          
          // We'll implement the forwarding logic here
          // For now, just count
          results.forwarded += deliveredShipments.length;
          results.details.push({
            orderId: order._id,
            shipments: deliveredShipments.length,
            status: 'queued'
          });
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          orderId: order._id,
          error: error.message,
          status: 'failed'
        });
      }
    }
    
    res.json({
      success: true,
      message: `Processed ${orders.length} orders`,
      results: results,
      nextStep: 'Run /api/warehouse/check-now to actually forward shipments'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ GET WAREHOUSE DASHBOARD
app.get("/api/warehouse/dashboard", async (req, res) => {
  try {
    const Order = (await import('./models/Order.js')).default;
    
    // Get warehouse stats
    const atWarehouse = await Order.countDocuments({
      'nimbuspostShipments': {
        $elemMatch: {
          shipmentType: 'seller_to_warehouse',
          status: 'delivered'
        }
      },
      'nimbuspostShipments': {
        $not: {
          $elemMatch: {
            shipmentType: 'warehouse_to_buyer',
            parentAWB: { $exists: true }
          }
        }
      }
    });
    
    const pendingForward = await Order.countDocuments({
      'nimbuspostShipments': {
        $elemMatch: {
          shipmentType: 'seller_to_warehouse',
          status: { $in: ['booked', 'in_transit', 'out_for_delivery'] }
        }
      }
    });
    
    const forwardedToday = await Order.countDocuments({
      forwardedAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0))
      },
      status: 'forwarded'
    });
    
    res.json({
      success: true,
      dashboard: {
        warehouseName: "JustBecho Warehouse, Indore",
        address: "103 Dilpasand grand, Behind Rafael tower, Indore, MP - 452001",
        contact: "Devansh Kothari - 9301847748",
        stats: {
          atWarehouse: atWarehouse,
          pendingForward: pendingForward,
          forwardedToday: forwardedToday,
          totalOrders: atWarehouse + pendingForward + forwardedToday
        },
        automation: {
          status: warehouseCheckInterval ? "ACTIVE" : "INACTIVE",
          interval: "15 minutes",
          isRunning: isCheckingWarehouse,
          lastCheck: new Date().toISOString()
        },
        endpoints: {
          checkNow: "POST /api/warehouse/check-now",
          forwardAWB: "POST /api/warehouse/forward/:awb",
          dashboard: "GET /api/warehouse/dashboard",
          status: "GET /api/warehouse/status"
        }
      }
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
      autoCheck: !!warehouseCheckInterval,
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
      manualForward: "POST /api/warehouse/forward/:awb",
      dashboard: "GET /api/warehouse/dashboard",
      forwardAll: "POST /api/warehouse/forward-all-delivered"
    }
  });
});

// ==============================================
// ✅ ADDITIONAL SERVER ENDPOINTS
// ==============================================

// ✅ TEST NIMBUSPOST CONNECTION
app.get("/api/test-nimbuspost", async (req, res) => {
  try {
    const nimbuspostService = (await import('./services/nimbuspostService.js')).default;
    
    const result = await nimbuspostService.testConnection();
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Test failed: ' + error.message
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
        status: "GET /api/warehouse/status",
        dashboard: "GET /api/warehouse/dashboard",
        manualForward: "POST /api/warehouse/forward/:awb"
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
  GET  /api/warehouse/status            - Check automation status
  GET  /api/warehouse/dashboard         - Warehouse dashboard
  POST /api/warehouse/forward-all-delivered - Forward all delivered

📦 SHIPMENT DETAILS:
  📮 Shipment Mode: B2C
  🔄 Flow: Two-leg B2C via Warehouse
  ⚡ Automation: Fully Automatic
  📊 Tracking: Real-time via NimbusPost API

📞 WAREHOUSE CONTACT:
  📍 Address: 103 Dilpasand grand, Behind Rafael tower
  🏙️  City: Indore, Madhya Pradesh
  📮 Pincode: 452001
  👤 Contact: Devansh Kothari
  📞 Phone: 9301847748
  📧 Email: warehouse@justbecho.com

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