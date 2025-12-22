// models/Order.js - COMPLETE UPDATED VERSION WITH NIMBUSPOST
import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  // Basic Order Information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cart: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cart',
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  
  // Razorpay Payment Information
  razorpayOrderId: {
    type: String,
    unique: true
  },
  razorpayPaymentId: {
    type: String,
    unique: true,
    sparse: true
  },
  
  // Order Status
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  
  // Shipping Address
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    phone: String,
    landmark: String
  },
  
  // Order Items
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    quantity: Number,
    price: Number,
    bechoProtect: {
      selected: Boolean,
      price: Number
    },
    totalPrice: Number
  }],
  
  // User Information
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
  
  // Payment Timeline
  paidAt: {
    type: Date
  },
  failedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  },
  
  // ✅ NIMBUSPOST SHIPPING INTEGRATION
  nimbuspostShipments: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    awbNumber: String,
    shipmentId: String,
    labelUrl: String,
    trackingUrl: {
      type: String,
      default: function() {
        return this.awbNumber ? `https://track.nimbuspost.com/track/${this.awbNumber}` : null;
      }
    },
    manifestUrl: String,
    status: {
      type: String,
      enum: ['booked', 'pickup_scheduled', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'rto'],
      default: 'booked'
    },
    courierName: String,
    courierId: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    pickedUpAt: Date,
    deliveredAt: Date,
    notes: String,
    error: String
  }],
  
  // ✅ TWO-LEG SHIPPING TRACKING
  shippingLegs: [{
    leg: {
      type: String,
      enum: ['seller_to_warehouse', 'warehouse_to_buyer', 'direct_delivery'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'in_transit', 'arrived', 'delivered', 'failed'],
      default: 'pending'
    },
    awbNumbers: [String],
    courierName: String,
    estimatedDelivery: Date,
    actualDelivery: Date,
    startedAt: Date,
    completedAt: Date,
    trackingUrl: String,
    notes: String,
    proofOfDelivery: {
      image: String,
      signature: String,
      receivedBy: String
    }
  }],
  
  // ✅ ORDER BREAKDOWN (For Invoice)
  orderBreakdown: {
    subtotal: Number,
    bechoProtectTotal: Number,
    platformFee: Number,
    gst: Number,
    shippingCharges: Number,
    discount: Number,
    grandTotal: Number
  },
  
  // ✅ BUYER/SELLER COMMUNICATION
  messages: [{
    from: {
      type: String,
      enum: ['buyer', 'seller', 'system', 'support']
    },
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    read: {
      type: Boolean,
      default: false
    }
  }],
  
  // ✅ RETURNS & REFUNDS
  returnRequest: {
    requested: Boolean,
    reason: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed']
    },
    requestedAt: Date,
    processedAt: Date,
    refundAmount: Number,
    notes: String
  },
  
  // ✅ DELIVERY PROOF
  deliveryProof: {
    image: String,
    signature: String,
    deliveredTo: String,
    relationship: String,
    timestamp: Date
  },
  
  // ✅ INVOICE INFORMATION
  invoice: {
    number: String,
    date: Date,
    url: String,
    items: [{
      description: String,
      quantity: Number,
      price: Number,
      total: Number
    }]
  },
  
  // ✅ ADMIN NOTES
  adminNotes: [{
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    note: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ✅ ORDER TAGS (For Filtering)
  tags: [{
    type: String,
    enum: ['express', 'fragile', 'high_value', 'international', 'cod']
  }],
  
  // ✅ METADATA
  metadata: {
    browser: String,
    ipAddress: String,
    device: String,
    referral: String
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ✅ VIRTUAL PROPERTIES
orderSchema.virtual('isPaid').get(function() {
  return this.status === 'paid' || this.status === 'processing' || 
         this.status === 'shipped' || this.status === 'delivered';
});

orderSchema.virtual('canCancel').get(function() {
  return this.status === 'pending' || this.status === 'paid';
});

orderSchema.virtual('canReturn').get(function() {
  // Can return within 7 days of delivery
  if (this.status !== 'delivered') return false;
  const deliveredDate = this.shippingLegs.find(l => l.status === 'delivered')?.completedAt;
  if (!deliveredDate) return false;
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return deliveredDate > sevenDaysAgo;
});

orderSchema.virtual('currentShippingStatus').get(function() {
  if (this.shippingLegs.length === 0) return 'pending';
  const lastLeg = this.shippingLegs[this.shippingLegs.length - 1];
  return `${lastLeg.leg.replace('_', ' ')} - ${lastLeg.status}`;
});

// ✅ INDEXES FOR PERFORMANCE
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ razorpayOrderId: 1 });
orderSchema.index({ razorpayPaymentId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ seller: 1 });
orderSchema.index({ buyer: 1 });
orderSchema.index({ 'nimbuspostShipments.awbNumber': 1 });
orderSchema.index({ 'shippingLegs.status': 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ totalAmount: 1 });

// ✅ PRE-SAVE HOOK
orderSchema.pre('save', function(next) {
  // Auto-generate invoice number if not set
  if (!this.invoice.number && this.status === 'paid') {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const sequence = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.invoice.number = `INV-JB-${year}${month}${day}-${sequence}`;
    this.invoice.date = date;
  }
  
  // Auto-update shipping leg status based on NimbusPost shipments
  if (this.nimbuspostShipments && this.nimbuspostShipments.length > 0) {
    const allDelivered = this.nimbuspostShipments.every(s => s.status === 'delivered');
    const anyInTransit = this.nimbuspostShipments.some(s => 
      s.status === 'in_transit' || s.status === 'out_for_delivery'
    );
    
    if (allDelivered) {
      // Update warehouse_to_buyer leg as delivered
      const buyerLegIndex = this.shippingLegs.findIndex(l => l.leg === 'warehouse_to_buyer');
      if (buyerLegIndex !== -1) {
        this.shippingLegs[buyerLegIndex].status = 'delivered';
        this.shippingLegs[buyerLegIndex].completedAt = new Date();
      }
    } else if (anyInTransit) {
      // Update appropriate leg as in_transit
      const sellerLegIndex = this.shippingLegs.findIndex(l => l.leg === 'seller_to_warehouse');
      if (sellerLegIndex !== -1 && this.shippingLegs[sellerLegIndex].status === 'scheduled') {
        this.shippingLegs[sellerLegIndex].status = 'in_transit';
      }
    }
  }
  
  next();
});

// ✅ STATIC METHODS
orderSchema.statics.findByAwbNumber = function(awbNumber) {
  return this.findOne({ 'nimbuspostShipments.awbNumber': awbNumber });
};

orderSchema.statics.findByBuyer = function(buyerId) {
  return this.find({ buyer: buyerId }).sort({ createdAt: -1 });
};

orderSchema.statics.findBySeller = function(sellerId) {
  return this.find({ seller: sellerId }).sort({ createdAt: -1 });
};

orderSchema.statics.getDashboardStats = async function(sellerId = null) {
  const matchStage = sellerId ? { seller: new mongoose.Types.ObjectId(sellerId) } : {};
  
  return await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        pendingOrders: {
          $sum: { $cond: [{ $in: ['$status', ['pending', 'processing']] }, 1, 0] }
        },
        completedOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        averageOrderValue: { $avg: '$totalAmount' }
      }
    }
  ]);
};

// ✅ INSTANCE METHODS
orderSchema.methods.addMessage = function(from, message) {
  this.messages.push({
    from: from,
    message: message,
    timestamp: new Date()
  });
  return this.save();
};

orderSchema.methods.updateShippingLeg = function(leg, updates) {
  const legIndex = this.shippingLegs.findIndex(l => l.leg === leg);
  
  if (legIndex === -1) {
    this.shippingLegs.push({
      leg: leg,
      ...updates
    });
  } else {
    this.shippingLegs[legIndex] = {
      ...this.shippingLegs[legIndex],
      ...updates,
      updatedAt: new Date()
    };
  }
  
  return this.save();
};

orderSchema.methods.getShippingTimeline = function() {
  const timeline = [];
  
  // Order placed
  timeline.push({
    event: 'Order Placed',
    timestamp: this.createdAt,
    status: 'completed'
  });
  
  // Payment
  if (this.paidAt) {
    timeline.push({
      event: 'Payment Received',
      timestamp: this.paidAt,
      status: 'completed'
    });
  }
  
  // Shipping legs
  this.shippingLegs.forEach(leg => {
    timeline.push({
      event: `${leg.leg.replace('_', ' ').toUpperCase()}`,
      timestamp: leg.startedAt || this.paidAt,
      status: leg.status === 'delivered' ? 'completed' : 
              leg.status === 'in_transit' ? 'in_progress' : 'pending',
      details: leg.notes
    });
    
    if (leg.completedAt) {
      timeline.push({
        event: `${leg.leg.replace('_', ' ').toUpperCase()} Completed`,
        timestamp: leg.completedAt,
        status: 'completed',
        details: leg.notes
      });
    }
  });
  
  // Sort by timestamp
  return timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

// ✅ ENUMS FOR REFERENCE
orderSchema.statics.STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
};

orderSchema.statics.SHIPPING_LEGS = {
  SELLER_TO_WAREHOUSE: 'seller_to_warehouse',
  WAREHOUSE_TO_BUYER: 'warehouse_to_buyer',
  DIRECT_DELIVERY: 'direct_delivery'
};

orderSchema.statics.SHIPPING_STATUS = {
  PENDING: 'pending',
  SCHEDULED: 'scheduled',
  IN_TRANSIT: 'in_transit',
  ARRIVED: 'arrived',
  DELIVERED: 'delivered',
  FAILED: 'failed'
};

export default mongoose.model('Order', orderSchema);