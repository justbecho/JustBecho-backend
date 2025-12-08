import Category from "../models/Category.js";

// ✅ GET ALL CATEGORIES (PUBLIC)
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });
    
    // If no categories in DB, return empty array
    if (!categories || categories.length === 0) {
      return res.status(200).json({
        success: true,
        categories: [],
        message: "No categories found",
        count: 0
      });
    }
    
    // Transform for frontend
    const transformedCategories = categories.map(cat => ({
      name: cat.name,
      description: cat.description || "",
      href: cat.href || `/categories/${cat.name.toLowerCase().replace(/\s+/g, '-')}`,
      image: cat.image || "",
      subCategories: cat.subCategories || [{
        title: "ITEMS",
        items: ["View All Products", "New Arrivals", "Best Sellers"]
      }]
    }));
    
    res.status(200).json({
      success: true,
      categories: transformedCategories,
      count: categories.length
    });
    
  } catch (error) {
    console.error('❌ Category Controller Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message,
      categories: []
    });
  }
};

// ✅ CREATE CATEGORY (ADMIN)
export const createCategory = async (req, res) => {
  try {
    const { name, description, image, href, subCategories } = req.body;

    // Check if category exists
    const existing = await Category.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists'
      });
    }

    const category = new Category({
      name,
      description: description || "",
      image: image || "",
      href: href || `/categories/${name.toLowerCase().replace(/\s+/g, '-')}`,
      subCategories: subCategories || [{
        title: "ITEMS",
        items: ["View All Products", "New Arrivals", "Best Sellers"]
      }],
      isActive: true
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    console.error('❌ Create Category Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ UPDATE CATEGORY (ADMIN)
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const category = await Category.findByIdAndUpdate(
      id,
      updates,
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
      category
    });
  } catch (error) {
    console.error('❌ Update Category Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ DELETE CATEGORY (ADMIN)
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Category deactivated successfully'
    });
  } catch (error) {
    console.error('❌ Delete Category Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};