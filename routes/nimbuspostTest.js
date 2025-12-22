// routes/nimbuspostTest.js
import express from 'express';
import nimbuspostService from '../services/nimbuspostService.js';

const router = express.Router();

// ✅ TEST NIMBUSPOST CONNECTION
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Testing NimbusPost connection...');
    
    const testResult = await nimbuspostService.testConnection();
    
    res.json({
      success: true,
      message: 'NimbusPost Test Route',
      ...testResult
    });
    
  } catch (error) {
    console.error('❌ NimbusPost test error:', error);
    res.status(500).json({
      success: false,
      message: 'Test failed: ' + error.message
    });
  }
});

// ✅ TEST SHIPMENT CREATION (with sample data)
router.post('/test-shipment', async (req, res) => {
  try {
    console.log('📦 Testing NimbusPost shipment creation...');
    
    const sampleData = {
      orderData: {
        orderId: `TEST-${Date.now()}`,
        totalAmount: 2999
      },
      productData: {
        productName: 'Test Product',
        price: 2999,
        weight: 500,
        dimensions: { length: 20, breadth: 15, height: 10 }
      },
      sellerData: {
        name: 'Test Seller',
        phone: '9876543210',
        address: {
          street: 'Test Street, Test Colony',
          city: 'Gurugram',
          state: 'Haryana',
          pincode: '110001'
        }
      },
      buyerData: {
        name: 'Test Buyer',
        phone: '9876543211',
        email: 'test@buyer.com',
        address: {
          street: 'Buyer Street, Buyer Colony',
          city: 'Gurugram',
          state: 'Haryana',
          pincode: '110002'
        }
      }
    };
    
    const shipmentResult = await nimbuspostService.createB2BShipment(
      sampleData.orderData,
      sampleData.productData,
      sampleData.sellerData,
      sampleData.buyerData
    );
    
    res.json({
      success: true,
      message: '✅ Test shipment created successfully!',
      shipment: shipmentResult
    });
    
  } catch (error) {
    console.error('❌ Test shipment error:', error);
    res.status(500).json({
      success: false,
      message: 'Test shipment failed: ' + error.message,
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ✅ TEST WALLET BALANCE
router.get('/wallet', async (req, res) => {
  try {
    const balance = await nimbuspostService.checkWalletBalance();
    
    res.json({
      success: true,
      walletBalance: balance
    });
    
  } catch (error) {
    console.error('Wallet balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get wallet balance: ' + error.message
    });
  }
});

// ✅ TEST SHIPMENT TRACKING
router.get('/track/:awb', async (req, res) => {
  try {
    const { awb } = req.params;
    
    const trackingData = await nimbuspostService.trackShipment(awb);
    
    res.json({
      success: true,
      awbNumber: awb,
      tracking: trackingData
    });
    
  } catch (error) {
    console.error('Tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Tracking failed: ' + error.message
    });
  }
});

export default router;