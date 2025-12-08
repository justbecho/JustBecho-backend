// controllers/categoryController.js - UPDATED WITH SUB-CATEGORIES mian
import Category from "../models/Category.js";

// ✅ GET ALL CATEGORIES
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true });
    
    res.status(200).json({
      success: true,
      categories: categories,
      count: categories.length
    });
  } catch (error) {
    console.error('Get All Categories Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ CREATE CATEGORY WITH SUB-CATEGORIES (Admin only)
export const createCategory = async (req, res) => {
  try {
    const { name, description, image, href, subCategories, isActive } = req.body;

    // Check if category already exists
    const existingCategory = await Category.findOne({ name });
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
      subCategories, // ✅ NEW: Sub-categories support
      isActive
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category: category
    });
  } catch (error) {
    console.error('Create Category Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ UPDATE CATEGORY WITH SUB-CATEGORIES (Admin only)
export const updateCategory = async (req, res) => {
  try {
    const { name, description, image, href, subCategories, isActive } = req.body;

    const category = await Category.findByIdAndUpdate(
      req.params.categoryId,
      {
        name,
        description,
        image,
        href, // ✅ NEW: href support
        subCategories, // ✅ NEW: Sub-categories update support
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
    console.error('Update Category Error:', error);
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
    console.error('Delete Category Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};


