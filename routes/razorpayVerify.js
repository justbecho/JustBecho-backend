import express from 'express';
import crypto from 'crypto';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ VERIFY PAYMENT (Public route - Razorpay calls this)
router.post('/verify-payment', async (req, res) => {
  try {
    console.log('🔐 [RAZORPAY] Payment verification request');
    console.log('📦 Request body:', req.body);
    
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.log('❌ Missing verification parameters');
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification parameters'
      });
    }

    // Step 1: Find order in database
    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
    
    if (!order) {
      console.log('❌ Order not found for Razorpay ID:', razorpay_order_id);
      return res.status(400).json({
        success: false,
        message: 'Order not found'
      });
    }

    console.log('✅ Order found:', order._id);
    
    // Step 2: Verify signature
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_LIVE_SECRET_KEY)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    console.log('🔐 Signature verification:', {
      received: razorpay_signature.substring(0, 20) + '...',
      generated: generated_signature.substring(0, 20) + '...',
      match: generated_signature === razorpay_signature
    });

    if (generated_signature === razorpay_signature) {
      // ✅ Payment verified successfully
      console.log('✅ Payment verified for order:', order._id);
      
      // Update order status
      order.status = 'paid';
      order.razorpayPaymentId = razorpay_payment_id;
      order.paidAt = new Date();
      await order.save();

      // ✅ Empty the user's cart
      await Cart.findOneAndUpdate(
        { user: order.user },
        { 
          items: [], 
          subtotal: 0, 
          bechoProtectTotal: 0,
          totalAmount: 0, 
          totalItems: 0 
        }
      );

      console.log('🛒 Cart cleared for user:', order.user);

      res.json({
        success: true,
        message: 'Payment verified successfully',
        orderId: order._id,
        paymentId: razorpay_payment_id
      });
    } else {
      // ❌ Signature mismatch
      console.log('❌ Signature mismatch for payment:', razorpay_payment_id);
      
      order.status = 'failed';
      order.failedAt = new Date();
      await order.save();

      res.status(400).json({
        success: false,
        message: 'Payment verification failed - invalid signature'
      });
    }
  } catch (error) {
    console.error('❌ [RAZORPAY] Verification error:', error.message);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Server error during verification: ' + error.message
    });
  }
});

// ✅ VERIFY PAYMENT (For frontend - with auth)
router.post('/verify-payment-frontend', authMiddleware, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user.userId;

    // Find order and verify it belongs to user
    const order = await Order.findOne({ 
      razorpayOrderId: razorpay_order_id,
      user: userId 
    });

    if (!order) {
      return res.status(400).json({
        success: false,
        message: 'Order not found or unauthorized'
      });
    }

    // Verify signature
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_LIVE_SECRET_KEY)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      // Update order
      order.status = 'paid';
      order.razorpayPaymentId = razorpay_payment_id;
      order.paidAt = new Date();
      await order.save();

      // Clear cart
      await Cart.findOneAndUpdate(
        { user: userId },
        { 
          items: [], 
          subtotal: 0, 
          totalAmount: 0, 
          totalItems: 0 
        }
      );

      res.json({
        success: true,
        message: 'Payment verified successfully'
      });
    } else {
      order.status = 'failed';
      await order.save();

      res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during verification'
    });
  }
});

export default router;