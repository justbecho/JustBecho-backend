import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Category from "../models/Category.js";
import Cart from "../models/Cart.js";
import Wishlist from "../models/Wishlist.js";

const router = express.Router();

// ✅ ADMIN AUTH MIDDLEWARE
const adminAuth = async (req, res, next) => {
  try {
    console.log('🔍 Admin auth middleware checking...');
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.log('❌ No authorization header');
      return res.status(401).json({
        success: false,
        message: "No token provided"
      });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : authHeader;
    
    console.log('Token received:', token ? token.substring(0, 20) + '...' : 'No token');

    if (!token) {
      console.log('❌ Token not found');
      return res.status(401).json({
        success: false,
        message: "No token, authorization denied"
      });
    }

    const JWT_SECRET = process.env.JWT_SECRET || "supersecretjustbecho";
    console.log('🔑 Using JWT_SECRET:', JWT_SECRET ? 'Set' : 'Not set');

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ Token decoded:', decoded);
      
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        console.log('❌ User not found for ID:', decoded.userId);
        return res.status(403).json({
          success: false,
          message: "Access denied. User not found."
        });
      }

      if (user.role !== 'admin') {
        console.log('❌ User is not admin. Role:', user.role);
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin only."
        });
      }

      console.log('✅ Admin authenticated:', user.email);
      req.user = user;
      next();
      
    } catch (jwtError) {
      console.error('❌ JWT verification error:', jwtError.message);
      return res.status(401).json({
        success: false,
        message: "Invalid token: " + jwtError.message
      });
    }

  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: "Server error in auth middleware"
    });
  }
};

// ✅ ALL DASHBOARD ROUTES REQUIRE ADMIN AUTH
router.use(adminAuth);

// ========================
// 📊 DASHBOARD STATS
// ========================
router.get("/stats", async (req, res) => {
  try {
    console.log('📊 Fetching dashboard stats for admin:', req.user.email);
    
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalCategories = await Category.countDocuments();
    
    const totalSellers = await User.countDocuments({ role: 'seller' });
    const verifiedSellers = await User.countDocuments({ 
      role: 'seller', 
      sellerVerified: true 
    });
    
    const activeProducts = await Product.countDocuments({ status: 'active' });
    const soldProducts = await Product.countDocuments({ status: 'sold' });
    const pendingProducts = await Product.countDocuments({ status: 'pending' });
    
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const paidOrders = await Order.countDocuments({ status: 'paid' });
    const shippedOrders = await Order.countDocuments({ status: 'shipped' });
    const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
    
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt');
    
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'name email')
      .select('totalAmount status createdAt');
    
    const recentProducts = await Product.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('seller', 'name email')
      .select('productName finalPrice status createdAt');

    const salesResult = await Order.aggregate([
      {
        $match: {
          status: { $in: ['paid', 'delivered'] }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$totalAmount" },
          count: { $sum: 1 }
        }
      }
    ]);

    const totalSales = salesResult[0]?.totalSales || 0;
    const totalOrdersCount = salesResult[0]?.count || 0;

    console.log('✅ Dashboard stats fetched successfully');

    res.json({
      success: true,
      message: "Dashboard stats fetched successfully",
      stats: {
        totals: {
          users: totalUsers,
          products: totalProducts,
          orders: totalOrders,
          categories: totalCategories,
          sellers: totalSellers,
          verifiedSellers: verifiedSellers
        },
        products: {
          active: activeProducts,
          sold: soldProducts,
          pending: pendingProducts
        },
        orders: {
          pending: pendingOrders,
          paid: paidOrders,
          shipped: shippedOrders,
          delivered: deliveredOrders
        },
        sales: {
          total: totalSales,
          orders: totalOrdersCount,
          average: totalOrdersCount > 0 ? totalSales / totalOrdersCount : 0
        },
        recent: {
          users: recentUsers,
          orders: recentOrders,
          products: recentProducts
        }
      }
    });

  } catch (error) {
    console.error('❌ Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: "Server error fetching stats: " + error.message
    });
  }
});

// ========================
// 👥 USER MANAGEMENT
// ========================
router.get("/users", async (req, res) => {
  try {
    console.log('👥 Fetching users for admin:', req.user.email);
    
    const { page = 1, limit = 20, search = '', role = '' } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    console.log(`✅ Found ${users.length} users`);

    res.json({
      success: true,
      message: "Users fetched successfully",
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Get users error:', error);
    res.status(500).json({
      success: false,
      message: "Server error fetching users: " + error.message
    });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    console.log('👤 Fetching user details for ID:', userId);
    
    const user = await User.findById(userId)
      .select('-password');

    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const products = await Product.find({ seller: user._id });
    const orders = await Order.find({ user: user._id });

    console.log('✅ User details fetched:', user.email);

    res.json({
      success: true,
      message: "User details fetched successfully",
      user,
      stats: {
        products: products.length,
        orders: orders.length,
        activeProducts: products.filter(p => p.status === 'active').length,
        soldProducts: products.filter(p => p.status === 'sold').length
      },
      products: products.slice(0, 10),
      orders: orders.slice(0, 10)
    });

  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({
      success: false,
      message: "Server error fetching user details: " + error.message
    });
  }
});

router.put("/users/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, phone, role, sellerVerified } = req.body;
    
    console.log('🔄 Updating user:', userId, req.body);
    
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (role) updateData.role = role;
    if (sellerVerified !== undefined) updateData.sellerVerified = sellerVerified;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    console.log('✅ User updated:', user.email);

    res.json({
      success: true,
      message: "User updated successfully",
      user
    });

  } catch (error) {
    console.error('❌ Update user error:', error);
    res.status(500).json({
      success: false,
      message: "Server error updating user: " + error.message
    });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    console.log('🗑️  Deleting user:', userId);
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete yourself"
      });
    }

    await Product.deleteMany({ seller: user._id });
    await Cart.deleteOne({ user: user._id });
    await Wishlist.deleteOne({ user: user._id });
    await Order.deleteMany({ user: user._id });
    await User.findByIdAndDelete(user._id);

    console.log('✅ User deleted:', user.email);

    res.json({
      success: true,
      message: "User deleted successfully"
    });

  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({
      success: false,
      message: "Server error deleting user: " + error.message
    });
  }
});

// ========================
// 📦 PRODUCT MANAGEMENT
// ========================
router.get("/products", async (req, res) => {
  try {
    console.log('📦 Fetching products for admin:', req.user.email);
    
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      status = '',
      category = '',
      seller = ''
    } = req.query;
    
    const skip = (page - 1) * limit;

    let query = {};
    
    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) query.status = status;
    if (category) query.category = { $regex: new RegExp(category, 'i') };
    if (seller) query.seller = seller;

    const products = await Product.find(query)
      .populate('seller', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    console.log(`✅ Found ${products.length} products`);

    res.json({
      success: true,
      message: "Products fetched successfully",
      products,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Get products error:', error);
    res.status(500).json({
      success: false,
      message: "Server error fetching products: " + error.message
    });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    console.log('📦 Fetching product details:', productId);
    
    const product = await Product.findById(productId)
      .populate('seller', 'name email phone address')
      .populate('categoryDetails');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    console.log('✅ Product details fetched:', product.productName);

    res.json({
      success: true,
      message: "Product details fetched successfully",
      product
    });

  } catch (error) {
    console.error('❌ Get product error:', error);
    res.status(500).json({
      success: false,
      message: "Server error fetching product: " + error.message
    });
  }
});

router.put("/products/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    console.log('🔄 Updating product:', productId, req.body);
    
    const { 
      productName, 
      brand, 
      category, 
      status, 
      finalPrice,
      askingPrice,
      description,
      condition,
      size,
      color,
      material
    } = req.body;

    const updateData = {};
    if (productName) updateData.productName = productName;
    if (brand) updateData.brand = brand;
    if (category) updateData.category = category;
    if (status) updateData.status = status;
    if (finalPrice) updateData.finalPrice = finalPrice;
    if (askingPrice) updateData.askingPrice = askingPrice;
    if (description) updateData.description = description;
    if (condition) updateData.condition = condition;
    if (size) updateData.size = size;
    if (color) updateData.color = color;
    if (material) updateData.material = material;

    const product = await Product.findByIdAndUpdate(
      productId,
      updateData,
      { new: true, runValidators: true }
    ).populate('seller', 'name email');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    console.log('✅ Product updated:', product.productName);

    res.json({
      success: true,
      message: "Product updated successfully",
      product
    });

  } catch (error) {
    console.error('❌ Update product error:', error);
    res.status(500).json({
      success: false,
      message: "Server error updating product: " + error.message
    });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    console.log('🗑️  Deleting product:', productId);
    
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    await Cart.updateMany(
      { 'products.product': productId },
      { $pull: { products: { product: productId } } }
    );
    
    await Wishlist.updateMany(
      {},
      { $pull: { products: productId } }
    );

    await Product.findByIdAndDelete(productId);

    console.log('✅ Product deleted:', product.productName);

    res.json({
      success: true,
      message: "Product deleted successfully"
    });

  } catch (error) {
    console.error('❌ Delete product error:', error);
    res.status(500).json({
      success: false,
      message: "Server error deleting product: " + error.message
    });
  }
});

// ========================
// 🛒 ORDER MANAGEMENT
// ========================
router.get("/orders", async (req, res) => {
  try {
    console.log('🛒 Fetching orders for admin:', req.user.email);
    
    const { 
      page = 1, 
      limit = 20, 
      status = '',
      search = '',
      dateFrom = '',
      dateTo = ''
    } = req.query;
    
    const skip = (page - 1) * limit;

    let query = {};
    
    if (status) query.status = status;
    
    if (search) {
      query.$or = [
        { razorpayOrderId: { $regex: search, $options: 'i' } },
        { 'shippingAddress.name': { $regex: search, $options: 'i' } },
        { 'shippingAddress.phone': { $regex: search, $options: 'i' } },
        { 'shippingAddress.email': { $regex: search, $options: 'i' } }
      ];
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('products', 'productName images finalPrice')
      .populate('seller', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    console.log(`✅ Found ${orders.length} orders`);

    res.json({
      success: true,
      message: "Orders fetched successfully",
      orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Get orders error:', error);
    res.status(500).json({
      success: false,
      message: "Server error fetching orders: " + error.message
    });
  }
});

router.get("/orders/:id", async (req, res) => {
  try {
    const orderId = req.params.id;
    console.log('🛒 Fetching order details:', orderId);
    
    const order = await Order.findById(orderId)
      .populate('user', 'name email phone address')
      .populate('products')
      .populate('seller', 'name email phone');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    console.log('✅ Order details fetched:', order._id);

    res.json({
      success: true,
      message: "Order details fetched successfully",
      order
    });

  } catch (error) {
    console.error('❌ Get order error:', error);
    res.status(500).json({
      success: false,
      message: "Server error fetching order: " + error.message
    });
  }
});

router.put("/orders/:id/status", async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;
    
    console.log('🔄 Updating order status:', orderId, status);
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required"
      });
    }

    const validStatuses = [
      'pending', 'paid', 'failed', 'confirmed', 'processing',
      'packed', 'shipped', 'out_for_delivery', 'delivered',
      'cancelled', 'return_requested', 'returned', 'refunded'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Valid statuses: " + validStatuses.join(', ')
      });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    order.timeline = order.timeline || [];
    order.timeline.push({
      event: 'status_changed',
      description: `Status changed to ${status} by admin`,
      status: status,
      timestamp: new Date(),
      changedBy: req.user.email
    });

    await order.save();

    console.log('✅ Order status updated:', orderId, 'to', status);

    res.json({
      success: true,
      message: "Order status updated successfully",
      order
    });

  } catch (error) {
    console.error('❌ Update order status error:', error);
    res.status(500).json({
      success: false,
      message: "Server error updating order status: " + error.message
    });
  }
});

// ========================
// 📁 CATEGORY MANAGEMENT
// ========================
router.get("/categories", async (req, res) => {
  try {
    console.log('📁 Fetching categories for admin:', req.user.email);
    
    const { search = '' } = req.query;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const categories = await Category.find(query)
      .sort({ name: 1 });

    console.log(`✅ Found ${categories.length} categories`);

    res.json({
      success: true,
      message: "Categories fetched successfully",
      categories
    });

  } catch (error) {
    console.error('❌ Get categories error:', error);
    res.status(500).json({
      success: false,
      message: "Server error fetching categories: " + error.message
    });
  }
});

router.get("/categories/:id", async (req, res) => {
  try {
    const categoryId = req.params.id;
    console.log('📁 Fetching category details:', categoryId);
    
    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    console.log('✅ Category details fetched:', category.name);

    res.json({
      success: true,
      message: "Category details fetched successfully",
      category
    });

  } catch (error) {
    console.error('❌ Get category error:', error);
    res.status(500).json({
      success: false,
      message: "Server error fetching category: " + error.message
    });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const { name, description, image, href, isActive = true, subCategories = [] } = req.body;
    
    console.log('➕ Creating category:', name, req.body);

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required"
      });
    }

    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category already exists"
      });
    }

    const category = new Category({
      name,
      description,
      image,
      href: href || name.toLowerCase().replace(/\s+/g, '-'),
      isActive,
      subCategories
    });

    await category.save();

    console.log('✅ Category created:', category.name);

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category
    });

  } catch (error) {
    console.error('❌ Create category error:', error);
    res.status(500).json({
      success: false,
      message: "Server error creating category: " + error.message
    });
  }
});

router.put("/categories/:id", async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { name, description, image, href, isActive, subCategories } = req.body;
    
    console.log('🔄 Updating category:', categoryId, req.body);

    const category = await Category.findByIdAndUpdate(
      categoryId,
      {
        name,
        description,
        image,
        href,
        isActive,
        subCategories
      },
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    console.log('✅ Category updated:', category.name);

    res.json({
      success: true,
      message: "Category updated successfully",
      category
    });

  } catch (error) {
    console.error('❌ Update category error:', error);
    res.status(500).json({
      success: false,
      message: "Server error updating category: " + error.message
    });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    const categoryId = req.params.id;
    console.log('🗑️  Deleting category:', categoryId);
    
    const category = await Category.findById(categoryId);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    const productCount = await Product.countDocuments({
      category: { $regex: new RegExp(`^${category.name}$`, 'i') }
    });

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${productCount} products`
      });
    }

    await Category.findByIdAndDelete(categoryId);

    console.log('✅ Category deleted:', category.name);

    res.json({
      success: true,
      message: "Category deleted successfully"
    });

  } catch (error) {
    console.error('❌ Delete category error:', error);
    res.status(500).json({
      success: false,
      message: "Server error deleting category: " + error.message
    });
  }
});

// ========================
// 📁 SUBCATEGORY MANAGEMENT
// ========================

// GET SUB-CATEGORIES FOR A CATEGORY
router.get("/categories/:categoryId/subcategories", async (req, res) => {
  try {
    const { categoryId } = req.params;
    console.log('📁 Fetching subcategories for category:', categoryId);
    
    const category = await Category.findById(categoryId);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    res.json({
      success: true,
      message: "Subcategories fetched successfully",
      subCategories: category.subCategories || []
    });

  } catch (error) {
    console.error('❌ Get subcategories error:', error);
    res.status(500).json({
      success: false,
      message: "Server error fetching subcategories: " + error.message
    });
  }
});

// ADD SUB-CATEGORY TO CATEGORY
router.post("/categories/:categoryId/subcategories", async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { title, slug, items = [] } = req.body;
    
    console.log('➕ Adding subcategory to category:', categoryId, req.body);

    if (!title || !slug) {
      return res.status(400).json({
        success: false,
        message: "Title and slug are required for subcategory"
      });
    }

    const category = await Category.findById(categoryId);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    const existingSubcategory = category.subCategories.find(
      sub => sub.slug.toLowerCase() === slug.toLowerCase()
    );

    if (existingSubcategory) {
      return res.status(400).json({
        success: false,
        message: "Subcategory with this slug already exists"
      });
    }

    category.subCategories = category.subCategories || [];
    category.subCategories.push({
      title,
      slug: slug.toLowerCase(),
      items: items || []
    });

    await category.save();

    console.log('✅ Subcategory added to:', category.name);

    res.status(201).json({
      success: true,
      message: "Subcategory added successfully",
      category
    });

  } catch (error) {
    console.error('❌ Add subcategory error:', error);
    res.status(500).json({
      success: false,
      message: "Server error adding subcategory: " + error.message
    });
  }
});

// UPDATE SUB-CATEGORY
router.put("/categories/:categoryId/subcategories/:subSlug", async (req, res) => {
  try {
    const { categoryId, subSlug } = req.params;
    const { title, newSlug, items } = req.body;
    
    console.log('🔄 Updating subcategory:', categoryId, subSlug, req.body);

    const category = await Category.findById(categoryId);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    const subIndex = category.subCategories.findIndex(
      sub => sub.slug === subSlug
    );

    if (subIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found"
      });
    }

    if (title) category.subCategories[subIndex].title = title;
    if (newSlug) category.subCategories[subIndex].slug = newSlug.toLowerCase();
    if (items !== undefined) category.subCategories[subIndex].items = items;

    await category.save();

    console.log('✅ Subcategory updated');

    res.json({
      success: true,
      message: "Subcategory updated successfully",
      category
    });

  } catch (error) {
    console.error('❌ Update subcategory error:', error);
    res.status(500).json({
      success: false,
      message: "Server error updating subcategory: " + error.message
    });
  }
});

// DELETE SUB-CATEGORY
router.delete("/categories/:categoryId/subcategories/:subSlug", async (req, res) => {
  try {
    const { categoryId, subSlug } = req.params;
    console.log('🗑️  Deleting subcategory:', categoryId, subSlug);
    
    const category = await Category.findById(categoryId);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    const initialLength = category.subCategories.length;
    category.subCategories = category.subCategories.filter(
      sub => sub.slug !== subSlug
    );

    if (category.subCategories.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found"
      });
    }

    await category.save();

    console.log('✅ Subcategory deleted from:', category.name);

    res.json({
      success: true,
      message: "Subcategory deleted successfully",
      category
    });

  } catch (error) {
    console.error('❌ Delete subcategory error:', error);
    res.status(500).json({
      success: false,
      message: "Server error deleting subcategory: " + error.message
    });
  }
});

// ADD ITEM TO SUB-CATEGORY
router.post("/categories/:categoryId/subcategories/:subSlug/items", async (req, res) => {
  try {
    const { categoryId, subSlug } = req.params;
    const { item } = req.body;
    
    console.log('➕ Adding item to subcategory:', categoryId, subSlug, item);

    if (!item || !item.trim()) {
      return res.status(400).json({
        success: false,
        message: "Item name is required"
      });
    }

    const category = await Category.findById(categoryId);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    const subIndex = category.subCategories.findIndex(
      sub => sub.slug === subSlug
    );

    if (subIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found"
      });
    }

    if (!category.subCategories[subIndex].items.includes(item.trim())) {
      category.subCategories[subIndex].items.push(item.trim());
      await category.save();
    }

    console.log('✅ Item added to subcategory');

    res.json({
      success: true,
      message: "Item added to subcategory successfully",
      category
    });

  } catch (error) {
    console.error('❌ Add item error:', error);
    res.status(500).json({
      success: false,
      message: "Server error adding item: " + error.message
    });
  }
});

// REMOVE ITEM FROM SUB-CATEGORY
router.delete("/categories/:categoryId/subcategories/:subSlug/items/:item", async (req, res) => {
  try {
    const { categoryId, subSlug, item } = req.params;
    console.log('🗑️  Removing item from subcategory:', categoryId, subSlug, item);
    
    const category = await Category.findById(categoryId);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    const subIndex = category.subCategories.findIndex(
      sub => sub.slug === subSlug
    );

    if (subIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found"
      });
    }

    category.subCategories[subIndex].items = 
      category.subCategories[subIndex].items.filter(i => i !== decodeURIComponent(item));

    await category.save();

    console.log('✅ Item removed from subcategory');

    res.json({
      success: true,
      message: "Item removed from subcategory successfully",
      category
    });

  } catch (error) {
    console.error('❌ Remove item error:', error);
    res.status(500).json({
      success: false,
      message: "Server error removing item: " + error.message
    });
  }
});

// ========================
// 📈 SALES REPORTS
// ========================
router.get("/sales-report", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    console.log('📈 Generating sales report for admin:', req.user.email);
    console.log('Date range:', startDate, 'to', endDate);
    
    let dateFilter = {};
    
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const salesData = await Order.aggregate([
      {
        $match: {
          status: { $in: ['paid', 'delivered'] },
          ...dateFilter
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" }
          },
          totalSales: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 }
      }
    ]);

    const recentOrders = await Order.find({
      status: { $in: ['paid', 'delivered'] },
      ...dateFilter
    })
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(10);

    const topProducts = await Order.aggregate([
      {
        $match: {
          status: { $in: ['paid', 'delivered'] },
          ...dateFilter
        }
      },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products",
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" }
        }
      },
      { $sort: { orderCount: -1 } },
      { $limit: 10 }
    ]);

    for (let item of topProducts) {
      const product = await Product.findById(item._id).select('productName brand finalPrice images');
      item.product = product;
    }

    const totalSales = salesData.reduce((sum, item) => sum + item.totalSales, 0);
    const totalOrders = salesData.reduce((sum, item) => sum + item.orderCount, 0);

    console.log('✅ Sales report generated');

    res.json({
      success: true,
      message: "Sales report generated successfully",
      report: {
        summary: {
          totalSales,
          totalOrders,
          averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0
        },
        salesData,
        recentOrders,
        topProducts,
        dateRange: {
          start: startDate,
          end: endDate
        }
      }
    });

  } catch (error) {
    console.error('❌ Sales report error:', error);
    res.status(500).json({
      success: false,
      message: "Server error generating sales report: " + error.message
    });
  }
});

// ========================
// 🏥 HEALTH CHECK
// ========================
router.get("/health", (req, res) => {
  console.log('🏥 Admin health check requested by:', req.user.email);
  
  res.json({
    success: true,
    message: "Admin dashboard API is healthy",
    timestamp: new Date().toISOString(),
    admin: {
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      id: req.user._id
    },
    endpoints: {
      stats: "GET /api/admin/dashboard/stats",
      users: "GET /api/admin/dashboard/users",
      products: "GET /api/admin/dashboard/products",
      orders: "GET /api/admin/dashboard/orders",
      categories: "GET /api/admin/dashboard/categories",
      sales: "GET /api/admin/dashboard/sales-report"
    }
  });
});

// ========================
// 📊 DASHBOARD SUMMARY
// ========================
router.get("/summary", async (req, res) => {
  try {
    console.log('📊 Fetching dashboard summary for admin:', req.user.email);
    
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0));
    const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999));
    
    const todayOrders = await Order.countDocuments({
      createdAt: { $gte: startOfToday, $lte: endOfToday }
    });
    
    const todaySales = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfToday, $lte: endOfToday },
          status: { $in: ['paid', 'delivered'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" }
        }
      }
    ]);
    
    const todayUsers = await User.countDocuments({
      createdAt: { $gte: startOfToday, $lte: endOfToday }
    });
    
    const todayProducts = await Product.countDocuments({
      createdAt: { $gte: startOfToday, $lte: endOfToday }
    });
    
    const yesterdayOrders = await Order.countDocuments({
      createdAt: { $gte: startOfYesterday, $lte: endOfYesterday }
    });
    
    const yesterdaySales = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfYesterday, $lte: endOfYesterday },
          status: { $in: ['paid', 'delivered'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" }
        }
      }
    ]);
    
    const salesGrowth = yesterdaySales[0]?.total 
      ? ((todaySales[0]?.total || 0) - yesterdaySales[0].total) / yesterdaySales[0].total * 100
      : 0;
    
    const ordersGrowth = yesterdayOrders 
      ? ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100
      : 0;
    
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const pendingProducts = await Product.countDocuments({ status: 'pending' });
    const pendingSellers = await User.countDocuments({ 
      role: 'seller', 
      sellerVerified: false 
    });

    console.log('✅ Dashboard summary fetched');

    res.json({
      success: true,
      message: "Dashboard summary fetched successfully",
      summary: {
        today: {
          orders: todayOrders,
          sales: todaySales[0]?.total || 0,
          users: todayUsers,
          products: todayProducts
        },
        yesterday: {
          orders: yesterdayOrders,
          sales: yesterdaySales[0]?.total || 0
        },
        growth: {
          sales: salesGrowth,
          orders: ordersGrowth
        },
        pending: {
          orders: pendingOrders,
          products: pendingProducts,
          sellers: pendingSellers
        },
        totals: {
          users: await User.countDocuments(),
          products: await Product.countDocuments(),
          orders: await Order.countDocuments(),
          categories: await Category.countDocuments()
        }
      }
    });

  } catch (error) {
    console.error('❌ Dashboard summary error:', error);
    res.status(500).json({
      success: false,
      message: "Server error fetching dashboard summary: " + error.message
    });
  }
});

// ========================
// 📊 WEBSITE ANALYTICS
// ========================
router.get("/analytics", async (req, res) => {
  try {
    console.log('📊 Fetching website analytics for admin:', req.user.email);
    
    const { days = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Daily user registrations
    const dailyRegistrations = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
      }
    ]);
    
    // Daily orders
    const dailyOrders = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" }
          },
          count: { $sum: 1 },
          revenue: { $sum: "$totalAmount" }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
      }
    ]);
    
    // Category-wise product count
    const categoryStats = await Product.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          averagePrice: { $avg: "$finalPrice" }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);
    
    // Top selling products
    const topSellingProducts = await Product.aggregate([
      {
        $match: {
          status: 'sold'
        }
      },
      {
        $group: {
          _id: "$productName",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$finalPrice" }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    console.log('✅ Website analytics fetched');

    res.json({
      success: true,
      message: "Website analytics fetched successfully",
      analytics: {
        period: `${days} days`,
        userRegistrations: dailyRegistrations,
        orderTrends: dailyOrders,
        categoryDistribution: categoryStats,
        topSellingProducts: topSellingProducts,
        summary: {
          totalUsers: await User.countDocuments({ createdAt: { $gte: startDate } }),
          totalOrders: await Order.countDocuments({ createdAt: { $gte: startDate } }),
          totalRevenue: await Order.aggregate([
            {
              $match: {
                createdAt: { $gte: startDate },
                status: { $in: ['paid', 'delivered'] }
              }
            },
            {
              $group: {
                _id: null,
                total: { $sum: "$totalAmount" }
              }
            }
          ]).then(result => result[0]?.total || 0)
        }
      }
    });

  } catch (error) {
    console.error('❌ Analytics error:', error);
    res.status(500).json({
      success: false,
      message: "Server error fetching analytics: " + error.message
    });
  }
});

// ========================
// 🚀 BULK OPERATIONS
// ========================
router.post("/bulk/update-product-status", async (req, res) => {
  try {
    const { productIds, status } = req.body;
    
    console.log('🚀 Bulk updating product status:', productIds.length, 'products to', status);

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product IDs array is required"
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required"
      });
    }

    const validStatuses = ['active', 'pending', 'sold', 'inactive'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Valid statuses: " + validStatuses.join(', ')
      });
    }

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: { status: status } }
    );

    console.log('✅ Bulk update completed:', result.modifiedCount, 'products updated');

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} products to ${status}`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('❌ Bulk update error:', error);
    res.status(500).json({
      success: false,
      message: "Server error in bulk operation: " + error.message
    });
  }
});

router.post("/bulk/delete-products", async (req, res) => {
  try {
    const { productIds } = req.body;
    
    console.log('🚀 Bulk deleting products:', productIds?.length, 'products');

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product IDs array is required"
      });
    }

    const result = await Product.deleteMany({ _id: { $in: productIds } });

    console.log('✅ Bulk delete completed:', result.deletedCount, 'products deleted');

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} products`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('❌ Bulk delete error:', error);
    res.status(500).json({
      success: false,
      message: "Server error in bulk delete: " + error.message
    });
  }
});

// ========================
// 📋 ACTIVITY LOG
// ========================
router.get("/activity-log", async (req, res) => {
  try {
    console.log('📋 Fetching activity log for admin:', req.user.email);
    
    const { page = 1, limit = 50, type = '' } = req.query;
    const skip = (page - 1) * limit;

    let logs = [];
    
    // Get user activity
    const userActivity = await User.find()
      .select('name email role lastLogin createdAt')
      .sort({ lastLogin: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get product activity
    const productActivity = await Product.find()
      .select('productName status createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get order activity
    const orderActivity = await Order.find()
      .select('status totalAmount createdAt')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    logs = [
      ...userActivity.map(u => ({
        type: 'user',
        action: u.lastLogin ? 'login' : 'created',
        user: u.name,
        email: u.email,
        timestamp: u.lastLogin || u.createdAt,
        details: `User ${u.role} ${u.lastLogin ? 'logged in' : 'registered'}`
      })),
      ...productActivity.map(p => ({
        type: 'product',
        action: p.status === 'sold' ? 'sold' : 'updated',
        product: p.productName,
        status: p.status,
        timestamp: p.updatedAt,
        details: `Product ${p.productName} ${p.status === 'sold' ? 'was sold' : 'status updated to ' + p.status}`
      })),
      ...orderActivity.map(o => ({
        type: 'order',
        action: o.status,
        orderId: o._id,
        amount: o.totalAmount,
        user: o.user?.name,
        timestamp: o.createdAt,
        details: `Order ${o._id} ${o.status} for ₹${o.totalAmount}`
      }))
    ];

    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    console.log('✅ Activity log fetched:', logs.length, 'entries');

    res.json({
      success: true,
      message: "Activity log fetched successfully",
      logs: logs.slice(0, limit),
      pagination: {
        total: logs.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(logs.length / limit)
      }
    });

  } catch (error) {
    console.error('❌ Activity log error:', error);
    res.status(500).json({
      success: false,
      message: "Server error fetching activity log: " + error.message
    });
  }
});

// ========================
// 🔐 ADMIN SETTINGS
// ========================
router.get("/settings", async (req, res) => {
  try {
    console.log('🔐 Fetching admin settings for:', req.user.email);
    
    // In a real app, you'd have a Settings model
    // For now, return some default settings
    const settings = {
      siteName: "Just Becho",
      siteUrl: "https://justbecho.com",
      adminEmail: req.user.email,
      currency: "INR",
      taxRate: 18,
      shippingCost: 50,
      freeShippingThreshold: 1000,
      maintenanceMode: false,
      allowNewRegistrations: true,
      allowNewProducts: true,
      requireProductApproval: true,
      maxProductsPerSeller: 100,
      commissionRate: 10,
      notificationSettings: {
        emailNotifications: true,
        orderNotifications: true,
        userNotifications: true,
        productNotifications: true
      },
      seoSettings: {
        metaTitle: "Just Becho - Buy & Sell Pre-loved Fashion",
        metaDescription: "Sustainable fashion marketplace for buying and selling pre-loved clothing and accessories.",
        keywords: "sustainable fashion, pre-loved, second-hand, buy, sell, clothing, accessories"
      }
    };

    console.log('✅ Admin settings fetched');

    res.json({
      success: true,
      message: "Admin settings fetched successfully",
      settings
    });

  } catch (error) {
    console.error('❌ Settings error:', error);
    res.status(500).json({
      success: false,
      message: "Server error fetching settings: " + error.message
    });
  }
});

router.put("/settings", async (req, res) => {
  try {
    console.log('🔐 Updating admin settings by:', req.user.email);
    
    // In a real app, you'd save to a Settings model
    // For now, just validate and return success
    const settings = req.body;
    
    console.log('Updated settings:', settings);

    // Validate required fields
    if (!settings.siteName || !settings.currency) {
      return res.status(400).json({
        success: false,
        message: "Site name and currency are required"
      });
    }

    console.log('✅ Admin settings updated');

    res.json({
      success: true,
      message: "Admin settings updated successfully",
      settings
    });

  } catch (error) {
    console.error('❌ Update settings error:', error);
    res.status(500).json({
      success: false,
      message: "Server error updating settings: " + error.message
    });
  }
});

// ========================
// 📧 NOTIFICATIONS
// ========================
router.get("/notifications", async (req, res) => {
  try {
    console.log('📧 Fetching notifications for admin:', req.user.email);
    
    // Get pending approvals
    const pendingProducts = await Product.countDocuments({ status: 'pending' });
    const pendingSellers = await User.countDocuments({ 
      role: 'seller', 
      sellerVerified: false 
    });
    const pendingOrders = await Order.countDocuments({ status: 'pending' });

    // Get recent activities
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt');

    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('totalAmount status createdAt');

    const notifications = [
      ...(pendingProducts > 0 ? [{
        type: 'warning',
        title: 'Pending Products',
        message: `${pendingProducts} products awaiting approval`,
        time: 'Just now',
        priority: 'high'
      }] : []),
      ...(pendingSellers > 0 ? [{
        type: 'warning',
        title: 'Pending Sellers',
        message: `${pendingSellers} sellers awaiting verification`,
        time: 'Just now',
        priority: 'medium'
      }] : []),
      ...(pendingOrders > 0 ? [{
        type: 'info',
        title: 'Pending Orders',
        message: `${pendingOrders} orders awaiting processing`,
        time: 'Just now',
        priority: 'low'
      }] : []),
      ...recentUsers.map(user => ({
        type: 'info',
        title: 'New User',
        message: `${user.name} (${user.email}) registered as ${user.role}`,
        time: new Date(user.createdAt).toLocaleTimeString(),
        priority: 'low'
      })),
      ...recentOrders.map(order => ({
        type: 'success',
        title: 'New Order',
        message: `Order #${order._id.toString().substring(0, 8)} for ₹${order.totalAmount}`,
        time: new Date(order.createdAt).toLocaleTimeString(),
        priority: 'medium'
      }))
    ];

    console.log('✅ Notifications fetched:', notifications.length);

    res.json({
      success: true,
      message: "Notifications fetched successfully",
      notifications,
      counts: {
        pendingProducts,
        pendingSellers,
        pendingOrders,
        total: notifications.length
      }
    });

  } catch (error) {
    console.error('❌ Notifications error:', error);
    res.status(500).json({
      success: false,
      message: "Server error fetching notifications: " + error.message
    });
  }
});

export default router;