// routes/razorpayVerify.js - UPDATED & FIXED
import express from 'express';
import crypto from 'crypto';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import nimbuspostService from '../services/nimbuspostService.js';

const router = express.Router();

// ✅ VERIFY PAYMENT WITH NIMBUSPOST SHIPMENT CREATION
router.post('/verify-payment', async (req, res) => {
  try {
    console.log('🔐 [RAZORPAY] Payment verification started...');
    
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // ✅ 1. SIGNATURE VERIFICATION
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

    // ✅ 2. FIND ORDER
    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id })
      .populate('cart')
      .populate('user', 'name email phone address');
    
    if (!order) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    console.log('✅ Payment verified for order:', order._id);
    
    // ✅ 3. GET CART ITEMS
    const cart = await Cart.findById(order.cart).populate('items.product');
    if (!cart) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cart not found' 
      });
    }

    // ✅ 4. UPDATE PRODUCTS TO "SOLD"
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
          shippingStatus: 'pending_pickup'
        });
        
        productUpdates.push(productId);
        
        // Group products by seller
        if (sellerId) {
          if (!sellerMap.has(sellerId.toString())) {
            const seller = await User.findById(sellerId);
            sellerMap.set(sellerId.toString(), {
              sellerData: seller,
              products: []
            });
          }
          sellerMap.get(sellerId.toString()).products.push({
            productId: productId,
            productData: item.product,
            quantity: item.quantity,
            price: item.price
          });
        }
      }
    }
    
    console.log(`📦 Updated ${productUpdates.length} products to SOLD`);
    console.log(`👨‍💼 Found ${sellerMap.size} sellers`);
    
    // ✅ 5. CREATE NIMBUSPOST SHIPMENTS
    const nimbusShipments = [];
    
    for (const [sellerId, sellerInfo] of sellerMap) {
      const seller = sellerInfo.sellerData;
      
      for (const product of sellerInfo.products) {
        try {
          const buyer = await User.findById(order.user);
          
          // Prepare shipment data
          const shipmentData = {
            orderData: {
              orderId: `${order._id}-${product.productId}`,
              totalAmount: product.price * product.quantity
            },
            productData: {
              productName: product.productData.productName,
              price: product.productData.finalPrice,
              weight: 500,
              dimensions: { length: 20, breadth: 15, height: 10 }
            },
            sellerData: {
              name: seller.name,
              phone: seller.phone || '9876543210',
              address: seller.address || {
                street: 'Address not provided',
                city: 'Gurugram',
                state: 'Haryana',
                pincode: '110001'
              }
            },
            buyerData: {
              name: buyer.name,
              phone: buyer.phone || '9876543210',
              email: buyer.email,
              address: buyer.address || order.shippingAddress || {
                street: 'Address not provided',
                city: buyer.address?.city || 'Gurugram',
                state: buyer.address?.state || 'Haryana',
                pincode: buyer.address?.pincode || '110001'
              }
            }
          };
          
          // Create NimbusPost shipment
          console.log(`🚚 Creating shipment for product: ${product.productId}`);
          const shipmentResult = await nimbuspostService.createB2BShipment(
            shipmentData.orderData,
            shipmentData.productData,
            shipmentData.sellerData,
            shipmentData.buyerData
          );
          
          nimbusShipments.push({
            productId: product.productId,
            awbNumber: shipmentResult.awbNumber,
            shipmentId: shipmentResult.shipmentId,
            labelUrl: shipmentResult.labelUrl,
            trackingUrl: shipmentResult.trackingUrl,
            courierName: shipmentResult.courierName,
            status: 'booked',
            createdAt: new Date()
          });
          
          console.log(`✅ Shipment created: ${shipmentResult.awbNumber}`);
          
        } catch (shipmentError) {
          console.error(`❌ Shipment failed for product ${product.productId}:`, shipmentError.message);
          nimbusShipments.push({
            productId: product.productId,
            error: shipmentError.message
          });
        }
      }
    }
    
    // ✅ 6. UPDATE ORDER WITH SHIPMENT DETAILS
    order.status = 'paid';
    order.razorpayPaymentId = razorpay_payment_id;
    order.paidAt = new Date();
    order.buyer = order.user;
    order.products = productUpdates;
    
    // Add seller if only one seller
    if (sellerMap.size === 1) {
      order.seller = Array.from(sellerMap.keys())[0];
    }
    
    // Save NimbusPost shipments
    order.nimbuspostShipments = nimbusShipments;
    
    // Initialize shipping legs for two-leg shipping
    order.shippingLegs = [{
      leg: 'seller_to_warehouse',
      awbNumbers: nimbusShipments.map(s => s.awbNumber).filter(Boolean),
      status: 'pending_pickup',
      createdAt: new Date(),
      notes: 'Awaiting pickup from seller'
    }];
    
    await order.save();
    
    // ✅ 7. UPDATE SELLER STATS
    for (const [sellerId, sellerInfo] of sellerMap) {
      await User.findByIdAndUpdate(sellerId, {
        $addToSet: { 
          soldProducts: { $each: sellerInfo.products.map(p => p.productId) } 
        },
        $inc: { 
          totalSales: sellerInfo.products.length,
          totalRevenue: sellerInfo.products.reduce((sum, p) => sum + (p.price * p.quantity), 0)
        }
      });
    }
    
    // ✅ 8. UPDATE BUYER STATS
    await User.findByIdAndUpdate(order.user, {
      $addToSet: { orders: order._id },
      $inc: { totalOrders: 1 }
    });
    
    // ✅ 9. CLEAR CART
    await Cart.findOneAndUpdate(
      { user: order.user },
      { 
        items: [], 
        subtotal: 0, 
        bechoProtectTotal: 0,
        totalItems: 0 
      }
    );
    
    // ✅ 10. SEND RESPONSE
    res.json({
      success: true,
      message: 'Payment verified and shipment created!',
      orderId: order._id,
      paymentId: razorpay_payment_id,
      nimbusShipments: nimbusShipments.filter(s => s.awbNumber),
      trackingInfo: 'Shipments booked. Sellers will be contacted for pickup.',
      updates: {
        productsSold: productUpdates.length,
        sellersUpdated: sellerMap.size,
        shipmentsCreated: nimbusShipments.filter(s => s.awbNumber).length
      }
    });
    
  } catch (error) {
    console.error('❌ Verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

// ✅ CHECK ORDER STATUS WITH SHIPPING INFO
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
        if (shipment.awbNumber) {
          try {
            const trackingPromise = nimbuspostService.trackShipment(shipment.awbNumber)
              .then(trackingData => ({
                productId: shipment.productId,
                awbNumber: shipment.awbNumber,
                tracking: trackingData
              }))
              .catch(error => ({
                productId: shipment.productId,
                awbNumber: shipment.awbNumber,
                error: error.message
              }));
            trackingPromises.push(trackingPromise);
          } catch (error) {
            // Continue with other shipments
          }
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
        shippingStatus: order.shippingLegs?.[0]?.status || 'pending',
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

// ✅ UPDATE SHIPPING STATUS (for admin/seller dashboard)
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
          status: status || 'picked_up',
          awbNumbers: order.nimbuspostShipments?.map(s => s.awbNumber).filter(Boolean),
          startedAt: new Date(),
          notes: notes || 'Pickup completed'
        });
      } else {
        order.shippingLegs[legIndex].status = status || 'picked_up';
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
        status: status || 'in_transit',
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
        order.shippingLegs[warehouseLegIndex].status = 'delivered';
        order.shippingLegs[warehouseLegIndex].completedAt = new Date();
        order.shippingLegs[warehouseLegIndex].notes = notes || 'Delivered to buyer';
      } else {
        order.shippingLegs.push({
          leg: 'warehouse_to_buyer',
          status: 'delivered',
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
    
    await order.save();
    
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

export default router;