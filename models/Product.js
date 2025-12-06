// models/Product.js - COMPLETE FIXED VERSION
import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  // Basic Product Information
  productName: {
    type: String,
    required: true,
    trim: true
  },
  brand: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true
  },
  productType: {
    type: String,
    required: true,
    trim: true
  },
  purchaseYear: {
    type: Number,
    default: null
  },
  condition: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },

  // Pricing Information
  askingPrice: {
    type: Number,
    required: true,
    min: 1
  },
  platformFee: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  finalPrice: {
    type: Number,
    required: true,
    min: 1
  },

  // Images
  images: [{
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],

  // Seller Information
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'sold', 'pending', 'draft', 'expired', 'rejected'],
    default: 'active'
  },

  // Additional Fields
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },

  // Timestamps
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  }

}, {
  timestamps: true
});

// ✅ FIXED: Simple pre-save middleware (NO next parameter)
productSchema.pre('save', function() {
  console.log('🔄 Pre-save middleware running...');
  
  // Ensure final price is calculated
  if (this.askingPrice && this.platformFee && (!this.finalPrice || this.isModified('askingPrice'))) {
    const feeAmount = (this.askingPrice * this.platformFee) / 100;
    this.finalPrice = Math.ceil(this.askingPrice + feeAmount);
    console.log('💰 Final price calculated:', this.finalPrice);
  }

  // Set first image as primary
  if (this.images && this.images.length > 0 && !this.images.some(img => img.isPrimary)) {
    this.images[0].isPrimary = true;
    console.log('🖼️ Primary image set');
  }
  
  console.log('✅ Pre-save middleware completed');
});

export default mongoose.model("Product", productSchema);
