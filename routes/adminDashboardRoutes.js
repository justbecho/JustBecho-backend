import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Category from "../models/Category.js";
import Cart from "../models/Cart.js";
import Wishlist from "../models/Wishlist.js";

const router = express.Router();

// ✅ AUTH MIDDLEWARE FOR ADMIN
const adminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.userId);
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only."
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid token"
    });
  }
};

// ✅ ALL ROUTES REQUIRE ADMIN AUTH
router.use(adminAuth);

// ========================
// 📊 DASHBOARD STATS
// ========================
router.get("/stats", async (req, res) => {
  try {
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

    res.json({
      success: true,
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
      message: "Server error"
    });
  }
});

// ========================
// 👥 USER MANAGEMENT
// ========================
router.get("/users", async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', role = '' } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
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

    res.json({
      success: true,
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
      message: "Server error"
    });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get user's products
    const products = await Product.find({ seller: user._id });
    
    // Get user's orders
    const orders = await Order.find({ user: user._id });

    res.json({
      success: true,
      user,
      stats: {
        products: products.length,
        orders: orders.length
      },
      products,
      orders
    });

  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.put("/users/:id", async (req, res) => {
  try {
    const { name, email, phone, role, sellerVerified } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (role) updateData.role = role;
    if (sellerVerified !== undefined) updateData.sellerVerified = sellerVerified;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: "User updated successfully",
      user
    });

  } catch (error) {
    console.error('❌ Update user error:', error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
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
    
    // Delete user
    await User.findByIdAndDelete(user._id);

    res.json({
      success: true,
      message: "User deleted successfully"
    });

  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ========================
// 📦 PRODUCT MANAGEMENT
// ========================
router.get("/products", async (req, res) => {
  try {
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
      .populate('seller', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
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
      message: "Server error"
    });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('seller', 'name email phone');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    res.json({
      success: true,
      product
    });

  } catch (error) {
    console.error('❌ Get product error:', error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.put("/products/:id", async (req, res) => {
  try {
    const { 
      productName, 
      brand, 
      category, 
      status, 
      finalPrice,
      askingPrice,
      description 
    } = req.body;

    const updateData = {};
    if (productName) updateData.productName = productName;
    if (brand) updateData.brand = brand;
    if (category) updateData.category = category;
    if (status) updateData.status = status;
    if (finalPrice) updateData.finalPrice = finalPrice;
    if (askingPrice) updateData.askingPrice = askingPrice;
    if (description) updateData.description = description;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('seller', 'name email');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    res.json({
      success: true,
      message: "Product updated successfully",
      product
    });

  } catch (error) {
    console.error('❌ Update product error:', error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    await Product.findByIdAndDelete(product._id);

    res.json({
      success: true,
      message: "Product deleted successfully"
    });

  } catch (error) {
    console.error('❌ Delete product error:', error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ========================
// 🛒 ORDER MANAGEMENT
// ========================
router.get("/orders", async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status = '',
      search = ''
    } = req.query;
    
    const skip = (page - 1) * limit;

    let query = {};
    
    if (status) query.status = status;
    
    if (search) {
      query.$or = [
        { razorpayOrderId: { $regex: search, $options: 'i' } },
        { 'shippingAddress.name': { $regex: search, $options: 'i' } },
        { 'shippingAddress.phone': { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(query)
      .populate('user', 'name email')
      .populate('products', 'productName images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
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
      message: "Server error"
    });
  }
});

router.get("/orders/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('products')
      .populate('seller', 'name email');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error('❌ Get order error:', error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.put("/orders/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    
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
        message: "Invalid status"
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    res.json({
      success: true,
      message: "Order status updated",
      order
    });

  } catch (error) {
    console.error('❌ Update order status error:', error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ========================
// 📁 CATEGORY MANAGEMENT
// ========================
router.get("/categories", async (req, res) => {
  try {
    const categories = await Category.find()
      .sort({ name: 1 });

    res.json({
      success: true,
      categories
    });

  } catch (error) {
    console.error('❌ Get categories error:', error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const { name, description, image, href, isActive = true } = req.body;

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

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category
    });

  } catch (error) {
    console.error('❌ Create category error:', error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.put("/categories/:id", async (req, res) => {
  try {
    const { name, description, image, href, isActive } = req.body;

    const category = await Category.findByIdAndUpdate(
      req.params.id,
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

    res.json({
      success: true,
      message: "Category updated successfully",
      category
    });

  } catch (error) {
    console.error('❌ Update category error:', error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
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

    await Category.findByIdAndDelete(category._id);

    res.json({
      success: true,
      message: "Category deleted successfully"
    });

  } catch (error) {
    console.error('❌ Delete category error:', error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ========================
// 📈 SALES REPORTS
// ========================
router.get("/sales-report", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
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
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { orderCount: -1 } },
      { $limit: 10 }
    ]);

    // Populate product names
    for (let item of topProducts) {
      const product = await Product.findById(item._id).select('productName brand finalPrice');
      item.product = product;
    }

    res.json({
      success: true,
      report: {
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
      message: "Server error"
    });
  }
});

export default router;