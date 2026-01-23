// routes/razorpayVerify.js - UPDATED - CREATE DB ORDER ONLY AFTER PAYMENT
import express from 'express';
import crypto from 'crypto';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import nimbuspostService from '../services/nimbuspostService.js';
import warehouseAutomation from '../services/warehouseAutomation.js';

const router = express.Router();

// ✅ VERIFY PAYMENT & CREATE DATABASE ORDER (ONLY AFTER PAYMENT)
router.post('/verify-payment', async (req, res) => {
  console.log('🔐 [RAZORPAY] Payment verification - Creating DB order NOW...');
  
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      cartId,
      shippingAddress
    } = req.body;

    // Validate input
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification data'
      });
    }

    // Signature verification
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

    // Check if order already exists in DB (prevent duplicate)
    const existingOrder = await Order.findOne({ 
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id 
    });
    
    if (existingOrder) {
      console.log('⚠️ Order already exists in DB:', existingOrder._id);
      return res.json({
        success: true,
        message: 'Order already created',
        orderId: existingOrder._id,
        paymentId: razorpay_payment_id
      });
    }

    // ✅ STEP 1: Get cart data
    let cart;
    if (cartId) {
      cart = await Cart.findById(cartId)
        .populate({
          path: 'items.product',
          select: 'productName finalPrice brand condition images seller weight dimensions sellerAddress status'
        });
      
      if (!cart) {
        console.error('❌ Cart not found:', cartId);
        return res.status(400).json({ 
          success: false, 
          message: 'Cart not found' 
        });
      }
      console.log('🛒 Cart found with items:', cart.items?.length || 0);
    } else {
      console.log('⚠️ Cart ID not provided, creating order without cart');
    }

    // ✅ STEP 2: Get user info
    const user = cart ? await User.findById(cart.user) : null;
    if (!user && cart) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // ✅ STEP 3: NOW CREATE DATABASE ORDER (Only after payment verified)
    console.log('📦 Creating database order after successful payment...');

    // Prepare order data
    const orderData = {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      status: 'paid',
      paidAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add cart data if available
    if (cart && user) {
      orderData.user = cart.user;
      orderData.cart = cartId;
      orderData.totalAmount = cart.subtotal + (cart.bechoProtectTotal || 0);
      orderData.buyer = cart.user;
      
      // Add shipping address
      if (shippingAddress) {
        orderData.shippingAddress = shippingAddress;
      } else if (user.address) {
        orderData.shippingAddress = user.address;
      }

      // Add items from cart
      if (cart.items && cart.items.length > 0) {
        orderData.items = cart.items.map(item => ({
          product: item.product?._id || item.product,
          quantity: item.quantity || 1,
          price: item.price || 0,
          bechoProtect: item.bechoProtect || { selected: false, price: 0 },
          totalPrice: (item.price || 0) * (item.quantity || 1),
          productDetails: item.product ? {
            name: item.product.productName || '',
            brand: item.product.brand || '',
            images: item.product.images || [],
            condition: item.product.condition || '',
            weight: item.product.weight || 0
          } : {}
        }));
        
        // Extract products
        orderData.products = cart.items
          .map(item => item.product?._id)
          .filter(Boolean);
        
        // Get seller from first product
        if (cart.items[0]?.product?.seller) {
          orderData.seller = cart.items[0].product.seller;
        }
      }
      
      // B2C warehouse flow metadata
      orderData.metadata = {
        cartItemsCount: cart.items?.length || 0,
        bechoProtectApplied: cart.bechoProtectTotal > 0,
        shippingCharges: 0,
        taxAmount: 0,
        discountAmount: 0,
        shipmentMode: 'B2C',
        autoForwardEnabled: true,
        shippingFlow: 'seller_to_warehouse_to_buyer',
        warehouse: {
          name: 'JustBecho Warehouse',
          address: '103 Dilpasand grand, Behind Rafael tower',
          city: 'Indore',
          state: 'Madhya Pradesh',
          pincode: '452001',
          contact: 'Devansh Kothari - 9301847748'
        },
        trackingJobs: []
      };
    } else {
      // If no cart, create minimal order
      orderData.totalAmount = 0;
      orderData.user = req.body.userId || null;
      orderData.buyer = req.body.userId || null;
      console.log('⚠️ Creating order without cart data');
    }

    // Create order in database
    const newOrder = new Order(orderData);
    const savedOrder = await newOrder.save();
    
    console.log('✅ Database order created:', savedOrder._id);

    // ✅ STEP 4: Update products to "SOLD" if cart exists
    if (cart && cart.items && cart.items.length > 0) {
      const productUpdates = [];
      
      for (const item of cart.items) {
        if (item.product && item.product._id) {
          const productId = item.product._id;
          
          // Update product status
          await Product.findByIdAndUpdate(productId, {
            status: 'sold',
            soldAt: new Date(),
            soldTo: cart.user,
            order: savedOrder._id,
            shippingStatus: 'pending',
            warehouseFlow: true
          });
          
          productUpdates.push(productId);
        }
      }
      
      console.log(`📦 Updated ${productUpdates.length} products to SOLD`);
      
      // Clear the cart
      await Cart.findByIdAndUpdate(cartId, {
        $set: { items: [], subtotal: 0, bechoProtectTotal: 0, totalItems: 0 }
      });
      console.log('🛒 Cart cleared after successful order');
    }

    // ✅ STEP 5: Create shipments (only if B2C flow needed)
    let shipmentInfo = {};
    try {
      if (cart && cart.items && cart.items.length > 0) {
        console.log('🚚 Attempting to create B2C shipments...');
        // Here you can call nimbuspostService if needed
        shipmentInfo.message = 'Shipments will be created automatically';
      }
    } catch (shipmentError) {
      console.error('❌ Shipment creation error:', shipmentError.message);
      shipmentInfo.error = shipmentError.message;
    }

    // ✅ STEP 6: SUCCESS RESPONSE
    const responseData = {
      success: true,
      message: '🎉 Payment verified & order created successfully!',
      orderId: savedOrder._id.toString(),
      paymentId: razorpay_payment_id,
      order: {
        id: savedOrder._id,
        status: savedOrder.status,
        totalAmount: savedOrder.totalAmount,
        razorpayOrderId: savedOrder.razorpayOrderId,
        createdAt: savedOrder.createdAt,
        itemsCount: savedOrder.items?.length || 0
      },
      shipmentInfo: shipmentInfo,
      timestamp: new Date().toISOString()
    };

    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Verification error:', error.message);
    console.error('❌ Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Payment verification failed: ' + error.message,
      troubleshooting: [
        'Check Razorpay signature verification',
        'Verify database connection',
        'Check cart data'
      ]
    });
  }
});

// ✅ WEBHOOK FOR PAYMENT STATUS (Razorpay will call this)
router.post('/webhook', express.json({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const body = JSON.stringify(req.body);
    
    // Verify webhook signature
    const generatedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');
    
    if (generatedSignature !== signature) {
      console.error('❌ Invalid webhook signature');
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }
    
    const event = req.body;
    console.log('🔔 Razorpay Webhook Event:', event.event);
    
    switch (event.event) {
      case 'payment.captured':
        console.log('💰 Payment captured:', event.payload.payment.entity.id);
        // You can update order status here if needed
        break;
        
      case 'payment.failed':
        console.log('❌ Payment failed:', event.payload.payment.entity.id);
        // Handle failed payments
        break;
        
      case 'order.paid':
        console.log('✅ Order paid:', event.payload.order.entity.id);
        // Order is paid, you can trigger further processing
        break;
    }
    
    res.json({ success: true, message: 'Webhook received' });
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ CHECK INCOMPLETE ORDERS
router.get('/check-incomplete/:razorpayOrderId', async (req, res) => {
  try {
    const { razorpayOrderId } = req.params;
    
    console.log('🔍 Checking incomplete order:', razorpayOrderId);
    
    // Check if order exists in DB
    const order = await Order.findOne({ razorpayOrderId });
    
    if (order) {
      return res.json({
        success: true,
        exists: true,
        order: {
          id: order._id,
          status: order.status,
          totalAmount: order.totalAmount
        }
      });
    } else {
      return res.json({
        success: true,
        exists: false,
        message: 'No database order found for this payment'
      });
    }
    
  } catch (error) {
    console.error('Check incomplete error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ MANUAL ORDER CREATION (for testing/admin)
router.post('/manual-create-order', async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, userId, cartId, amount } = req.body;
    
    console.log('🛠️ Manual order creation:', razorpayOrderId);
    
    // Check if already exists
    const existingOrder = await Order.findOne({ razorpayOrderId });
    if (existingOrder) {
      return res.json({
        success: false,
        message: 'Order already exists',
        orderId: existingOrder._id
      });
    }
    
    // Create order
    const orderData = {
      razorpayOrderId,
      razorpayPaymentId: razorpayPaymentId || `manual_${Date.now()}`,
      user: userId,
      cart: cartId,
      totalAmount: amount || 0,
      status: 'paid',
      paidAt: new Date(),
      buyer: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        manualCreation: true,
        createdBy: 'admin'
      }
    };
    
    const newOrder = new Order(orderData);
    const savedOrder = await newOrder.save();
    
    console.log('✅ Manual order created:', savedOrder._id);
    
    res.json({
      success: true,
      message: 'Manual order created',
      orderId: savedOrder._id
    });
    
  } catch (error) {
    console.error('Manual creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;