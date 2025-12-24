// routes/razorpayVerify.js - COMPLETE B2C WAREHOUSE FLOW
import express from 'express';
import crypto from 'crypto';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import nimbuspostService from '../services/nimbuspostService.js';
import warehouseAutomation from '../services/warehouseAutomation.js';

const router = express.Router();

// ✅ VERIFY PAYMENT & CREATE B2C WAREHOUSE FLOW SHIPMENTS
router.post('/verify-payment', async (req, res) => {
  console.log('🔐 [RAZORPAY] Payment verification with B2C warehouse flow...');
  
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // ✅ 1. VALIDATE INPUT
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification data'
      });
    }

    // ✅ 2. SIGNATURE VERIFICATION
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_LIVE_SECRET_KEY)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    console.log('✅ Payment signature verified');

    // ✅ 3. FIND ORDER
    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id })
      .populate('user', 'name email phone address city state pincode')
      .populate('cart');
    
    if (!order) {
      console.error('❌ Order not found for Razorpay ID:', razorpay_order_id);
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    console.log('✅ Order found:', order._id);

    // ✅ 4. CHECK IF ORDER ALREADY PAID
    if (order.status === 'paid' || order.razorpayPaymentId) {
      console.log('⚠️ Order already marked as paid');
      return res.json({
        success: true,
        message: 'Payment already verified for this order',
        orderId: order._id,
        paymentId: razorpay_payment_id
      });
    }

    // ✅ 5. GET CART ITEMS WITH PRODUCT DETAILS
    const cart = await Cart.findById(order.cart)
      .populate({
        path: 'items.product',
        select: 'productName finalPrice brand condition images seller weight dimensions isReturnable shippingMethod'
      });
    
    if (!cart) {
      console.error('❌ Cart not found:', order.cart);
      return res.status(400).json({ 
        success: false, 
        message: 'Cart not found' 
      });
    }

    console.log('🛒 Cart items:', cart.items?.length || 0);

    // ✅ 6. UPDATE PRODUCTS TO "SOLD"
    const productUpdates = [];
    const sellerMap = new Map();
    
    for (const item of cart.items) {
      if (item.product && item.product._id) {
        const productId = item.product._id;
        const sellerId = item.product.seller;
        
        // Update product status
        await Product.findByIdAndUpdate(productId, {
          status: 'sold',
          soldAt: new Date(),
          soldTo: order.user,
          order: order._id,
          shippingStatus: 'pending',
          warehouseFlow: true
        });
        
        productUpdates.push(productId);
        
        // Group products by seller
        if (sellerId) {
          const sellerIdStr = sellerId.toString();
          if (!sellerMap.has(sellerIdStr)) {
            const seller = await User.findById(sellerId);
            sellerMap.set(sellerIdStr, {
              sellerData: seller,
              products: []
            });
          }
          sellerMap.get(sellerIdStr).products.push({
            productId: productId,
            productData: item.product,
            quantity: item.quantity || 1,
            price: item.price || item.product.finalPrice || 0
          });
        }
      }
    }
    
    console.log(`📦 Updated ${productUpdates.length} products to SOLD`);
    console.log(`👨‍💼 Found ${sellerMap.size} sellers`);

    // ✅ 7. UPDATE ORDER WITH PAYMENT INFO
    order.status = 'paid';
    order.razorpayPaymentId = razorpay_payment_id;
    order.paidAt = new Date();
    order.buyer = order.user;
    order.products = productUpdates;
    
    // Update metadata for B2C warehouse flow
    order.metadata = order.metadata || {};
    order.metadata.shipmentMode = 'B2C_WAREHOUSE';
    order.metadata.autoForwardEnabled = true;
    order.metadata.shippingFlow = 'seller_to_warehouse_to_buyer';
    order.metadata.warehouse = nimbuspostService.getWarehouseInfo();
    
    // Add seller if only one seller
    const sellerIds = Array.from(sellerMap.keys());
    if (sellerIds.length === 1) {
      order.seller = sellerIds[0];
    }

    // ✅ 8. CREATE B2C SHIPMENTS: SELLER → WAREHOUSE (FIRST LEG)
    const nimbusShipments = [];
    const createdAWBs = [];
    let flowType = 'B2C via Warehouse';
    
    for (const [sellerId, sellerInfo] of sellerMap) {
      const seller = sellerInfo.sellerData;
      const buyer = await User.findById(order.user);
      
      for (const product of sellerInfo.products) {
        try {
          console.log(`🏭 Creating B2C shipment: Seller → Warehouse for product: ${product.productId}`);
          
          const shipmentData = {
            orderData: {
              orderId: `JB-IN-${order._id.toString().substr(-6)}-${product.productId.toString().substr(-6)}`,
              totalAmount: product.price * product.quantity
            },
            productData: {
              productName: product.productData.productName || 'Product',
              price: product.price || 0,
              weight: product.productData.weight || 500,
              dimensions: product.productData.dimensions || { length: 20, breadth: 15, height: 10 },
              quantity: product.quantity || 1,
              productId: product.productId
            },
            sellerData: {
              name: seller?.name || 'Seller',
              phone: seller?.phone || '9876543210',
              email: seller?.email || '',
              address: seller?.address || {
                street: 'Seller address not provided',
                city: 'City',
                state: 'State',
                pincode: '110001'
              }
            },
            buyerData: {
              name: buyer?.name || order.shippingAddress?.name || 'Customer',
              phone: buyer?.phone || order.shippingAddress?.phone || '9876543210',
              email: buyer?.email || '',
              address: order.shippingAddress || buyer?.address || {
                street: 'Address not provided',
                city: 'City',
                state: 'State',
                pincode: '110001'
              }
            }
          };
          
          // ✅ CREATE B2C SHIPMENT: SELLER → WAREHOUSE
          const incomingResult = await nimbuspostService.createSellerToWarehouseB2C(
            shipmentData.orderData,
            shipmentData.productData,
            shipmentData.sellerData
          );
          
          if (incomingResult.success) {
            createdAWBs.push({
              awb: incomingResult.awbNumber,
              productId: product.productId,
              type: 'B2C Seller→Warehouse',
              direction: 'incoming'
            });
            
            nimbusShipments.push({
              productId: product.productId,
              awbNumber: incomingResult.awbNumber,
              shipmentId: incomingResult.shipmentId,
              shipmentMode: 'B2C',
              shipmentType: 'seller_to_warehouse',
              status: 'booked',
              createdAt: new Date(),
              trackingUrl: incomingResult.trackingUrl,
              labelUrl: incomingResult.labelUrl,
              courierName: incomingResult.courierName,
              courierId: incomingResult.courierId,
              shipmentDetails: {
                weight: shipmentData.productData.weight,
                dimensions: shipmentData.productData.dimensions,
                charges: incomingResult.charges || { freight: 0, cod: 0, total: 0 },
                estimatedDelivery: incomingResult.estimatedDelivery
              },
              notes: 'B2C shipment from seller to warehouse',
              direction: 'incoming',
              warehouseDetails: nimbuspostService.getWarehouseInfo(),
              isMock: incomingResult.isMock || false
            });
            
            console.log(`✅ B2C Seller→Warehouse created: ${incomingResult.awbNumber} via ${incomingResult.courierName}`);
            
            // Add tracking job for auto-forwarding
            order.metadata.trackingJobs = order.metadata.trackingJobs || [];
            order.metadata.trackingJobs.push({
              incomingAWB: incomingResult.awbNumber,
              productId: product.productId,
              productData: product.productData,
              buyerData: shipmentData.buyerData,
              scheduledAt: new Date(),
              checkedAt: new Date(),
              status: 'monitoring',
              attemptCount: 0,
              maxAttempts: 48 // Check every 30 mins for 24 hours
            });
            
            // Update shipping legs
            if (!order.shippingLegs) {
              order.shippingLegs = [];
            }
            
            // Check if seller_to_warehouse leg already exists
            let warehouseLeg = order.shippingLegs.find(l => l.leg === 'seller_to_warehouse');
            if (!warehouseLeg) {
              order.shippingLegs.push({
                leg: 'seller_to_warehouse',
                awbNumbers: [incomingResult.awbNumber],
                status: 'pending',
                startedAt: new Date(),
                courierName: incomingResult.courierName,
                notes: 'B2C shipment to warehouse',
                estimatedArrival: incomingResult.estimatedDelivery
              });
            } else {
              warehouseLeg.awbNumbers.push(incomingResult.awbNumber);
            }
            
            // Update order status
            order.status = 'processing';
            
            // Add to timeline
            order.timeline = order.timeline || [];
            order.timeline.push({
              event: 'shipment_created',
              description: `B2C Seller→Warehouse shipment created: ${incomingResult.awbNumber}`,
              status: 'booked',
              timestamp: new Date(),
              metadata: {
                productId: product.productId,
                awbNumber: incomingResult.awbNumber,
                courier: incomingResult.courierName,
                warehouse: nimbuspostService.getWarehouseInfo()
              }
            });
            
          } else {
            throw new Error('B2C Seller→Warehouse shipment creation failed');
          }
          
        } catch (shipmentError) {
          console.error(`❌ B2C Seller→Warehouse Shipment failed for product ${product.productId}:`, shipmentError.message);
          
          nimbusShipments.push({
            productId: product.productId,
            error: shipmentError.message,
            status: 'failed',
            createdAt: new Date(),
            notes: `B2C Seller→Warehouse failed: ${shipmentError.message}`,
            isMock: false
          });
          
          // Add error to timeline
          order.timeline = order.timeline || [];
          order.timeline.push({
            event: 'shipment_failed',
            description: `B2C Seller→Warehouse failed for product ${product.productId}`,
            status: 'failed',
            timestamp: new Date(),
            metadata: {
              productId: product.productId,
              error: shipmentError.message
            }
          });
        }
      }
    }
    
    console.log(`📊 B2C Shipment results: ${createdAWBs.length} Seller→Warehouse shipments created`);

    // ✅ 9. SAVE NIMBUSPOST SHIPMENTS TO ORDER
    order.nimbuspostShipments = nimbusShipments;
    
    // ✅ 10. UPDATE ORDER TIMELINE
    order.timeline = order.timeline || [];
    order.timeline.push({
      event: 'payment_verified',
      description: `Payment verified and ${createdAWBs.length} B2C warehouse shipments created`,
      status: 'paid',
      timestamp: new Date(),
      metadata: {
        paymentId: razorpay_payment_id,
        shipmentsCreated: createdAWBs.length,
        shipmentMode: 'B2C_WAREHOUSE',
        flowType: flowType
      }
    });
    
    // ✅ 11. SAVE ORDER
    await order.save({ validateBeforeSave: false });
    console.log('✅ Order saved with B2C warehouse shipments');

    // ✅ 12. UPDATE SELLER STATS
    for (const [sellerId, sellerInfo] of sellerMap) {
      const productsSold = sellerInfo.products.length;
      const totalRevenue = sellerInfo.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
      
      await User.findByIdAndUpdate(sellerId, {
        $addToSet: { 
          soldProducts: { $each: sellerInfo.products.map(p => p.productId) } 
        },
        $inc: { 
          totalSales: productsSold,
          totalRevenue: totalRevenue
        },
        lastSaleAt: new Date(),
        $set: {
          warehouseFlowEnabled: true
        }
      });
    }
    
    // ✅ 13. UPDATE BUYER STATS
    await User.findByIdAndUpdate(order.user, {
      $addToSet: { orders: order._id },
      $inc: { totalOrders: 1 },
      lastOrderAt: new Date()
    });

    // ✅ 14. CLEAR CART
    await Cart.findOneAndUpdate(
      { user: order.user },
      { 
        items: [], 
        subtotal: 0, 
        bechoProtectTotal: 0,
        totalItems: 0,
        lastClearedAt: new Date()
      }
    );

    // ✅ 15. START WAREHOUSE AUTOMATION MONITORING
    warehouseAutomation.startB2CMonitoring(15); // Check every 15 minutes
    console.log('🚀 B2C warehouse automation monitoring started');

    // ✅ 16. PREPARE RESPONSE
    const responseData = {
      success: true,
      message: `🎉 Payment verified & ${createdAWBs.length} B2C warehouse shipments created!`,
      orderId: order._id.toString(),
      paymentId: razorpay_payment_id,
      shipmentMode: 'B2C_WAREHOUSE',
      flowType: flowType,
      orderDetails: {
        totalAmount: order.totalAmount,
        status: order.status,
        itemsCount: productUpdates.length,
        paidAt: order.paidAt,
        shipmentCount: createdAWBs.length,
        orderId: order._id
      },
      shipments: createdAWBs.map(item => {
        const shipment = nimbusShipments.find(s => 
          s.productId.toString() === item.productId.toString() && 
          s.awbNumber === item.awb
        );
        return {
          awbNumber: item.awb,
          productId: item.productId,
          type: item.type,
          direction: item.direction,
          shipmentMode: 'B2C',
          courier: shipment?.courierName,
          trackingUrl: shipment?.trackingUrl,
          status: shipment?.status || 'booked',
          labelUrl: shipment?.labelUrl,
          estimatedDelivery: shipment?.shipmentDetails?.estimatedDelivery,
          warehouse: shipment?.warehouseDetails
        };
      }),
      automation: {
        flow: 'B2C via Warehouse',
        currentStep: 'Step 1: Seller → Warehouse',
        nextStep: 'Auto-forward to buyer when delivered',
        steps: [
          '✅ Step 1: Payment verified',
          '✅ Step 2: B2C Seller→Warehouse shipments created',
          '🏭 Step 3: Products shipping to JustBecho Warehouse',
          '🔍 Step 4: System monitoring delivery status',
          '🔄 Step 5: Auto-create B2C Warehouse→Buyer when delivered',
          '🚚 Step 6: Final delivery to your address'
        ],
        warehouse: nimbuspostService.getWarehouseInfo(),
        monitoring: {
          status: 'active',
          interval: '15 minutes',
          autoForward: 'enabled'
        }
      },
      instructions: [
        '📦 Your products are being shipped to JustBecho Warehouse first',
        '🔍 We will verify the products at warehouse',
        '🔄 Then automatically forward to your address',
        '📱 Track both shipments using provided tracking links',
        '⏱️ Estimated total delivery time: 5-8 business days'
      ],
      trackingInfo: {
        warehouseAddress: nimbuspostService.getWarehouseInfo(),
        contact: {
          name: 'Devansh Kothari',
          phone: '9301847748',
          email: 'warehouse@justbecho.com'
        },
        support: 'For any queries, contact warehouse team'
      }
    };
    
    // Add warnings if any shipments failed
    const failedShipments = nimbusShipments.filter(s => s.error);
    if (failedShipments.length > 0) {
      responseData.warnings = failedShipments.map(s => ({
        productId: s.productId,
        error: s.error,
        note: 'Contact support for manual shipment creation'
      }));
      responseData.message += ` (${failedShipments.length} shipments failed)`;
    }
    
    console.log('✅ Payment verification COMPLETE with B2C warehouse flow');
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Verification error:', error.message);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Payment verification failed: ' + error.message,
      errorType: error.name,
      troubleshooting: [
        'Check Razorpay keys configuration',
        'Verify NimbusPost API connection',
        'Ensure order exists in database',
        'Check cart items availability'
      ],
      ...(process.env.NODE_ENV === 'development' && { 
        stack: error.stack 
      })
    });
  }
});

// ✅ B2C SHIPMENT WEBHOOK (For both legs)
router.post('/b2c-webhook', express.json(), async (req, res) => {
  try {
    const { event, data, timestamp } = req.body;
    
    console.log('🔔 [B2C WEBHOOK] Received:', { event, timestamp });
    
    if (!data || !data.awb) {
      return res.status(400).json({ success: false, message: 'Invalid webhook data' });
    }
    
    const awbNumber = data.awb;
    
    // Find order with this AWB
    const order = await Order.findOne({
      'nimbuspostShipments.awbNumber': awbNumber
    });
    
    if (!order) {
      console.error(`❌ Order not found for AWB: ${awbNumber}`);
      return res.json({ success: false, message: 'Order not found' });
    }
    
    // Get the specific shipment
    const shipmentIndex = order.nimbuspostShipments.findIndex(s => s.awbNumber === awbNumber);
    if (shipmentIndex === -1) {
      return res.json({ success: false, message: 'Shipment not found in order' });
    }
    
    const shipment = order.nimbuspostShipments[shipmentIndex];
    
    // Update shipment status based on event
    let newStatus = 'booked';
    let orderStatus = order.status;
    let legStatus = null;
    
    switch (event) {
      case 'shipment_booked':
        newStatus = 'booked';
        break;
      case 'pickup_scheduled':
        newStatus = 'pickup_scheduled';
        break;
      case 'pickup_generated':
        newStatus = 'pickup_generated';
        break;
      case 'picked_up':
        newStatus = 'picked_up';
        legStatus = 'in_transit';
        break;
      case 'in_transit':
        newStatus = 'in_transit';
        legStatus = 'in_transit';
        break;
      case 'out_for_delivery':
        newStatus = 'out_for_delivery';
        orderStatus = 'out_for_delivery';
        legStatus = 'out_for_delivery';
        break;
      case 'delivered':
        newStatus = 'delivered';
        legStatus = 'completed';
        
        // If this is seller_to_warehouse shipment, trigger auto-forward
        if (shipment.shipmentType === 'seller_to_warehouse') {
          orderStatus = 'warehouse_received';
          
          // Trigger auto-forwarding
          try {
            const product = await Product.findById(shipment.productId);
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
                orderId: `JB-OUT-${order._id}-${shipment.productId}`,
                totalAmount: product?.finalPrice || 0
              },
              {
                productName: product?.productName || 'Product',
                price: product?.finalPrice || 0,
                weight: product?.weight || 500,
                dimensions: product?.dimensions,
                productId: shipment.productId
              },
              buyerData
            );
            
            if (outgoingResult.success) {
              // Add outgoing shipment to order
              order.nimbuspostShipments.push({
                productId: shipment.productId,
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
                  weight: product?.weight || 500,
                  charges: outgoingResult.charges || { freight: 0, total: 0 },
                  estimatedDelivery: outgoingResult.estimatedDelivery
                },
                notes: 'Auto-created B2C from warehouse',
                direction: 'outgoing',
                parentAWB: awbNumber,
                warehouseDetails: nimbuspostService.getWarehouseInfo()
              });
              
              // Update shipping legs
              const warehouseLeg = order.shippingLegs?.find(l => l.leg === 'seller_to_warehouse');
              if (warehouseLeg) {
                warehouseLeg.status = 'completed';
                warehouseLeg.completedAt = new Date();
                warehouseLeg.actualArrival = new Date();
              }
              
              // Add warehouse_to_buyer leg
              order.shippingLegs.push({
                leg: 'warehouse_to_buyer',
                awbNumbers: [outgoingResult.awbNumber],
                status: 'pending',
                startedAt: new Date(),
                courierName: outgoingResult.courierName,
                notes: 'Auto-forwarded from warehouse',
                parentAWB: awbNumber
              });
              
              order.status = 'forwarded';
              
              console.log(`🔄 Auto-forwarded: ${awbNumber} → ${outgoingResult.awbNumber}`);
            }
          } catch (forwardError) {
            console.error(`❌ Auto-forward failed for ${awbNumber}:`, forwardError.message);
          }
        } else if (shipment.shipmentType === 'warehouse_to_buyer') {
          // Final delivery to buyer
          orderStatus = 'delivered';
          order.deliveredAt = new Date();
        }
        break;
      case 'failed':
        newStatus = 'failed';
        break;
      case 'cancelled':
        newStatus = 'cancelled';
        orderStatus = 'cancelled';
        break;
      case 'rto':
        newStatus = 'rto';
        break;
      default:
        newStatus = data.status || 'booked';
    }
    
    // Update shipment status
    order.nimbuspostShipments[shipmentIndex].status = newStatus;
    
    // Update timestamps
    const now = new Date();
    if (newStatus === 'picked_up') {
      order.nimbuspostShipments[shipmentIndex].pickedUpAt = now;
    } else if (newStatus === 'in_transit') {
      order.nimbuspostShipments[shipmentIndex].inTransitAt = now;
    } else if (newStatus === 'out_for_delivery') {
      order.nimbuspostShipments[shipmentIndex].outForDeliveryAt = now;
      order.outForDeliveryAt = now;
    } else if (newStatus === 'delivered') {
      order.nimbuspostShipments[shipmentIndex].deliveredAt = now;
    }
    
    // Update shipment data from webhook
    if (data.courier_name) {
      order.nimbuspostShipments[shipmentIndex].courierName = data.courier_name;
    }
    if (data.tracking_url) {
      order.nimbuspostShipments[shipmentIndex].trackingUrl = data.tracking_url;
    }
    if (data.charges) {
      order.nimbuspostShipments[shipmentIndex].shipmentDetails = 
        order.nimbuspostShipments[shipmentIndex].shipmentDetails || {};
      order.nimbuspostShipments[shipmentIndex].shipmentDetails.charges = data.charges;
    }
    
    // Update order status
    order.status = orderStatus;
    
    // Update shipping leg status
    if (legStatus && order.shippingLegs) {
      const legType = shipment.shipmentType === 'seller_to_warehouse' ? 'seller_to_warehouse' : 
                     shipment.shipmentType === 'warehouse_to_buyer' ? 'warehouse_to_buyer' : null;
      
      if (legType) {
        const leg = order.shippingLegs.find(l => l.leg === legType && 
          l.awbNumbers && l.awbNumbers.includes(awbNumber));
        if (leg) {
          leg.status = legStatus;
          if (legStatus === 'completed') {
            leg.completedAt = now;
          }
        }
      }
    }
    
    // Add to timeline
    order.timeline = order.timeline || [];
    order.timeline.push({
      event: 'webhook_update',
      description: `${shipment.shipmentType} shipment ${awbNumber} updated to ${newStatus}`,
      status: newStatus,
      timestamp: now,
      metadata: {
        awbNumber,
        event,
        shipmentType: shipment.shipmentType,
        webhookData: data
      }
    });
    
    await order.save();
    
    console.log(`✅ [B2C WEBHOOK] Updated ${shipment.shipmentType} AWB ${awbNumber} to ${newStatus}`);
    
    res.json({ 
      success: true, 
      message: 'Webhook processed',
      awb: awbNumber,
      status: newStatus,
      shipmentType: shipment.shipmentType,
      orderId: order._id,
      orderStatus: order.status
    });
    
  } catch (error) {
    console.error('❌ B2C Webhook error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ GET ORDER STATUS WITH B2C SHIPMENTS
router.get('/order-status/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('buyer', 'name email phone address')
      .populate('seller', 'name email phone username')
      .populate('products', 'productName brand images finalPrice weight dimensions condition')
      .populate('user', 'name email phone');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Get live tracking for each B2C shipment
    const trackingPromises = [];
    if (order.nimbuspostShipments) {
      for (const shipment of order.nimbuspostShipments) {
        if (shipment.awbNumber && !shipment.error) {
          trackingPromises.push(
            nimbuspostService.trackB2CShipment(shipment.awbNumber)
              .then(trackingData => ({
                awbNumber: shipment.awbNumber,
                productId: shipment.productId,
                shipmentType: shipment.shipmentType,
                currentStatus: shipment.status,
                liveTracking: trackingData,
                courier: shipment.courierName
              }))
              .catch(error => ({
                awbNumber: shipment.awbNumber,
                error: error.message,
                shipmentType: shipment.shipmentType
              }))
          );
        }
      }
    }
    
    const trackingResults = await Promise.allSettled(trackingPromises);
    
    // Group shipments by type
    const incomingShipments = order.nimbuspostShipments?.filter(
      s => s.shipmentType === 'seller_to_warehouse'
    ) || [];
    
    const outgoingShipments = order.nimbuspostShipments?.filter(
      s => s.shipmentType === 'warehouse_to_buyer'
    ) || [];
    
    res.json({
      success: true,
      order: {
        id: order._id,
        buyer: order.buyer || order.user,
        seller: order.seller,
        totalAmount: order.totalAmount,
        status: order.status,
        paidAt: order.paidAt,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        
        // Shipping Information
        shipmentMode: order.metadata?.shipmentMode || 'B2C_WAREHOUSE',
        shippingFlow: order.metadata?.shippingFlow || 'seller_to_warehouse_to_buyer',
        shippingLegs: order.shippingLegs || [],
        shippingAddress: order.shippingAddress,
        
        // Shipments by type
        incomingShipments: incomingShipments,
        outgoingShipments: outgoingShipments,
        allShipments: order.nimbuspostShipments || [],
        
        // Products
        products: order.products,
        
        // Warehouse Info
        warehouse: order.metadata?.warehouse || nimbuspostService.getWarehouseInfo(),
        
        // Timeline
        timeline: order.timeline?.slice(-5) || [],
        
        // Live Tracking
        liveTracking: trackingResults
          .filter(result => result.status === 'fulfilled')
          .map(result => result.value),
        
        // Tracking Errors
        trackingErrors: trackingResults
          .filter(result => result.status === 'rejected')
          .map(result => result.reason)
      },
      
      // Summary
      summary: {
        totalProducts: order.products?.length || 0,
        totalShipments: order.nimbuspostShipments?.length || 0,
        incomingCount: incomingShipments.length,
        outgoingCount: outgoingShipments.length,
        deliveredCount: order.nimbuspostShipments?.filter(s => s.status === 'delivered').length || 0,
        inTransitCount: order.nimbuspostShipments?.filter(s => 
          ['picked_up', 'in_transit', 'out_for_delivery'].includes(s.status)
        ).length || 0
      }
    });
  } catch (error) {
    console.error('Order status error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ MANUAL CREATE B2C SHIPMENT (for admin/testing)
router.post('/create-b2c-shipment/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { productId, shipmentType } = req.body;
    
    const order = await Order.findById(orderId)
      .populate('buyer')
      .populate('seller')
      .populate('products');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const product = order.products.find(p => p._id.toString() === productId);
    const buyer = order.buyer || await User.findById(order.user);
    const seller = order.seller || await User.findById(order.seller);
    
    if (!product || !buyer || !seller) {
      return res.status(400).json({
        success: false,
        message: 'Product, buyer or seller not found'
      });
    }
    
    let result;
    const shipmentTypeToUse = shipmentType || 'seller_to_warehouse';
    
    if (shipmentTypeToUse === 'seller_to_warehouse') {
      // Create B2C: Seller → Warehouse
      result = await nimbuspostService.createSellerToWarehouseB2C(
        {
          orderId: `JB-IN-${orderId}-${productId}`,
          totalAmount: product.finalPrice || 0
        },
        {
          productName: product.productName,
          price: product.finalPrice || 0,
          weight: product.weight || 500,
          dimensions: product.dimensions,
          productId: productId
        },
        {
          name: seller.name || 'Seller',
          phone: seller.phone || '9876543210',
          email: seller.email || '',
          address: seller.address || 'Seller address',
          pincode: seller.pincode || '110001'
        }
      );
      
      if (result.success) {
        // Add shipment to order
        order.nimbuspostShipments.push({
          productId: productId,
          awbNumber: result.awbNumber,
          shipmentId: result.shipmentId,
          shipmentMode: 'B2C',
          shipmentType: 'seller_to_warehouse',
          status: 'booked',
          createdAt: new Date(),
          trackingUrl: result.trackingUrl,
          labelUrl: result.labelUrl,
          courierName: result.courierName,
          shipmentDetails: {
            weight: product.weight || 500,
            charges: result.charges || { freight: 0, total: 0 },
            estimatedDelivery: result.estimatedDelivery
          },
          notes: 'Manually created B2C shipment to warehouse',
          direction: 'incoming',
          warehouseDetails: nimbuspostService.getWarehouseInfo()
        });
        
        // Update shipping leg
        order.shippingLegs = order.shippingLegs || [];
        order.shippingLegs.push({
          leg: 'seller_to_warehouse',
          awbNumbers: [result.awbNumber],
          status: 'pending',
          startedAt: new Date(),
          courierName: result.courierName,
          notes: 'Manually created shipment'
        });
      }
      
    } else if (shipmentTypeToUse === 'warehouse_to_buyer') {
      // Create B2C: Warehouse → Buyer
      result = await nimbuspostService.createWarehouseToBuyerB2C(
        {
          orderId: `JB-OUT-${orderId}-${productId}`,
          totalAmount: product.finalPrice || 0
        },
        {
          productName: product.productName,
          price: product.finalPrice || 0,
          weight: product.weight || 500,
          dimensions: product.dimensions,
          productId: productId
        },
        {
          name: buyer.name || 'Customer',
          phone: buyer.phone || '9876543210',
          email: buyer.email || '',
          address: order.shippingAddress || buyer.address,
          pincode: order.shippingAddress?.pincode || '110001'
        }
      );
      
      if (result.success) {
        // Add shipment to order
        order.nimbuspostShipments.push({
          productId: productId,
          awbNumber: result.awbNumber,
          shipmentId: result.shipmentId,
          shipmentMode: 'B2C',
          shipmentType: 'warehouse_to_buyer',
          status: 'booked',
          createdAt: new Date(),
          trackingUrl: result.trackingUrl,
          labelUrl: result.labelUrl,
          courierName: result.courierName,
          shipmentDetails: {
            weight: product.weight || 500,
            charges: result.charges || { freight: 0, total: 0 },
            estimatedDelivery: result.estimatedDelivery
          },
          notes: 'Manually created B2C shipment from warehouse',
          direction: 'outgoing',
          warehouseDetails: nimbuspostService.getWarehouseInfo()
        });
        
        // Update shipping leg
        order.shippingLegs = order.shippingLegs || [];
        order.shippingLegs.push({
          leg: 'warehouse_to_buyer',
          awbNumbers: [result.awbNumber],
          status: 'pending',
          startedAt: new Date(),
          courierName: result.courierName,
          notes: 'Manually created shipment'
        });
      }
    }
    
    if (result.success) {
      await order.save();
      
      res.json({
        success: true,
        message: `B2C ${shipmentTypeToUse} shipment created successfully`,
        shipment: result,
        orderId: order._id,
        awbNumber: result.awbNumber,
        shipmentType: shipmentTypeToUse
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Failed to create B2C shipment'
      });
    }
    
  } catch (error) {
    console.error('Create B2C shipment error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ TEST B2C CONNECTION
router.get('/test-b2c-connection', async (req, res) => {
  try {
    const result = await nimbuspostService.testB2CConnection();
    
    res.json({
      success: result.success,
      message: result.message,
      details: result,
      warehouse: nimbuspostService.getWarehouseInfo(),
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ GET WAREHOUSE DASHBOARD
router.get('/warehouse-dashboard', async (req, res) => {
  try {
    // Orders with incoming shipments at warehouse
    const incomingOrders = await Order.find({
      'nimbuspostShipments.shipmentType': 'seller_to_warehouse',
      'nimbuspostShipments.shipmentMode': 'B2C',
      'nimbuspostShipments.status': { $nin: ['delivered', 'cancelled'] }
    })
    .populate('buyer', 'name')
    .populate('products', 'productName images')
    .sort({ createdAt: -1 })
    .limit(20);
    
    // Orders ready for forwarding
    const readyToForward = await Order.find({
      'nimbuspostShipments.shipmentType': 'seller_to_warehouse',
      'nimbuspostShipments.status': 'delivered',
      'nimbuspostShipments': {
        $not: {
          $elemMatch: {
            shipmentType: 'warehouse_to_buyer',
            status: { $nin: ['cancelled', 'failed'] }
          }
        }
      }
    })
    .populate('buyer', 'name')
    .populate('products', 'productName')
    .sort({ updatedAt: -1 })
    .limit(20);
    
    // Recently forwarded orders
    const forwardedOrders = await Order.find({
      'nimbuspostShipments.shipmentType': 'warehouse_to_buyer',
      'nimbuspostShipments.createdAt': {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    })
    .populate('buyer', 'name')
    .sort({ updatedAt: -1 })
    .limit(10);
    
    res.json({
      success: true,
      warehouse: nimbuspostService.getWarehouseInfo(),
      stats: {
        totalIncoming: incomingOrders.length,
        readyToForward: readyToForward.length,
        forwarded24h: forwardedOrders.length,
        automationStatus: 'active'
      },
      incomingOrders: incomingOrders.map(order => ({
        orderId: order._id,
        buyer: order.buyer?.name,
        products: order.products?.map(p => p.productName),
        shipments: order.nimbuspostShipments
          .filter(s => s.shipmentType === 'seller_to_warehouse')
          .map(s => ({
            awb: s.awbNumber,
            status: s.status,
            courier: s.courierName,
            tracking: s.trackingUrl
          })),
        createdAt: order.createdAt
      })),
      readyToForward: readyToForward.map(order => ({
        orderId: order._id,
        buyer: order.buyer?.name,
        products: order.products?.map(p => p.productName),
        deliveredAWBs: order.nimbuspostShipments
          .filter(s => s.shipmentType === 'seller_to_warehouse' && s.status === 'delivered')
          .map(s => s.awbNumber),
        deliveredAt: order.nimbuspostShipments
          .find(s => s.shipmentType === 'seller_to_warehouse' && s.status === 'delivered')
          ?.deliveredAt
      })),
      recentlyForwarded: forwardedOrders.map(order => ({
        orderId: order._id,
        buyer: order.buyer?.name,
        outgoingAWBs: order.nimbuspostShipments
          .filter(s => s.shipmentType === 'warehouse_to_buyer')
          .map(s => s.awbNumber),
        forwardedAt: order.nimbuspostShipments
          .find(s => s.shipmentType === 'warehouse_to_buyer')
          ?.createdAt
      }))
    });
    
  } catch (error) {
    console.error('Warehouse dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ MANUAL FORWARD FROM WAREHOUSE
router.post('/manual-forward/:orderId/:productId', async (req, res) => {
  try {
    const { orderId, productId } = req.params;
    
    const order = await Order.findById(orderId)
      .populate('buyer')
      .populate('products');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const product = order.products.find(p => p._id.toString() === productId);
    const buyer = order.buyer || await User.findById(order.user);
    
    if (!product || !buyer) {
      return res.status(400).json({
        success: false,
        message: 'Product or buyer not found'
      });
    }
    
    // Check if incoming shipment is delivered
    const incomingShipment = order.nimbuspostShipments.find(
      s => s.productId?.toString() === productId && 
           s.shipmentType === 'seller_to_warehouse'
    );
    
    if (!incomingShipment) {
      return res.status(400).json({
        success: false,
        message: 'No incoming shipment found for this product'
      });
    }
    
    if (incomingShipment.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: `Incoming shipment status is ${incomingShipment.status}, not delivered`
      });
    }
    
    // Check if already forwarded
    const alreadyForwarded = order.nimbuspostShipments.some(
      s => s.productId?.toString() === productId && 
           s.shipmentType === 'warehouse_to_buyer'
    );
    
    if (alreadyForwarded) {
      return res.status(400).json({
        success: false,
        message: 'Product already forwarded from warehouse'
      });
    }
    
    // Create B2C: Warehouse → Buyer
    const result = await nimbuspostService.createWarehouseToBuyerB2C(
      {
        orderId: `JB-OUT-MANUAL-${orderId}-${productId}`,
        totalAmount: product.finalPrice || 0
      },
      {
        productName: product.productName,
        price: product.finalPrice || 0,
        weight: product.weight || 500,
        dimensions: product.dimensions,
        productId: productId
      },
      {
        name: buyer.name || 'Customer',
        phone: buyer.phone || '9876543210',
        email: buyer.email || '',
        address: order.shippingAddress || buyer.address,
        pincode: order.shippingAddress?.pincode || '110001'
      }
    );
    
    if (result.success) {
      // Add outgoing shipment
      order.nimbuspostShipments.push({
        productId: productId,
        awbNumber: result.awbNumber,
        shipmentId: result.shipmentId,
        shipmentMode: 'B2C',
        shipmentType: 'warehouse_to_buyer',
        status: 'booked',
        createdAt: new Date(),
        trackingUrl: result.trackingUrl,
        labelUrl: result.labelUrl,
        courierName: result.courierName,
        shipmentDetails: {
          weight: product.weight || 500,
          charges: result.charges || { freight: 0, total: 0 },
          estimatedDelivery: result.estimatedDelivery
        },
        notes: 'Manually forwarded from warehouse',
        direction: 'outgoing',
        parentAWB: incomingShipment.awbNumber,
        warehouseDetails: nimbuspostService.getWarehouseInfo()
      });
      
      // Update shipping legs
      const warehouseLeg = order.shippingLegs.find(l => l.leg === 'seller_to_warehouse');
      if (warehouseLeg) {
        warehouseLeg.status = 'completed';
        warehouseLeg.completedAt = new Date();
      }
      
      order.shippingLegs.push({
        leg: 'warehouse_to_buyer',
        awbNumbers: [result.awbNumber],
        status: 'pending',
        startedAt: new Date(),
        courierName: result.courierName,
        notes: 'Manually forwarded',
        parentAWB: incomingShipment.awbNumber
      });
      
      order.status = 'forwarded';
      
      await order.save();
      
      res.json({
        success: true,
        message: 'Product manually forwarded from warehouse',
        incomingAWB: incomingShipment.awbNumber,
        outgoingAWB: result.awbNumber,
        orderId: order._id,
        productId: productId,
        trackingUrl: result.trackingUrl
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Forwarding failed'
      });
    }
    
  } catch (error) {
    console.error('Manual forward error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;