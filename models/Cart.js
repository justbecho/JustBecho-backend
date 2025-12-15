// models/Cart.js - CORRECTED VERSION
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
  
  // ✅ CORRECTED: subtotal should be ONLY product prices (without becho protect)
  subtotal: {
    type: Number,
    default: 0
  },
  
  // ✅ bechoProtectTotal should be separate
  bechoProtectTotal: {
    type: Number,
    default: 0
  },
  
  // ✅ totalAmount = subtotal + bechoProtectTotal (for display)
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

// ✅ CORRECTED calculation method
cartSchema.methods.calculateAndSave = async function() {
  let subtotal = 0;
  let bechoProtectTotal = 0;
  let totalItems = 0;
  
  this.items.forEach(item => {
    // ✅ Item subtotal (product price × quantity)
    const itemSubtotal = item.price * item.quantity;
    
    // ✅ Becho Protect total for this item (if selected)
    const bechoProtectItemTotal = item.bechoProtect.selected 
      ? (item.bechoProtect.price || 0) * item.quantity 
      : 0;
    
    // ✅ Item total price (product + becho protect)
    item.totalPrice = itemSubtotal + bechoProtectItemTotal;
    
    // ✅ Add to cart totals
    subtotal += itemSubtotal; // ONLY product prices
    bechoProtectTotal += bechoProtectItemTotal; // Becho protect separately
    totalItems += item.quantity;
  });
  
  // ✅ Update cart totals CORRECTLY
  this.subtotal = subtotal;
  this.bechoProtectTotal = bechoProtectTotal;
  this.totalAmount = subtotal + bechoProtectTotal;
  this.totalItems = totalItems;
  
  // Save the cart
  return await this.save();
};

// ✅ Helper method to get totals for checkout
cartSchema.methods.getCheckoutTotals = function() {
  const SHIPPING_CHARGE = 299;
  
  // Platform fee calculation based on subtotal
  let platformFeePercentage = 0;
  if (this.subtotal <= 2000) {
    platformFeePercentage = 30;
  } else if (this.subtotal >= 2001 && this.subtotal <= 5000) {
    platformFeePercentage = 28;
  } else if (this.subtotal >= 5001 && this.subtotal <= 10000) {
    platformFeePercentage = 25;
  } else if (this.subtotal >= 10001 && this.subtotal <= 15000) {
    platformFeePercentage = 20;
  } else {
    platformFeePercentage = 15;
  }
  
  const platformFee = Math.round((this.subtotal * platformFeePercentage) / 100);
  const tax = Math.round(platformFee * 0.18); // GST on platform fee only
  const grandTotal = this.subtotal + this.bechoProtectTotal + platformFee + tax + SHIPPING_CHARGE;
  
  return {
    subtotal: this.subtotal,
    bechoProtectTotal: this.bechoProtectTotal,
    platformFee,
    platformFeePercentage,
    tax,
    shipping: SHIPPING_CHARGE,
    grandTotal
  };
};

export default mongoose.model("Cart", cartSchema);