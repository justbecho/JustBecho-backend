import express from 'express';
import { 
  getCart, 
  addToCart, 
  updateCartItem, 
  removeFromCart, 
  clearCart, 
  toggleBechoProtect,
  getCheckoutTotals,
  getCartBreakdown
} from '../controllers/cartController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(auth);

// Cart routes
router.get('/', getCart);
router.post('/add', addToCart);
router.put('/update/:itemId', updateCartItem);
router.delete('/remove/:itemId', removeFromCart);
router.delete('/clear', clearCart);
router.put('/item/:itemId/becho-protect', toggleBechoProtect);

// New checkout totals routes
router.get('/checkout-totals', getCheckoutTotals);
router.get('/breakdown', getCartBreakdown); // For debugging

export default router;