// services/nimbuspostService.js - COMPLETE UPDATED CODE WITH WAREHOUSE AUTOMATION
import axios from 'axios';
import { NIMBUSPOST_CONFIG, NIMBUSPOST_ENDPOINTS } from '../config/nimbuspostConfig.js';

class NimbusPostService {
  constructor() {
    this.baseURL = NIMBUSPOST_CONFIG.baseURL;
    this.apiKey = NIMBUSPOST_CONFIG.apiKey;
    this.credentials = NIMBUSPOST_CONFIG.credentials;
    this.token = null;
    this.tokenExpiry = null;
    
    // ✅ WAREHOUSE DETAILS - HARDCODED
    this.WAREHOUSE_DETAILS = {
      name: "Devansh Kothari",
      company: "JustBecho Warehouse",
      address: "103 Dilpasand grand, Behind Rafael tower",
      city: "Indore",
      state: "Madhya Pradesh",
      pincode: "452001",
      phone: "9301847748",
      email: "warehouse@justbecho.com"
    };
  }
  
  // ✅ 1. GENERATE TOKEN USING EMAIL/PASSWORD
  async generateToken() {
    try {
      console.log('🔐 Generating NimbusPost token...');
      
      const response = await axios.post(
        `${this.baseURL}/users/login`,
        {
          email: this.credentials.email,
          password: this.credentials.password
        },
        {
          headers: { 
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey
          }
        }
      );
      
      if (response.data.status && response.data.data) {
        this.token = response.data.data;
        this.tokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
        return this.token;
      } else {
        throw new Error('Failed to get token: ' + response.data.message);
      }
    } catch (error) {
      console.error('❌ Token generation error:', error.response?.data || error.message);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }
  
  // ✅ 2. GET VALID TOKEN
  async getToken() {
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }
    return await this.generateToken();
  }
  
  // ✅ 3. CREATE SHIPMENT WITH WAREHOUSE SUPPORT (UPDATED)
  async createB2BShipment(orderData, productData, sellerData, buyerData, shipmentType = 'seller_to_warehouse') {
    try {
      const token = await this.getToken();
      
      console.log('🚚 Creating shipment:', shipmentType, 'for order:', orderData.orderId);
      
      // ✅ DETERMINE SOURCE & DESTINATION
      let pickupDetails, deliveryDetails;
      
      if (shipmentType === 'seller_to_warehouse') {
        // FROM: SELLER, TO: WAREHOUSE
        pickupDetails = {
          warehouse_name: sellerData.name || 'Seller',
          name: sellerData.name || 'Seller',
          address: sellerData.address?.street || 'Seller address',
          address_2: sellerData.address?.street2 || '',
          city: sellerData.address?.city || 'City',
          state: sellerData.address?.state || 'State',
          pincode: sellerData.address?.pincode || '110001',
          phone: sellerData.phone || '9876543210'
        };
        
        deliveryDetails = {
          consignee_name: this.WAREHOUSE_DETAILS.name,
          consignee_company_name: this.WAREHOUSE_DETAILS.company,
          consignee_phone: this.WAREHOUSE_DETAILS.phone,
          consignee_email: this.WAREHOUSE_DETAILS.email,
          consignee_address: this.WAREHOUSE_DETAILS.address,
          consignee_pincode: this.WAREHOUSE_DETAILS.pincode,
          consignee_city: this.WAREHOUSE_DETAILS.city,
          consignee_state: this.WAREHOUSE_DETAILS.state,
        };
        
        console.log('🏭 Creating INCOMING shipment: Seller → Warehouse');
        
      } else if (shipmentType === 'warehouse_to_buyer') {
        // FROM: WAREHOUSE, TO: BUYER
        pickupDetails = {
          warehouse_name: this.WAREHOUSE_DETAILS.company,
          name: this.WAREHOUSE_DETAILS.name,
          address: this.WAREHOUSE_DETAILS.address,
          address_2: '',
          city: this.WAREHOUSE_DETAILS.city,
          state: this.WAREHOUSE_DETAILS.state,
          pincode: this.WAREHOUSE_DETAILS.pincode,
          phone: this.WAREHOUSE_DETAILS.phone
        };
        
        deliveryDetails = {
          consignee_name: buyerData.name || 'Customer',
          consignee_company_name: buyerData.name || 'Individual',
          consignee_phone: buyerData.phone || '9876543210',
          consignee_email: buyerData.email || '',
          consignee_address: buyerData.address?.street || 'Address not provided',
          consignee_pincode: buyerData.address?.pincode || '110001',
          consignee_city: buyerData.address?.city || 'City',
          consignee_state: buyerData.address?.state || 'State',
        };
        
        console.log('🚚 Creating OUTGOING shipment: Warehouse → Buyer');
      }
      
      // ✅ SHIPMENT PAYLOAD
      const shipmentPayload = {
        order_id: shipmentType === 'seller_to_warehouse' 
          ? `JB-IN-${orderData.orderId}`  // IN = Incoming
          : `JB-OUT-${orderData.orderId}`, // OUT = Outgoing
        
        payment_method: 'prepaid',
        
        // ✅ DELIVERY DETAILS
        ...deliveryDetails,
        consignee_gst_number: '',
        
        // ✅ SHIPMENT DETAILS
        no_of_invoices: 1,
        no_of_boxes: 1,
        courier_id: NIMBUSPOST_CONFIG.defaultCourierId,
        request_auto_pickup: 'yes',
        
        // ✅ INVOICE DETAILS
        invoice: [{
          invoice_number: shipmentType === 'seller_to_warehouse'
            ? `INV-IN-${orderData.orderId}`
            : `INV-OUT-${orderData.orderId}`,
          invoice_date: new Date().toISOString().split('T')[0],
          invoice_value: orderData.totalAmount,
          ebn_number: '',
          ebn_expiry_date: ''
        }],
        
        // ✅ PICKUP DETAILS
        pickup: pickupDetails,
        
        // ✅ PRODUCT DETAILS
        products: [{
          product_name: shipmentType === 'seller_to_warehouse'
            ? `[INCOMING] ${productData.productName || 'Product'}`
            : `[OUTGOING] ${productData.productName || 'Product'}`,
          product_hsn_code: productData.hsnCode || '9999',
          product_lbh_unit: 'cm',
          no_of_box: 1,
          product_tax_per: 0,
          product_price: productData.price || 0,
          product_weight_unit: 'gram',
          product_length: productData.dimensions?.length || 20,
          product_breadth: productData.dimensions?.breadth || 15,
          product_height: productData.dimensions?.height || 10,
          product_weight: productData.weight || 500
        }]
      };
      
      console.log('📦 Shipment payload for', shipmentType);
      
      // ✅ MAKE API CALL
      const response = await axios.post(
        `${this.baseURL}${NIMBUSPOST_ENDPOINTS.createShipment}`,
        shipmentPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-api-key': this.apiKey
          },
          timeout: 30000
        }
      );
      
      if (response.data.status) {
        const shipment = response.data.data;
        console.log('✅ Shipment created! AWB:', shipment.awb_number, 'Type:', shipmentType);
        
        return {
          success: true,
          shipmentType: shipmentType,
          awbNumber: shipment.awb_number,
          shipmentId: shipment.shipment_id,
          orderId: shipment.order_id,
          labelUrl: shipment.label,
          manifestUrl: shipment.manifest,
          courierName: shipment.courier_name,
          status: shipment.status,
          trackingUrl: `https://track.nimbuspost.com/track/${shipment.awb_number}`,
          rawResponse: response.data
        };
      } else {
        throw new Error(response.data.message || 'Shipment creation failed');
      }
    } catch (error) {
      console.error('❌ Create shipment error:', error.message);
      throw error;
    }
  }
  
  // ✅ 4. CREATE COMPLETE TWO-LEG SHIPMENT (Seller → Warehouse → Buyer)
  async createCompleteTwoLegShipment(orderData, productData, sellerData, buyerData) {
    try {
      console.log('🔄 Creating COMPLETE two-leg shipment flow...');
      
      // STEP 1: Create incoming shipment (Seller → Warehouse)
      const incomingResult = await this.createB2BShipment(
        orderData,
        productData,
        sellerData,
        buyerData,
        'seller_to_warehouse'
      );
      
      if (!incomingResult.success) {
        throw new Error('Failed to create incoming shipment');
      }
      
      console.log('✅ Step 1 complete: Incoming shipment created', incomingResult.awbNumber);
      
      // STEP 2: Setup monitoring for incoming shipment
      // In production, you would setup webhook here
      // For now, we'll return both and let frontend schedule step 2
      
      return {
        success: true,
        message: 'Two-leg shipment process started',
        incoming: incomingResult,
        nextStep: {
          action: 'monitor_incoming_delivery',
          incomingAWB: incomingResult.awbNumber,
          triggerWhen: 'when status = "Delivered"',
          then: 'call createB2BShipment with shipmentType = "warehouse_to_buyer"'
        }
      };
      
    } catch (error) {
      console.error('❌ Two-leg shipment error:', error);
      throw error;
    }
  }
  
  // ✅ 5. TRACK SHIPMENT
  async trackShipment(awbNumber) {
    try {
      const token = await this.getToken();
      
      const response = await axios.get(
        `${this.baseURL}${NIMBUSPOST_ENDPOINTS.trackShipment}/${awbNumber}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.status) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Tracking failed');
      }
    } catch (error) {
      console.error('❌ Track error:', error.message);
      throw error;
    }
  }
  
  // ✅ 6. CANCEL SHIPMENT
  async cancelShipment(awbNumber) {
    try {
      const token = await this.getToken();
      
      const response = await axios.post(
        `${this.baseURL}${NIMBUSPOST_ENDPOINTS.cancelShipment}`,
        { awb: awbNumber },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.status) {
        return { success: true, message: response.data.message };
      } else {
        throw new Error(response.data.message || 'Cancellation failed');
      }
    } catch (error) {
      console.error('❌ Cancel error:', error.message);
      throw error;
    }
  }
  
  // ✅ 7. CHECK WALLET BALANCE
  async checkWalletBalance() {
    try {
      const token = await this.getToken();
      
      const response = await axios.get(
        `${this.baseURL}${NIMBUSPOST_ENDPOINTS.walletBalance}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.status) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Balance check failed');
      }
    } catch (error) {
      console.error('❌ Balance error:', error.message);
      throw error;
    }
  }
  
  // ✅ 8. TEST CONNECTION
  async testConnection() {
    try {
      const token = await this.getToken();
      const balance = await this.checkWalletBalance();
      
      return {
        success: true,
        message: '✅ NimbusPost connection successful!',
        token: token.substring(0, 30) + '...',
        walletBalance: balance?.available_limit || 0,
        email: this.credentials.email,
        warehouse: this.WAREHOUSE_DETAILS
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Connection failed: ' + error.message
      };
    }
  }
}

export default new NimbusPostService();