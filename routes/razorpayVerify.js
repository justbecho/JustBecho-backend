// routes/razorpayVerify.js - UPDATED FOR NEW NIMBUSPOST API
import express from 'express';
import crypto from 'crypto';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import nimbuspostService from '../services/nimbuspostService.js';
import warehouseAutomation from '../services/warehouseAutomation.js';

const router = express.Router();

// ✅ VERIFY PAYMENT & CREATE B2C SHIPMENTS
router.post('/verify-payment', async (req, res) => {
  console.log('🔐 [RAZORPAY] Payment verification with B2C warehouse flow...');
  
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Validate input
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification data'
      });
    }

    // Signature verification
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

    // Find order
    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id })
      .populate('user', 'name email phone address')
      .populate('cart');
    
    if (!order) {
      console.error('❌ Order not found for Razorpay ID:', razorpay_order_id);
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    console.log('✅ Order found:', order._id);

    // Check if order already paid
    if (order.status === 'paid' || order.razorpayPaymentId) {
      console.log('⚠️ Order already marked as paid');
      return res.json({
        success: true,
        message: 'Payment already verified for this order',
        orderId: order._id,
        paymentId: razorpay_payment_id
      });
    }

    // Get cart items
    const cart = await Cart.findById(order.cart)
      .populate({
        path: 'items.product',
        select: 'productName finalPrice brand condition images seller weight dimensions sellerAddress'
      });
    
    if (!cart) {
      console.error('❌ Cart not found:', order.cart);
      return res.status(400).json({ 
        success: false, 
        message: 'Cart not found' 
      });
    }

    console.log('🛒 Cart items:', cart.items?.length || 0);

    // Update products to "SOLD"
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
            const seller = await User.findById(sellerId).select('name email phone address');
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

    // Update order with payment info
    order.status = 'paid';
    order.razorpayPaymentId = razorpay_payment_id;
    order.paidAt = new Date();
    order.buyer = order.user;
    order.products = productUpdates;
    
    // B2C warehouse flow metadata
    order.metadata = order.metadata || {};
    order.metadata.shipmentMode = 'B2C_WAREHOUSE';
    order.metadata.autoForwardEnabled = true;
    order.metadata.shippingFlow = 'seller_to_warehouse_to_buyer';
    order.metadata.warehouse = nimbuspostService.getWarehouseInfo();

    // ✅ TEST NIMBUSPOST CONNECTION FIRST
    try {
      console.log('🔌 Testing NimbusPost connection before creating shipments...');
      const connectionTest = await nimbuspostService.testConnection();
      
      if (!connectionTest.success) {
        console.error('❌ NimbusPost connection test failed:', connectionTest.message);
        // Continue with mock shipments if API fails
      } else {
        console.log('✅ NimbusPost connection successful');
      }
    } catch (connectionError) {
      console.error('❌ NimbusPost connection error:', connectionError.message);
    }

    // Create B2C Shipments: Seller → Warehouse (First Leg)
    const nimbusShipments = [];
    const createdAWBs = [];
    
    for (const [sellerId, sellerInfo] of sellerMap) {
      const seller = sellerInfo.sellerData;
      
      for (const product of sellerInfo.products) {
        try {
          console.log(`🏭 Creating B2C shipment: Seller → Warehouse for product: ${product.productId}`);
          
          // ✅ UPDATED: Prepare shipment data for new API
          const shipmentData = {
            orderId: `${order._id.toString().substr(-6)}-${product.productId.toString().substr(-6)}`,
            totalAmount: product.price * product.quantity
          };
          
          // ✅ UPDATED: Prepare seller data with proper structure
          const sellerData = {
            name: seller?.name || 'Seller',
            phone: seller?.phone || '9876543210',
            email: seller?.email || 'seller@example.com',
            address: seller?.address || product.productData.sellerAddress || {
              street: 'Seller address not provided',
              city: 'City',
              state: 'State',
              pincode: '400001',
              landmark: ''
            },
            // Add coordinates for major cities
            latitude: '19.0760', // Mumbai coordinates
            longitude: '72.8777'
          };
          
          // Extract address components
          const sellerAddress = typeof sellerData.address === 'string' 
            ? { street: sellerData.address, city: 'Mumbai', state: 'Maharashtra', pincode: '400001' }
            : sellerData.address;
          
          // ✅ UPDATED: Call new API method
          const incomingResult = await nimbuspostService.createSellerToWarehouseB2C(
            shipmentData,
            {
              productName: product.productData.productName || 'Product',
              price: product.price || 0,
              weight: product.productData.weight || 500,
              dimensions: product.productData.dimensions || { length: 20, breadth: 15, height: 10 },
              quantity: product.quantity || 1,
              productId: product.productId
            },
            {
              name: sellerData.name,
              phone: sellerData.phone,
              email: sellerData.email,
              address: sellerAddress,
              latitude: sellerData.latitude,
              longitude: sellerData.longitude
            }
          );
          
          if (incomingResult.success) {
            createdAWBs.push({
              awb: incomingResult.awbNumber,
              productId: product.productId,
              type: 'B2C Seller→Warehouse',
              direction: 'incoming',
              courier: incomingResult.courierName,
              isMock: incomingResult.isMock || false
            });
            
            nimbusShipments.push({
              productId: product.productId,
              awbNumber: incomingResult.awbNumber,
              shipmentId: incomingResult.shipmentId,
              orderId: incomingResult.orderId,
              shipmentMode: 'B2C',
              shipmentType: 'seller_to_warehouse',
              status: incomingResult.status || 'booked',
              createdAt: new Date(),
              trackingUrl: incomingResult.trackingUrl,
              labelUrl: incomingResult.labelUrl,
              courierName: incomingResult.courierName,
              shipmentDetails: {
                weight: product.productData.weight || 500,
                charges: incomingResult.charges || { freight: 0, total: 0 },
                estimatedDelivery: incomingResult.estimatedDelivery
              },
              notes: incomingResult.isMock 
                ? 'MOCK: B2C shipment from seller to warehouse (API issue)' 
                : 'B2C shipment from seller to warehouse',
              direction: 'incoming',
              isMock: incomingResult.isMock || false,
              warehouseDetails: nimbuspostService.getWarehouseInfo()
            });
            
            console.log(`✅ ${incomingResult.isMock ? 'MOCK' : 'B2C'} Seller→Warehouse created: ${incomingResult.awbNumber} via ${incomingResult.courierName}`);
            
            // Add tracking job for auto-forwarding
            order.metadata.trackingJobs = order.metadata.trackingJobs || [];
            order.metadata.trackingJobs.push({
              incomingAWB: incomingResult.awbNumber,
              productId: product.productId,
              scheduledAt: new Date(),
              checkedAt: new Date(),
              status: 'monitoring',
              attemptCount: 0,
              isMock: incomingResult.isMock || false
            });
          } else {
            console.error(`❌ Failed to create shipment for product ${product.productId}`);
            // Add failed shipment record
            nimbusShipments.push({
              productId: product.productId,
              shipmentMode: 'B2C',
              shipmentType: 'seller_to_warehouse',
              status: 'failed',
              createdAt: new Date(),
              error: incomingResult.message || 'Shipment creation failed',
              isMock: false
            });
          }
        } catch (shipmentError) {
          console.error(`❌ B2C Seller→Warehouse Shipment failed:`, shipmentError.message);
          
          // Add error shipment record
          nimbusShipments.push({
            productId: product.productId,
            shipmentMode: 'B2C',
            shipmentType: 'seller_to_warehouse',
            status: 'failed',
            createdAt: new Date(),
            error: shipmentError.message,
            isMock: false,
            notes: 'Shipment creation error'
          });
        }
      }
    }
    
    // Save shipments to order
    order.nimbuspostShipments = nimbusShipments;
    
    // Update shipping legs
    if (createdAWBs.length > 0) {
      order.shippingLegs = [{
        leg: 'seller_to_warehouse',
        awbNumbers: createdAWBs.map(awb => awb.awb),
        status: 'pending',
        startedAt: new Date(),
        notes: createdAWBs.some(awb => awb.isMock) 
          ? 'MOCK B2C shipments to warehouse (API issue)' 
          : 'B2C shipments to warehouse'
      }];
    } else {
      order.shippingLegs = [{
        leg: 'seller_to_warehouse',
        status: 'failed',
        startedAt: new Date(),
        notes: 'No shipments created - check NimbusPost API'
      }];
    }
    
    // Save order
    await order.save({ validateBeforeSave: false });
    console.log('✅ Order saved with B2C warehouse shipments');

    // Start warehouse automation monitoring (only if we have real shipments)
    const hasRealShipments = createdAWBs.some(awb => !awb.isMock);
    if (hasRealShipments) {
      warehouseAutomation.startB2CMonitoring(15);
      console.log('🚀 B2C warehouse automation monitoring started');
    } else {
      console.log('⚠️ No real shipments created, skipping automation monitoring');
    }

    // Prepare response
    const successShipments = createdAWBs.filter(awb => awb.awb);
    const mockShipments = createdAWBs.filter(awb => awb.isMock);
    
    const responseData = {
      success: true,
      message: mockShipments.length > 0 
        ? `🎉 Payment verified! ${successShipments.length} real shipments + ${mockShipments.length} mock shipments created` 
        : `🎉 Payment verified & ${successShipments.length} B2C warehouse shipments created!`,
      orderId: order._id.toString(),
      paymentId: razorpay_payment_id,
      shipmentMode: 'B2C_WAREHOUSE',
      shipments: {
        total: successShipments.length,
        real: successShipments.filter(awb => !awb.isMock).length,
        mock: mockShipments.length,
        details: createdAWBs.map(awb => ({
          awb: awb.awb,
          type: awb.type,
          courier: awb.courier,
          isMock: awb.isMock
        }))
      },
      automation: {
        flow: 'B2C via Warehouse',
        currentStep: 'Step 1: Seller → Warehouse',
        nextStep: 'Auto-forward to buyer when delivered',
        monitoring: hasRealShipments ? 'active' : 'inactive (mock shipments)',
        interval: '15 minutes'
      },
      notes: mockShipments.length > 0 
        ? '⚠️ Some shipments are MOCK due to API issues. Check NimbusPost credentials.'
        : '✅ All shipments created successfully'
    };
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Verification error:', error.message);
    console.error('❌ Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Payment verification failed: ' + error.message,
      troubleshooting: [
        'Check Razorpay signature verification',
        'Verify NimbusPost API credentials',
        'Check database connection'
      ]
    });
  }
});

// ✅ UPDATED B2C WEBHOOK FOR AUTO-FORWARDING
router.post('/b2c-webhook', express.json(), async (req, res) => {
  try {
    const { event, data, timestamp } = req.body;
    
    console.log('🔔 [B2C WEBHOOK] Received:', { event, timestamp });
    
    if (!data || !data.awb_number) {
      console.error('❌ Invalid webhook data:', data);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid webhook data - missing awb_number' 
      });
    }
    
    const awbNumber = data.awb_number;
    
    // Find order with this AWB
    const order = await Order.findOne({
      'nimbuspostShipments.awbNumber': awbNumber
    })
    .populate('buyer', 'name email phone address')
    .populate('products', 'productName finalPrice weight dimensions');
    
    if (!order) {
      console.error(`❌ Order not found for AWB: ${awbNumber}`);
      return res.json({ 
        success: false, 
        message: 'Order not found for this AWB' 
      });
    }
    
    // Get the shipment
    const shipmentIndex = order.nimbuspostShipments.findIndex(s => s.awbNumber === awbNumber);
    if (shipmentIndex === -1) {
      return res.json({ 
        success: false, 
        message: 'Shipment not found in order' 
      });
    }
    
    const shipment = order.nimbuspostShipments[shipmentIndex];
    
    // Update shipment status based on event
    let newStatus = shipment.status;
    let statusMessage = '';
    
    if (event === 'delivered' || data.status?.toLowerCase().includes('delivered')) {
      newStatus = 'delivered';
      statusMessage = 'Delivered to warehouse';
      
      // Check if this is an incoming shipment to warehouse
      if (shipment.shipmentType === 'seller_to_warehouse') {
        console.log(`🏭 Incoming shipment ${awbNumber} delivered to warehouse, auto-forwarding...`);
        
        // Check if outgoing already exists
        const existingOutgoing = order.nimbuspostShipments.find(s => 
          s.parentAWB === awbNumber && s.shipmentType === 'warehouse_to_buyer'
        );
        
        if (!existingOutgoing) {
          try {
            // Get product for this shipment
            const product = order.products.find(p => 
              p._id.toString() === shipment.productId?.toString()
            );
            
            if (product) {
              // Get buyer data from order
              const buyerData = {
                name: order.buyer?.name || order.shippingAddress?.name || 'Customer',
                phone: order.buyer?.phone || order.shippingAddress?.phone || '9876543210',
                email: order.buyer?.email || order.shippingAddress?.email || '',
                address: order.shippingAddress || order.buyer?.address || {
                  street: 'Address not provided',
                  city: 'City',
                  state: 'State',
                  pincode: '110001'
                }
              };
              
              // ✅ UPDATED: Create outgoing B2C shipment using new API
              const outgoingResult = await nimbuspostService.createWarehouseToBuyerB2C(
                {
                  orderId: `${order._id}-${shipment.productId || product._id}`,
                  totalAmount: product.finalPrice || 0
                },
                {
                  productName: product.productName || 'Product',
                  price: product.finalPrice || 0,
                  weight: product.weight || 500,
                  dimensions: product.dimensions,
                  productId: shipment.productId || product._id,
                  quantity: 1
                },
                buyerData
              );
              
              if (outgoingResult.success) {
                // Add outgoing shipment
                order.nimbuspostShipments.push({
                  productId: shipment.productId || product._id,
                  awbNumber: outgoingResult.awbNumber,
                  shipmentId: outgoingResult.shipmentId,
                  orderId: outgoingResult.orderId,
                  shipmentMode: 'B2C',
                  shipmentType: 'warehouse_to_buyer',
                  status: outgoingResult.status || 'booked',
                  parentAWB: awbNumber,
                  createdAt: new Date(),
                  trackingUrl: outgoingResult.trackingUrl,
                  labelUrl: outgoingResult.labelUrl,
                  courierName: outgoingResult.courierName,
                  shipmentDetails: {
                    weight: product.weight || 500,
                    charges: outgoingResult.charges || { freight: 0, total: 0 },
                    estimatedDelivery: outgoingResult.estimatedDelivery
                  },
                  notes: outgoingResult.isMock 
                    ? 'MOCK: Auto-created from warehouse (API issue)' 
                    : 'Auto-created B2C from warehouse',
                  direction: 'outgoing',
                  isMock: outgoingResult.isMock || false,
                  warehouseDetails: nimbuspostService.getWarehouseInfo()
                });
                
                // Update shipping legs
                const warehouseLeg = order.shippingLegs.find(l => l.leg === 'seller_to_warehouse');
                if (warehouseLeg) {
                  warehouseLeg.status = 'completed';
                  warehouseLeg.completedAt = new Date();
                  warehouseLeg.notes = `Delivered & auto-forwarded (${outgoingResult.awbNumber})`;
                }
                
                order.shippingLegs.push({
                  leg: 'warehouse_to_buyer',
                  awbNumbers: [outgoingResult.awbNumber],
                  status: 'pending',
                  startedAt: new Date(),
                  courierName: outgoingResult.courierName,
                  notes: outgoingResult.isMock ? 'MOCK forwarding' : 'Auto-forwarded from warehouse',
                  parentAWB: awbNumber
                });
                
                console.log(`🔄 ${outgoingResult.isMock ? 'MOCK' : 'Auto'}-forwarded: ${awbNumber} → ${outgoingResult.awbNumber}`);
                statusMessage += ` & ${outgoingResult.isMock ? 'mock ' : ''}auto-forwarded to buyer`;
              }
            }
          } catch (forwardError) {
            console.error(`❌ Auto-forward failed for ${awbNumber}:`, forwardError.message);
            statusMessage += ' (auto-forward failed)';
          }
        } else {
          console.log(`⚠️ Outgoing already exists for ${awbNumber}: ${existingOutgoing.awbNumber}`);
          statusMessage += ' (already forwarded)';
        }
      }
    } else if (event === 'out_for_delivery') {
      newStatus = 'out_for_delivery';
      statusMessage = 'Out for delivery';
    } else if (event === 'in_transit') {
      newStatus = 'in_transit';
      statusMessage = 'In transit';
    } else if (event === 'picked_up') {
      newStatus = 'picked_up';
      statusMessage = 'Picked up';
    }
    
    // Update shipment status
    order.nimbuspostShipments[shipmentIndex].status = newStatus;
    order.nimbuspostShipments[shipmentIndex].updatedAt = new Date();
    
    // Add timeline entry
    order.timeline = order.timeline || [];
    order.timeline.push({
      event: 'webhook_update',
      description: `Shipment ${awbNumber}: ${statusMessage}`,
      status: newStatus,
      timestamp: new Date(),
      metadata: {
        awb: awbNumber,
        event: event,
        data: data
      }
    });
    
    await order.save();
    
    res.json({ 
      success: true, 
      message: 'Webhook processed',
      awb: awbNumber,
      status: newStatus,
      shipmentType: shipment.shipmentType,
      notes: statusMessage
    });
    
  } catch (error) {
    console.error('❌ B2C Webhook error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ✅ MANUAL TRIGGER FOR AUTO-FORWARDING
router.post('/manual-forward/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log(`🔄 Manual forward triggered for order: ${orderId}`);
    
    const order = await Order.findById(orderId)
      .populate('buyer', 'name email phone address')
      .populate('products', 'productName finalPrice weight dimensions');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Find delivered incoming shipments without outgoing
    const deliveredIncoming = order.nimbuspostShipments.filter(s => 
      s.shipmentType === 'seller_to_warehouse' && 
      s.status === 'delivered' &&
      !order.nimbuspostShipments.some(os => os.parentAWB === s.awbNumber)
    );
    
    if (deliveredIncoming.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No delivered incoming shipments found to forward'
      });
    }
    
    const forwardedShipments = [];
    
    for (const incoming of deliveredIncoming) {
      try {
        const product = order.products.find(p => 
          p._id.toString() === incoming.productId?.toString()
        );
        
        if (product) {
          const buyerData = {
            name: order.buyer?.name || order.shippingAddress?.name || 'Customer',
            phone: order.buyer?.phone || order.shippingAddress?.phone || '9876543210',
            email: order.buyer?.email || order.shippingAddress?.email || '',
            address: order.shippingAddress || order.buyer?.address || {
              street: 'Address not provided',
              city: 'City',
              state: 'State',
              pincode: '110001'
            }
          };
          
          const outgoingResult = await nimbuspostService.createWarehouseToBuyerB2C(
            {
              orderId: `${order._id}-${incoming.productId || product._id}`,
              totalAmount: product.finalPrice || 0
            },
            {
              productName: product.productName || 'Product',
              price: product.finalPrice || 0,
              weight: product.weight || 500,
              dimensions: product.dimensions,
              productId: incoming.productId || product._id,
              quantity: 1
            },
            buyerData
          );
          
          if (outgoingResult.success) {
            order.nimbuspostShipments.push({
              productId: incoming.productId || product._id,
              awbNumber: outgoingResult.awbNumber,
              shipmentId: outgoingResult.shipmentId,
              orderId: outgoingResult.orderId,
              shipmentMode: 'B2C',
              shipmentType: 'warehouse_to_buyer',
              status: outgoingResult.status || 'booked',
              parentAWB: incoming.awbNumber,
              createdAt: new Date(),
              trackingUrl: outgoingResult.trackingUrl,
              labelUrl: outgoingResult.labelUrl,
              courierName: outgoingResult.courierName,
              isMock: outgoingResult.isMock || false,
              notes: 'Manually created from warehouse'
            });
            
            forwardedShipments.push({
              incomingAWB: incoming.awbNumber,
              outgoingAWB: outgoingResult.awbNumber,
              isMock: outgoingResult.isMock || false
            });
          }
        }
      } catch (error) {
        console.error(`❌ Error forwarding ${incoming.awbNumber}:`, error.message);
      }
    }
    
    await order.save();
    
    res.json({
      success: true,
      message: `Manually forwarded ${forwardedShipments.length} shipments`,
      forwarded: forwardedShipments,
      orderId: order._id
    });
    
  } catch (error) {
    console.error('Manual forward error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;