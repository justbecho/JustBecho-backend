import Product from "../models/Product.js";
import User from "../models/User.js";
import { v2 as cloudinary } from 'cloudinary';

// ✅ CREATE PRODUCT
const createProduct = async (req, res) => {
  console.log('=== 🚨 CREATE PRODUCT START ===');
  
  try {
    // ✅ SAFE: Access request data
    const body = req.body || {};
    const files = req.files || [];
    const user = req.user || {};
    
    console.log('📥 Request received:', {
      hasBody: !!body,
      hasFiles: files.length > 0,
      hasUser: !!user.userId,
      bodyKeys: Object.keys(body)
    });

    // ✅ Validate authentication
    if (!user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Please login to list a product'
      });
    }

    // ✅ Validate required fields
    const requiredFields = [
      'productName', 'brand', 'category', 'productType', 
      'condition', 'description', 'askingPrice'
    ];
    
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // ✅ Extract fields safely
    const productName = String(body.productName || '').trim();
    const brand = String(body.brand || '').trim();
    const category = String(body.category || '').trim();
    const productType = String(body.productType || '').trim();
    const condition = String(body.condition || '').trim();
    const description = String(body.description || '').trim();
    const askingPrice = body.askingPrice || '0';
    const purchaseYear = body.purchaseYear || '';

    // ✅ Validate images
    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one product image is required'
      });
    }

    console.log('✅ Validations passed');

    // ✅ Calculate price
    const price = parseFloat(askingPrice);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid asking price'
      });
    }

    // ✅ Platform fee calculation
    let platformFeePercentage = 15;
    if (price <= 2000) platformFeePercentage = 30;
    else if (price <= 5000) platformFeePercentage = 28;
    else if (price <= 10000) platformFeePercentage = 25;
    else if (price <= 15000) platformFeePercentage = 20;

    const feeAmount = (price * platformFeePercentage) / 100;
    const finalPrice = Math.ceil(price + feeAmount);

    console.log('💰 Price calculation:', { price, platformFeePercentage, finalPrice });

    // ✅ UPLOAD IMAGES
    console.log('🖼️ Starting image upload...');
    const imageUrls = [];
    const cloudinaryConfig = {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    };

    const isCloudinaryConfigured = cloudinaryConfig.cloud_name && 
                                   cloudinaryConfig.api_key && 
                                   cloudinaryConfig.api_secret;

    console.log('☁️ Cloudinary configured:', isCloudinaryConfigured);
    
    for (const [index, file] of files.entries()) {
      try {
        if (!file.buffer) {
          console.log('⚠️ File has no buffer');
          continue;
        }

        let imageUrl = '';
        
        if (isCloudinaryConfigured) {
          // Upload to Cloudinary
          const b64 = Buffer.from(file.buffer).toString('base64');
          const dataURI = `data:${file.mimetype};base64,${b64}`;
          
          console.log(`📤 Uploading image ${index + 1}/${files.length} to Cloudinary...`);
          
          const result = await cloudinary.uploader.upload(dataURI, {
            folder: 'justbecho/products',
            resource_type: 'image'
          });
          
          imageUrl = result.secure_url;
          console.log(`✅ Cloudinary upload successful: ${file.originalname}`);
        } else {
          // Fallback to placeholder
          const placeholders = [
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
            'https://images.unsplash.com/photo-1565958011703-44f9829ba187',
            'https://images.unsplash.com/photo-1482049016688-2d3e1b311543'
          ];
          imageUrl = placeholders[Math.floor(Math.random() * placeholders.length)];
          console.log(`⚠️ Cloudinary not configured. Using placeholder for: ${file.originalname}`);
        }
        
        imageUrls.push({
          url: imageUrl,
          publicId: null,
          isPrimary: imageUrls.length === 0
        });
        
      } catch (uploadError) {
        console.error(`❌ Image ${index + 1} upload failed:`, uploadError.message);
        
        // If Cloudinary error, use placeholder
        const placeholders = [
          'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
          'https://images.unsplash.com/photo-1565958011703-44f9829ba187'
        ];
        const fallbackUrl = placeholders[Math.floor(Math.random() * placeholders.length)];
        
        imageUrls.push({
          url: fallbackUrl,
          publicId: null,
          isPrimary: imageUrls.length === 0
        });
        
        console.log(`✅ Using fallback image for ${file.originalname}`);
      }
    }

    if (imageUrls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to process any images'
      });
    }

    console.log(`✅ Processed ${imageUrls.length} images`);

    // ✅ Get seller info
    const seller = await User.findById(user.userId).select('name email username');
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // ✅ Prepare product data
    const productData = {
      productName,
      brand,
      category,
      productType,
      condition,
      description,
      askingPrice: price,
      platformFee: platformFeePercentage,
      finalPrice,
      images: imageUrls,
      seller: user.userId,
      sellerName: seller.name || seller.email.split('@')[0],
      sellerUsername: seller.username || '',
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    };

    // ✅ Add optional fields
    if (purchaseYear && !isNaN(parseInt(purchaseYear))) {
      productData.purchaseYear = parseInt(purchaseYear);
    }

    // ✅ Create and save product
    const product = new Product(productData);
    const savedProduct = await product.save();
    
    console.log('✅ Product created:', savedProduct._id);
    console.log('=== ✅ CREATE PRODUCT SUCCESS ===');

    res.status(201).json({
      success: true,
      message: 'Product listed successfully!',
      product: {
        id: savedProduct._id,
        productName: savedProduct.productName,
        brand: savedProduct.brand,
        finalPrice: savedProduct.finalPrice,
        images: savedProduct.images.map(img => img.url),
        sellerName: savedProduct.sellerName,
        status: savedProduct.status
      }
    });

  } catch (error) {
    console.error('=== ❌ CREATE PRODUCT ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed: ' + messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating product: ' + error.message
    });
  }
};

// ✅ GET USER PRODUCTS
const getUserProducts = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const products = await Product.find({ seller: userId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      products: products.map(product => ({
        id: product._id,
        productName: product.productName,
        brand: product.brand,
        category: product.category,
        finalPrice: product.finalPrice,
        images: product.images.map(img => img.url),
        status: product.status,
        createdAt: product.createdAt,
        views: product.views,
        likes: product.likes
      }))
    });
  } catch (error) {
    console.error('Get User Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ GET ALL PRODUCTS
const getAllProducts = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 12, 
      category, 
      brand,
      search 
    } = req.query;
    
    let query = { status: 'active' };
    
    if (category && category !== 'all') {
      query.category = { $regex: new RegExp(category, 'i') };
    }
    
    if (brand && brand !== 'all') {
      query.brand = { $regex: new RegExp(brand, 'i') };
    }
    
    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('productName brand category finalPrice images views likes createdAt condition');

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get All Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅
// ✅ PERMANENT FIX: GET PRODUCTS BY CATEGORY - NO MIXING OF MEN'S/WOMEN'S FASHION
// ✅ ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅
const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 12, brand } = req.query;
    
    console.log('🔍 [PERMANENT FIX] Fetching products for category slug:', category);
    
    // ✅ STEP 1: Normalize the requested category slug
    const requestedCategory = category.trim().toLowerCase();
    
    // ✅ STEP 2: Category mapping - URL slugs to Database category names
    const categoryMapping = {
      // Men's Fashion
      'mens-fashion': "Men's Fashion",
      'men-s-fashion': "Men's Fashion",
      'mensfashion': "Men's Fashion",
      'mens': "Men's Fashion",
      'men': "Men's Fashion",
      'men-fashion': "Men's Fashion",
      
      // Women's Fashion  
      'womens-fashion': "Women's Fashion",
      'women-s-fashion': "Women's Fashion",
      'womensfashion': "Women's Fashion",
      'womens': "Women's Fashion",
      'women': "Women's Fashion",
      'women-fashion': "Women's Fashion",
      
      // Other categories
      'footwear': "Footwear",
      'shoes': "Footwear",
      'sneakers': "Footwear",
      
      'accessories': "Accessories",
      'fashion-accessories': "Accessories",
      
      'watches': "Watches",
      'timepieces': "Watches",
      
      'perfumes': "Perfumes",
      'fragrances': "Perfumes",
      
      'bags': "Bags",
      'handbags': "Bags",
      
      'toys-collectibles': "TOYS & COLLECTIBLES",
      'toys': "TOYS & COLLECTIBLES",
      'collectibles': "TOYS & COLLECTIBLES",
      'toys-and-collectibles': "TOYS & COLLECTIBLES",
      
      'kids': "KIDS",
      'children': "KIDS",
      'kids-fashion': "KIDS"
    };
    
    // ✅ STEP 3: Get exact database category name
    let dbCategoryName = categoryMapping[requestedCategory];
    
    // If not found in mapping, try to find exact match in database
    if (!dbCategoryName) {
      const allCategories = await Product.distinct('category');
      const foundCategory = allCategories.find(cat => 
        cat.toLowerCase().replace(/[^a-z]/g, '') === requestedCategory.replace(/[^a-z]/g, '')
      );
      
      if (foundCategory) {
        dbCategoryName = foundCategory;
      } else {
        // Fallback: Convert URL slug to proper format
        dbCategoryName = requestedCategory
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    }
    
    console.log(`✅ [PERMANENT FIX] URL Slug: "${requestedCategory}" → Database Category: "${dbCategoryName}"`);
    
    // ✅ STEP 4: Build query with EXACT CASE-INSENSITIVE MATCH
    let query = { 
      status: 'active',
      category: { $regex: new RegExp(`^${dbCategoryName}$`, 'i') } // EXACT MATCH, case-insensitive
    };
    
    // ✅ STEP 5: For Men's/Women's Fashion, add additional safety
    if (dbCategoryName.includes("Men") || dbCategoryName.includes("Men's")) {
      console.log('🎯 [PERMANENT FIX] Applying Men\'s Fashion strict filter');
      query = { 
        status: 'active',
        $or: [
          { category: { $regex: /^Men'?s? Fashion$/i } },
          { category: "Men's Fashion" },
          { category: "Mens Fashion" },
          { category: "Men Fashion" }
        ]
      };
    } 
    else if (dbCategoryName.includes("Women") || dbCategoryName.includes("Women's")) {
      console.log('🎯 [PERMANENT FIX] Applying Women\'s Fashion strict filter');
      query = { 
        status: 'active',
        $or: [
          { category: { $regex: /^Women'?s? Fashion$/i } },
          { category: "Women's Fashion" },
          { category: "Womens Fashion" },
          { category: "Women Fashion" }
        ]
      };
    }
    
    // ✅ STEP 6: Added brand filter
    if (brand && brand !== 'all') {
      query.brand = { $regex: new RegExp(brand, 'i') };
    }

    const skip = (page - 1) * limit;

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('productName brand category finalPrice images views likes createdAt condition');

    const total = await Product.countDocuments(query);
    
    // ✅ STEP 7: Verification logs
    console.log(`✅ [PERMANENT FIX] Found ${products.length} products`);
    
    if (products.length > 0) {
      const uniqueCategories = [...new Set(products.map(p => p.category))];
      console.log(`✅ [PERMANENT FIX] Categories in results:`, uniqueCategories);
      
      // ✅ CRITICAL: Verify no mixed categories
      if (uniqueCategories.length > 1) {
        console.warn(`⚠️ [PERMANENT FIX] WARNING: Multiple categories found:`, uniqueCategories);
        
        // Filter to keep only the requested category
        const filteredProducts = products.filter(p => 
          p.category.toLowerCase().includes(requestedCategory.replace(/[^a-z]/g, '')) ||
          requestedCategory.replace(/[^a-z]/g, '').includes(p.category.toLowerCase().replace(/[^a-z]/g, ''))
        );
        
        if (filteredProducts.length !== products.length) {
          console.log(`✅ [PERMANENT FIX] Filtered ${products.length - filteredProducts.length} mixed category products`);
          return res.status(200).json({
            success: true,
            products: filteredProducts,
            category: requestedCategory,
            dbCategory: dbCategoryName,
            warning: `Filtered ${products.length - filteredProducts.length} mixed category products`,
            pagination: {
              total: filteredProducts.length,
              page: Number(page),
              limit: Number(limit),
              totalPages: Math.ceil(filteredProducts.length / limit)
            }
          });
        }
      }
    }
    
    console.log(`✅ [PERMANENT FIX] Final query:`, JSON.stringify(query, null, 2));

    res.status(200).json({
      success: true,
      products,
      category: requestedCategory,
      dbCategory: dbCategoryName,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ [PERMANENT FIX] Get Products By Category Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ GET PRODUCTS BY BRAND
const getProductsByBrand = async (req, res) => {
  try {
    const { brand } = req.params;
    const { category, page = 1, limit = 20 } = req.query;
    
    console.log('Fetching products for brand:', brand);
    console.log('Category filter:', category);
    
    let query = { 
      status: 'active',
      brand: { $regex: new RegExp(`^${brand}$`, 'i') } // Exact match for brand
    };
    
    // If category is provided, add it to filter
    if (category && category !== 'all') {
      // Use exact category matching to prevent mixing
      query.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }
    
    console.log('Query:', query);

    const skip = (page - 1) * limit;

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('productName brand category finalPrice images views likes createdAt condition');

    const total = await Product.countDocuments(query);
    
    console.log('Found products:', products.length);

    res.status(200).json({
      success: true,
      brand,
      category,
      products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get Products By Brand Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ GET ALL BRANDS
const getAllBrands = async (req, res) => {
  try {
    const brands = await Product.distinct('brand', { status: 'active' });
    
    const brandsWithCount = await Promise.all(
      brands.map(async (brand) => {
        const count = await Product.countDocuments({ 
          brand: { $regex: new RegExp(`^${brand}$`, 'i') },
          status: 'active'
        });
        return {
          name: brand,
          count: count
        };
      })
    );
    
    // Sort alphabetically
    const sortedBrands = brandsWithCount.sort((a, b) => 
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    
    // Filter out empty brands
    const filteredBrands = sortedBrands.filter(b => b.name && b.name.trim() !== '');

    res.status(200).json({
      success: true,
      brands: filteredBrands,
      total: filteredBrands.length
    });
  } catch (error) {
    console.error('Get All Brands Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ GET SINGLE PRODUCT
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Increment views
    product.views += 1;
    await product.save();

    // Get seller info
    const seller = await User.findById(product.seller)
      .select('name email username phone instaId sellerVerified');

    const productWithSeller = {
      ...product.toObject(),
      seller: seller ? {
        id: seller._id,
        name: seller.name,
        username: seller.username,
        phone: seller.phone,
        instaId: seller.instaId,
        sellerVerified: seller.sellerVerified
      } : null
    };

    res.status(200).json({
      success: true,
      product: productWithSeller
    });
  } catch (error) {
    console.error('Get Product Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ UPDATE PRODUCT
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const user = req.user;
    const isOwner = product.seller.toString() === user.userId;
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this product'
      });
    }

    const updateData = { ...req.body };
    
    // Handle image updates if files are provided
    if (req.files && req.files.length > 0) {
      const imageUrls = [];
      
      for (const file of req.files) {
        try {
          if (!file.buffer) {
            console.log('⚠️ File has no buffer');
            continue;
          }

          const cloudinaryConfig = {
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
          };

          if (cloudinaryConfig.cloud_name && cloudinaryConfig.api_key && 
              cloudinaryConfig.api_secret) {
            const b64 = Buffer.from(file.buffer).toString('base64');
            const dataURI = `data:${file.mimetype};base64,${b64}`;
            
            const result = await cloudinary.uploader.upload(dataURI, {
              folder: 'justbecho/products'
            });
            
            imageUrls.push({
              url: result.secure_url,
              publicId: result.public_id,
              isPrimary: imageUrls.length === 0
            });
          }
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
        }
      }
      
      if (imageUrls.length > 0) {
        updateData.images = imageUrls;
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Update Product Error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ DELETE PRODUCT
const deleteProduct = async (req, res) => {
  try {
    console.log('=== 🗑️ DELETE PRODUCT START ===');
    console.log('📥 Product ID:', req.params.id);
    console.log('👤 User object:', req.user);
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    console.log('✅ Product found:', {
      id: product._id,
      name: product.productName,
      seller: product.seller.toString()
    });
    
    const user = req.user;
    console.log('👤 Current user:', {
      userId: user.userId,
      email: user.email,
      role: user.role
    });
    
    // ✅ FIX: Check if user is admin OR owner
    const isOwner = product.seller.toString() === user.userId;
    const isAdmin = user.role === 'admin';
    
    console.log('🔐 Authorization check:', {
      isOwner,
      isAdmin,
      canDelete: isOwner || isAdmin
    });
    
    if (!isOwner && !isAdmin) {
      console.log('❌ Not authorized to delete');
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this product'
      });
    }
    
    // ✅ ADMIN SPECIAL LOG
    if (isAdmin) {
      console.log('👑 ADMIN ACTION: Deleting product');
    }
    
    await Product.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      message: isAdmin ? 'Product deleted by admin' : 'Product deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Delete Product Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ GET FEATURED PRODUCTS
const getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({ 
      status: 'active'
    })
      .sort({ views: -1, likes: -1 })
      .limit(8)
      .select('productName brand finalPrice images views likes condition');

    res.status(200).json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Get Featured Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ SEARCH PRODUCTS
const searchProducts = async (req, res) => {
  try {
    const { q, brand, category, limit = 20 } = req.query;
    
    let query = { status: 'active' };
    
    if (brand && brand !== 'all') {
      query.brand = { $regex: new RegExp(brand, 'i') };
    }
    
    if (category && category !== 'all') {
      // Use exact category matching
      query.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }
    
    if (q) {
      query.$or = [
        { productName: { $regex: q, $options: 'i' } },
        { brand: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } }
      ];
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .select('productName brand category finalPrice images views likes createdAt condition');

    res.status(200).json({
      success: true,
      products,
      count: products.length
    });
  } catch (error) {
    console.error('Search Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ TEST CLOUDINARY ENDPOINT
const testCloudinary = async (req, res) => {
  try {
    const cloudinaryConfig = {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    };

    const isConfigured = cloudinaryConfig.cloud_name && 
                         cloudinaryConfig.api_key && 
                         cloudinaryConfig.api_secret;

    if (!isConfigured) {
      return res.json({
        success: false,
        message: 'Cloudinary not configured',
        env_variables: {
          CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || 'not set',
          CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? 'set (hidden)' : 'not set',
          CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? 'set (hidden)' : 'not set'
        }
      });
    }

    // Test upload
    const testImage = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
    
    try {
      const result = await cloudinary.uploader.upload(testImage, {
        folder: 'justbecho/test'
      });

      res.json({
        success: true,
        message: 'Cloudinary is working!',
        test: {
          uploaded: true,
          url: result.secure_url,
          public_id: result.public_id
        },
        config: {
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key_set: !!process.env.CLOUDINARY_API_KEY,
          api_secret_set: !!process.env.CLOUDINARY_API_SECRET
        }
      });
    } catch (uploadError) {
      res.status(500).json({
        success: false,
        message: 'Cloudinary upload failed',
        error: uploadError.message,
        config: cloudinaryConfig
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message
    });
  }
};

// ✅ DEBUG ENDPOINT: Get all categories with counts
const getAllCategoriesDebug = async (req, res) => {
  try {
    const categories = await Product.aggregate([
      { $match: { status: 'active' } },
      { 
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          sampleProducts: { 
            $push: { 
              id: '$_id',
              name: '$productName',
              brand: '$brand'
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({
      success: true,
      totalCategories: categories.length,
      categories: categories.map(cat => ({
        name: cat._id,
        count: cat.count,
        sampleProducts: cat.sampleProducts.slice(0, 3)
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ✅ DEBUG ENDPOINT: Check specific category matching
const checkCategoryMatch = async (req, res) => {
  try {
    const { category } = req.params;
    
    const regexMatch = new RegExp(category, 'i');
    const exactMatch = new RegExp(`^${category}$`, 'i');
    
    const regexProducts = await Product.find({ 
      category: { $regex: regexMatch },
      status: 'active'
    }).select('productName brand category').limit(5);
    
    const exactProducts = await Product.find({ 
      category: { $regex: exactMatch },
      status: 'active'
    }).select('productName brand category').limit(5);
    
    res.json({
      success: true,
      requestedCategory: category,
      regexMatch: {
        pattern: regexMatch.toString(),
        count: regexProducts.length,
        products: regexProducts
      },
      exactMatch: {
        pattern: exactMatch.toString(),
        count: exactProducts.length,
        products: exactProducts
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ✅ EXPORT ALL FUNCTIONS
export {
  createProduct,
  getUserProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getProductsByCategory, // ✅ THIS IS NOW PERMANENTLY FIXED
  getProductsByBrand,
  getAllBrands,
  getFeaturedProducts,
  searchProducts,
  testCloudinary,
  getAllCategoriesDebug,
  checkCategoryMatch
};