// File: /routes/razorpayOrder.js
import express from 'express';
import Razorpay from 'razorpay';
import Order from '../models/Order.js'; // Naya model banaoge

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_LIVE_KEY_ID,
  key_secret: process.env.RAZORPAY_LIVE_SECRET_KEY
});

// ✅ CREATE ORDER
router.post('/create-order', async (req, res) => {
  try {
    const { amount, cartId, shippingAddress } = req.body;
    const userId = req.user.userId;

    // Validate cart exists
    const cart = await Cart.findById(cartId).populate('items.product');
    if (!cart) {
      return res.status(400).json({
        success: false,
        message: 'Cart not found'
      });
    }

    // Create order in database
    const order = new Order({
      user: userId,
      cart: cartId,
      totalAmount: amount,
      shippingAddress: shippingAddress,
      razorpayOrderId: null,
      status: 'pending'
    });

    await order.save();

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amount * 100, // Rupees to paise
      currency: 'INR',
      receipt: `order_${order._id}`,
      notes: {
        orderId: order._id.toString(),
        cartId: cartId
      }
    });

    // Save Razorpay order ID in your database
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        yourOrderId: order._id
      }
    });

  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order'
    });
  }
});

export default router;