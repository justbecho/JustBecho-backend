// models/Category.js - IMPROVED VERSION
import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Category name is required"],
    unique: true,
    trim: true,
    index: true
  },
  
  slug: {
    type: String,
    required: [true, "Slug is required"],
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  
  description: {
    type: String,
    default: ""
  },
  
  href: {
    type: String,
    default: ""
  },
  
  image: {
    type: String,
    default: ""
  },
  
  // ✅ IMPROVED SUB-CATEGORIES STRUCTURE
  subCategories: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    items: [{
      type: String,
      trim: true
    }]
  }],
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // ✅ ADD THESE FIELDS FOR BETTER UX
  displayOrder: {
    type: Number,
    default: 0
  },
  
  metaTitle: {
    type: String,
    default: ""
  },
  
  metaDescription: {
    type: String,
    default: ""
  },
  
  productCount: {
    type: Number,
    default: 0
  }
  
}, {
  timestamps: true
});

// ✅ Create indexes for better performance
categorySchema.index({ slug: 1, isActive: 1 });
categorySchema.index({ isActive: 1, displayOrder: 1 });

// ✅ Pre-save hook to generate slug if not provided
categorySchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

export default mongoose.model("Category", categorySchema);