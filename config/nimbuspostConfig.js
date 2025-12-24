// config/nimbuspostConfig.js
const NIMBUSPOST_CONFIG = {
  baseURL: 'https://api.nimbuspost.com/v1',
  
  credentials: {
    email: process.env.NIMBUSPOST_EMAIL || 'justbecho+2995@gmail.com',
    password: process.env.NIMBUSPOST_PASSWORD || 'FgVWcfQSnt'
  },
  
  apiKey: process.env.NIMBUSPOST_API_KEY || 'ccbd48931ea40e234e8b00142ba1d8b60a2e71ae242245',
  
  warehouse: {
    name: 'Devansh Kothari',
    company: 'JustBecho Warehouse',
    address: '103 Dilpasand grand, Behind Rafael tower',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '452001',
    phone: '9301847748',
    latitude: '22.7196',
    longitude: '75.8577'
  },
  
  // ✅ FIXED: Default courier ID for Delhivery
  defaultCourier: 14,
  
  autoPickup: true,
  
  b2cSettings: {
    payment_type: 'Prepaid',
    is_insurance: false
  }
};

const NIMBUSPOST_ENDPOINTS = {
  login: '/users/login',
  createShipment: '/shipments',
  trackShipment: '/track',
  courierList: '/couriers'
};

export { NIMBUSPOST_CONFIG, NIMBUSPOST_ENDPOINTS };