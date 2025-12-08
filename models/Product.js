import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  // Product Details
  productName: {
    type: String,
    required: [true, "Product name is required"],
    trim: true,
    maxlength: [100, "Product name cannot exceed 100 characters"]
  },
  
  brand: {
    type: String,
    required: [true, "Brand is required"],
    trim: true
  },
  
  category: {
    type: String,
    required: [true, "Category is required"],
    trim: true
  },
  
  productType: {
    type: String,
    required: [true, "Product type is required"],
    trim: true
  },
  
  condition: {
    type: String,
    required: [true, "Condition is required"],
    enum: ['New', 'Like New', 'Good', 'Fair', 'Poor']
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
    required: true
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
    required: true
  },
  
  sellerName: {
    type: String,
    required: true
  },
  
  sellerUsername: {
    type: String,
    default: ""
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
    default: 'active'
  },
  
  // Analytics
  views: {
    type: Number,
    default: 0
  },
  
  likes: {
    type: Number,
    default: 0
  },
  
  // Expiration
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  }
  
}, {
  timestamps: true
});

// Indexes for better performance
productSchema.index({ seller: 1 });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ finalPrice: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ views: -1 });
productSchema.index({ likes: -1 });

export default mongoose.model("Product", productSchema);