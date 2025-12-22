// routes/shippingRoutes.js - UPDATED & FIXED
import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import nimbuspostService from '../services/nimbuspostService.js';

const router = express.Router();

// ✅ GET SHIPMENT TRACKING (for buyers and sellers)
router.get('/track/:orderId', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;
    
    // Find order (either buyer or seller)
    const order = await Order.findOne({
      _id: orderId,
      $or: [
        { user: userId },  // Buyer
        { seller: userId } // Seller
      ]
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not authorized'
      });
    }
    
    // Check if we have shipments
    if (!order.nimbuspostShipments || order.nimbuspostShipments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Shipping not initiated for this order'
      });
    }
    
    // Get tracking for each AWB
    const trackingPromises = [];
    for (const shipment of order.nimbuspostShipments) {
      if (shipment.awbNumber) {
        trackingPromises.push(
          nimbuspostService.trackShipment(shipment.awbNumber)
            .then(trackingData => ({
              productId: shipment.productId,
              awbNumber: shipment.awbNumber,
              status: shipment.status,
              tracking: trackingData
            }))
            .catch(error => ({
              productId: shipment.productId,
              awbNumber: shipment.awbNumber,
              error: error.message
            }))
        );
      }
    }
    
    const trackingResults = await Promise.allSettled(trackingPromises);
    
    res.json({
      success: true,
      orderId: order._id,
      orderStatus: order.status,
      shippingLegs: order.shippingLegs || [],
      shipments: order.nimbuspostShipments.map(shipment => ({
        productId: shipment.productId,
        awbNumber: shipment.awbNumber,
        labelUrl: shipment.labelUrl,
        trackingUrl: shipment.trackingUrl,
        status: shipment.status,
        courierName: shipment.courierName,
        createdAt: shipment.createdAt
      })),
      liveTracking: trackingResults
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value)
    });
    
  } catch (error) {
    console.error('Tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Tracking failed: ' + error.message
    });
  }
});

// ✅ UPDATE SHIPPING STATUS (for admin/seller)
router.put('/update-status/:orderId', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, leg, notes } = req.body;
    const userId = req.user.userId;
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    // Check if user is seller or admin
    const user = await User.findById(userId);
    const isSeller = order.seller && order.seller.toString() === userId;
    const isAdmin = user.role === 'admin';
    
    if (!isSeller && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to update shipping' 
      });
    }
    
    // Update shipping legs
    if (leg === 'seller_to_warehouse') {
      // Check if leg already exists
      let legIndex = order.shippingLegs.findIndex(l => l.leg === 'seller_to_warehouse');
      
      if (legIndex === -1) {
        order.shippingLegs.push({
          leg: 'seller_to_warehouse',
          status: status || 'in_transit',
          awbNumbers: order.nimbuspostShipments?.map(s => s.awbNumber).filter(Boolean),
          startedAt: new Date(),
          notes: notes || 'Pickup completed from seller'
        });
      } else {
        order.shippingLegs[legIndex].status = status || 'in_transit';
        order.shippingLegs[legIndex].completedAt = new Date();
        order.shippingLegs[legIndex].notes = notes;
      }
      
      // Update products shipping status
      await Product.updateMany(
        { _id: { $in: order.products } },
        { 
          $set: { 
            shippingStatus: 'shipped', 
            shippedAt: new Date() 
          } 
        }
      );
      
      // Update NimbusPost shipments status
      if (order.nimbuspostShipments) {
        order.nimbuspostShipments = order.nimbuspostShipments.map(shipment => ({
          ...shipment,
          status: 'in_transit',
          pickedUpAt: new Date()
        }));
      }
      
    } else if (leg === 'warehouse_to_buyer') {
      // Mark as shipped from warehouse to buyer
      order.shippingLegs.push({
        leg: 'warehouse_to_buyer',
        status: status || 'in_transit',
        awbNumbers: order.nimbuspostShipments?.map(s => s.awbNumber).filter(Boolean),
        startedAt: new Date(),
        notes: notes || 'Shipped from warehouse to buyer'
      });
      
      // Update order status
      order.status = 'shipped';
      order.shippedAt = new Date();
      
    } else if (leg === 'delivered') {
      // Mark as delivered
      const warehouseLegIndex = order.shippingLegs.findIndex(l => l.leg === 'warehouse_to_buyer');
      
      if (warehouseLegIndex !== -1) {
        order.shippingLegs[warehouseLegIndex].status = 'delivered';
        order.shippingLegs[warehouseLegIndex].completedAt = new Date();
        order.shippingLegs[warehouseLegIndex].notes = notes || 'Delivered to buyer';
      } else {
        order.shippingLegs.push({
          leg: 'warehouse_to_buyer',
          status: 'delivered',
          completedAt: new Date(),
          notes: notes || 'Delivered to buyer'
        });
      }
      
      // Update order status
      order.status = 'delivered';
      order.deliveredAt = new Date();
      
      // Update products as delivered
      await Product.updateMany(
        { _id: { $in: order.products } },
        { 
          $set: { 
            shippingStatus: 'delivered', 
            deliveredAt: new Date() 
          } 
        }
      );
      
      // Update all NimbusPost shipments status
      if (order.nimbuspostShipments) {
        order.nimbuspostShipments = order.nimbuspostShipments.map(shipment => ({
          ...shipment,
          status: 'delivered',
          deliveredAt: new Date()
        }));
      }
    }
    
    await order.save();
    
    res.json({
      success: true,
      message: `Shipping status updated to ${status || 'updated'}`,
      order: {
        id: order._id,
        status: order.status,
        shippingLegs: order.shippingLegs,
        shipments: order.nimbuspostShipments
      }
    });
    
  } catch (error) {
    console.error('Update shipping error:', error);
    res.status(500).json({
      success: false,
      message: 'Update failed: ' + error.message
    });
  }
});

// ✅ GET ORDER SHIPPING DETAILS
router.get('/details/:orderId', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;
    
    const order = await Order.findOne({
      _id: orderId,
      $or: [{ user: userId }, { seller: userId }]
    })
    .populate('products', 'productName images finalPrice brand')
    .populate('buyer', 'name phone address')
    .populate('seller', 'name phone address username');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      order: {
        id: order._id,
        status: order.status,
        totalAmount: order.totalAmount,
        paidAt: order.paidAt,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        
        // Shipping info
        shippingLegs: order.shippingLegs,
        shipments: order.nimbuspostShipments,
        
        // Buyer info
        buyer: order.buyer,
        
        // Seller info
        seller: order.seller,
        
        // Products
        products: order.products,
        
        // Address
        shippingAddress: order.shippingAddress
      }
    });
    
  } catch (error) {
    console.error('Shipping details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get shipping details: ' + error.message
    });
  }
});

export default router;