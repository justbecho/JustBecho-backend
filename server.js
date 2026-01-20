// server.js - NETWORK OPTIMIZED FOR MOBILE UPLOADS
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp'; // ✅ ADDED FOR HEIF/HEIC SUPPORT

// ✅ Load environment variables
dotenv.config();

console.log(`
╔══════════════════════════════════════════════════════════════╗
║           🚀 JUST BECHO SERVER - B2C WAREHOUSE FLOW         ║
║          📦 B2C: SELLER → WAREHOUSE → BUYER                ║
║           ⚡ AUTO-FORWARD WHEN DELIVERED TO WAREHOUSE       ║
║           📸 HEIF/HEIC SUPPORT ENABLED                     ║
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
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 20,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000
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

// ✅ IMPORT ADMIN ROUTES
import adminAuthRoutes from "./routes/adminAuthRoutes.js";
import adminDashboardRoutes from "./routes/adminDashboardRoutes.js";

const app = express();

// ✅ NETWORK OPTIMIZATION FOR MOBILE UPLOADS
app.use((req, res, next) => {
  req.startTime = Date.now();
  
  // Check if it's a mobile upload request
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isUploadRequest = req.method === 'POST' && req.url.includes('/api/products');
  
  // Set longer timeout for mobile uploads
  if (isMobile && isUploadRequest) {
    req.setTimeout(300000); // 5 minutes for mobile uploads
    res.setTimeout(300000);
    console.log(`📱 Mobile upload detected, setting 5min timeout`);
  } else if (isUploadRequest) {
    req.setTimeout(180000); // 3 minutes for desktop uploads
    res.setTimeout(180000);
  } else {
    req.setTimeout(60000); // 1 minute for other requests
    res.setTimeout(60000);
  }
  
  next();
});

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
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-Auth-Token', 'Content-Length', 'X-Requested-With'],
  exposedHeaders: ['Content-Length'],
  maxAge: 86400
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
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, X-Auth-Token, Content-Length, X-Requested-With');
  res.header('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// ✅ Body parsing with increased limits
app.use(express.json({ 
  limit: '50mb'
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb',
  parameterLimit: 10000
}));

// ✅ Request logging
app.use((req, res, next) => {
  const contentLength = req.headers['content-length'];
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  const sizeInfo = contentLength ? ` - ${(contentLength/(1024*1024)).toFixed(2)}MB` : '';
  const deviceEmoji = isMobile ? '📱' : '💻';
  
  console.log(`📍 ${deviceEmoji} ${new Date().toISOString()} - ${req.method} ${req.url}${sizeInfo}`);
  
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    const statusEmoji = res.statusCode >= 400 ? '❌' : '✅';
    console.log(`${statusEmoji} ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ HEIF/HEIC IMAGE PROCESSING MIDDLEWARE
app.use('/api/products', async (req, res, next) => {
  if (req.method === 'POST' && req.files && req.files.length > 0) {
    console.log('🔄 Processing images for HEIF/HEIC conversion...');
    
    try {
      const processedFiles = [];
      
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const originalName = file.originalname.toLowerCase();
        
        // Check if file is HEIF/HEIC
        const isHEIF = originalName.endsWith('.heif') || 
                      originalName.endsWith('.heic') ||
                      file.mimetype === 'image/heif' || 
                      file.mimetype === 'image/heic';
        
        if (isHEIF) {
          console.log(`   🖼️  Converting HEIF/HEIC: ${file.originalname} (${(file.size/(1024*1024)).toFixed(2)}MB)`);
          
          try {
            // Convert HEIF to JPEG using sharp
            const jpegBuffer = await sharp(file.buffer, {
              failOnError: false
            })
            .jpeg({ 
              quality: 85,
              mozjpeg: true 
            })
            .toBuffer();
            
            // Create new file object with JPEG data
            const processedFile = {
              ...file,
              buffer: jpegBuffer,
              size: jpegBuffer.length,
              originalname: file.originalname.replace(/\.[^/.]+$/, '.jpg'),
              mimetype: 'image/jpeg',
              fieldname: file.fieldname
            };
            
            console.log(`   ✅ Converted to JPEG: ${processedFile.originalname} (${(processedFile.size/(1024*1024)).toFixed(2)}MB)`);
            processedFiles.push(processedFile);
            
          } catch (sharpError) {
            console.log(`   ⚠️  Sharp conversion failed for ${file.originalname}: ${sharpError.message}`);
            // Keep original if conversion fails
            processedFiles.push(file);
          }
        } else {
          // Keep non-HEIF files as is
          processedFiles.push(file);
        }
      }
      
      // Replace files array with processed files
      req.files = processedFiles;
      
    } catch (error) {
      console.log(`⚠️  Image processing middleware error: ${error.message}`);
      // Continue with original files if processing fails
    }
  }
  next();
});

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

// ✅ REGISTER ADMIN ROUTES
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);

// ✅ ADMIN ROUTE FOR justbecho.com/admin
app.get("/admin", (req, res) => {
  res.redirect('https://justbecho.com/admin');
});

// ✅ Admin API health check
app.get("/api/admin/health", (req, res) => {
  res.json({
    success: true,
    message: "Admin API is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

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
    const Product = (await import('./models/Product.js')).default;
    
    // Find orders with delivered incoming shipments to warehouse
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
    uploadLimits: {
      perFile: '10MB',
      maxFiles: 5,
      totalSize: '50MB',
      timeout: '5 minutes for mobile, 3 minutes for desktop',
      supportedFormats: ['JPG', 'PNG', 'WebP', 'HEIF', 'HEIC'],
      autoConversion: 'HEIF/HEIC → JPEG'
    },
    adminPanel: {
      auth: '/api/admin/auth',
      dashboard: '/api/admin/dashboard',
      health: '/api/admin/health',
      frontend: 'https://justbecho.com/admin'
    },
    warehouseAutomation: {
      status: warehouseCheckInterval ? "ACTIVE" : "INACTIVE",
      method: "setInterval",
      interval: "15 minutes",
      isRunning: isCheckingWarehouse,
      lastCheck: new Date().toISOString()
    },
    services: {
      mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      warehouseAutoForward: "enabled",
      mobileUpload: "optimized",
      heifSupport: "enabled",
      adminRoutes: "enabled"
    }
  });
});

// ✅ Mobile test endpoint
app.post("/api/test/mobile-upload", (req, res) => {
  console.log('📱 Mobile upload test endpoint hit');
  
  // Simulate processing time
  setTimeout(() => {
    res.json({
      success: true,
      message: 'Mobile upload test successful',
      timestamp: new Date().toISOString(),
      server: 'JustBecho API',
      mobileOptimized: true,
      uploadLimits: {
        perFile: '10MB',
        maxFiles: 5,
        timeout: '5 minutes'
      },
      heifSupport: true
    });
  }, 1000);
});

// ✅ API Documentation
app.get("/", (req, res) => {
  res.json({ 
    message: "🚀 Just Becho API with B2C Warehouse Automation",
    timestamp: new Date().toISOString(),
    version: "5.0.0",
    uploadLimits: {
      perFile: "10MB",
      maxFiles: 5,
      totalSize: "50MB",
      formats: "JPG, PNG, JPEG, WebP, HEIF, HEIC",
      note: "HEIF/HEIC files automatically converted to JPEG"
    },
    adminPanel: {
      auth: "/api/admin/auth",
      dashboard: "/api/admin/dashboard",
      health: "/api/admin/health",
      frontend: "https://justbecho.com/admin"
    },
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
      adminHealth: "GET /api/admin/health",
      mobileTest: "POST /api/test/mobile-upload",
      warehouse: {
        checkNow: "POST /api/warehouse/check-now",
        forward: "POST /api/warehouse/forward/:awb"
      },
      products: {
        create: "POST /api/products",
        limits: "10MB per file, 5 files max",
        formats: "JPG, PNG, WebP, HEIF, HEIC"
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

// ✅ Global error handler with mobile optimization
app.use((error, req, res, next) => {
  console.error('💥 Global error:', error.message);
  
  let statusCode = error.status || 500;
  let message = error.message || 'Internal server error';
  
  // Check if mobile request
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
    statusCode = 408;
    message = isMobile 
      ? 'Upload timeout. Please use Wi-Fi and keep screen on.' 
      : 'Request timeout. Please try again.';
  } else if (error.type === 'entity.too.large') {
    statusCode = 413;
    message = isMobile
      ? 'File too large for mobile. Maximum 10MB per image. Try compressing images.'
      : 'File too large. Maximum 10MB per image.';
  } else if (error.message.includes('HEIF') || error.message.includes('HEIC')) {
    message = isMobile
      ? 'HEIF/HEIC file issue. Try converting to JPEG before upload.'
      : 'HEIF/HEIC file processing error.';
  }
  
  res.status(statusCode).json({
    success: false,
    message: message,
    timestamp: new Date().toISOString(),
    errorType: error.name,
    isMobile: isMobile,
    suggestion: isMobile ? 'Use Wi-Fi, keep screen on, upload fewer images' : undefined
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
    
    const server = app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                  🚀 JUST BECHO SERVER 5.0.0                  ║
║            🏭 B2C WAREHOUSE AUTOMATION ENABLED              ║
║      🔄 SELLER → WAREHOUSE → BUYER (AUTO-FORWARD)          ║
║      📸 HEIF/HEIC SUPPORT ENABLED                          ║
║      ⚡ iPhone files automatically converted to JPEG       ║
╚══════════════════════════════════════════════════════════════╝

📊 SERVER STATUS:
  ✅ Port: ${PORT}
  ✅ Upload Limits: 10MB/file, 5 files max, 50MB total
  ✅ HEIF/HEIC Support: ✅ ENABLED
  ✅ Auto-conversion: HEIF/HEIC → JPEG
  ✅ Mobile Timeout: 5 minutes
  ✅ Desktop Timeout: 3 minutes
  ✅ Warehouse Automation: ACTIVE
  ✅ Auto-check: Every 15 minutes
  ✅ Auto-forward: ENABLED
  ✅ Admin Routes: ✅ ENABLED
  ✅ Database: Connected
  ✅ B2C Flow: Seller → Warehouse → Buyer

🏢 ADMIN PANEL:
  🔐 /api/admin/auth
  📊 /api/admin/dashboard
  ❤️ /api/admin/health
  🌐 https://justbecho.com/admin

🏭 B2C WAREHOUSE FLOW (AUTOMATIC):
  1️⃣ B2C: Seller → Warehouse ✅
  2️⃣ ✅ WHEN DELIVERED TO WAREHOUSE → Auto-check triggers
  3️⃣ B2C: Warehouse → Buyer ✅
  4️⃣ Buyer receives package via B2C ✅

📸 HEIF/HEIC FEATURES:
  • iPhone HEIF/HEIC files supported
  • Automatic conversion to JPEG
  • No size increase on conversion
  • Maintains image quality

📱 MOBILE UPLOAD OPTIMIZATIONS:
  ⏱️  5-minute timeout for mobile uploads
  📊 Request size monitoring
  🔄 Automatic error recovery in frontend
  💡 Mobile-specific error messages
  🔍 Detailed logging for debugging

🔧 DEBUG ENDPOINTS:
  POST /api/test/mobile-upload    - Test mobile upload
  GET  /api/health               - Check server status
  GET  /api/admin/health         - Admin health check
  POST /api/warehouse/check-now   - Manual warehouse check

⚠️  MOBILE UPLOAD TIPS:
  • Use Wi-Fi for large uploads
  • Maximum 10MB per image
  • Maximum 5 images per product
  • Keep screen ON during upload
  • Don't switch apps during upload
  • HEIF/HEIC files automatically converted

──────────────────────────────────────────────────────────────
✅ Server is running. B2C Warehouse, HEIF & Admin support ACTIVE.
──────────────────────────────────────────────────────────────
      `);
    });
    
    // Server optimization
    server.keepAliveTimeout = 120000; // 2 minutes
    server.headersTimeout = 120000; // 2 minutes
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;