import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Category name is required"],
    unique: true,
    trim: true,
    index: true
  },
  
  // ✅ FIX: Make slug NOT required or ensure auto-generation
  slug: {
    type: String,
    // Remove required: true
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
    default: ""  // Add default value
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

// ✅ Improved pre-save hook
categorySchema.pre('save', function(next) {
  // Generate slug from name if not provided
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  
  // Ensure href is set if not provided
  if (!this.href && this.slug) {
    this.href = this.slug;
  }
  
  next();
});

// ✅ Create indexes
categorySchema.index({ slug: 1, isActive: 1 });
categorySchema.index({ isActive: 1, displayOrder: 1 });

export default mongoose.model("Category", categorySchema);