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
  totalItems: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Calculate cart totals
cartSchema.methods.calculateAndSave = async function() {
  let subtotal = 0;
  let bechoProtectTotal = 0;
  let totalItems = 0;
  
  this.items.forEach(item => {
    const itemSubtotal = item.price * item.quantity;
    const bechoProtectItemTotal = item.bechoProtect.selected 
      ? (item.bechoProtect.price || 0) * item.quantity 
      : 0;
    
    item.totalPrice = itemSubtotal + bechoProtectItemTotal;
    subtotal += itemSubtotal;
    bechoProtectTotal += bechoProtectItemTotal;
    totalItems += item.quantity;
  });
  
  this.subtotal = subtotal;
  this.bechoProtectTotal = bechoProtectTotal;
  this.totalItems = totalItems;
  
  return await this.save();
};

// Get checkout totals (hidden platform fee included in GST)
cartSchema.methods.getCheckoutTotals = function() {
  const SHIPPING_CHARGE = 1;
  
  // Platform fee calculation (hidden from user)
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
  const gst = Math.round(platformFee * 0.18); // 18% GST on platform fee
  const grandTotal = this.subtotal + this.bechoProtectTotal + gst + SHIPPING_CHARGE;
  
  return {
    subtotal: this.subtotal,
    bechoProtectTotal: this.bechoProtectTotal,
    gst,
    shipping: SHIPPING_CHARGE,
    grandTotal,
    // Hidden values for calculation only
    _platformFee: platformFee,
    _platformFeePercentage: platformFeePercentage
  };
};

export default mongoose.model("Cart", cartSchema);