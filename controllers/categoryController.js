import Category from "../models/Category.js";
import Product from "../models/Product.js";

// ✅ STRICT CATEGORY MAPPING FOR CATEGORY CONTROLLER
const strictCategoryMappingForController = (category) => {
  const map = {
    // Men's - All variations to EXACT database name
    "Men's Fashion": "Men's Fashion",
    "Mens Fashion": "Men's Fashion",
    "Mens": "Men's Fashion",
    "Men": "Men's Fashion",
    "men": "Men's Fashion",
    "mens": "Men's Fashion",
    "men-fashion": "Men's Fashion",
    "men's": "Men's Fashion",
    "men's-fashion": "Men's Fashion",
    
    // Women's - All variations to EXACT database name
    "Women's Fashion": "Women's Fashion",
    "Womens Fashion": "Women's Fashion",
    "Womens": "Women's Fashion",
    "Women": "Women's Fashion",
    "women": "Women's Fashion",
    "womens": "Women's Fashion",
    "women-fashion": "Women's Fashion",
    "women's": "Women's Fashion",
    "women's-fashion": "Women's Fashion",
    
    // Others - EXACT names as stored in database
    "Footwear": "Footwear",
    "footwear": "Footwear",
    "Shoes": "Footwear",
    "shoes": "Footwear",
    
    "Accessories": "Accessories",
    "accessories": "Accessories",
    
    "Watches": "Watches",
    "watches": "Watches",
    
    "Perfumes": "Perfumes",
    "perfumes": "Perfumes",
    
    "TOYS & COLLECTIBLES": "TOYS & COLLECTIBLES",
    "Toys & Collectibles": "TOYS & COLLECTIBLES",
    "Toys": "TOYS & COLLECTIBLES",
    "toys": "TOYS & COLLECTIBLES",
    
    "KIDS": "KIDS",
    "Kids": "KIDS",
    "kids": "KIDS"
  };
  
  // First check exact match
  if (map[category]) {
    return map[category];
  }
  
  // Check case-insensitive match
  const lowerCategory = category.toLowerCase();
  for (const key in map) {
    if (key.toLowerCase() === lowerCategory) {
      return map[key];
    }
  }
  
  // If no match found, return original
  return category;
};

// ✅ GET ALL CATEGORIES
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true });
    
    // Get product counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Product.countDocuments({
          category: category.name,
          status: 'active'
        });
        
        return {
          _id: category._id,
          name: category.name,
          description: category.description,
          image: category.image,
          href: category.href,
          productCount: productCount,
          subCategories: category.subCategories || []
        };
      })
    );
    
    res.status(200).json({
      success: true,
      categories: categoriesWithCounts,
      count: categoriesWithCounts.length
    });
  } catch (error) {
    console.error('❌ Get All Categories Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ GET CATEGORY BY SLUG
export const getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    console.log('🔍 [CATEGORY] Fetching category for slug:', slug);
    
    // Try different ways to find the category
    const category = await Category.findOne({
      $or: [
        { href: { $regex: new RegExp(slug, 'i') } },
        { name: { $regex: new RegExp(slug, 'i') } },
        { slug: { $regex: new RegExp(slug, 'i') } }
      ],
      isActive: true
    });
    
    if (!category) {
      console.log('❌ [CATEGORY] Category not found for slug:', slug);
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    console.log('✅ [CATEGORY] Found category:', category.name);
    
    res.status(200).json({
      success: true,
      category: category
    });
  } catch (error) {
    console.error('❌ Get Category By Slug Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ GET PRODUCTS BY CATEGORY SLUG - FIXED
export const getCategoryProducts = async (req, res) => {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 12, brand, sort = 'newest' } = req.query;
    
    console.log('🎯 [CATEGORY PRODUCTS] Request for slug:', slug);
    console.log('Query params:', { page, limit, brand, sort });
    
    // Find category from database
    const category = await Category.findOne({
      $or: [
        { href: { $regex: new RegExp(slug, 'i') } },
        { name: { $regex: new RegExp(slug, 'i') } },
        { slug: { $regex: new RegExp(slug, 'i') } }
      ],
      isActive: true
    });
    
    if (!category) {
      console.log('❌ [CATEGORY PRODUCTS] Category not found in DB for slug:', slug);
      
      // ✅ FIXED: Use the same strict mapping as product controller
      const dbCategory = strictCategoryMappingForController(
        slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')
      );
      console.log('🔄 [CATEGORY PRODUCTS] Using mapped category:', dbCategory);
      
      return await getProductsForCategory(dbCategory, req, res);
    }
    
    console.log('✅ [CATEGORY PRODUCTS] Found category in DB:', category.name);
    return await getProductsForCategory(category.name, req, res);
    
  } catch (error) {
    console.error('❌ [CATEGORY PRODUCTS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ HELPER FUNCTION: Get products for a category - FIXED
const getProductsForCategory = async (categoryName, req, res) => {
  try {
    const { page = 1, limit = 12, brand, minPrice, maxPrice, condition, sort = 'newest' } = req.query;
    
    console.log('🎯 [HELPER] Getting products for category:', categoryName);
    
    // ✅ FIXED: Use EXACT MATCH instead of regex for men's and women's fashion
    let query = { 
      status: 'active'
    };
    
    // Apply strict matching for fashion categories
    if (categoryName.toLowerCase().includes('men') || 
        categoryName === "Men's Fashion" || 
        categoryName === "Mens Fashion") {
      // ✅ EXACT match for Men's Fashion
      query.category = "Men's Fashion";
    } else if (categoryName.toLowerCase().includes('women') || 
               categoryName === "Women's Fashion" || 
               categoryName === "Womens Fashion") {
      // ✅ EXACT match for Women's Fashion
      query.category = "Women's Fashion";
    } else {
      // For other categories, use case-insensitive match
      query.category = { $regex: new RegExp(`^${categoryName}$`, 'i') };
    }
    
    // Apply filters
    if (brand && brand !== 'all') {
      query.brand = { $regex: new RegExp(brand, 'i') };
    }
    
    if (condition && condition !== 'all') {
      query.condition = condition;
    }
    
    if (minPrice) {
      query.finalPrice = { $gte: Number(minPrice) };
    }
    
    if (maxPrice) {
      query.finalPrice = { ...query.finalPrice, $lte: Number(maxPrice) };
    }
    
    // Sorting
    let sortOption = { createdAt: -1 };
    if (sort === 'price-low') sortOption = { finalPrice: 1 };
    if (sort === 'price-high') sortOption = { finalPrice: -1 };
    if (sort === 'popular') sortOption = { views: -1, likes: -1 };
    if (sort === 'oldest') sortOption = { createdAt: 1 };
    
    // Pagination
    const skip = (page - 1) * limit;
    
    // Execute query
    const products = await Product.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit))
      .select('productName brand category finalPrice images views likes createdAt condition sellerName');
    
    const total = await Product.countDocuments(query);
    
    // Get unique brands
    const brands = await Product.distinct('brand', query);
    
    // Get price range
    const priceStats = await Product.aggregate([
      {
        $match: {
          category: query.category,
          status: 'active',
          finalPrice: { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$finalPrice' },
          maxPrice: { $max: '$finalPrice' }
        }
      }
    ]);
    
    const priceRange = priceStats[0] || { minPrice: 0, maxPrice: 0 };
    
    console.log(`✅ [HELPER] Found ${products.length} products for category: "${categoryName}"`);
    console.log('🔍 Query used:', JSON.stringify(query, null, 2));
    
    // Debug: Check categories of returned products
    if (products.length > 0) {
      const uniqueCategories = [...new Set(products.map(p => p.category))];
      console.log('📊 Unique categories in results:', uniqueCategories);
    }
    
    res.status(200).json({
      success: true,
      category: categoryName,
      slug: req.params.slug,
      products,
      filters: {
        brands: brands.filter(b => b && b.trim() !== '').sort(),
        conditions: ['Brand New With Tag', 'Brand New Without Tag', 'Like New', 'Fairly Used', 'Excellent', 'Good'],
        priceRange: {
          min: Math.floor(priceRange.minPrice),
          max: Math.ceil(priceRange.maxPrice)
        }
      },
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
        hasNextPage: (page * limit) < total,
        hasPrevPage: page > 1
      }
    });
    
  } catch (error) {
    console.error('❌ [HELPER] Error:', error);
    throw error;
  }
};

// ✅ CREATE CATEGORY (Admin only)
export const createCategory = async (req, res) => {
  try {
    const { name, description, image, href, subCategories, isActive } = req.body;

    // Check if category already exists
    const existingCategory = await Category.findOne({ 
      $or: [
        { name },
        { href }
      ]
    });
    
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists'
      });
    }

    const category = new Category({
      name,
      description,
      image,
      href,
      subCategories,
      isActive
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category: category
    });
  } catch (error) {
    console.error('❌ Create Category Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ UPDATE CATEGORY (Admin only)
export const updateCategory = async (req, res) => {
  try {
    const { name, description, image, href, subCategories, isActive } = req.body;

    const category = await Category.findByIdAndUpdate(
      req.params.categoryId,
      {
        name,
        description,
        image,
        href,
        subCategories,
        isActive
      },
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      category: category
    });
  } catch (error) {
    console.error('❌ Update Category Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ DELETE CATEGORY (Admin only)
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete Category Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ GET CATEGORIES FOR NAVIGATION (Simplified)
export const getCategoriesForNav = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select('name href image subCategories')
      .sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('❌ Get Categories For Nav Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ SEARCH CATEGORIES
export const searchCategories = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    const categories = await Category.find({
      isActive: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    });
    
    res.status(200).json({
      success: true,
      categories,
      count: categories.length
    });
  } catch (error) {
    console.error('❌ Search Categories Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ GET CATEGORY STATS
export const getCategoryStats = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true });
    
    const stats = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Product.countDocuments({
          category: category.name,
          status: 'active'
        });
        
        const recentProducts = await Product.countDocuments({
          category: category.name,
          status: 'active',
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        });
        
        return {
          name: category.name,
          href: category.href,
          productCount,
          recentProducts
        };
      })
    );
    
    res.status(200).json({
      success: true,
      stats,
      totalCategories: categories.length,
      totalProducts: stats.reduce((sum, cat) => sum + cat.productCount, 0)
    });
  } catch (error) {
    console.error('❌ Get Category Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};