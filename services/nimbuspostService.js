// services/nimbuspostService.js - ALL B2C SHIPMENTS
import axios from 'axios';
import { NIMBUSPOST_CONFIG, NIMBUSPOST_ENDPOINTS } from '../config/nimbuspostConfig.js';

class NimbusPostService {
  constructor() {
    this.baseURL = NIMBUSPOST_CONFIG.baseURL;
    this.apiKey = NIMBUSPOST_CONFIG.apiKey;
    this.WAREHOUSE_DETAILS = NIMBUSPOST_CONFIG.warehouse;
    this.defaultCourier = NIMBUSPOST_CONFIG.defaultCourier;
  }
  
  // ✅ 1. CREATE B2C SHIPMENT (Generic Method)
  async createB2CShipment(shipmentData) {
    try {
      console.log('🚚 Creating B2C shipment:', shipmentData.order_id);
      
      const response = await axios.post(
        `${this.baseURL}${NIMBUSPOST_ENDPOINTS.createShipment}`,
        shipmentData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'api-key': this.apiKey
          },
          timeout: 30000
        }
      );
      
      console.log('📦 B2C API Response:', response.data);
      
      if (response.data.success || response.data.status === 'success') {
        const data = response.data.data || response.data;
        
        return {
          success: true,
          awbNumber: data.awb || data.awb_number,
          shipmentId: data.shipment_id || data.order_id,
          courierName: data.courier_name || data.courier,
          status: data.status || 'created',
          trackingUrl: data.tracking_url || `https://track.nimbuspost.com/track/${data.awb}`,
          labelUrl: data.label_url || data.label,
          charges: data.charges || { freight: 0, total: 0 },
          estimatedDelivery: data.estimated_delivery,
          rawResponse: response.data
        };
      } else {
        throw new Error(response.data.message || 'B2C shipment failed');
      }
      
    } catch (error) {
      console.error('❌ B2C Shipment error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Fallback to mock for development
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Using mock B2C shipment');
        return this.createMockB2CShipment(shipmentData);
      }
      
      throw error;
    }
  }
  
  // ✅ 2. CREATE B2C SHIPMENT: SELLER → WAREHOUSE (FIRST LEG)
  async createSellerToWarehouseB2C(orderData, productData, sellerData) {
    try {
      console.log('🏭 Creating B2C: Seller → Warehouse');
      
      const shipmentData = {
        order_id: `JB-IN-${orderData.orderId}`,
        
        // From: Seller
        pickup_name: sellerData.name || 'Seller',
        pickup_phone: sellerData.phone || '9876543210',
        pickup_email: sellerData.email || '',
        pickup_address: sellerData.address?.street || sellerData.address || 'Seller Address',
        pickup_city: sellerData.address?.city || sellerData.city || 'City',
        pickup_state: sellerData.address?.state || sellerData.state || 'State',
        pickup_pincode: sellerData.address?.pincode || sellerData.pincode || '110001',
        
        // To: Warehouse
        customer_name: this.WAREHOUSE_DETAILS.name,
        customer_phone: this.WAREHOUSE_DETAILS.phone,
        customer_email: this.WAREHOUSE_DETAILS.email,
        customer_address: this.WAREHOUSE_DETAILS.address,
        customer_city: this.WAREHOUSE_DETAILS.city,
        customer_state: this.WAREHOUSE_DETAILS.state,
        customer_pincode: this.WAREHOUSE_DETAILS.pincode,
        
        // Shipment Details
        payment_mode: NIMBUSPOST_CONFIG.b2cSettings.payment_mode,
        weight: productData.weight || 500,
        length: productData.dimensions?.length || 20,
        breadth: productData.dimensions?.breadth || 15,
        height: productData.dimensions?.height || 10,
        quantity: productData.quantity || 1,
        
        // Product Details
        product_name: `[TO WAREHOUSE] ${productData.productName || 'Product'}`,
        product_price: productData.price || 0,
        sku: `SKU-IN-${productData.productId || Date.now()}`,
        
        // Courier
        courier_name: this.defaultCourier,
        service_type: NIMBUSPOST_CONFIG.b2cSettings.service_type,
        collectable_amount: NIMBUSPOST_CONFIG.b2cSettings.collectable_amount,
        
        // Additional
        is_returnable: NIMBUSPOST_CONFIG.b2cSettings.is_returnable,
        return_days: NIMBUSPOST_CONFIG.b2cSettings.return_days,
        add_ons: NIMBUSPOST_CONFIG.b2cSettings.add_ons,
        
        // Special Notes
        notes: 'B2C Shipment from Seller to JustBecho Warehouse'
      };
      
      const result = await this.createB2CShipment(shipmentData);
      
      return {
        ...result,
        shipmentType: 'seller_to_warehouse',
        direction: 'incoming',
        warehouse: this.WAREHOUSE_DETAILS
      };
      
    } catch (error) {
      console.error('❌ Seller→Warehouse B2C error:', error);
      throw error;
    }
  }
  
  // ✅ 3. CREATE B2C SHIPMENT: WAREHOUSE → BUYER (SECOND LEG)
  async createWarehouseToBuyerB2C(orderData, productData, buyerData) {
    try {
      console.log('🚚 Creating B2C: Warehouse → Buyer');
      
      const shipmentData = {
        order_id: `JB-OUT-${orderData.orderId}`,
        
        // From: Warehouse
        pickup_name: this.WAREHOUSE_DETAILS.name,
        pickup_phone: this.WAREHOUSE_DETAILS.phone,
        pickup_email: this.WAREHOUSE_DETAILS.email,
        pickup_address: this.WAREHOUSE_DETAILS.address,
        pickup_city: this.WAREHOUSE_DETAILS.city,
        pickup_state: this.WAREHOUSE_DETAILS.state,
        pickup_pincode: this.WAREHOUSE_DETAILS.pincode,
        
        // To: Buyer
        customer_name: buyerData.name || 'Customer',
        customer_phone: buyerData.phone || '9876543210',
        customer_email: buyerData.email || '',
        customer_address: buyerData.address?.street || buyerData.address || 'Customer Address',
        customer_city: buyerData.address?.city || buyerData.city || 'City',
        customer_state: buyerData.address?.state || buyerData.state || 'State',
        customer_pincode: buyerData.address?.pincode || buyerData.pincode || '110001',
        
        // Shipment Details
        payment_mode: NIMBUSPOST_CONFIG.b2cSettings.payment_mode,
        weight: productData.weight || 500,
        length: productData.dimensions?.length || 20,
        breadth: productData.dimensions?.breadth || 15,
        height: productData.dimensions?.height || 10,
        quantity: productData.quantity || 1,
        
        // Product Details
        product_name: productData.productName || 'Product',
        product_price: productData.price || 0,
        sku: `SKU-OUT-${productData.productId || Date.now()}`,
        
        // Courier
        courier_name: this.defaultCourier,
        service_type: NIMBUSPOST_CONFIG.b2cSettings.service_type,
        collectable_amount: NIMBUSPOST_CONFIG.b2cSettings.collectable_amount,
        
        // Additional
        is_returnable: NIMBUSPOST_CONFIG.b2cSettings.is_returnable,
        return_days: NIMBUSPOST_CONFIG.b2cSettings.return_days,
        add_ons: NIMBUSPOST_CONFIG.b2cSettings.add_ons,
        
        // Special Notes
        notes: 'B2C Shipment from JustBecho Warehouse to Customer'
      };
      
      const result = await this.createB2CShipment(shipmentData);
      
      return {
        ...result,
        shipmentType: 'warehouse_to_buyer',
        direction: 'outgoing',
        warehouse: this.WAREHOUSE_DETAILS
      };
      
    } catch (error) {
      console.error('❌ Warehouse→Buyer B2C error:', error);
      throw error;
    }
  }
  
  // ✅ 4. CREATE COMPLETE B2C WAREHOUSE FLOW
  async createCompleteB2CWarehouseFlow(orderData, productData, sellerData, buyerData) {
    try {
      console.log('🔄 Starting B2C Warehouse Flow...');
      
      // Step 1: Seller → Warehouse
      console.log('📦 Step 1: Creating Seller → Warehouse B2C shipment');
      const incomingResult = await this.createSellerToWarehouseB2C(
        orderData,
        productData,
        sellerData
      );
      
      if (!incomingResult.success) {
        throw new Error('Failed to create incoming B2C shipment');
      }
      
      console.log('✅ Step 1 Complete: Incoming B2C shipment created');
      
      // Return with monitoring instructions
      return {
        success: true,
        message: 'B2C Warehouse Flow started successfully',
        incoming: incomingResult,
        flow: {
          step1: '✅ B2C Seller → Warehouse created',
          step2: '⏳ Monitoring delivery to warehouse',
          step3: '🔔 Auto-create Warehouse → Buyer when delivered',
          automation: 'Auto-forwarding enabled'
        },
        tracking: {
          incomingAWB: incomingResult.awbNumber,
          trackingUrl: incomingResult.trackingUrl,
          warehouse: this.WAREHOUSE_DETAILS
        }
      };
      
    } catch (error) {
      console.error('❌ B2C Warehouse Flow error:', error);
      throw error;
    }
  }
  
  // ✅ 5. TRACK B2C SHIPMENT
  async trackB2CShipment(awbNumber) {
    try {
      const response = await axios.get(
        `${this.baseURL}${NIMBUSPOST_ENDPOINTS.trackShipment}/${awbNumber}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success || response.data.status === 'success') {
        return response.data.data || response.data;
      } else {
        throw new Error(response.data.message || 'Tracking failed');
      }
    } catch (error) {
      console.error('❌ B2C Track error:', error.message);
      
      // Mock tracking for development
      if (process.env.NODE_ENV === 'development') {
        return {
          awb: awbNumber,
          status: 'in_transit',
          current_status: 'In Transit',
          tracking: [
            {
              date: new Date().toISOString(),
              status: 'In Transit',
              location: 'Warehouse Hub',
              remarks: 'Package is in transit'
            }
          ]
        };
      }
      
      throw error;
    }
  }
  
  // ✅ 6. CHECK IF DELIVERED (For automation)
  async isB2CShipmentDelivered(awbNumber) {
    try {
      const tracking = await this.trackB2CShipment(awbNumber);
      
      const isDelivered = tracking.status === 'delivered' || 
                         tracking.current_status === 'Delivered' ||
                         (tracking.tracking && 
                          tracking.tracking.some(t => t.status === 'Delivered'));
      
      console.log(`📦 AWB ${awbNumber}: ${tracking.status || tracking.current_status}, Delivered: ${isDelivered}`);
      
      return {
        delivered: isDelivered,
        status: tracking.status || tracking.current_status,
        data: tracking,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('❌ Delivery check error:', error.message);
      return { 
        delivered: false, 
        status: 'error', 
        error: error.message 
      };
    }
  }
  
  // ✅ 7. MOCK B2C SHIPMENT (Development only)
  createMockB2CShipment(shipmentData) {
    const awb = `MOCK${Date.now()}`;
    return {
      success: true,
      awbNumber: awb,
      shipmentId: `mock-${awb}`,
      courierName: 'Delhivery',
      status: 'created',
      trackingUrl: `https://track.nimbuspost.com/track/${awb}`,
      labelUrl: `https://labels.nimbuspost.com/${awb}.pdf`,
      charges: { freight: 45, total: 45 },
      estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      isMock: true,
      notes: 'Mock B2C shipment for development'
    };
  }
  
  // ✅ 8. TEST B2C CONNECTION
  async testB2CConnection() {
    try {
      // Try to create a test shipment
      const testPayload = {
        order_id: `TEST-${Date.now()}`,
        pickup_name: 'Test Seller',
        pickup_phone: '9876543210',
        pickup_address: 'Test Address',
        pickup_city: 'Test City',
        pickup_state: 'Test State',
        pickup_pincode: '110001',
        customer_name: 'Test Customer',
        customer_phone: '9876543211',
        customer_address: 'Test Customer Address',
        customer_city: 'Test City',
        customer_state: 'Test State',
        customer_pincode: '110002',
        payment_mode: 'prepaid',
        weight: 500,
        product_name: 'Test Product',
        product_price: 100,
        courier_name: 'delhivery'
      };
      
      const response = await axios.post(
        `${this.baseURL}${NIMBUSPOST_ENDPOINTS.createShipment}`,
        testPayload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      return {
        success: true,
        message: '✅ B2C API Connected Successfully!',
        apiStatus: 'connected',
        warehouse: this.WAREHOUSE_DETAILS,
        testResponse: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ B2C API Connection Failed: ' + error.message,
        apiStatus: 'disconnected',
        warehouse: this.WAREHOUSE_DETAILS
      };
    }
  }
  
  // ✅ 9. GET WAREHOUSE INFO
  getWarehouseInfo() {
    return {
      ...this.WAREHOUSE_DETAILS,
      flow: 'B2C Warehouse Flow',
      steps: [
        'Step 1: Seller → Warehouse (B2C)',
        'Step 2: Warehouse → Buyer (B2C)',
        'Automation: Auto-forward when delivered'
      ]
    };
  }
}

export default new NimbusPostService();