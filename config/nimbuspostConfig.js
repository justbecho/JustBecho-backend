// config/nimbuspostConfig.js - BOTH LEGS B2C
export const NIMBUSPOST_CONFIG = {
  // ✅ YOUR API KEY
  apiKey: 'ccbd48931ea40e234e8b00142ba1d8b60a2e71ae242245',
  
  // ✅ B2C API ENDPOINT
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
    pincode: '452001'
  },
  
  // ✅ DEFAULT COURIER FOR B2C
  defaultCourier: 'delhivery',
  
  // ✅ SETTINGS
  shipmentFlow: 'B2C_WAREHOUSE',
  autoForwardEnabled: true,
  
  // ✅ B2C SETTINGS
  b2cSettings: {
    payment_mode: 'prepaid',
    service_type: 'surface',
    collectable_amount: 0,
    is_returnable: true,
    return_days: 7,
    add_ons: {
      awb_required: "yes",
      label_required: "yes"
    }
  }
};

export const NIMBUSPOST_ENDPOINTS = {
  // B2C Endpoints
  createShipment: '/shipments',
  trackShipment: '/shipments/track',
  cancelShipment: '/shipments/cancel',
  generateLabel: '/shipments/label'
};