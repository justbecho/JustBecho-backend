// services/warehouseAutomation.js - B2C AUTO-FORWARD
import nimbuspostService from './nimbuspostService.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';

class WarehouseAutomation {
  constructor() {
    this.WAREHOUSE_DETAILS = nimbuspostService.getWarehouseInfo();
    this.monitoringInterval = null;
  }
  
  // ✅ MONITOR B2C INCOMING SHIPMENTS
  async monitorB2CIncomingShipments() {
    try {
      // Find orders with B2C incoming shipments at warehouse
      const orders = await Order.find({
        'nimbuspostShipments.shipmentType': 'seller_to_warehouse',
        'nimbuspostShipments.shipmentMode': 'B2C',
        'nimbuspostShipments.status': { $ne: 'cancelled' },
        'shippingLegs': {
          $elemMatch: {
            leg: 'seller_to_warehouse',
            status: { $in: ['pending', 'in_transit'] }
          }
        },
        'shippingLegs': {
          $not: {
            $elemMatch: {
              leg: 'warehouse_to_buyer',
              status: { $in: ['completed', 'in_transit'] }
            }
          }
        }
      })
      .populate('buyer')
      .populate('products');
      
      console.log(`🔍 Monitoring ${orders.length} B2C incoming shipments...`);
      
      let forwardedCount = 0;
      
      for (const order of orders) {
        try {
          // Get incoming B2C shipments
          const incomingShipments = order.nimbuspostShipments?.filter(
            s => s.shipmentType === 'seller_to_warehouse' && 
                 s.shipmentMode === 'B2C' && 
                 !s.error
          );
          
          for (const incoming of incomingShipments) {
            // Check if already forwarded
            const alreadyForwarded = order.nimbuspostShipments?.some(
              s => s.shipmentType === 'warehouse_to_buyer' && 
                   s.productId?.toString() === incoming.productId?.toString()
            );
            
            if (alreadyForwarded) {
              continue;
            }
            
            // Check delivery status
            const deliveryStatus = await nimbuspostService.isB2CShipmentDelivered(incoming.awbNumber);
            
            if (deliveryStatus.delivered) {
              console.log(`✅ AWB ${incoming.awbNumber} delivered to warehouse, auto-forwarding...`);
              
              // Get product data
              const product = order.products?.find(p => 
                p._id.toString() === incoming.productId?.toString()
              );
              
              if (!product) continue;
              
              // Get buyer data
              const buyerData = {
                name: order.buyer?.name || order.shippingAddress?.name,
                phone: order.buyer?.phone || order.shippingAddress?.phone,
                email: order.buyer?.email,
                address: order.shippingAddress || order.buyer?.address,
                pincode: order.shippingAddress?.pincode
              };
              
              // Create B2C: Warehouse → Buyer
              const outgoingResult = await nimbuspostService.createWarehouseToBuyerB2C(
                {
                  orderId: `JB-OUT-${order._id}-${product._id}`,
                  totalAmount: product.finalPrice || 0
                },
                {
                  productName: product.productName,
                  price: product.finalPrice || 0,
                  weight: product.weight || 500,
                  dimensions: product.dimensions,
                  productId: product._id
                },
                buyerData
              );
              
              if (outgoingResult.success) {
                // Update order with outgoing shipment
                order.nimbuspostShipments.push({
                  productId: product._id,
                  awbNumber: outgoingResult.awbNumber,
                  shipmentId: outgoingResult.shipmentId,
                  shipmentMode: 'B2C',
                  shipmentType: 'warehouse_to_buyer',
                  status: 'booked',
                  createdAt: new Date(),
                  trackingUrl: outgoingResult.trackingUrl,
                  labelUrl: outgoingResult.labelUrl,
                  courierName: outgoingResult.courierName,
                  shipmentDetails: {
                    weight: product.weight || 500,
                    charges: outgoingResult.charges || { freight: 0, total: 0 },
                    estimatedDelivery: outgoingResult.estimatedDelivery
                  },
                  notes: 'Auto-created B2C from warehouse',
                  direction: 'outgoing',
                  parentAWB: incoming.awbNumber,
                  warehouseDetails: this.WAREHOUSE_DETAILS
                });
                
                // Update shipping legs
                const warehouseLeg = order.shippingLegs?.find(l => l.leg === 'seller_to_warehouse');
                if (warehouseLeg) {
                  warehouseLeg.status = 'completed';
                  warehouseLeg.completedAt = new Date();
                }
                
                // Add warehouse_to_buyer leg
                order.shippingLegs.push({
                  leg: 'warehouse_to_buyer',
                  awbNumbers: [outgoingResult.awbNumber],
                  status: 'pending',
                  startedAt: new Date(),
                  courierName: outgoingResult.courierName,
                  notes: 'Auto-forwarded from warehouse'
                });
                
                // Update order status
                order.status = 'processing';
                
                // Add timeline
                order.timeline = order.timeline || [];
                order.timeline.push({
                  event: 'auto_forwarded',
                  description: `Auto-forwarded from warehouse to buyer: ${outgoingResult.awbNumber}`,
                  status: 'forwarded',
                  timestamp: new Date(),
                  metadata: {
                    incomingAWB: incoming.awbNumber,
                    outgoingAWB: outgoingResult.awbNumber,
                    productId: product._id
                  }
                });
                
                await order.save();
                forwardedCount++;
                
                console.log(`✅ Auto-forwarded: ${incoming.awbNumber} → ${outgoingResult.awbNumber}`);
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error processing order ${order._id}:`, error.message);
        }
      }
      
      return {
        checked: orders.length,
        forwarded: forwardedCount,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('❌ B2C monitoring error:', error);
      throw error;
    }
  }
  
  // ✅ START B2C MONITORING
  startB2CMonitoring(intervalMinutes = 15) {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.monitoringInterval = setInterval(async () => {
      console.log('🔄 Running B2C warehouse monitoring...');
      try {
        const result = await this.monitorB2CIncomingShipments();
        console.log(`📊 B2C Monitoring: ${result.forwarded} shipments auto-forwarded`);
      } catch (error) {
        console.error('❌ B2C monitoring job error:', error);
      }
    }, intervalMinutes * 60 * 1000);
    
    console.log(`🚀 B2C Warehouse monitoring started (every ${intervalMinutes} minutes)`);
    
    // Run immediately
    this.monitorB2CIncomingShipments();
  }
}

export default new WarehouseAutomation();