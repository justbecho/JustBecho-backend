// models/Category.js - UPDATED VERSION
import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: ""
  },
  // ✅ ADD HREF FIELD
  href: {
    type: String,
    default: ""
  },
  image: {
    type: String,
    default: ""
  },
  // ✅ SUB-CATEGORIES ARRAY
  subCategories: [{
    title: String,
    items: [String]
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model("Category", categorySchema);
