// controllers/cartController.js - WITH MANUAL CALCULATION
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

// Get user's cart
export const getCart = async (req, res) => {
  try {
    const userId = req.user.userId;

    const cart = await Cart.findOne({ user: userId })
      .populate('items.product', 'productName images finalPrice originalPrice stock seller condition brand category')
      .populate('items.product.seller', 'name username');

    if (!cart) {
      return res.json({
        success: true,
        cart: {
          items: [],
          totalAmount: 0,
          totalItems: 0,
          subtotal: 0,
          bechoProtectTotal: 0
        }
      });
    }

    res.json({
      success: true,
      cart: cart
    });

  } catch (error) {
    console.error('❌ Get cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching cart'
    });
  }
};

// Add item to cart - WITH MANUAL CALCULATION
export const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, price, bechoProtectSelected = false, bechoProtectPrice = 0 } = req.body;
    const userId = req.user.userId;

    console.log('🛒 Add to cart request:', req.body);

    // Validate required fields
    if (!productId || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and price are required'
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Validate stock
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock available'
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({ 
        user: userId, 
        items: [],
        subtotal: 0,
        bechoProtectTotal: 0,
        totalAmount: 0,
        totalItems: 0
      });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    // Calculate Becho Protect price
    let finalBechoProtectPrice = 0;
    if (bechoProtectSelected) {
      if (bechoProtectPrice && bechoProtectPrice > 0) {
        finalBechoProtectPrice = bechoProtectPrice;
      } else {
        // Calculate based on product price
        finalBechoProtectPrice = price < 15000 ? 499 : 999;
      }
    }

    if (existingItemIndex > -1) {
      // Update existing item
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      
      if (product.stock < newQuantity) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock for the requested quantity'
        });
      }

      cart.items[existingItemIndex].quantity = newQuantity;
      cart.items[existingItemIndex].price = price;
      cart.items[existingItemIndex].bechoProtect = {
        selected: bechoProtectSelected,
        price: finalBechoProtectPrice
      };
    } else {
      // Add new item to cart
      cart.items.push({
        product: productId,
        quantity: quantity,
        price: price,
        size: '',
        color: '',
        bechoProtect: {
          selected: bechoProtectSelected,
          price: finalBechoProtectPrice
        },
        totalPrice: 0
      });
    }

    // ✅ MANUALLY CALCULATE TOTALS
    let subtotal = 0;
    let bechoProtectTotal = 0;
    let totalItems = 0;
    
    cart.items.forEach(item => {
      const itemSubtotal = item.price * item.quantity;
      const bechoProtectItemTotal = (item.bechoProtect?.price || 0) * item.quantity;
      
      item.totalPrice = itemSubtotal + bechoProtectItemTotal;
      subtotal += itemSubtotal;
      bechoProtectTotal += bechoProtectItemTotal;
      totalItems += item.quantity;
    });
    
    cart.subtotal = subtotal;
    cart.bechoProtectTotal = bechoProtectTotal;
    cart.totalAmount = subtotal + bechoProtectTotal;
    cart.totalItems = totalItems;

    // Save cart
    await cart.save();

    // Populate cart with product details
    const populatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'productName images finalPrice originalPrice stock seller condition brand category')
      .populate('items.product.seller', 'name username');

    console.log('✅ Cart saved successfully');

    res.status(200).json({
      success: true,
      message: 'Product added to cart successfully',
      cart: populatedCart
    });

  } catch (error) {
    console.error('❌ Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding to cart',
      error: error.message
    });
  }
};

// Update cart item quantity
export const updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    const userId = req.user.userId;

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    // Check stock availability
    const product = await Product.findById(cart.items[itemIndex].product);
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock available'
      });
    }

    cart.items[itemIndex].quantity = quantity;
    
    // ✅ MANUALLY RECALCULATE TOTALS
    let subtotal = 0;
    let bechoProtectTotal = 0;
    let totalItems = 0;
    
    cart.items.forEach(item => {
      const itemSubtotal = item.price * item.quantity;
      const bechoProtectItemTotal = (item.bechoProtect?.price || 0) * item.quantity;
      
      item.totalPrice = itemSubtotal + bechoProtectItemTotal;
      subtotal += itemSubtotal;
      bechoProtectTotal += bechoProtectItemTotal;
      totalItems += item.quantity;
    });
    
    cart.subtotal = subtotal;
    cart.bechoProtectTotal = bechoProtectTotal;
    cart.totalAmount = subtotal + bechoProtectTotal;
    cart.totalItems = totalItems;

    await cart.save();

    // Populate cart
    const populatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'productName images finalPrice originalPrice stock seller condition brand category')
      .populate('items.product.seller', 'name username');

    res.json({
      success: true,
      message: 'Cart updated successfully',
      cart: populatedCart
    });

  } catch (error) {
    console.error('❌ Update cart item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating cart'
    });
  }
};

// Remove item from cart
export const removeFromCart = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.userId;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(item => item._id.toString() !== itemId);
    
    // ✅ MANUALLY RECALCULATE TOTALS
    let subtotal = 0;
    let bechoProtectTotal = 0;
    let totalItems = 0;
    
    cart.items.forEach(item => {
      const itemSubtotal = item.price * item.quantity;
      const bechoProtectItemTotal = (item.bechoProtect?.price || 0) * item.quantity;
      
      item.totalPrice = itemSubtotal + bechoProtectItemTotal;
      subtotal += itemSubtotal;
      bechoProtectTotal += bechoProtectItemTotal;
      totalItems += item.quantity;
    });
    
    cart.subtotal = subtotal;
    cart.bechoProtectTotal = bechoProtectTotal;
    cart.totalAmount = subtotal + bechoProtectTotal;
    cart.totalItems = totalItems;

    await cart.save();

    // Populate cart
    const populatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'productName images finalPrice originalPrice stock seller condition brand category')
      .populate('items.product.seller', 'name username');

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      cart: populatedCart
    });

  } catch (error) {
    console.error('❌ Remove from cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing from cart'
    });
  }
};

// Clear entire cart
export const clearCart = async (req, res) => {
  try {
    const userId = req.user.userId;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = [];
    cart.subtotal = 0;
    cart.bechoProtectTotal = 0;
    cart.totalAmount = 0;
    cart.totalItems = 0;

    await cart.save();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      cart: cart
    });

  } catch (error) {
    console.error('❌ Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while clearing cart'
    });
  }
};

// Toggle Becho Protect for a cart item
export const toggleBechoProtect = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { selected } = req.body;
    const userId = req.user.userId;

    if (selected === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Selected status is required'
      });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    // Update Becho Protect status and price
    cart.items[itemIndex].bechoProtect.selected = selected;
    
    if (selected) {
      const itemPrice = cart.items[itemIndex].price;
      cart.items[itemIndex].bechoProtect.price = itemPrice < 15000 ? 499 : 999;
    } else {
      cart.items[itemIndex].bechoProtect.price = 0;
    }
    
    // ✅ MANUALLY RECALCULATE TOTALS
    let subtotal = 0;
    let bechoProtectTotal = 0;
    let totalItems = 0;
    
    cart.items.forEach(item => {
      const itemSubtotal = item.price * item.quantity;
      const bechoProtectItemTotal = (item.bechoProtect?.price || 0) * item.quantity;
      
      item.totalPrice = itemSubtotal + bechoProtectItemTotal;
      subtotal += itemSubtotal;
      bechoProtectTotal += bechoProtectItemTotal;
      totalItems += item.quantity;
    });
    
    cart.subtotal = subtotal;
    cart.bechoProtectTotal = bechoProtectTotal;
    cart.totalAmount = subtotal + bechoProtectTotal;
    cart.totalItems = totalItems;

    await cart.save();

    // Populate cart
    const populatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'productName images finalPrice originalPrice stock seller condition brand category')
      .populate('items.product.seller', 'name username');

    res.json({
      success: true,
      message: `Becho Protect ${selected ? 'enabled' : 'disabled'} successfully`,
      cart: populatedCart
    });

  } catch (error) {
    console.error('❌ Toggle Becho Protect error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating Becho Protect'
    });
  }
};