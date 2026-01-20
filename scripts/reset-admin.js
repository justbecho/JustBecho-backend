import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || "mongodb+srv://Karan:Karan2021@justbecho-cluster.cbqu2mf.mongodb.net/justbecho?retryWrites=true&w=majority";

async function resetAdminUser() {
  try {
    console.log('🚀 ===== ADMIN RESET SCRIPT STARTED =====');
    
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB Connected Successfully');
    
    // Dynamically import User model
    const UserModule = await import('./models/User.js');
    const User = UserModule.default;
    
    // Step 1: Check existing admin
    console.log('\n🔍 Checking existing admin users...');
    const existingAdmins = await User.find({ 
      $or: [
        { email: "admin@justbecho.com" },
        { role: "admin" }
      ]
    });
    
    if (existingAdmins.length > 0) {
      console.log(`❌ Found ${existingAdmins.length} existing admin(s):`);
      
      // Delete all existing admins
      for (const admin of existingAdmins) {
        console.log(`   🗑️  Deleting: ${admin.email} (${admin.role})`);
        await User.findByIdAndDelete(admin._id);
      }
      console.log('✅ All existing admins deleted');
    } else {
      console.log('✅ No existing admin users found');
    }
    
    // Step 2: Create new admin
    console.log('\n➕ Creating new admin user...');
    
    // Hash password for "admin123"
    const hashedPassword = await bcrypt.hash("admin123", 10);
    
    // Create new admin user
    const newAdmin = new User({
      email: "admin@justbecho.com",
      name: "Admin User",
      password: hashedPassword,
      role: "admin",
      profileCompleted: true,
      sellerVerified: true,
      phone: "+919999999999",
      address: {
        street: "Admin Address",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India"
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Save to database
    await newAdmin.save();
    
    // Verify creation
    const verifiedAdmin = await User.findOne({ email: "admin@justbecho.com" });
    
    if (verifiedAdmin) {
      console.log('\n🎉 ===== ADMIN RESET SUCCESSFUL =====');
      console.log('✅ New Admin Created Successfully!');
      console.log('\n📋 ADMIN CREDENTIALS:');
      console.log('   📧 Email: admin@justbecho.com');
      console.log('   🔑 Password: admin123');
      console.log('   👑 Role: admin');
      console.log('   🆔 ID:', verifiedAdmin._id);
      console.log('   📅 Created:', new Date().toLocaleString());
      
      // Also update some other admin emails if needed
      const otherAdminEmails = [
        "admin@justbecho.in",
        "superadmin@justbecho.com",
        "administrator@justbecho.com"
      ];
      
      console.log('\n🔧 Creating additional admin accounts...');
      for (const email of otherAdminEmails) {
        const existing = await User.findOne({ email });
        if (!existing) {
          const additionalAdmin = new User({
            email: email,
            name: email.split('@')[0],
            password: hashedPassword,
            role: "admin",
            profileCompleted: true,
            sellerVerified: true
          });
          await additionalAdmin.save();
          console.log(`   ✅ Created: ${email}`);
        }
      }
      
    } else {
      console.log('❌ Failed to create admin user');
    }
    
  } catch (error) {
    console.error('\n💥 ===== ADMIN RESET FAILED =====');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    // Try alternative connection method
    try {
      console.log('\n🔄 Trying alternative connection...');
      await mongoose.connect(MONGODB_URI);
      console.log('✅ Reconnected to MongoDB');
      
      // Direct MongoDB query
      const db = mongoose.connection.db;
      const usersCollection = db.collection('users');
      
      // Delete existing
      await usersCollection.deleteMany({ 
        $or: [
          { email: "admin@justbecho.com" },
          { role: "admin" }
        ]
      });
      
      // Create new
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await usersCollection.insertOne({
        email: "admin@justbecho.com",
        name: "Admin User",
        password: hashedPassword,
        role: "admin",
        profileCompleted: true,
        sellerVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log('✅ Admin reset completed via direct MongoDB');
      
    } catch (directError) {
      console.error('❌ Direct MongoDB also failed:', directError.message);
    }
    
  } finally {
    // Close connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('\n🔌 MongoDB Disconnected');
    }
    
    console.log('\n📋 NEXT STEPS:');
    console.log('   1. Go to: https://justbecho.com/admin');
    console.log('   2. Login with: admin@justbecho.com / admin123');
    console.log('   3. Change password after first login');
    console.log('   4. Test API: https://just-becho-backend.vercel.app/api/admin/health');
    
    console.log('\n🚀 ===== ADMIN RESET COMPLETED =====\n');
    process.exit(0);
  }
}

// Run the function
resetAdminUser();