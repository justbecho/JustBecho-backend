// services/nimbuspostService.js - COMPLETE WORKING CODE
import axios from 'axios';
import { NIMBUSPOST_CONFIG, NIMBUSPOST_ENDPOINTS } from '../config/nimbuspostConfig.js';

class NimbusPostService {
  constructor() {
    this.baseURL = NIMBUSPOST_CONFIG.baseURL;
    this.apiKey = NIMBUSPOST_CONFIG.apiKey;
    this.credentials = NIMBUSPOST_CONFIG.credentials;
    this.token = null;
    this.tokenExpiry = null;
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
            'x-api-key': this.apiKey  // ✅ API KEY HEADER
          }
        }
      );
      
      console.log('✅ Token response:', response.data);
      
      if (response.data.status && response.data.data) {
        this.token = response.data.data;
        this.tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
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
  
  // ✅ 3. CREATE B2B SHIPMENT - MAIN FUNCTION
  async createB2BShipment(orderData, productData, sellerData, buyerData) {
    try {
      // Get token first
      const token = await this.getToken();
      
      console.log('🚚 Creating B2B shipment for order:', orderData.orderId);
      
      // ✅ CRITICAL: B2B SHIPMENT PAYLOAD (Exactly as per NimbusPost B2B docs)
      const shipmentPayload = {
        // ✅ ORDER DETAILS
        order_id: `JB-${orderData.orderId}`,
        payment_method: 'prepaid',
        
        // ✅ BUYER DETAILS (Consignee)
        consignee_name: buyerData.name || 'Customer',
        consignee_company_name: buyerData.name || 'Individual',
        consignee_phone: buyerData.phone || '9876543210',
        consignee_email: buyerData.email || '',
        consignee_gst_number: '',
        consignee_address: buyerData.address?.street || 'Address not provided',
        consignee_pincode: buyerData.address?.pincode || '110001',
        consignee_city: buyerData.address?.city || 'Gurugram',
        consignee_state: buyerData.address?.state || 'Haryana',
        
        // ✅ SHIPMENT DETAILS
        no_of_invoices: 1,
        no_of_boxes: 1,
        courier_id: NIMBUSPOST_CONFIG.defaultCourierId, // 110 = Delhivery
        request_auto_pickup: 'yes',
        
        // ✅ INVOICE DETAILS
        invoice: [{
          invoice_number: `INV-JB-${orderData.orderId}`,
          invoice_date: new Date().toISOString().split('T')[0],
          invoice_value: orderData.totalAmount,
          ebn_number: '',
          ebn_expiry_date: ''
        }],
        
        // ✅ PICKUP DETAILS (FROM SELLER)
        pickup: {
          warehouse_name: NIMBUSPOST_CONFIG.warehouse.name,
          name: sellerData.name || 'Seller',
          address: sellerData.address?.street || 'Seller address',
          address_2: sellerData.address?.street2 || '',
          city: sellerData.address?.city || 'Gurugram',
          state: sellerData.address?.state || 'Haryana',
          pincode: sellerData.address?.pincode || '110001',
          phone: sellerData.phone || '9876543210'
        },
        
        // ✅ PRODUCT DETAILS
        products: [{
          product_name: productData.productName || 'Product',
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
      
      console.log('📦 Shipment payload:', JSON.stringify(shipmentPayload, null, 2));
      
      // ✅ MAKE API CALL
      const response = await axios.post(
        `${this.baseURL}${NIMBUSPOST_ENDPOINTS.createShipment}`,
        shipmentPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-api-key': this.apiKey  // ✅ API KEY HEADER
          },
          timeout: 30000
        }
      );
      
      console.log('📦 API Response:', response.data);
      
      if (response.data.status) {
        const shipment = response.data.data;
        console.log('✅ Shipment created! AWB:', shipment.awb_number);
        
        return {
          success: true,
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
      console.error('❌ Create shipment error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      throw error;
    }
  }
  
  // ✅ 4. TRACK SHIPMENT
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
  
  // ✅ 5. CANCEL SHIPMENT
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
  
  // ✅ 6. CHECK WALLET BALANCE
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
  
  // ✅ 7. TEST CONNECTION
  async testConnection() {
    try {
      const token = await this.getToken();
      const balance = await this.checkWalletBalance();
      
      return {
        success: true,
        message: '✅ NimbusPost connection successful!',
        token: token.substring(0, 30) + '...',
        walletBalance: balance?.available_limit || 0,
        email: this.credentials.email
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