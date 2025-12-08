import mongoose from "mongoose";

const subCategorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  items: [{
    type: String,
    trim: true
  }]
});

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
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
  subCategories: [subCategorySchema],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// Auto-generate href if not provided
categorySchema.pre('save', function(next) {
  if (!this.href || this.href.trim() === '') {
    this.href = `/categories/${this.name.toLowerCase().replace(/\s+/g, '-')}`;
  }
  next();
});

export default mongoose.model("Category", categorySchema);