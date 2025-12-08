// controllers/userController.js - NEW FILE main
import User from "../models/User.js";

// ✅ GET ALL USERS (Admin only)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    
    res.status(200).json({
      success: true,
      users: users,
      count: users.length
    });
  } catch (error) {
    console.error('Get All Users Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ GET USER BY ID
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user: user
    });
  } catch (error) {
    console.error('Get User By ID Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ UPDATE USER PROFILE
export const updateUserProfile = async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const userId = req.user.userId;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        name,
        phone,
        address
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ DELETE USER
export const deleteUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete user
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};
