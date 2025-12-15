// File: /backend/routes/razorpayWebhook.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Webhook endpoint (Razorpay directly calls this)
router.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET; // Dashboard se alag secret
  
  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('hex');
  
  if (expectedSignature === signature) {
    const event = JSON.parse(req.body);
    
    // Handle specific events
    switch (event.event) {
      case 'payment.captured':
        // Update database
        console.log('Payment captured via webhook:', event.payload.payment.entity.id);
        break;
      case 'payment.failed':
        console.log('Payment failed:', event.payload.payment.entity.id);
        break;
    }
    
    res.json({ status: 'ok' });
  } else {
    res.status(400).json({ error: 'Invalid webhook signature' });
  }
});

module.exports = router;