import express from 'express';
import crypto from 'crypto';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import User from '../models/User.js';

const router = express.Router();

// ✅ UPDATED: VERIFY PAYMENT WITH ALL REQUIRED UPDATES
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
    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id })
      .populate('cart')
      .populate('user', 'name email');
    
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
      
      // ✅ CRITICAL: Get cart items to process
      const cart = await Cart.findById(order.cart)
        .populate('items.product');
      
      if (!cart) {
        return res.status(400).json({
          success: false,
          message: 'Cart not found for order'
        });
      }
      
      console.log('🛒 Processing cart with items:', cart.items.length);
      
      // ✅ Extract products and sellers from cart
      const productUpdates = [];
      const sellerUpdates = new Map(); // sellerId -> products sold
      const productIds = [];
      
      for (const item of cart.items) {
        if (item.product && item.product._id) {
          const productId = item.product._id;
          const sellerId = item.product.seller;
          
          productIds.push(productId);
          productUpdates.push({
            productId: productId,
            update: {
              status: 'sold',
              soldAt: new Date(),
              soldTo: order.user,
              order: order._id
            }
          });
          
          // Track seller's sold products
          if (sellerId) {
            if (!sellerUpdates.has(sellerId.toString())) {
              sellerUpdates.set(sellerId.toString(), []);
            }
            sellerUpdates.get(sellerId.toString()).push(productId);
          }
        }
      }
      
      // ✅ 1. Update all products to SOLD status (remove from listings)
      console.log('📦 Updating products to sold status...');
      for (const update of productUpdates) {
        await Product.findByIdAndUpdate(
          update.productId,
          update.update,
          { new: true }
        );
        console.log(`   ✅ Product ${update.productId} marked as SOLD`);
      }
      
      // ✅ 2. Update sellers' sold products count
      console.log('👨‍💼 Updating sellers...');
      for (const [sellerId, soldProducts] of sellerUpdates) {
        await User.findByIdAndUpdate(
          sellerId,
          {
            $addToSet: { soldProducts: { $each: soldProducts } },
            $inc: { totalSales: soldProducts.length }
          },
          { new: true }
        );
        console.log(`   ✅ Seller ${sellerId} updated with ${soldProducts.length} sold products`);
      }
      
      // ✅ 3. Update buyer's orders count
      console.log('🛍️ Updating buyer orders...');
      await User.findByIdAndUpdate(
        order.user,
        {
          $addToSet: { orders: order._id },
          $inc: { totalOrders: 1 }
        },
        { new: true }
      );
      
      // ✅ 4. Update order with complete details
      order.status = 'paid';
      order.razorpayPaymentId = razorpay_payment_id;
      order.paidAt = new Date();
      order.buyer = order.user;
      order.products = productIds;
      
      // Add seller info if only one seller
      if (sellerUpdates.size === 1) {
        order.seller = Array.from(sellerUpdates.keys())[0];
      }
      
      await order.save();
      console.log('✅ Order updated with complete details');

      // ✅ 5. Empty the user's cart
      await Cart.findOneAndUpdate(
        { user: order.user },
        { 
          items: [], 
          subtotal: 0, 
          bechoProtectTotal: 0,
          totalItems: 0 
        }
      );

      console.log('🛒 Cart cleared for user:', order.user);

      res.json({
        success: true,
        message: 'Payment verified successfully',
        orderId: order._id,
        paymentId: razorpay_payment_id,
        updates: {
          productsUpdated: productUpdates.length,
          sellersUpdated: sellerUpdates.size,
          buyerUpdated: true,
          cartCleared: true
        }
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

export default router;