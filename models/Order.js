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
  
  // ✅ Order Status (FIXED: added 'processing' status)
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
  
  // ✅ NimbusPost Shipments (FIXED: added 'pending' status)
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
  
  // ✅ Shipping Legs (FIXED: removed 'picked_up' from enum)
  shippingLegs: [{
    leg: {
      type: String,
      enum: ['seller_to_warehouse', 'warehouse_to_buyer']
    },
    status: {
      type: String,
      enum: ['pending', 'in_transit', 'completed', 'failed'], // ✅ REMOVED 'pending_pickup' and 'picked_up'
      default: 'pending'
    },
    awbNumbers: [String],
    startedAt: Date,
    completedAt: Date,
    notes: String
  }],
  
  // ✅ Order Metadata
  metadata: {
    cartItemsCount: Number,
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

// ✅ Pre-save hook (FIXED: proper function with next parameter)
orderSchema.pre('save', function(next) {
  try {
    // Auto-set buyer if not set
    if (!this.buyer && this.user) {
      this.buyer = this.user;
    }
    
    // Auto-calculate totalPrice for items
    if (this.items && this.items.length > 0) {
      this.items.forEach(item => {
        if (!item.totalPrice) {
          item.totalPrice = (item.price || 0) * (item.quantity || 1);
        }
      });
    }
    
    // Set default status
    if (!this.status) {
      this.status = 'pending';
    }
    
    // Initialize metadata if not set
    if (!this.metadata) {
      this.metadata = {};
    }
    
    if (!this.metadata.cartItemsCount && this.items) {
      this.metadata.cartItemsCount = this.items.length;
    }
    
    // Check if any item has bechoProtect
    if (this.items && this.items.length > 0) {
      const hasBechoProtect = this.items.some(item => 
        item.bechoProtect && item.bechoProtect.selected === true
      );
      this.metadata.bechoProtectApplied = hasBechoProtect;
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

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

// Virtual for shipping status
orderSchema.virtual('shippingStatusText').get(function() {
  if (!this.shippingLegs || this.shippingLegs.length === 0) {
    return 'Not Shipped';
  }
  
  const lastLeg = this.shippingLegs[this.shippingLegs.length - 1];
  const statusMap = {
    pending: 'Pending Pickup',
    in_transit: 'In Transit',
    completed: 'Delivered',
    failed: 'Shipping Failed'
  };
  
  return statusMap[lastLeg.status] || lastLeg.status;
});

// Ensure virtuals are included in JSON
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

export default mongoose.model('Order', orderSchema);