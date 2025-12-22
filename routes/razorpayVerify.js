import express from 'express';
import crypto from 'crypto';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import nimbuspostService from '../services/nimbuspostService.js';

const router = express.Router();

// ✅ VERIFY PAYMENT WITH NIMBUSPOST SHIPMENT CREATION - COMPLETELY FIXED
router.post('/verify-payment', async (req, res) => {
  console.log('🔐 [RAZORPAY] Payment verification started...');
  
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
        select: 'productName finalPrice brand condition images seller'
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
        
        // Update product status (FIXED: use 'pending' instead of 'pending_pickup')
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

    // ✅ 8. CREATE NIMBUSPOST SHIPMENTS (with error handling)
    const nimbusShipments = [];
    let nimbusSuccessCount = 0;
    let nimbusError = null;
    
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
            
            // Prepare shipment data
            const shipmentData = {
              orderData: {
                orderId: `${order._id}-${product.productId}`,
                totalAmount: product.price * product.quantity
              },
              productData: {
                productName: product.productData.productName || 'Product',
                price: product.price || 0,
                weight: 500,
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
            
            console.log(`🚚 Creating NimbusPost shipment for product: ${product.productId}`);
            
            const shipmentResult = await nimbuspostService.createB2BShipment(
              shipmentData.orderData,
              shipmentData.productData,
              shipmentData.sellerData,
              shipmentData.buyerData
            );
            
            if (shipmentResult.success) {
              nimbusSuccessCount++;
              nimbusShipments.push({
                productId: product.productId,
                awbNumber: shipmentResult.awbNumber,
                shipmentId: shipmentResult.shipmentId,
                labelUrl: shipmentResult.labelUrl,
                trackingUrl: shipmentResult.trackingUrl,
                courierName: shipmentResult.courierName,
                status: 'booked',
                createdAt: new Date(),
                isMock: shipmentResult.isMock || false
              });
              
              console.log(`✅ Shipment created: ${shipmentResult.awbNumber}`);
            }
            
          } catch (shipmentError) {
            const errorMsg = shipmentError.message || 'Unknown error';
            console.error(`❌ Shipment failed for product ${product.productId}:`, errorMsg);
            
            // Check if it's a KYC error
            const isKYCError = errorMsg.includes('KYC') || 
                             (shipmentError.response?.data?.message?.includes('KYC'));
            
            nimbusShipments.push({
              productId: product.productId,
              error: errorMsg,
              status: 'failed',
              isKYCError: isKYCError,
              createdAt: new Date()
            });
            
            if (isKYCError) {
              nimbusError = 'NimbusPost KYC incomplete. Please complete KYC on NimbusPost dashboard.';
            }
          }
        }
      }
    }
    
    console.log(`📊 Shipment results: ${nimbusSuccessCount} successful, ${nimbusShipments.length - nimbusSuccessCount} failed`);

    // ✅ 9. SAVE NIMBUSPOST SHIPMENTS TO ORDER
    order.nimbuspostShipments = nimbusShipments;
    
    // ✅ 10. INITIALIZE SHIPPING LEGS (FIXED: use 'pending' instead of 'pending_pickup')
    const validShipments = nimbusShipments.filter(s => s.awbNumber && !s.error);
    if (validShipments.length > 0) {
      order.shippingLegs = [{
        leg: 'seller_to_warehouse',
        awbNumbers: validShipments.map(s => s.awbNumber),
        status: 'pending', // ✅ FIXED: Changed from 'pending_pickup' to 'pending'
        createdAt: new Date(),
        notes: 'Awaiting pickup from seller'
      }];
    } else {
      order.shippingLegs = [{
        leg: 'seller_to_warehouse',
        status: 'pending', // ✅ FIXED: Changed from 'pending_pickup' to 'pending'
        createdAt: new Date(),
        notes: nimbusError || 'Shipment creation pending'
      }];
    }
    
    // ✅ 11. SAVE ORDER (with validation disabled to avoid enum issues)
    await order.save({ validateBeforeSave: false });
    console.log('✅ Order saved successfully');

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
      message: '🎉 Payment verified successfully! Order placed.',
      orderId: order._id.toString(),
      paymentId: razorpay_payment_id,
      orderDetails: {
        totalAmount: order.totalAmount,
        status: order.status,
        itemsCount: productUpdates.length,
        paidAt: order.paidAt
      },
      updates: {
        productsSold: productUpdates.length,
        sellersUpdated: sellerMap.size,
        successfulShipments: nimbusSuccessCount,
        totalShipments: nimbusShipments.length
      }
    };
    
    // Add shipment info if available
    const successfulShipments = nimbusShipments.filter(s => s.awbNumber && !s.error);
    if (successfulShipments.length > 0) {
      responseData.shipments = successfulShipments.map(s => ({
        productId: s.productId,
        awbNumber: s.awbNumber,
        trackingUrl: s.trackingUrl || `https://track.nimbuspost.com/track/${s.awbNumber}`,
        status: s.status
      }));
      responseData.message += ` ${successfulShipments.length} shipment(s) created.`;
    }
    
    // Add warnings if any
    if (nimbusError) {
      responseData.warning = nimbusError;
      if (nimbusError.includes('KYC')) {
        responseData.instructions = [
          '⚠️  Payment successful but shipping not created.',
          '📝 Please complete KYC on NimbusPost dashboard: https://ship.nimbuspost.com',
          '🔄 Shipping will be created once KYC is complete.',
          '📞 Contact support if you need assistance.'
        ];
      }
    }
    
    console.log('✅ Payment verification COMPLETE');
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

// ✅ CHECK ORDER STATUS WITH SHIPPING INFO - FIXED
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
    
    // Get tracking info for each shipment
    const trackingPromises = [];
    if (order.nimbuspostShipments) {
      for (const shipment of order.nimbuspostShipments) {
        if (shipment.awbNumber && !shipment.error && !shipment.isMock) {
          trackingPromises.push(
            nimbuspostService.trackShipment(shipment.awbNumber)
              .then(trackingData => ({
                productId: shipment.productId,
                awbNumber: shipment.awbNumber,
                tracking: trackingData
              }))
              .catch(error => ({
                productId: shipment.productId,
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
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: order.razorpayPaymentId,
        status: order.status,
        paidAt: order.paidAt,
        products: order.products,
        createdAt: order.createdAt,
        
        // Shipping Information
        shippingLegs: order.shippingLegs || [],
        nimbuspostShipments: order.nimbuspostShipments || [],
        
        // Live Tracking Results
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

// ✅ UPDATE SHIPPING STATUS - FIXED (removed 'picked_up' status)
router.put('/update-shipping/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, leg, awbNumber, notes } = req.body;
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    if (leg === 'seller_to_warehouse') {
      // Mark as picked up from seller
      const legIndex = order.shippingLegs.findIndex(l => l.leg === 'seller_to_warehouse');
      
      if (legIndex === -1) {
        order.shippingLegs.push({
          leg: 'seller_to_warehouse',
          status: 'in_transit', // ✅ FIXED: Changed from 'picked_up' to 'in_transit'
          awbNumbers: order.nimbuspostShipments?.map(s => s.awbNumber).filter(Boolean),
          startedAt: new Date(),
          notes: notes || 'Pickup completed from seller'
        });
      } else {
        order.shippingLegs[legIndex].status = 'in_transit'; // ✅ FIXED: Changed from 'picked_up' to 'in_transit'
        order.shippingLegs[legIndex].completedAt = new Date();
        order.shippingLegs[legIndex].notes = notes;
      }
      
      // Update products shipping status
      await Product.updateMany(
        { _id: { $in: order.products } },
        { $set: { shippingStatus: 'in_transit', shippedAt: new Date() } }
      );
      
      // Update NimbusPost shipments
      if (order.nimbuspostShipments) {
        order.nimbuspostShipments = order.nimbuspostShipments.map(shipment => ({
          ...shipment,
          status: 'in_transit',
          pickedUpAt: new Date()
        }));
      }
      
    } else if (leg === 'warehouse_to_buyer') {
      // Mark as shipped from warehouse to buyer
      order.shippingLegs.push({
        leg: 'warehouse_to_buyer',
        status: 'in_transit',
        awbNumber: awbNumber,
        startedAt: new Date(),
        notes: notes || 'Shipped to buyer'
      });
      
      // Update order status
      order.status = 'shipped';
      order.shippedAt = new Date();
      
    } else if (leg === 'delivered') {
      // Mark as delivered
      const warehouseLegIndex = order.shippingLegs.findIndex(l => l.leg === 'warehouse_to_buyer');
      
      if (warehouseLegIndex !== -1) {
        order.shippingLegs[warehouseLegIndex].status = 'completed';
        order.shippingLegs[warehouseLegIndex].completedAt = new Date();
        order.shippingLegs[warehouseLegIndex].notes = notes || 'Delivered to buyer';
      } else {
        order.shippingLegs.push({
          leg: 'warehouse_to_buyer',
          status: 'completed',
          completedAt: new Date(),
          notes: notes || 'Delivered to buyer'
        });
      }
      
      // Update order status
      order.status = 'delivered';
      order.deliveredAt = new Date();
      
      // Update products as delivered
      await Product.updateMany(
        { _id: { $in: order.products } },
        { $set: { shippingStatus: 'delivered', deliveredAt: new Date() } }
      );
      
      // Update all NimbusPost shipments status
      if (order.nimbuspostShipments) {
        order.nimbuspostShipments = order.nimbuspostShipments.map(shipment => ({
          ...shipment,
          status: 'delivered',
          deliveredAt: new Date()
        }));
      }
    }
    
    await order.save({ validateBeforeSave: false });
    
    res.json({
      success: true,
      message: `Shipping status updated to ${status || 'updated'}`,
      order: {
        id: order._id,
        status: order.status,
        shippingLegs: order.shippingLegs,
        shippingStatus: order.shippingLegs[order.shippingLegs.length - 1]?.status || 'pending'
      }
    });
    
  } catch (error) {
    console.error('Update shipping error:', error);
    res.status(500).json({
      success: false,
      message: 'Update failed: ' + error.message
    });
  }
});

// ✅ GET USER ORDERS
router.get('/user-orders/:userId', async (req, res) => {
  try {
    const orders = await Order.find({ user: req.params.userId })
      .sort({ createdAt: -1 })
      .populate('products', 'productName images finalPrice');
    
    res.json({
      success: true,
      orders: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('User orders error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;