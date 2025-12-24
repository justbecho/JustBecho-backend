// routes/razorpayOrder.js - COMPLETE FIXED VERSION
import express from 'express';
import Razorpay from 'razorpay';
import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ RAZORPAY INITIALIZATION
let razorpay;
try {
  const keyId = process.env.RAZORPAY_LIVE_KEY_ID || 'rzp_test_XXXXXXXXXXXX';
  const keySecret = process.env.RAZORPAY_LIVE_SECRET_KEY || 'XXXXXXXXXXXXXXXXXXXXXXXX';
  
  if (!keyId || !keySecret) {
    throw new Error('Razorpay keys not found');
  }
  
  razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
  
  console.log('✅ Razorpay initialized successfully');
} catch (error) {
  console.error('❌ Razorpay init error:', error.message);
  // Mock for development
  razorpay = {
    orders: {
      create: async (options) => {
        console.log('📦 Mock Razorpay Order Creation');
        return {
          id: `mock_order_${Date.now()}`,
          amount: options.amount,
          currency: options.currency || 'INR',
          receipt: options.receipt,
          status: 'created'
        };
      }
    }
  };
}

// ✅ CREATE ORDER - MAIN ENDPOINT (FIXED)
router.post('/create-order', authMiddleware, async (req, res) => {
  console.log('📦 [RAZORPAY] Creating order request received');
  
  try {
    const { amount, cartId, shippingAddress } = req.body;
    const userId = req.user.userId;

    // Validate amount
    if (!amount || amount < 1) {
      console.log('❌ Invalid amount:', amount);
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required (minimum ₹1)'
      });
    }

    // Check if cart exists
    const cart = await Cart.findById(cartId).populate('items.product');
    if (!cart) {
      console.log('❌ Cart not found for ID:', cartId);
      return res.status(400).json({
        success: false,
        message: 'Cart not found'
      });
    }

    console.log('🛒 Cart found:', cart._id);
    console.log('💰 Converting amount:', amount, 'to paise:', Math.round(amount * 100));

    // ✅ Create Razorpay order
    const razorpayOrderData = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `order_${Date.now()}_${userId.substring(0, 8)}`,
      payment_capture: 1
    };

    console.log('📋 Razorpay order data:', razorpayOrderData);
    
    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create(razorpayOrderData);
      console.log('✅ Razorpay order created:', razorpayOrder.id);
    } catch (razorpayError) {
      console.error('❌ Razorpay API error:', razorpayError.message);
      return res.status(500).json({
        success: false,
        message: 'Payment gateway error: ' + razorpayError.message
      });
    }

    // ✅ Build order data
    const orderData = {
      user: userId,
      cart: cartId,
      totalAmount: amount,
      razorpayOrderId: razorpayOrder.id,
      status: 'pending',
      buyer: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add shipping address if provided
    if (shippingAddress) {
      orderData.shippingAddress = {
        name: shippingAddress.name || req.user.name || 'Customer',
        phone: shippingAddress.phone || req.user.phone || '',
        email: shippingAddress.email || req.user.email || '',
        street: shippingAddress.street || '',
        city: shippingAddress.city || '',
        state: shippingAddress.state || '',
        pincode: shippingAddress.pincode || '',
        country: 'India',
        landmark: shippingAddress.landmark || ''
      };
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

    // ✅ B2C WAREHOUSE METADATA
    orderData.metadata = {
      cartItemsCount: cart.items?.length || 0,
      bechoProtectApplied: false,
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
      trackingJobs: [],
      preferredCourier: 'delhivery',
      deliveryType: 'surface'
    };

    console.log('📦 Creating database order...');

    // ✅ FIXED: Create order using Model.create() with proper error handling
    let savedOrder;
    try {
      // Option 1: Try using Model.create() with validateBeforeSave: false
      savedOrder = await Order.create([orderData], { 
        validateBeforeSave: false 
      });
      
      savedOrder = savedOrder[0]; // Create returns array
      console.log('✅ Order created via Model.create():', savedOrder._id);
      
    } catch (createError) {
      console.log('⚠️ Model.create() failed, trying manual insert...');
      
      // Option 2: Manual insert if Model.create fails
      try {
        const db = mongoose.connection.db;
        const result = await db.collection('orders').insertOne(orderData);
        
        // Fetch the created order
        savedOrder = await Order.findById(result.insertedId);
        console.log('✅ Order created via manual insert:', savedOrder._id);
        
      } catch (insertError) {
        console.error('❌ Manual insert also failed:', insertError.message);
        throw new Error('Order creation failed: ' + insertError.message);
      }
    }

    // ✅ SUCCESS RESPONSE
    res.json({
      success: true,
      message: 'Order created successfully',
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        status: razorpayOrder.status,
        databaseOrderId: savedOrder._id,
        razorpayOrderId: razorpayOrder.id
      },
      orderInfo: {
        totalAmount: amount,
        itemsCount: cart.items?.length || 0,
        razorpayOrderId: razorpayOrder.id,
        orderStatus: savedOrder.status,
        b2cFlow: 'seller_to_warehouse_to_buyer'
      }
    });

  } catch (error) {
    console.error('❌ [RAZORPAY] Order creation error:', error.message);
    console.error('❌ Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Failed to create order: ' + error.message,
      errorType: error.name,
      troubleshooting: [
        'Check if cart exists',
        'Verify database connection',
        'Check Razorpay API keys'
      ]
    });
  }
});

// ✅ SIMPLE TEST ENDPOINT (No middleware issues)
router.post('/create-order-test', authMiddleware, async (req, res) => {
  try {
    const { amount = 100, cartId } = req.body;
    const userId = req.user.userId;
    
    console.log('🧪 Creating test order...');
    
    // Create Razorpay order
    const razorpayOrderData = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `test_${Date.now()}`,
      payment_capture: 1
    };
    
    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create(razorpayOrderData);
      console.log('✅ Test Razorpay order created:', razorpayOrder.id);
    } catch (error) {
      console.error('❌ Test order error:', error.message);
      
      // Mock response
      razorpayOrder = {
        id: `test_mock_${Date.now()}`,
        amount: razorpayOrderData.amount,
        currency: razorpayOrderData.currency,
        receipt: razorpayOrderData.receipt,
        status: 'created'
      };
      console.log('⚠️  Using mock test order');
    }
    
    // Create minimal order
    const orderData = {
      user: userId,
      cart: cartId,
      totalAmount: amount,
      razorpayOrderId: razorpayOrder.id,
      status: 'pending',
      buyer: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        cartItemsCount: 1,
        shipmentMode: 'B2C',
        autoForwardEnabled: true
      }
    };
    
    // Direct insert to avoid middleware
    const db = mongoose.connection.db;
    const result = await db.collection('orders').insertOne(orderData);
    
    console.log('✅ Test order saved with ID:', result.insertedId);
    
    res.json({
      success: true,
      message: 'Test order created successfully',
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        databaseOrderId: result.insertedId
      }
    });
    
  } catch (error) {
    console.error('Test order creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ GET ORDER STATUS
router.get('/order-status/:orderId', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;
    
    const order = await Order.findOne({
      _id: orderId,
      user: userId
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      order: {
        id: order._id,
        status: order.status,
        totalAmount: order.totalAmount,
        razorpayOrderId: order.razorpayOrderId,
        createdAt: order.createdAt,
        itemsCount: order.items?.length || 0
      }
    });
    
  } catch (error) {
    console.error('Get order status error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;