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
        select: 'productName finalPrice brand condition images seller weight dimensions'
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

    // Create B2C Shipments: Seller → Warehouse (First Leg)
    const nimbusShipments = [];
    const createdAWBs = [];
    
    for (const [sellerId, sellerInfo] of sellerMap) {
      const seller = sellerInfo.sellerData;
      
      for (const product of sellerInfo.products) {
        try {
          console.log(`🏭 Creating B2C shipment: Seller → Warehouse for product: ${product.productId}`);
          
          const shipmentData = {
            orderId: `JB-IN-${order._id.toString().substr(-6)}-${product.productId.toString().substr(-6)}`,
            totalAmount: product.price * product.quantity
          };
          
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
              name: seller?.name || 'Seller',
              phone: seller?.phone || '9876543210',
              email: seller?.email || '',
              address: seller?.address || {
                street: 'Seller address not provided',
                city: 'City',
                state: 'State',
                pincode: '110001'
              }
            }
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
              shipmentDetails: {
                weight: product.productData.weight || 500,
                charges: incomingResult.charges || { freight: 0, total: 0 },
                estimatedDelivery: incomingResult.estimatedDelivery
              },
              notes: 'B2C shipment from seller to warehouse',
              direction: 'incoming',
              warehouseDetails: nimbuspostService.getWarehouseInfo()
            });
            
            console.log(`✅ B2C Seller→Warehouse created: ${incomingResult.awbNumber} via ${incomingResult.courierName}`);
            
            // Add tracking job for auto-forwarding
            order.metadata.trackingJobs = order.metadata.trackingJobs || [];
            order.metadata.trackingJobs.push({
              incomingAWB: incomingResult.awbNumber,
              productId: product.productId,
              scheduledAt: new Date(),
              checkedAt: new Date(),
              status: 'monitoring',
              attemptCount: 0
            });
          }
        } catch (shipmentError) {
          console.error(`❌ B2C Seller→Warehouse Shipment failed:`, shipmentError.message);
        }
      }
    }
    
    // Save shipments to order
    order.nimbuspostShipments = nimbusShipments;
    
    // Update shipping legs
    order.shippingLegs = [{
      leg: 'seller_to_warehouse',
      awbNumbers: createdAWBs.map(awb => awb.awb),
      status: 'pending',
      startedAt: new Date(),
      notes: 'B2C shipment to warehouse'
    }];
    
    // Save order
    await order.save({ validateBeforeSave: false });
    console.log('✅ Order saved with B2C warehouse shipments');

    // Start warehouse automation monitoring
    warehouseAutomation.startB2CMonitoring(15);
    console.log('🚀 B2C warehouse automation monitoring started');

    // Prepare response
    const responseData = {
      success: true,
      message: `🎉 Payment verified & ${createdAWBs.length} B2C warehouse shipments created!`,
      orderId: order._id.toString(),
      paymentId: razorpay_payment_id,
      shipmentMode: 'B2C_WAREHOUSE',
      shipments: createdAWBs,
      automation: {
        flow: 'B2C via Warehouse',
        currentStep: 'Step 1: Seller → Warehouse',
        nextStep: 'Auto-forward to buyer when delivered',
        monitoring: {
          status: 'active',
          interval: '15 minutes'
        }
      }
    };
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Verification error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed: ' + error.message
    });
  }
});

// ✅ B2C WEBHOOK FOR AUTO-FORWARDING
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
    
    // Get the shipment
    const shipmentIndex = order.nimbuspostShipments.findIndex(s => s.awbNumber === awbNumber);
    if (shipmentIndex === -1) {
      return res.json({ success: false, message: 'Shipment not found' });
    }
    
    const shipment = order.nimbuspostShipments[shipmentIndex];
    
    // Update shipment status
    let newStatus = shipment.status;
    
    if (event === 'delivered' && shipment.shipmentType === 'seller_to_warehouse') {
      newStatus = 'delivered';
      
      // Auto-create B2C: Warehouse → Buyer
      try {
        const product = await Product.findById(shipment.productId);
        const buyerData = {
          name: order.buyer?.name || order.shippingAddress?.name,
          phone: order.buyer?.phone || order.shippingAddress?.phone,
          email: order.buyer?.email,
          address: order.shippingAddress || order.buyer?.address,
          pincode: order.shippingAddress?.pincode
        };
        
        // Create outgoing B2C shipment
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
          // Add outgoing shipment
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
          order.shippingLegs.push({
            leg: 'warehouse_to_buyer',
            awbNumbers: [outgoingResult.awbNumber],
            status: 'pending',
            startedAt: new Date(),
            courierName: outgoingResult.courierName,
            notes: 'Auto-forwarded from warehouse'
          });
          
          console.log(`🔄 Auto-forwarded: ${awbNumber} → ${outgoingResult.awbNumber}`);
        }
      } catch (forwardError) {
        console.error(`❌ Auto-forward failed:`, forwardError.message);
      }
    }
    
    // Update shipment status
    order.nimbuspostShipments[shipmentIndex].status = newStatus;
    await order.save();
    
    res.json({ 
      success: true, 
      message: 'Webhook processed',
      awb: awbNumber,
      status: newStatus
    });
    
  } catch (error) {
    console.error('❌ B2C Webhook error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;