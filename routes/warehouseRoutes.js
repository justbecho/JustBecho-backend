// routes/warehouseRoutes.js - MANAGE AUTOMATION
import express from 'express';
import warehouseAutomation from '../services/warehouseAutomation.js';
import Order from '../models/Order.js';

const router = express.Router();

// ✅ TRIGGER OUTGOING SHIPMENT MANUALLY
router.post('/forward/:awb', async (req, res) => {
  try {
    const { awb } = req.params;
    
    console.log(`🚀 Manually triggering forwarding for AWB: ${awb}`);
    
    const result = await warehouseAutomation.autoCreateOutgoingShipment(awb);
    
    if (result) {
      res.json({
        success: true,
        message: 'Outgoing shipment created!',
        incomingAWB: awb,
        outgoingAWB: result.awbNumber,
        trackingUrl: result.trackingUrl
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Incoming shipment not delivered yet or already forwarded'
      });
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ MANUAL FORWARD ALL (Admin only)
router.post('/forward-all', async (req, res) => {
  try {
    const result = await warehouseAutomation.monitorAllIncomingShipments();
    
    res.json({
      success: true,
      message: `Processed ${result.processed} incoming shipments`,
      ...result
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ GET WAREHOUSE DASHBOARD
router.get('/dashboard', async (req, res) => {
  try {
    // Orders at warehouse
    const incomingOrders = await Order.find({
      'shippingLegs': {
        $elemMatch: {
          leg: 'seller_to_warehouse',
          status: 'completed'
        }
      },
      'shippingLegs': {
        $not: {
          $elemMatch: {
            leg: 'warehouse_to_buyer',
            status: { $in: ['pending', 'in_transit', 'completed'] }
          }
        }
      }
    })
    .populate('buyer', 'name')
    .populate('products', 'productName images')
    .sort({ updatedAt: -1 });
    
    // Recently forwarded
    const forwardedOrders = await Order.find({
      'shippingLegs': {
        $elemMatch: {
          leg: 'warehouse_to_buyer',
          status: 'pending'
        }
      }
    })
    .populate('buyer', 'name')
    .sort({ updatedAt: -1 })
    .limit(10);
    
    res.json({
      success: true,
      dashboard: {
        warehouseName: "JustBecho Warehouse, Indore",
        address: "103 Dilpasand grand, Behind Rafael tower, Indore, MP - 452001",
        contact: "Devansh Kothari - 9301847748",
        stats: {
          atWarehouse: incomingOrders.length,
          pendingForward: incomingOrders.filter(o => 
            !o.nimbuspostShipments.some(s => s.shipmentType === 'outgoing')
          ).length,
          forwardedToday: forwardedOrders.length,
          totalProcessed: forwardedOrders.length
        },
        incomingOrders: incomingOrders.map(order => ({
          orderId: order._id,
          buyer: order.buyer?.name,
          products: order.products?.map(p => p.productName),
          incomingAWB: order.nimbuspostShipments
            .filter(s => s.shipmentType === 'incoming')
            .map(s => s.awbNumber),
          arrivedAt: order.shippingLegs
            .find(l => l.leg === 'seller_to_warehouse')?.completedAt,
          status: 'at_warehouse'
        })),
        recentlyForwarded: forwardedOrders.map(order => ({
          orderId: order._id,
          buyer: order.buyer?.name,
          outgoingAWB: order.nimbuspostShipments
            .filter(s => s.shipmentType === 'outgoing')
            .map(s => s.awbNumber),
          forwardedAt: order.shippingLegs
            .find(l => l.leg === 'warehouse_to_buyer')?.startedAt
        }))
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;