// File: /routes/razorpayVerify.js
import express from 'express';
import crypto from 'crypto';
import Order from '../models/Order.js';

const router = express.Router();

// ✅ VERIFY PAYMENT
router.post('/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Step 1: Apne database se ORIGINAL order fetch karo
    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
    if (!order) {
      return res.status(400).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Step 2: Signature verify karo
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_LIVE_SECRET_KEY)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      // ✅ Payment verified successfully
      
      // Update order status in your database
      order.status = 'paid';
      order.razorpayPaymentId = razorpay_payment_id;
      order.paidAt = new Date();
      await order.save();

      // ✅ IMPORTANT: Empty the user's cart
      await Cart.findOneAndUpdate(
        { user: order.user },
        { items: [], subtotal: 0, totalAmount: 0, totalItems: 0 }
      );

      res.json({
        success: true,
        message: 'Payment verified successfully',
        orderId: order._id,
        paymentId: razorpay_payment_id
      });
    } else {
      // ❌ Signature mismatch
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