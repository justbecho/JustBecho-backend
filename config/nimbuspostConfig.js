// config/nimbuspostConfig.js - UPDATED VERSION
const NIMBUSPOST_CONFIG = {
  baseURL: 'https://api.nimbuspost.com/v1',
  
  credentials: {
    email: process.env.NIMBUSPOST_EMAIL || 'justbecho+2995@gmail.com',
    password: process.env.NIMBUSPOST_PASSWORD || 'FgVWcfQSnt'
  },
  
  apiKey: process.env.NIMBUSPOST_API_KEY || 'ccbd48931ea40e234e8b00142ba1d8b60a2e71ae242245',
  
  warehouse: {
    name: 'Just Becho',
    company: 'JustBecho Warehouse',
    address: '103 Dilpasand grand, Behind Rafael tower',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '452001',
    phone: '7000739393',
    latitude: '22.7196',
    longitude: '75.8577'
  },
  
  defaultCourier: 14, // Delhivery courier ID
  
  autoPickup: 'yes',
  
  b2cSettings: {
    payment_type: 'prepaid', // ✅ CHANGED FROM 'PREPAID' TO 'prepaid'
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