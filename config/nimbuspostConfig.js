// config/nimbuspostConfig.js - UPDATED
export const NIMBUSPOST_CONFIG = {
  // ✅ YOUR NEW CORRECT CREDENTIALS
  credentials: {
    email: 'justbecho+2995@gmail.com',  // UPDATED
    password: 'FgVWcfQSnt'               // UPDATED
  },
  apiKey: 'ccbd48931ea40e234e8b00142ba1d8b60a2e71ae242245',
  
  baseURL: 'https://api.nimbuspost.com/v1',
  
  warehouse: {
    name: 'Devansh Kothari',
    company: 'JustBecho Warehouse',
    phone: '9301847748',
    email: 'warehouse@justbecho.com',
    address: '103 Dilpasand grand, Behind Rafael tower',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '452001',
    latitude: '22.7196',
    longitude: '75.8577'
  },
  
  defaultCourier: 'autoship',
  autoPickup: 'yes',
  
  b2cSettings: {
    payment_type: 'prepaid',
    service_type: 'surface',
    is_insurance: '0'
  }
};

export const NIMBUSPOST_ENDPOINTS = {
  login: '/users/login',
  createShipment: '/shipments/hyperlocal',
  trackShipment: '/shipments/track/bulk',
  cancelShipment: '/shipments/cancel',
  manifest: '/shipments/manifest',
  courierList: '/couriers'
};