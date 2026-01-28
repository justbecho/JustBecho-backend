// scripts/cleanup-incomplete-orders.js - ES MODULE VERSION
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';

async function cleanupIncompleteOrders() {
  try {
    console.log('🧹 Starting cleanup of incomplete orders...');
    
    // MongoDB connection
    await mongoose.connect('mongodb+srv://Karan:Karan2021@justbecho-cluster.cbqu2mf.mongodb.net/justbecho?retryWrites=true&w=majority', {
      serverSelectionTimeoutMS: 10000
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Step 1: Find all orders with status 'pending' or 'processing' but no payment ID
    const incompleteOrders = await Order.find({
      $or: [
        { status: 'pending' },
        { status: 'processing' },
        { status: { $exists: false } }
      ],
      $or: [
        { razorpayPaymentId: { $exists: false } },
        { razorpayPaymentId: null },
        { razorpayPaymentId: '' }
      ]
    });
    
    console.log(`📊 Found ${incompleteOrders.length} incomplete orders`);
    
    // Step 2: Check each order
    let cancelledCount = 0;
    let fixedCount = 0;
    
    for (const order of incompleteOrders) {
      console.log(`\n🔍 Processing order: ${order._id}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Razorpay Order ID: ${order.razorpayOrderId}`);
      console.log(`   Created: ${order.createdAt}`);
      console.log(`   Amount: ${order.totalAmount}`);
      
      // Check if order is older than 24 hours
      const orderAge = Date.now() - new Date(order.createdAt).getTime();
      const hoursOld = orderAge / (1000 * 60 * 60);
      
      if (hoursOld > 24) {
        // Order is old and incomplete, mark as cancelled
        order.status = 'cancelled';
        order.cancelledAt = new Date();
        order.cancelledReason = 'Payment not completed within 24 hours';
        await order.save();
        cancelledCount++;
        console.log(`   ❌ Marked as cancelled (${hoursOld.toFixed(1)} hours old)`);
      } else if (order.razorpayOrderId) {
        // Newer order
        order.status = 'pending_payment';
        await order.save();
        fixedCount++;
        console.log(`   ⚠️  Marked as pending_payment`);
      }
    }
    
    // Step 3: Find products that are marked as 'sold' but belong to cancelled orders
    const cancelledOrders = await Order.find({ status: 'cancelled' });
    const cancelledOrderIds = cancelledOrders.map(o => o._id);
    
    if (cancelledOrderIds.length > 0) {
      console.log(`\n🔄 Updating products from ${cancelledOrderIds.length} cancelled orders...`);
      
      const productUpdateResult = await Product.updateMany(
        {
          order: { $in: cancelledOrderIds },
          status: 'sold'
        },
        {
          $set: {
            status: 'active',
            soldAt: null,
            soldTo: null,
            order: null,
            shippingStatus: 'pending'
          }
        }
      );
      
      console.log(`✅ Updated ${productUpdateResult.modifiedCount} products back to active`);
    }
    
    // Step 4: Find orders that have payment ID but status is wrong
    const paidOrdersWithWrongStatus = await Order.find({
      razorpayPaymentId: { $exists: true, $ne: null, $ne: '' },
      status: { $in: ['pending', 'processing', 'pending_payment'] }
    });
    
    console.log(`\n💵 Fixing ${paidOrdersWithWrongStatus.length} paid orders with wrong status...`);
    
    let fixedPaidCount = 0;
    for (const order of paidOrdersWithWrongStatus) {
      order.status = 'paid';
      await order.save();
      fixedPaidCount++;
    }
    
    console.log(`✅ Fixed ${fixedPaidCount} paid orders`);
    
    // Summary
    console.log('\n📊 CLEANUP SUMMARY:');
    console.log('══════════════════════════════════');
    console.log(`Total incomplete orders found: ${incompleteOrders.length}`);
    console.log(`Cancelled (older than 24h): ${cancelledCount}`);
    console.log(`Marked as pending_payment: ${fixedCount}`);
    console.log(`Fixed paid orders status: ${fixedPaidCount}`);
    console.log(`Products reactivated: ${productUpdateResult?.modifiedCount || 0}`);
    console.log('══════════════════════════════════');
    
    // Show current order status distribution
    const statusCounts = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    console.log('\n📈 CURRENT ORDER STATUS DISTRIBUTION:');
    statusCounts.forEach(({ _id, count }) => {
      console.log(`  ${_id || 'no status'}: ${count} orders`);
    });
    
    await mongoose.connection.close();
    console.log('\n✅ Cleanup completed!');
    
  } catch (error) {
    console.error('❌ Cleanup error:', error);
  }
}

// Run the cleanup
cleanupIncompleteOrders();