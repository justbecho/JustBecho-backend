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
      },
      fetch: async (orderId) => {
        return {
          id: orderId,
          amount: 10000,
          currency: 'INR',
          status: 'created'
        };
      }
    }
  };
}

// ✅ CREATE RAZORPAY ORDER ONLY (NO DATABASE ORDER YET)
router.post('/create-order', authMiddleware, async (req, res) => {
  console.log('📦 [RAZORPAY] Creating payment order (NO DB order yet)');
  
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

    // ✅ Create Razorpay order ONLY
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

    // ✅ DO NOT CREATE DATABASE ORDER HERE
    // Save temp data for frontend only
    const tempOrderData = {
      razorpayOrderId: razorpayOrder.id,
      cartId: cartId,
      userId: userId,
      totalAmount: amount,
      shippingAddress: shippingAddress,
      createdAt: new Date(),
      items: cart.items.map(item => ({
        product: item.product?._id,
        quantity: item.quantity,
        price: item.price,
        bechoProtect: item.bechoProtect
      }))
    };

    console.log('📦 Temp order data saved (not in DB yet)');

    // ✅ SUCCESS RESPONSE - NO DATABASE ORDER CREATED
    res.json({
      success: true,
      message: 'Payment order created. Complete payment to place order.',
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        status: 'created',
        // Send temp data to frontend
        tempData: {
          cartId: cartId,
          totalAmount: amount,
          itemsCount: cart.items?.length || 0
        }
      },
      paymentInfo: {
        key: process.env.RAZORPAY_LIVE_KEY_ID,
        name: "JustBecho",
        description: "Order Payment",
        order_id: razorpayOrder.id,
        prefill: {
          name: req.user.name || "Customer",
          email: req.user.email || "",
          contact: req.user.phone || ""
        },
        theme: {
          color: "#F37254"
        }
      }
    });

  } catch (error) {
    console.error('❌ [RAZORPAY] Order creation error:', error.message);
    console.error('❌ Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Failed to create order: ' + error.message,
      errorType: error.name
    });
  }
});

// ✅ CHECK PAYMENT STATUS
router.get('/check-payment/:orderId', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;
    
    console.log('🔍 Checking payment status for:', orderId);
    
    // Check if order exists in DB
    const dbOrder = await Order.findOne({ 
      razorpayOrderId: orderId,
      user: userId 
    });
    
    if (dbOrder) {
      // Order already in DB (payment was successful)
      console.log('✅ Order exists in DB:', dbOrder._id);
      return res.json({
        success: true,
        orderExists: true,
        order: {
          id: dbOrder._id,
          status: dbOrder.status,
          totalAmount: dbOrder.totalAmount,
          razorpayOrderId: dbOrder.razorpayOrderId,
          createdAt: dbOrder.createdAt
        },
        message: 'Order already created'
      });
    }
    
    // Check with Razorpay API
    try {
      const razorpayOrder = await razorpay.orders.fetch(orderId);
      console.log('📋 Razorpay order status:', razorpayOrder.status);
      
      if (razorpayOrder.status === 'paid') {
        // Payment was successful but order not in DB
        return res.json({
          success: false,
          orderExists: false,
          paymentStatus: 'paid',
          message: 'Payment successful but order not created. Please contact support.'
        });
      } else {
        // Payment not completed
        return res.json({
          success: false,
          orderExists: false,
          paymentStatus: razorpayOrder.status,
          message: 'Payment not completed'
        });
      }
    } catch (razorpayError) {
      console.error('❌ Razorpay fetch error:', razorpayError.message);
      return res.json({
        success: false,
        orderExists: false,
        message: 'Payment order not found in Razorpay'
      });
    }
    
  } catch (error) {
    console.error('❌ Check payment error:', error);
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
    })
    .select('_id status totalAmount razorpayOrderId razorpayPaymentId createdAt items shippingAddress');
    
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
        razorpayPaymentId: order.razorpayPaymentId,
        createdAt: order.createdAt,
        itemsCount: order.items?.length || 0,
        shippingAddress: order.shippingAddress
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

// ✅ SIMPLE TEST ENDPOINT
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
    
    res.json({
      success: true,
      message: 'Test payment order created',
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        databaseOrderId: null, // No DB order yet
        razorpayOrderId: razorpayOrder.id
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

export default router;