import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId;
    }
  },
  name: {
    type: String,
    default: ""
  },
  username: {
    type: String,
    unique: true,
    sparse: true
  },
  googleId: {
    type: String,
    default: null
  },
  
  // ✅ UPDATED: ROLE SYSTEM WITH ADMIN
  role: {
    type: String,
    enum: ['user', 'buyer', 'seller', 'influencer', 'admin'], // ✅ 'admin' ADDED
    default: 'user'
  },
  
  instaId: {
    type: String,
    default: "",
    trim: true
  },
  profileCompleted: {
    type: Boolean,
    default: false
  },
  
  // ✅ SELLER VERIFICATION FIELDS
  sellerVerified: {
    type: Boolean,
    default: false
  },
  sellerVerificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'not_started'],
    default: 'not_started'
  },
  verificationId: {
    type: String,
    unique: true,
    sparse: true
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  rejectedAt: {
    type: Date,
    default: null
  },
  
  // ✅ BANK DETAILS FOR SELLERS
  bankDetails: {
    accountNumber: {
      type: String,
      default: "",
      trim: true
    },
    ifscCode: {
      type: String,
      default: "",
      trim: true
    },
    accountName: {
      type: String,
      default: "",
      trim: true
    }
  },
  
  // ✅ PROFILE FIELDS
  phone: {
    type: String,
    default: "",
    trim: true
  },
  address: {
    street: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" }
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for better performance
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ username: 1 });
userSchema.index({ sellerVerificationStatus: 1 });
userSchema.index({ verificationId: 1 });
userSchema.index({ 'bankDetails.accountNumber': 1 });

export default mongoose.model("User", userSchema);