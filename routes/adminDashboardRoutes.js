import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Category from "../models/Category.js";
import Cart from "../models/Cart.js";
import Wishlist from "../models/Wishlist.js";

const router = express.Router();

// ✅ ADMIN AUTH MIDDLEWARE - FIXED VERSION
// ✅ ADMIN AUTH MIDDLEWARE - FIXED WITH YOUR ENV
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

    // ✅ Use environment JWT_SECRET
    const JWT_SECRET = process.env.JWT_SECRET || "supersecretjustbecho";
    console.log('🔑 Using JWT_SECRET:', JWT_SECRET ? 'Set' : 'Not set');

    // ✅ Verify token
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

      // ✅ Check if user is admin
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
    
    // Total counts
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalCategories = await Category.countDocuments();
    
    // Sellers count
    const totalSellers = await User.countDocuments({ role: 'seller' });
    const verifiedSellers = await User.countDocuments({ 
      role: 'seller', 
      sellerVerified: true 
    });
    
    // Products by status
    const activeProducts = await Product.countDocuments({ status: 'active' });
    const soldProducts = await Product.countDocuments({ status: 'sold' });
    const pendingProducts = await Product.countDocuments({ status: 'pending' });
    
    // Orders by status
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const paidOrders = await Order.countDocuments({ status: 'paid' });
    const shippedOrders = await Order.countDocuments({ status: 'shipped' });
    const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
    
    // Recent data
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

    // Sales calculation
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

    // Get user's products
    const products = await Product.find({ seller: user._id });
    
    // Get user's orders
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
      products: products.slice(0, 10), // Limit to 10 products
      orders: orders.slice(0, 10) // Limit to 10 orders
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

    // Don't allow deleting self
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete yourself"
      });
    }

    // Delete user's products
    await Product.deleteMany({ seller: user._id });
    
    // Delete user's cart
    await Cart.deleteOne({ user: user._id });
    
    // Delete user's wishlist
    await Wishlist.deleteOne({ user: user._id });
    
    // Delete user's orders
    await Order.deleteMany({ user: user._id });
    
    // Delete user
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

    // Remove product from carts and wishlists
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

    // Date filter
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

    // Add timeline entry
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
    
    const categories = await Category.find()
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

router.post("/categories", async (req, res) => {
  try {
    const { name, description, image, href, isActive = true } = req.body;
    
    console.log('➕ Creating category:', name, req.body);

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required"
      });
    }

    // Check if category already exists
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
      isActive
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
    const { name, description, image, href, isActive } = req.body;
    
    console.log('🔄 Updating category:', categoryId, req.body);

    const category = await Category.findByIdAndUpdate(
      categoryId,
      {
        name,
        description,
        image,
        href,
        isActive
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

    // Check if category has products
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

    // Get sales data
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

    // Get recent orders
    const recentOrders = await Order.find({
      status: { $in: ['paid', 'delivered'] },
      ...dateFilter
    })
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(10);

    // Get top products
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

    // Populate product names
    for (let item of topProducts) {
      const product = await Product.findById(item._id).select('productName brand finalPrice images');
      item.product = product;
    }

    // Calculate totals
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
    
    // Get today's date
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));
    
    // Get yesterday's date
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0));
    const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999));
    
    // Today's stats
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
    
    // Yesterday's stats
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
    
    // Calculate growth
    const salesGrowth = yesterdaySales[0]?.total 
      ? ((todaySales[0]?.total || 0) - yesterdaySales[0].total) / yesterdaySales[0].total * 100
      : 0;
    
    const ordersGrowth = yesterdayOrders 
      ? ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100
      : 0;
    
    // Pending actions
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

export default router;