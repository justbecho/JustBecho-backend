// models/Cart.js - SIMPLIFIED VERSION WITHOUT PRE-SAVE HOOK
import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true
  },
  size: {
    type: String,
    default: ''
  },
  color: {
    type: String,
    default: ''
  },
  bechoProtect: {
    selected: {
      type: Boolean,
      default: false
    },
    price: {
      type: Number,
      default: 0
    }
  },
  totalPrice: {
    type: Number,
    default: 0
  }
}, { _id: true });

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  subtotal: {
    type: Number,
    default: 0
  },
  bechoProtectTotal: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  totalItems: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// ✅ REMOVED pre-save hook
// ✅ ADD method to calculate totals manually

cartSchema.methods.calculateAndSave = async function() {
  let subtotal = 0;
  let bechoProtectTotal = 0;
  let totalItems = 0;
  
  this.items.forEach(item => {
    // Calculate item subtotal
    const itemSubtotal = item.price * item.quantity;
    
    // Calculate Becho Protect total for this item
    const bechoProtectItemTotal = (item.bechoProtect?.price || 0) * item.quantity;
    
    // Update item total price
    item.totalPrice = itemSubtotal + bechoProtectItemTotal;
    
    // Add to cart totals
    subtotal += itemSubtotal;
    bechoProtectTotal += bechoProtectItemTotal;
    totalItems += item.quantity;
  });
  
  // Update cart totals
  this.subtotal = subtotal;
  this.bechoProtectTotal = bechoProtectTotal;
  this.totalAmount = subtotal + bechoProtectTotal;
  this.totalItems = totalItems;
  
  // Save the cart
  return await this.save();
};

export default mongoose.model("Cart", cartSchema);
