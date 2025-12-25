// models/Product.js - OPTIMIZED VERSION
import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  // Product Details
  productName: {
    type: String,
    required: [true, "Product name is required"],
    trim: true,
    maxlength: [100, "Product name cannot exceed 100 characters"],
    index: true
  },
  
  brand: {
    type: String,
    required: [true, "Brand is required"],
    trim: true,
    index: true
  },
  
  category: {
    type: String,
    required: [true, "Category is required"],
    trim: true,
    index: true
  },
  
  productType: {
    type: String,
    required: [true, "Product type is required"],
    trim: true
  },
  
  condition: {
    type: String,
    required: [true, "Condition is required"],
    enum: ['Brand New With Tag', 'Brand New Without Tag', 'Like New','Excellent','Fairly Used','Good'],
    index: true
  },
  
  description: {
    type: String,
    required: [true, "Description is required"],
    trim: true,
    maxlength: [1000, "Description cannot exceed 1000 characters"]
  },
  
  // Pricing
  askingPrice: {
    type: Number,
    required: [true, "Asking price is required"],
    min: [1, "Price must be at least 1"]
  },
  
  platformFee: {
    type: Number,
    default: 0
  },
  
  finalPrice: {
    type: Number,
    required: true,
    index: true
  },
  
  // Images
  images: [{
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  
  // Seller Info
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  sellerName: {
    type: String,
    required: true
  },
  
  sellerUsername: {
    type: String,
    default: ""
  },
  
  // ✅ ADDED: Shipping Fields
  shippingStatus: {
    type: String,
    enum: ['pending', 'ready', 'shipped', 'delivered'],
    default: 'pending'
  },
  
  shippedAt: {
    type: Date
  },
  
  deliveredAt: {
    type: Date
  },
  
  // ✅ ADDED: Sold tracking
  soldTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  soldAt: {
    type: Date
  },
  
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  
  // Additional Info
  purchaseYear: {
    type: Number,
    min: [1900, "Invalid purchase year"],
    max: [new Date().getFullYear(), "Purchase year cannot be in the future"]
  },
  
  size: {
    type: String,
    default: "One Size"
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'sold', 'pending', 'inactive'],
    default: 'active',
    index: true
  },
  
  // Analytics
  views: {
    type: Number,
    default: 0,
    index: true
  },
  
  likes: {
    type: Number,
    default: 0,
    index: true
  },
  
  // Expiration
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    index: true
  }
  
}, {
  timestamps: true
});

// ✅ Compound indexes for better performance
productSchema.index({ brand: 1, category: 1, status: 1 });
productSchema.index({ category: 1, brand: 1, status: 1 });
productSchema.index({ seller: 1, status: 1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ status: 1, views: -1 });
productSchema.index({ status: 1, likes: -1 });

// ✅ Text index for search
productSchema.index(
  { 
    productName: 'text', 
    brand: 'text', 
    description: 'text',
    category: 'text'
  },
  {
    weights: {
      productName: 10,
      brand: 8,
      category: 6,
      description: 3
    },
    name: 'product_search_index'
  }
);

export default mongoose.model("Product", productSchema);