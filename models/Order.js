// models/Order.js - SIMPLIFIED VERSION (NO MIDDLEWARE)
import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  // ✅ Basic Order Information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  cart: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cart',
    required: true
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // ✅ Razorpay Payment Information
  razorpayOrderId: {
    type: String,
    unique: true,
    sparse: true
  },
  razorpayPaymentId: {
    type: String,
    sparse: true
  },
  
  // ✅ Order Status
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'shipped', 'delivered', 'cancelled', 'payment_pending', 'processing'],
    default: 'pending'
  },
  
  // ✅ Shipping Address
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    phone: String
  },
  
  // ✅ Order Items
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    },
    price: {
      type: Number,
      default: 0,
      min: 0
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
  }],
  
  // ✅ User Information
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  
  // ✅ Payment Timeline
  paidAt: Date,
  shippedAt: Date,
  deliveredAt: Date,
  failedAt: Date,
  
  // ✅ NimbusPost Shipments
  nimbuspostShipments: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    awbNumber: String,
    shipmentId: String,
    labelUrl: String,
    trackingUrl: String,
    status: {
      type: String,
      enum: ['booked', 'pickup_scheduled', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'pending'],
      default: 'booked'
    },
    courierName: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    pickedUpAt: Date,
    deliveredAt: Date,
    error: String,
    isMock: {
      type: Boolean,
      default: false
    }
  }],
  
  // ✅ Shipping Legs
  shippingLegs: [{
    leg: {
      type: String,
      enum: ['seller_to_warehouse', 'warehouse_to_buyer']
    },
    status: {
      type: String,
      enum: ['pending', 'in_transit', 'completed', 'failed'],
      default: 'pending'
    },
    awbNumbers: [String],
    startedAt: Date,
    completedAt: Date,
    notes: String
  }],
  
  // ✅ Order Metadata
  metadata: {
    cartItemsCount: {
      type: Number,
      default: 0
    },
    bechoProtectApplied: {
      type: Boolean,
      default: false
    },
    shippingCharges: {
      type: Number,
      default: 0
    },
    taxAmount: {
      type: Number,
      default: 0
    },
    discountAmount: {
      type: Number,
      default: 0
    }
  },
  
  // ✅ Order Notes
  notes: [{
    note: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
  
}, {
  timestamps: true,
  minimize: false
});

// ✅ NO PRE-SAVE HOOKS - Complete remove all middleware

// Indexes for better performance
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ razorpayOrderId: 1 }, { unique: true, sparse: true });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ seller: 1 });
orderSchema.index({ 'nimbuspostShipments.awbNumber': 1 });

// Virtual for total items count
orderSchema.virtual('itemsCount').get(function() {
  return this.items ? this.items.length : 0;
});

// Virtual for formatted amount
orderSchema.virtual('formattedAmount').get(function() {
  return `₹${this.totalAmount?.toLocaleString('en-IN') || '0'}`;
});

// Ensure virtuals are included in JSON
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

export default mongoose.model('Order', orderSchema);