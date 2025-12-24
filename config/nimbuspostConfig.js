// config/nimbuspostConfig.js - UPDATED FOR NEW API
export const NIMBUSPOST_CONFIG = {
  // ✅ Login credentials from your account
  credentials: {
    email: 'justbecho+2985@gmail.com',
    password: 'vRcYE3eZPj'
  },
  
  // ✅ API Endpoints
  baseURL: 'https://api.nimbuspost.com/v1',
  
  // ✅ WAREHOUSE DETAILS
  warehouse: {
    name: 'Devansh Kothari',
    company: 'JustBecho Warehouse',
    phone: '9301847748',
    email: 'warehouse@justbecho.com',
    address: '103 Dilpasand grand, Behind Rafael tower',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '452001',
    latitude: '22.7196', // Indore coordinates
    longitude: '75.8577'
  },
  
  // ✅ DEFAULT SETTINGS
  defaultCourier: 'autoship', // Let NimbusPost choose best courier
  autoPickup: 'yes',
  
  // ✅ B2C SETTINGS
  b2cSettings: {
    payment_type: 'prepaid',
    service_type: 'surface',
    is_insurance: '0'
  }
};

export const NIMBUSPOST_ENDPOINTS = {
  login: '/users/login',
  createShipment: '/shipments/hyperlocal', // Using hyperlocal endpoint
  trackShipment: '/shipments/track/bulk',
  cancelShipment: '/shipments/cancel',
  manifest: '/shipments/manifest',
  courierList: '/couriers'
};