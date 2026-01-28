// scripts/reactivate-products.js
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';

async function reactivateProducts() {
  try {
    console.log('🔄 Reactivating products from cancelled orders...');
    
    // MongoDB connection
    await mongoose.connect('mongodb+srv://Karan:Karan2021@justbecho-cluster.cbqu2mf.mongodb.net/justbecho?retryWrites=true&w=majority', {
      serverSelectionTimeoutMS: 10000
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Step 1: Find all cancelled orders
    const cancelledOrders = await Order.find({ 
      status: 'cancelled' 
    }).select('_id products items createdAt');
    
    console.log(`📊 Found ${cancelledOrders.length} cancelled orders`);
    
    // Step 2: Extract all product IDs from cancelled orders
    const allProductIds = [];
    let orderCount = 0;
    
    for (const order of cancelledOrders) {
      orderCount++;
      console.log(`\n🔍 Order ${orderCount}/${cancelledOrders.length}: ${order._id}`);
      console.log(`   Created: ${order.createdAt.toLocaleDateString()}`);
      
      // Get products from order.products array
      if (order.products && order.products.length > 0) {
        console.log(`   Products in order.products: ${order.products.length}`);
        order.products.forEach(productId => {
          if (productId) {
            allProductIds.push(productId.toString());
            console.log(`     - ${productId}`);
          }
        });
      }
      
      // Get products from order.items array
      if (order.items && order.items.length > 0) {
        console.log(`   Products in order.items: ${order.items.length}`);
        order.items.forEach(item => {
          if (item.product) {
            const productId = item.product.toString ? item.product.toString() : item.product;
            allProductIds.push(productId);
            console.log(`     - ${productId} (Qty: ${item.quantity})`);
          }
        });
      }
      
      if (!order.products && !order.items) {
        console.log(`   ℹ️  No products found in this order`);
      }
    }
    
    // Step 3: Remove duplicates
    const uniqueProductIds = [...new Set(allProductIds)];
    console.log(`\n📦 Found ${uniqueProductIds.length} unique products in cancelled orders`);
    
    if (uniqueProductIds.length === 0) {
      console.log('ℹ️  No products found to reactivate');
      await mongoose.connection.close();
      return;
    }
    
    // Step 4: Reactivate these products
    console.log('\n🔄 Reactivating products...');
    
    // First check current status
    const productsBefore = await Product.find({
      _id: { $in: uniqueProductIds }
    }).select('_id productName status soldAt order');
    
    console.log(`📊 Found ${productsBefore.length} products in database`);
    
    let soldCount = 0;
    let activeCount = 0;
    productsBefore.forEach(product => {
      if (product.status === 'sold') {
        soldCount++;
        console.log(`   ❌ ${product._id} - ${product.productName} - Status: SOLD (Order: ${product.order})`);
      } else {
        activeCount++;
        console.log(`   ✅ ${product._id} - ${product.productName} - Status: ${product.status}`);
      }
    });
    
    console.log(`\n📈 Before: ${soldCount} sold, ${activeCount} active`);
    
    // Update only sold products
    const updateResult = await Product.updateMany(
      {
        _id: { $in: uniqueProductIds },
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
    
    console.log(`✅ Reactivated ${updateResult.modifiedCount} products from 'sold' to 'active'`);
    
    // Step 5: Verify after update
    const productsAfter = await Product.find({
      _id: { $in: uniqueProductIds },
      status: 'sold'
    }).countDocuments();
    
    console.log(`📊 After: ${productsAfter} products still marked as 'sold'`);
    
    if (productsAfter > 0) {
      console.log('\n⚠️  Some products still not reactivated. Listing them:');
      const stillSold = await Product.find({
        _id: { $in: uniqueProductIds },
        status: 'sold'
      }).select('_id productName order');
      
      stillSold.forEach(product => {
        console.log(`   ❌ ${product._id} - ${product.productName} - Order: ${product.order}`);
      });
    }
    
    // Summary
    console.log('\n📊 REACTIVATION SUMMARY:');
    console.log('══════════════════════════════════');
    console.log(`Cancelled orders processed: ${cancelledOrders.length}`);
    console.log(`Unique products found: ${uniqueProductIds.length}`);
    console.log(`Products reactivated: ${updateResult.modifiedCount}`);
    console.log(`Products still sold: ${productsAfter}`);
    console.log('══════════════════════════════════');
    
    await mongoose.connection.close();
    console.log('\n🎉 Reactivation completed!');
    
  } catch (error) {
    console.error('❌ Reactivation error:', error);
  }
}

// Run the function
reactivateProducts();