import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const updateAllProductsPlatformFee = async () => {
  try {
    // Connect to database
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Import Product model
    const { default: Product } = await import('./models/Product.js');
    
    // Get all active products
    console.log('📊 Fetching all active products...');
    const products = await Product.find({ status: 'active' });
    
    console.log(`✅ Total products to update: ${products.length}`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    // Update each product
    for (const product of products) {
      try {
        const askingPrice = product.askingPrice;
        
        if (!askingPrice || askingPrice <= 0) {
          console.log(`⚠️ Skipping product ${product._id}: Invalid asking price`);
          skippedCount++;
          continue;
        }
        
        // Calculate new platform fee (10%)
        const platformFeePercentage = 10;
        const feeAmount = (askingPrice * platformFeePercentage) / 100;
        const finalPrice = Math.ceil(askingPrice + feeAmount);
        
        // Update product
        await Product.findByIdAndUpdate(product._id, {
          platformFee: platformFeePercentage,
          finalPrice: finalPrice
        });
        
        updatedCount++;
        
        // Log progress every 50 products
        if (updatedCount % 50 === 0) {
          console.log(`📈 Updated ${updatedCount} products...`);
        }
        
      } catch (productError) {
        console.error(`❌ Error updating product ${product._id}:`, productError.message);
        skippedCount++;
      }
    }
    
    console.log('\n====================================');
    console.log('📋 UPDATE SUMMARY:');
    console.log('====================================');
    console.log(`✅ Successfully updated: ${updatedCount} products`);
    console.log(`⚠️ Skipped: ${skippedCount} products`);
    console.log(`📊 Total processed: ${products.length} products`);
    console.log('====================================\n');
    
    console.log('🎉 All products updated with 10% platform fee!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error updating products:', error);
    process.exit(1);
  }
};

// Run the update
updateAllProductsPlatformFee();