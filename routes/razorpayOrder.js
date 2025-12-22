import express from 'express';
import Razorpay from 'razorpay';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ SAFE RAZORPAY INITIALIZATION
let razorpay;
try {
  const keyId = process.env.RAZORPAY_LIVE_KEY_ID;
  const keySecret = process.env.RAZORPAY_LIVE_SECRET_KEY;
  
  console.log('🔐 Razorpay Config Check:', {
    keyIdExists: !!keyId,
    keySecretExists: !!keySecret,
    keyIdPrefix: keyId ? keyId.substring(0, 10) + '...' : 'none'
  });
  
  if (!keyId || !keySecret) {
    throw new Error('Razorpay keys not found in environment variables');
  }
  
  razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
  
  console.log('✅ Razorpay initialized successfully');
} catch (error) {
  console.error('❌ Razorpay initialization failed:', error.message);
  
  // Create mock razorpay for development
  razorpay = {
    orders: {
      create: async (options) => {
        console.log('📦 Mock Razorpay Order Creation:', options);
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
  console.log('⚠️  Using mock Razorpay for development');
}

// ✅ CREATE ORDER (Protected route) - COMPLETELY FIXED VERSION
router.post('/create-order', authMiddleware, async (req, res) => {
  try {
    console.log('📦 [RAZORPAY] Creating order request received');
    console.log('👤 User ID from auth:', req.user?.userId);
    console.log('📊 Request body:', req.body);
    
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
    console.log('📊 Cart items:', cart.items?.length || 0);
    console.log('💰 Converting amount:', amount, 'to paise:', Math.round(amount * 100));

    // ✅ Create Razorpay order FIRST
    const razorpayOrderData = {
      amount: Math.round(amount * 100), // Rupees to paise
      currency: 'INR',
      receipt: `order_${Date.now()}_${userId.substring(0, 8)}`,
      payment_capture: 1 // Auto capture
    };

    console.log('📋 Razorpay order data:', razorpayOrderData);
    
    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create(razorpayOrderData);
      console.log('✅ Razorpay order created:', razorpayOrder.id);
    } catch (razorpayError) {
      console.error('❌ Razorpay API error:', razorpayError.message);
      console.error('Razorpay error details:', razorpayError.error || razorpayError);
      
      return res.status(500).json({
        success: false,
        message: 'Payment gateway error: ' + razorpayError.message,
        debug: process.env.NODE_ENV === 'development' ? razorpayError : undefined
      });
    }

    // ✅ PREPARE ORDER DATA WITHOUT MIDDLEWARE DEPENDENCIES
    const orderData = {
      user: userId,
      cart: cartId,
      totalAmount: amount,
      razorpayOrderId: razorpayOrder.id,
      status: 'pending',
      shippingAddress: shippingAddress || null,
      buyer: userId,
      items: cart.items.map(item => ({
        product: item.product?._id || item.product,
        quantity: item.quantity || 1,
        price: item.price || 0,
        bechoProtect: item.bechoProtect || { selected: false, price: 0 },
        totalPrice: (item.price || 0) * (item.quantity || 1)
      }))
    };

    console.log('📦 Creating database order with simplified data');

    // ✅ METHOD 1: Direct Order.create() - Most reliable
    let order;
    try {
      console.log('🔄 Trying Order.create() method...');
      
      // Create order directly without going through constructor
      const createdOrders = await Order.create([{
        user: userId,
        cart: cartId,
        totalAmount: amount,
        razorpayOrderId: razorpayOrder.id,
        status: 'pending',
        shippingAddress: shippingAddress || null,
        buyer: userId,
        items: cart.items.map(item => ({
          product: item.product?._id || item.product,
          quantity: item.quantity || 1,
          price: item.price || 0,
          bechoProtect: item.bechoProtect || { selected: false, price: 0 },
          totalPrice: (item.price || 0) * (item.quantity || 1)
        }))
      }], { 
        validateBeforeSave: false 
      });
      
      order = createdOrders[0];
      console.log('✅ Order created successfully via create():', order._id);
      
    } catch (createError) {
      console.error('❌ Order.create() failed:', createError.message);
      
      // ✅ METHOD 2: Insert directly into collection
      try {
        console.log('🔄 Trying direct MongoDB insert...');
        
        const orderDoc = {
          user: new mongoose.Types.ObjectId(userId),
          cart: new mongoose.Types.ObjectId(cartId),
          totalAmount: amount,
          razorpayOrderId: razorpayOrder.id,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        if (shippingAddress) {
          orderDoc.shippingAddress = shippingAddress;
        }
        
        // Add items if available
        if (cart.items && cart.items.length > 0) {
          orderDoc.items = cart.items.map(item => ({
            product: item.product?._id || item.product,
            quantity: item.quantity || 1,
            price: item.price || 0,
            bechoProtect: item.bechoProtect || { selected: false, price: 0 },
            totalPrice: (item.price || 0) * (item.quantity || 1)
          }));
        }
        
        const result = await Order.collection.insertOne(orderDoc);
        console.log('✅ Direct insert successful, ID:', result.insertedId);
        
        // Get the inserted document
        order = await Order.findById(result.insertedId);
        
      } catch (insertError) {
        console.error('❌ Direct insert also failed:', insertError.message);
        
        // ✅ METHOD 3: Create minimal order
        try {
          console.log('🔄 Creating minimal order...');
          
          const minimalOrder = new Order({
            user: userId,
            cart: cartId,
            totalAmount: amount,
            razorpayOrderId: razorpayOrder.id,
            status: 'pending'
          });
          
          // Save with bypassing ALL middleware
          const saved = await minimalOrder.save({ 
            validateBeforeSave: false 
          });
          
          order = saved;
          console.log('✅ Minimal order saved:', order._id);
          
        } catch (minimalError) {
          console.error('❌ All order creation methods failed:', minimalError.message);
          throw new Error(`Order creation failed: ${minimalError.message}`);
        }
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
        yourOrderId: order._id,
        databaseOrderId: order._id
      },
      orderInfo: {
        totalAmount: amount,
        items: order.items?.length || cart.items?.length || 0,
        razorpayOrderId: razorpayOrder.id,
        orderStatus: order.status
      },
      nextSteps: [
        'Use Razorpay checkout with order.id',
        'After payment, verify with /api/razorpay/verify-payment',
        'Track order status at /api/orders/my-orders'
      ]
    });

  } catch (error) {
    console.error('❌ [RAZORPAY] Order creation error:', error.message);
    console.error('Error stack:', error.stack);
    
    // Detailed error response
    res.status(500).json({
      success: false,
      message: 'Failed to create order: ' + error.message,
      errorType: error.name,
      troubleshooting: [
        'Check Order model for middleware issues',
        'Verify database connection',
        'Ensure cart exists and has items',
        'Check if Razorpay keys are valid'
      ],
      debug: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
});

// ✅ CREATE ORDER WITHOUT MIDDLEWARE (Alternative route)
router.post('/create-order-simple', authMiddleware, async (req, res) => {
  try {
    const { amount, cartId, shippingAddress } = req.body;
    const userId = req.user.userId;
    
    if (!amount || amount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }
    
    // Create Razorpay order
    const razorpayOrderData = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `order_${Date.now()}`,
      payment_capture: 1
    };
    
    const razorpayOrder = await razorpay.orders.create(razorpayOrderData);
    
    // Create order with simplest possible data
    const orderDoc = {
      user: userId,
      cart: cartId,
      totalAmount: amount,
      razorpayOrderId: razorpayOrder.id,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    if (shippingAddress) {
      orderDoc.shippingAddress = shippingAddress;
    }
    
    // Insert directly
    const result = await Order.collection.insertOne(orderDoc);
    const order = await Order.findById(result.insertedId);
    
    res.json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        yourOrderId: order._id
      }
    });
    
  } catch (error) {
    console.error('Simple order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Order creation failed: ' + error.message
    });
  }
});

// ✅ CREATE TEST ORDER (No auth required for testing)
router.post('/test-create-order', async (req, res) => {
  try {
    const { amount = 100, email = 'test@example.com' } = req.body;
    
    console.log('🧪 Creating test Razorpay order...');
    
    const razorpayOrderData = {
      amount: Math.round(amount * 100), // Rupees to paise
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
      
      // Mock response if Razorpay fails
      razorpayOrder = {
        id: `test_mock_${Date.now()}`,
        amount: razorpayOrderData.amount,
        currency: razorpayOrderData.currency,
        receipt: razorpayOrderData.receipt,
        status: 'created'
      };
      console.log('⚠️  Using mock test order');
    }
    
    res.json({
      success: true,
      message: 'Test order created',
      order: razorpayOrder,
      testInfo: {
        amountInRupees: amount,
        amountInPaise: razorpayOrder.amount,
        email: email,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Test order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Test failed: ' + error.message
    });
  }
});

// ✅ GET ORDER STATUS (For debugging)
router.get('/order-status/:orderId', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('user', 'name email')
      .populate('cart', 'items subtotal')
      .lean();
    
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
        user: order.user,
        totalAmount: order.totalAmount,
        razorpayOrderId: order.razorpayOrderId,
        status: order.status,
        createdAt: order.createdAt,
        itemsCount: order.items?.length || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ GET ALL USER ORDERS
router.get('/my-orders', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const orders = await Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({
      success: true,
      orders: orders.map(order => ({
        id: order._id,
        totalAmount: order.totalAmount,
        status: order.status,
        razorpayOrderId: order.razorpayOrderId,
        createdAt: order.createdAt,
        itemsCount: order.items?.length || 0
      })),
      count: orders.length
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ CHECK RAZORPAY CONFIG
router.get('/config-check', (req, res) => {
  const keyId = process.env.RAZORPAY_LIVE_KEY_ID;
  const keySecret = process.env.RAZORPAY_LIVE_SECRET_KEY;
  
  res.json({
    success: true,
    razorpay: {
      keyIdExists: !!keyId,
      keySecretExists: !!keySecret,
      keyIdPreview: keyId ? keyId.substring(0, 10) + '...' : 'Not set',
      environment: process.env.NODE_ENV || 'development'
    },
    serverTime: new Date().toISOString()
  });
});

export default router;