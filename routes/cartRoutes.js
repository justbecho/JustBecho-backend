// routes/cartRoutes.js - UPDATED WITH BECHO PROTECT ROUTES
import express from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  toggleBechoProtect // ✅ New function
} from "../controllers/cartController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ CART ROUTES (All require authentication)
router.get("/", authMiddleware, getCart);
router.post("/add", authMiddleware, addToCart);
router.put("/update/:itemId", authMiddleware, updateCartItem);
router.delete("/remove/:itemId", authMiddleware, removeFromCart);
router.delete("/clear", authMiddleware, clearCart);
router.put("/item/:itemId/becho-protect", authMiddleware, toggleBechoProtect); // ✅ New route

export default router;