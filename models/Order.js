// models/Order.js - COMPLETE WITH B2C SUPPORT
import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  // ✅ BASIC ORDER INFORMATION
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
  
  // ✅ RAZORPAY PAYMENT INFORMATION
  razorpayOrderId: {
    type: String,
    unique: true,
    sparse: true
  },
  razorpayPaymentId: {
    type: String,
    sparse: true
  },
  
  // ✅ ORDER STATUS
  status: {
    type: String,
    enum: [
      'pending', 
      'paid', 
      'failed', 
      'confirmed',
      'processing',
      'packed',
      'shipped', 
      'out_for_delivery',
      'delivered', 
      'cancelled', 
      'payment_pending',
      'return_requested',
      'returned',
      'refunded'
    ],
    default: 'pending'
  },
  
  // ✅ SHIPPING ADDRESS
  shippingAddress: {
    name: String,
    phone: String,
    email: String,
    street: String,
    street2: String,
    city: String,
    state: String,
    pincode: String,
    country: {
      type: String,
      default: 'India'
    },
    landmark: String
  },
  
  // ✅ ORDER ITEMS
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
    },
    productDetails: {
      name: String,
      brand: String,
      images: [String],
      condition: String,
      weight: Number
    }
  }],
  
  // ✅ USER INFORMATION
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
  
  // ✅ PAYMENT TIMELINE
  paidAt: Date,
  confirmedAt: Date,
  packedAt: Date,
  shippedAt: Date,
  outForDeliveryAt: Date,
  deliveredAt: Date,
  failedAt: Date,
  cancelledAt: Date,
  returnedAt: Date,
  
  // ✅ NIMBUSPOST B2C SHIPMENTS
  nimbuspostShipments: [{
    // ✅ BASIC INFO
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    awbNumber: String,
    shipmentId: String,
    shipmentMode: {
      type: String,
      enum: ['B2B', 'B2C', 'B2B2C'],
      default: 'B2C'
    },
    shipmentType: {
      type: String,
      enum: ['direct', 'warehouse', 'seller_to_buyer', 'warehouse_to_buyer'],
      default: 'seller_to_buyer'
    },
    
    // ✅ SHIPMENT LINKS
    labelUrl: String,
    invoiceUrl: String,
    manifestUrl: String,
    trackingUrl: String,
    
    // ✅ SHIPMENT STATUS
    status: {
      type: String,
      enum: [
        'booked', 
        'pickup_scheduled', 
        'pickup_generated',
        'picked_up', 
        'in_transit', 
        'out_for_delivery', 
        'delivered', 
        'failed', 
        'pending',
        'cancelled',
        'returned',
        'rto'
      ],
      default: 'booked'
    },
    
    // ✅ COURIER INFORMATION
    courierName: String,
    courierId: String,
    courierTrackingUrl: String,
    
    // ✅ TIMESTAMPS
    createdAt: {
      type: Date,
      default: Date.now
    },
    pickupScheduledAt: Date,
    pickedUpAt: Date,
    inTransitAt: Date,
    outForDeliveryAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    
    // ✅ SHIPMENT DETAILS
    shipmentDetails: {
      weight: Number,
      dimensions: {
        length: Number,
        breadth: Number,
        height: Number
      },
      charges: {
        freight: Number,
        cod: Number,
        total: Number
      },
      estimatedDelivery: Date,
      actualDelivery: Date
    },
    
    // ✅ ERROR HANDLING
    error: String,
    errorDetails: mongoose.Schema.Types.Mixed,
    
    // ✅ ADDITIONAL INFO
    isMock: {
      type: Boolean,
      default: false
    },
    notes: String,
    
    // ✅ FOR WAREHOUSE SHIPMENTS
    parentAWB: String, // For warehouse shipments, link to incoming AWB
    warehouseDetails: {
      name: String,
      address: String,
      city: String,
      state: String,
      pincode: String
    }
  }],
  
  // ✅ SHIPPING LEGS (FOR WAREHOUSE FLOW)
  shippingLegs: [{
    leg: {
      type: String,
      enum: ['seller_to_warehouse', 'warehouse_to_buyer', 'seller_to_buyer']
    },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'in_transit', 'completed', 'failed'],
      default: 'pending'
    },
    awbNumbers: [String],
    courierName: String,
    startedAt: Date,
    completedAt: Date,
    notes: String,
    trackingUrl: String
  }],
  
  // ✅ ORDER METADATA
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
    },
    
    // ✅ SHIPMENT SPECIFIC METADATA
    shipmentMode: {
      type: String,
      enum: ['B2B', 'B2C'],
      default: 'B2C'
    },
    autoForwardEnabled: {
      type: Boolean,
      default: true
    },
    
    // ✅ TRACKING JOBS FOR AUTOMATION
    trackingJobs: [{
      incomingAWB: String,
      productId: mongoose.Schema.Types.ObjectId,
      buyerData: mongoose.Schema.Types.Mixed,
      productData: mongoose.Schema.Types.Mixed,
      scheduledAt: Date,
      checkedAt: Date,
      status: {
        type: String,
        enum: ['monitoring', 'pending_forward', 'forwarded', 'failed'],
        default: 'monitoring'
      },
      attemptCount: {
        type: Number,
        default: 0
      }
    }],
    
    // ✅ COURIER PREFERENCES
    preferredCourier: String,
    deliveryType: {
      type: String,
      enum: ['surface', 'air'],
      default: 'surface'
    },
    
    // ✅ RETURN & REFUND INFO
    returnRequested: Boolean,
    returnReason: String,
    refundAmount: Number,
    refundStatus: {
      type: String,
      enum: ['pending', 'processed', 'completed', 'failed'],
      default: 'pending'
    }
  },
  
  // ✅ ORDER NOTES
  notes: [{
    note: String,
    type: {
      type: String,
      enum: ['system', 'admin', 'seller', 'buyer'],
      default: 'system'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ✅ ORDER TIMELINE
  timeline: [{
    event: String,
    description: String,
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: mongoose.Schema.Types.Mixed
  }]
  
}, {
  timestamps: true,
  minimize: false
});

// ✅ INDEXES FOR BETTER PERFORMANCE
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ razorpayOrderId: 1 }, { unique: true, sparse: true });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ seller: 1 });
orderSchema.index({ 'nimbuspostShipments.awbNumber': 1 });
orderSchema.index({ 'nimbuspostShipments.status': 1 });
orderSchema.index({ 'shippingAddress.pincode': 1 });
orderSchema.index({ 'metadata.shipmentMode': 1 });

// ✅ VIRTUAL FOR TOTAL ITEMS COUNT
orderSchema.virtual('itemsCount').get(function() {
  return this.items ? this.items.length : 0;
});

// ✅ VIRTUAL FOR FORMATTED AMOUNT
orderSchema.virtual('formattedAmount').get(function() {
  return `₹${this.totalAmount?.toLocaleString('en-IN') || '0'}`;
});

// ✅ VIRTUAL FOR SHIPPING STATUS
orderSchema.virtual('shippingStatus').get(function() {
  if (!this.nimbuspostShipments || this.nimbuspostShipments.length === 0) {
    return 'not_shipped';
  }
  
  const latestShipment = this.nimbuspostShipments[this.nimbuspostShipments.length - 1];
  return latestShipment.status;
});

// ✅ VIRTUAL FOR ACTIVE AWB
orderSchema.virtual('activeAwb').get(function() {
  if (!this.nimbuspostShipments || this.nimbuspostShipments.length === 0) {
    return null;
  }
  
  // Find the latest non-cancelled shipment
  const validShipments = this.nimbuspostShipments.filter(s => 
    s.status !== 'cancelled' && s.awbNumber
  );
  
  if (validShipments.length === 0) {
    return null;
  }
  
  return validShipments[validShipments.length - 1].awbNumber;
});

// ✅ VIRTUAL FOR TRACKING URL
orderSchema.virtual('trackingUrl').get(function() {
  const awb = this.activeAwb;
  return awb ? `https://track.nimbuspost.com/track/${awb}` : null;
});

// ✅ PRE-SAVE HOOK FOR TIMELINE
orderSchema.pre('save', function(next) {
  // Add to timeline if status changed
  if (this.isModified('status')) {
    if (!this.timeline) {
      this.timeline = [];
    }
    
    this.timeline.push({
      event: 'status_change',
      description: `Order status changed to ${this.status}`,
      status: this.status,
      metadata: {
        previousStatus: this._originalStatus || 'unknown'
      }
    });
    
    this._originalStatus = this.status;
  }
  
  next();
});

// ✅ STATIC METHOD TO FIND BY AWB
orderSchema.statics.findByAWB = function(awbNumber) {
  return this.findOne({
    'nimbuspostShipments.awbNumber': awbNumber
  });
};

// ✅ METHOD TO ADD SHIPMENT
orderSchema.methods.addShipment = function(shipmentData) {
  if (!this.nimbuspostShipments) {
    this.nimbuspostShipments = [];
  }
  
  this.nimbuspostShipments.push({
    ...shipmentData,
    createdAt: new Date()
  });
  
  // Update order status based on shipment
  if (shipmentData.status === 'shipped' || shipmentData.status === 'in_transit') {
    this.status = 'shipped';
    this.shippedAt = new Date();
  } else if (shipmentData.status === 'delivered') {
    this.status = 'delivered';
    this.deliveredAt = new Date();
  }
  
  // Add to timeline
  if (!this.timeline) {
    this.timeline = [];
  }
  
  this.timeline.push({
    event: 'shipment_created',
    description: `Shipment created with AWB: ${shipmentData.awbNumber}`,
    status: shipmentData.status,
    metadata: {
      awbNumber: shipmentData.awbNumber,
      courier: shipmentData.courierName
    }
  });
  
  return this;
};

// ✅ METHOD TO UPDATE SHIPMENT STATUS
orderSchema.methods.updateShipmentStatus = function(awbNumber, status, notes) {
  const shipment = this.nimbuspostShipments.find(s => s.awbNumber === awbNumber);
  
  if (shipment) {
    shipment.status = status;
    shipment.notes = notes || shipment.notes;
    
    // Update timestamp based on status
    const now = new Date();
    if (status === 'picked_up') {
      shipment.pickedUpAt = now;
    } else if (status === 'in_transit') {
      shipment.inTransitAt = now;
    } else if (status === 'out_for_delivery') {
      shipment.outForDeliveryAt = now;
    } else if (status === 'delivered') {
      shipment.deliveredAt = now;
      this.status = 'delivered';
      this.deliveredAt = now;
    }
    
    // Add to timeline
    if (!this.timeline) {
      this.timeline = [];
    }
    
    this.timeline.push({
      event: 'shipment_status_update',
      description: `Shipment ${awbNumber} status updated to ${status}`,
      status: status,
      timestamp: now
    });
    
    return true;
  }
  
  return false;
};

// ✅ METHOD TO GET SHIPPING SUMMARY
orderSchema.methods.getShippingSummary = function() {
  const summary = {
    totalShipments: this.nimbuspostShipments?.length || 0,
    activeShipments: 0,
    deliveredShipments: 0,
    inTransitShipments: 0,
    failedShipments: 0,
    shipments: []
  };
  
  if (this.nimbuspostShipments && this.nimbuspostShipments.length > 0) {
    this.nimbuspostShipments.forEach(shipment => {
      summary.shipments.push({
        awb: shipment.awbNumber,
        status: shipment.status,
        courier: shipment.courierName,
        createdAt: shipment.createdAt,
        trackingUrl: shipment.trackingUrl
      });
      
      if (shipment.status === 'delivered') {
        summary.deliveredShipments++;
      } else if (['in_transit', 'out_for_delivery', 'picked_up'].includes(shipment.status)) {
        summary.inTransitShipments++;
        summary.activeShipments++;
      } else if (shipment.status === 'failed') {
        summary.failedShipments++;
      } else if (shipment.status === 'booked') {
        summary.activeShipments++;
      }
    });
  }
  
  return summary;
};

// Ensure virtuals are included in JSON
orderSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;
    return ret;
  }
});
orderSchema.set('toObject', { virtuals: true });

export default mongoose.model('Order', orderSchema);