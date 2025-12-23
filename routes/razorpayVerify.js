// routes/razorpayVerify.js - UPDATED WITH WAREHOUSE AUTOMATION
import express from 'express';
import crypto from 'crypto';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import nimbuspostService from '../services/nimbuspostService.js';

const router = express.Router();

// ✅ VERIFY PAYMENT WITH AUTOMATIC TWO-LEG SHIPMENTS
router.post('/verify-payment', async (req, res) => {
  console.log('🔐 [RAZORPAY] Payment verification with warehouse automation...');
  
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // ✅ 1. VALIDATE INPUT
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification data'
      });
    }

    // ✅ 2. SIGNATURE VERIFICATION
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_LIVE_SECRET_KEY)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    console.log('✅ Payment signature verified');

    // ✅ 3. FIND ORDER
    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id })
      .populate('user', 'name email phone address');
    
    if (!order) {
      console.error('❌ Order not found for Razorpay ID:', razorpay_order_id);
      return res.status(400).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    console.log('✅ Order found:', order._id);

    // ✅ 4. CHECK IF ORDER ALREADY PAID
    if (order.status === 'paid' || order.razorpayPaymentId) {
      console.log('⚠️  Order already marked as paid');
      return res.json({
        success: true,
        message: 'Payment already verified for this order',
        orderId: order._id,
        paymentId: razorpay_payment_id
      });
    }

    // ✅ 5. GET CART ITEMS
    const cart = await Cart.findById(order.cart)
      .populate({
        path: 'items.product',
        select: 'productName finalPrice brand condition images seller weight'
      });
    
    if (!cart) {
      console.error('❌ Cart not found:', order.cart);
      return res.status(400).json({ 
        success: false, 
        message: 'Cart not found' 
      });
    }

    console.log('🛒 Cart items:', cart.items?.length || 0);

    // ✅ 6. UPDATE PRODUCTS TO "SOLD"
    const productUpdates = [];
    const sellerMap = new Map();
    
    for (const item of cart.items) {
      if (item.product && item.product._id) {
        const productId = item.product._id;
        const sellerId = item.product.seller;
        
        // Update product status
        await Product.findByIdAndUpdate(productId, {
          status: 'sold',
          soldAt: new Date(),
          soldTo: order.user,
          order: order._id,
          shippingStatus: 'pending'
        });
        
        productUpdates.push(productId);
        
        // Group products by seller
        if (sellerId) {
          const sellerIdStr = sellerId.toString();
          if (!sellerMap.has(sellerIdStr)) {
            const seller = await User.findById(sellerId);
            sellerMap.set(sellerIdStr, {
              sellerData: seller,
              products: []
            });
          }
          sellerMap.get(sellerIdStr).products.push({
            productId: productId,
            productData: item.product,
            quantity: item.quantity || 1,
            price: item.price || item.product.finalPrice || 0
          });
        }
      }
    }
    
    console.log(`📦 Updated ${productUpdates.length} products to SOLD`);
    console.log(`👨‍💼 Found ${sellerMap.size} sellers`);

    // ✅ 7. UPDATE ORDER WITH PAYMENT INFO
    order.status = 'paid';
    order.razorpayPaymentId = razorpay_payment_id;
    order.paidAt = new Date();
    order.buyer = order.user;
    order.products = productUpdates;
    
    // Add seller if only one seller
    const sellerIds = Array.from(sellerMap.keys());
    if (sellerIds.length === 1) {
      order.seller = sellerIds[0];
    }

    // ✅ 8. CREATE AUTOMATIC TWO-LEG SHIPMENTS
    const nimbusShipments = [];
    let incomingAWBs = [];
    
    if (sellerMap.size > 0) {
      for (const [sellerId, sellerInfo] of sellerMap) {
        const seller = sellerInfo.sellerData;
        
        for (const product of sellerInfo.products) {
          try {
            const buyer = await User.findById(order.user);
            
            if (!buyer) {
              console.error(`❌ Buyer not found: ${order.user}`);
              continue;
            }
            
            // Prepare data for two-leg shipment
            const shipmentData = {
              orderData: {
                orderId: `${order._id}-${product.productId}`,
                totalAmount: product.price * product.quantity
              },
              productData: {
                productName: product.productData.productName || 'Product',
                price: product.price || 0,
                weight: product.productData.weight || 500,
                dimensions: { length: 20, breadth: 15, height: 10 }
              },
              sellerData: {
                name: seller?.name || 'Seller',
                phone: seller?.phone || '9876543210',
                address: seller?.address || {
                  street: 'Address not provided',
                  city: 'Ghaziabad',
                  state: 'Uttar Pradesh',
                  pincode: '201017'
                }
              },
              buyerData: {
                name: buyer?.name || 'Customer',
                phone: buyer?.phone || order.shippingAddress?.phone || '9876543210',
                email: buyer?.email || '',
                address: buyer?.address || order.shippingAddress || {
                  street: 'Address not provided',
                  city: 'City',
                  state: 'State',
                  pincode: '110001'
                }
              }
            };
            
            console.log(`🔄 Creating INCOMING shipment for product: ${product.productId}`);
            
            // ✅ CREATE ONLY INCOMING SHIPMENT (Seller → Warehouse)
            const incomingResult = await nimbuspostService.createB2BShipment(
              shipmentData.orderData,
              shipmentData.productData,
              shipmentData.sellerData,
              shipmentData.buyerData,
              'seller_to_warehouse'  // 🆕 Only incoming for now
            );
            
            if (incomingResult.success) {
              incomingAWBs.push(incomingResult.awbNumber);
              
              nimbusShipments.push({
                productId: product.productId,
                awbNumber: incomingResult.awbNumber,
                shipmentId: incomingResult.shipmentId,
                shipmentType: 'incoming',
                status: 'booked',
                createdAt: new Date(),
                trackingUrl: incomingResult.trackingUrl,
                labelUrl: incomingResult.labelUrl,
                courierName: incomingResult.courierName
              });
              
              console.log(`✅ INCOMING shipment created: ${incomingResult.awbNumber}`);
              
              // Save tracking job for automatic forwarding
              if (!order.metadata) order.metadata = {};
              if (!order.metadata.trackingJobs) order.metadata.trackingJobs = [];
              
              order.metadata.trackingJobs.push({
                incomingAWB: incomingResult.awbNumber,
                productId: product.productId,
                buyerData: shipmentData.buyerData,
                productData: shipmentData.productData,
                scheduledAt: new Date(),
                status: 'monitoring'
              });
              
            }
            
          } catch (shipmentError) {
            const errorMsg = shipmentError.message || 'Unknown error';
            console.error(`❌ Shipment failed for product ${product.productId}:`, errorMsg);
            
            nimbusShipments.push({
              productId: product.productId,
              error: errorMsg,
              status: 'failed',
              createdAt: new Date()
            });
          }
        }
      }
    }
    
    console.log(`📊 Shipment results: ${incomingAWBs.length} incoming shipments created`);

    // ✅ 9. SAVE NIMBUSPOST SHIPMENTS TO ORDER
    order.nimbuspostShipments = nimbusShipments;
    
    // ✅ 10. INITIALIZE SHIPPING LEGS
    if (incomingAWBs.length > 0) {
      order.shippingLegs = [{
        leg: 'seller_to_warehouse',
        awbNumbers: incomingAWBs,
        status: 'pending',
        createdAt: new Date(),
        notes: 'Auto-created: Seller → Warehouse'
      }];
      
      console.log(`📦 Shipping leg created for ${incomingAWBs.length} shipments`);
    }
    
    // ✅ 11. SAVE ORDER
    await order.save({ validateBeforeSave: false });
    console.log('✅ Order saved with warehouse automation');

    // ✅ 12. UPDATE SELLER STATS
    for (const [sellerId, sellerInfo] of sellerMap) {
      const productsSold = sellerInfo.products.length;
      const totalRevenue = sellerInfo.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
      
      await User.findByIdAndUpdate(sellerId, {
        $addToSet: { 
          soldProducts: { $each: sellerInfo.products.map(p => p.productId) } 
        },
        $inc: { 
          totalSales: productsSold,
          totalRevenue: totalRevenue
        }
      });
    }
    
    // ✅ 13. UPDATE BUYER STATS
    await User.findByIdAndUpdate(order.user, {
      $addToSet: { orders: order._id },
      $inc: { totalOrders: 1 }
    });

    // ✅ 14. CLEAR CART
    await Cart.findOneAndUpdate(
      { user: order.user },
      { 
        items: [], 
        subtotal: 0, 
        bechoProtectTotal: 0,
        totalItems: 0 
      }
    );

    // ✅ 15. PREPARE RESPONSE
    const responseData = {
      success: true,
      message: '🎉 Payment verified & warehouse automation started!',
      orderId: order._id.toString(),
      paymentId: razorpay_payment_id,
      automation: {
        flow: 'Seller → Warehouse → Buyer',
        step1: 'COMPLETE: Incoming shipment created',
        step2: 'PENDING: Will auto-forward when delivered to warehouse',
        incomingShipments: incomingAWBs.length,
        warehouse: {
          name: 'JustBecho Warehouse',
          address: '103 Dilpasand grand, Behind Rafael tower, Indore, MP - 452001',
          contact: 'Devansh Kothari - 9301847748'
        }
      },
      orderDetails: {
        totalAmount: order.totalAmount,
        status: order.status,
        itemsCount: productUpdates.length,
        paidAt: order.paidAt
      },
      shipments: incomingAWBs.map(awb => ({
        awbNumber: awb,
        type: 'incoming',
        trackingUrl: `https://track.nimbuspost.com/track/${awb}`,
        status: 'Seller → Warehouse (in transit)'
      })),
      instructions: [
        '✅ Step 1: Seller pickup scheduled',
        '⏳ Step 2: When delivered to warehouse, outgoing shipment will auto-create',
        '📦 Step 3: Package forwarded to buyer',
        '🎉 Step 4: Delivery completed'
      ]
    };
    
    // Add warnings if any
    const failedShipments = nimbusShipments.filter(s => s.error);
    if (failedShipments.length > 0) {
      responseData.warnings = failedShipments.map(s => ({
        productId: s.productId,
        error: s.error
      }));
    }
    
    console.log('✅ Payment verification COMPLETE with warehouse automation');
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Verification error:', error.message);
    console.error('Error details:', error);
    
    res.status(500).json({
      success: false,
      message: 'Payment verification failed: ' + error.message,
      errorType: error.name,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: error.stack 
      })
    });
  }
});

// ✅ CREATE NEW: WEBHOOK FOR WAREHOUSE AUTOMATION
router.post('/warehouse-webhook', async (req, res) => {
  try {
    const { event_type, awb_number, current_status } = req.body;
    
    console.log('🔔 Warehouse webhook received:', { event_type, awb_number, current_status });
    
    if (event_type === 'SHIPMENT_DELIVERED' && current_status === 'Delivered') {
      // Find order with this incoming AWB
      const order = await Order.findOne({
        'nimbuspostShipments.awbNumber': awb_number,
        'nimbuspostShipments.shipmentType': 'incoming'
      })
      .populate('buyer')
      .populate('products');
      
      if (!order) {
        console.error(`❌ Order not found for AWB: ${awb_number}`);
        return res.json({ success: false, message: 'Order not found' });
      }
      
      // Find the shipment
      const incomingShipment = order.nimbuspostShipments.find(s => 
        s.awbNumber === awb_number && s.shipmentType === 'incoming'
      );
      
      if (!incomingShipment) {
        console.error(`❌ Incoming shipment not found: ${awb_number}`);
        return res.json({ success: false, message: 'Shipment not found' });
      }
      
      // Check if outgoing already exists
      const existingOutgoing = order.nimbuspostShipments.find(s => 
        s.parentAWB === awb_number && s.shipmentType === 'outgoing'
      );
      
      if (existingOutgoing) {
        console.log(`⚠️  Outgoing already exists: ${existingOutgoing.awbNumber}`);
        return res.json({ success: true, message: 'Already forwarded' });
      }
      
      // Get buyer data
      const buyer = order.buyer || await User.findById(order.user);
      const product = order.products.find(p => 
        p._id.toString() === incomingShipment.productId.toString()
      );
      
      if (!product || !buyer) {
        console.error('❌ Product or buyer not found');
        return res.json({ success: false, message: 'Data incomplete' });
      }
      
      // Create outgoing shipment (Warehouse → Buyer)
      console.log(`🚀 Auto-creating OUTGOING shipment for AWB: ${awb_number}`);
      
      const outgoingResult = await nimbuspostService.createB2BShipment(
        {
          orderId: `${order._id}-${incomingShipment.productId}-OUT`,
          totalAmount: order.totalAmount || 0
        },
        {
          productName: product.productName,
          price: product.finalPrice || 0,
          weight: product.weight || 500
        },
        nimbuspostService.WAREHOUSE_DETAILS, // Pickup from warehouse
        {
          name: buyer.name || 'Customer',
          phone: buyer.phone || '',
          address: order.shippingAddress || buyer.address
        },
        'warehouse_to_buyer'
      );
      
      if (outgoingResult.success) {
        // Update order
        order.nimbuspostShipments.push({
          productId: incomingShipment.productId,
          awbNumber: outgoingResult.awbNumber,
          shipmentId: outgoingResult.shipmentId,
          shipmentType: 'outgoing',
          parentAWB: awb_number,
          status: 'booked',
          createdAt: new Date(),
          trackingUrl: outgoingResult.trackingUrl,
          labelUrl: outgoingResult.labelUrl,
          courierName: outgoingResult.courierName
        });
        
        // Update shipping leg
        const warehouseLeg = order.shippingLegs.find(l => l.leg === 'seller_to_warehouse');
        if (warehouseLeg) {
          warehouseLeg.status = 'completed';
          warehouseLeg.completedAt = new Date();
          warehouseLeg.notes = 'Delivered to warehouse, auto-forwarded to buyer';
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
        
        console.log(`✅ OUTGOING shipment created: ${outgoingResult.awbNumber}`);
        
        // Send notification
        console.log(`📧 Notification: Package ${awb_number} forwarded to buyer as ${outgoingResult.awbNumber}`);
        
        return res.json({
          success: true,
          message: 'Outgoing shipment auto-created',
          incomingAWB: awb_number,
          outgoingAWB: outgoingResult.awbNumber,
          trackingUrl: outgoingResult.trackingUrl
        });
      }
    }
    
    res.json({ success: true, message: 'Webhook processed' });
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ MANUAL TRIGGER FOR OUTGOING SHIPMENT
router.post('/trigger-outgoing/:awb', async (req, res) => {
  try {
    const { awb } = req.params;
    
    console.log(`🚀 Manually triggering outgoing for AWB: ${awb}`);
    
    // Call the webhook handler directly
    const result = await handleOutgoingCreation(awb);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Helper function for outgoing creation
async function handleOutgoingCreation(awb) {
  // Same logic as webhook handler
  const order = await Order.findOne({
    'nimbuspostShipments.awbNumber': awb,
    'nimbuspostShipments.shipmentType': 'incoming'
  })
  .populate('buyer')
  .populate('products');
  
  if (!order) {
    return { success: false, message: 'Order not found' };
  }
  
  const incomingShipment = order.nimbuspostShipments.find(s => 
    s.awbNumber === awb && s.shipmentType === 'incoming'
  );
  
  if (!incomingShipment) {
    return { success: false, message: 'Incoming shipment not found' };
  }
  
  const buyer = order.buyer || await User.findById(order.user);
  const product = order.products.find(p => 
    p._id.toString() === incomingShipment.productId.toString()
  );
  
  if (!product || !buyer) {
    return { success: false, message: 'Data incomplete' };
  }
  
  const outgoingResult = await nimbuspostService.createB2BShipment(
    {
      orderId: `${order._id}-${incomingShipment.productId}-OUT`,
      totalAmount: order.totalAmount || 0
    },
    {
      productName: product.productName,
      price: product.finalPrice || 0,
      weight: product.weight || 500
    },
    nimbuspostService.WAREHOUSE_DETAILS,
    {
      name: buyer.name || 'Customer',
      phone: buyer.phone || '',
      address: order.shippingAddress || buyer.address
    },
    'warehouse_to_buyer'
  );
  
  if (outgoingResult.success) {
    order.nimbuspostShipments.push({
      productId: incomingShipment.productId,
      awbNumber: outgoingResult.awbNumber,
      shipmentId: outgoingResult.shipmentId,
      shipmentType: 'outgoing',
      parentAWB: awb,
      status: 'booked',
      createdAt: new Date(),
      trackingUrl: outgoingResult.trackingUrl,
      labelUrl: outgoingResult.labelUrl,
      courierName: outgoingResult.courierName
    });
    
    const warehouseLeg = order.shippingLegs.find(l => l.leg === 'seller_to_warehouse');
    if (warehouseLeg) {
      warehouseLeg.status = 'completed';
      warehouseLeg.completedAt = new Date();
    }
    
    order.shippingLegs.push({
      leg: 'warehouse_to_buyer',
      awbNumbers: [outgoingResult.awbNumber],
      status: 'pending',
      createdAt: new Date(),
      notes: 'Manually triggered: Warehouse → Buyer'
    });
    
    order.status = 'processing';
    
    await order.save();
    
    return {
      success: true,
      message: 'Outgoing shipment created',
      incomingAWB: awb,
      outgoingAWB: outgoingResult.awbNumber,
      trackingUrl: outgoingResult.trackingUrl
    };
  }
  
  return { success: false, message: 'Failed to create outgoing shipment' };
}

// ✅ GET ORDER STATUS WITH WAREHOUSE INFO
router.get('/order-status/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('buyer', 'name email phone')
      .populate('seller', 'name email phone username')
      .populate('products', 'productName brand images finalPrice');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Get tracking info
    const trackingPromises = [];
    if (order.nimbuspostShipments) {
      for (const shipment of order.nimbuspostShipments) {
        if (shipment.awbNumber && !shipment.error) {
          trackingPromises.push(
            nimbuspostService.trackShipment(shipment.awbNumber)
              .then(trackingData => ({
                awbNumber: shipment.awbNumber,
                shipmentType: shipment.shipmentType,
                tracking: trackingData
              }))
              .catch(error => ({
                awbNumber: shipment.awbNumber,
                error: error.message
              }))
          );
        }
      }
    }
    
    const trackingResults = await Promise.allSettled(trackingPromises);
    
    res.json({
      success: true,
      order: {
        id: order._id,
        buyer: order.buyer,
        seller: order.seller,
        totalAmount: order.totalAmount,
        status: order.status,
        paidAt: order.paidAt,
        products: order.products,
        
        // Warehouse Automation Info
        warehouseFlow: {
          hasIncoming: order.nimbuspostShipments?.some(s => s.shipmentType === 'incoming'),
          hasOutgoing: order.nimbuspostShipments?.some(s => s.shipmentType === 'outgoing'),
          warehouse: {
            name: 'JustBecho Warehouse',
            address: 'Indore, MP - 452001',
            contact: 'Devansh Kothari - 9301847748'
          }
        },
        
        // Shipping Information
        shippingLegs: order.shippingLegs || [],
        nimbuspostShipments: order.nimbuspostShipments || [],
        
        // Live Tracking
        liveTracking: trackingResults
          .filter(result => result.status === 'fulfilled')
          .map(result => result.value)
      }
    });
  } catch (error) {
    console.error('Order status error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ GET WAREHOUSE DASHBOARD
router.get('/warehouse-dashboard', async (req, res) => {
  try {
    // Orders at warehouse (incoming delivered, outgoing not created)
    const atWarehouse = await Order.find({
      'nimbuspostShipments.shipmentType': 'incoming',
      'shippingLegs': {
        $elemMatch: {
          leg: 'seller_to_warehouse',
          status: 'completed'
        }
      },
      'nimbuspostShipments': {
        $not: {
          $elemMatch: {
            shipmentType: 'outgoing'
          }
        }
      }
    })
    .populate('buyer', 'name')
    .populate('products', 'productName')
    .sort({ updatedAt: -1 });
    
    // Recently forwarded
    const forwarded = await Order.find({
      'nimbuspostShipments.shipmentType': 'outgoing'
    })
    .populate('buyer', 'name')
    .sort({ updatedAt: -1 })
    .limit(10);
    
    res.json({
      success: true,
      warehouse: {
        name: "JustBecho Warehouse",
        address: "103 Dilpasand grand, Behind Rafael tower, Indore, MP - 452001",
        contact: "Devansh Kothari - 9301847748",
        manager: "Devansh Kothari"
      },
      stats: {
        atWarehouse: atWarehouse.length,
        pendingForward: atWarehouse.length,
        forwardedToday: forwarded.length,
        totalOrders: atWarehouse.length + forwarded.length
      },
      atWarehouse: atWarehouse.map(order => ({
        orderId: order._id,
        buyer: order.buyer?.name,
        products: order.products?.map(p => p.productName),
        incomingAWB: order.nimbuspostShipments
          .filter(s => s.shipmentType === 'incoming')
          .map(s => s.awbNumber),
        arrivedAt: order.shippingLegs
          .find(l => l.leg === 'seller_to_warehouse')?.completedAt,
        actionRequired: true
      })),
      recentlyForwarded: forwarded.map(order => ({
        orderId: order._id,
        buyer: order.buyer?.name,
        outgoingAWB: order.nimbuspostShipments
          .filter(s => s.shipmentType === 'outgoing')
          .map(s => s.awbNumber),
        forwardedAt: order.shippingLegs
          .find(l => l.leg === 'warehouse_to_buyer')?.startedAt
      }))
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;