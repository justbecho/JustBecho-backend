// config/nimbuspostConfig.js
export const NIMBUSPOST_CONFIG = {
  // ✅ TUMHARA API KEY (Dashboard se mila hua)
  apiKey: 'ccbd48931ea40e234e8b00142ba1d8b60a2e71ae242245',
  
  // ✅ B2B API ENDPOINT (Tumhare dashboard mei jo "B2B API Document" link hai)
  baseURL: 'https://ship.nimbuspost.com/api',
  
  // ✅ TUMHARA CREDENTIALS
  credentials: {
    email: 'justbecho+2985@gmail.com',
    password: 'vRcYE3eZPj'
  },
  
  // ✅ WAREHOUSE DETAILS (JustBecho ka warehouse)
  warehouse: {
    name: 'JustBecho Warehouse',
    phone: '7000739393', // Apna warehouse phone daal do
    address: 'Your warehouse address, Gurugram',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '122001'
  },
  
  // ✅ DEFAULT COURIER (Delhivery B2B)
  defaultCourierId: '110',
  
  // ✅ SETTINGS
  defaultPaymentMethod: 'prepaid',
  autoPickup: 'yes'
};

export const NIMBUSPOST_ENDPOINTS = {
  createShipment: '/shipmentcargo/create',    // ✅ B2B SHIPMENT CREATE
  trackShipment: '/shipmentcargo/track',      // ✅ TRACK SHIPMENT
  cancelShipment: '/shipmentcargo/cancel',    // ✅ CANCEL SHIPMENT
  walletBalance: '/shipmentcargo/wallet_balance', // ✅ CHECK BALANCE
  pickupManifest: '/shipmentcargo/pickup'     // ✅ GENERATE MANIFEST
};