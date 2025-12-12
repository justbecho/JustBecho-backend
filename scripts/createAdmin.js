// scripts/createAdmin.js - FIXED VERSION
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ✅ Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const createPermanentAdmin = async () => {
  let mongooseConnected = false;
  
  try {
    console.log('🛠️ Creating permanent admin user...');
    
    // ✅ Hardcode MongoDB URI
    const MONGODB_URI = "mongodb+srv://Karan:Karan2021@justbecho-cluster.cbqu2mf.mongodb.net/justbecho?retryWrites=true&w=majority";
    
    console.log('🔗 Connecting to MongoDB...');
    
    // ✅ Simple connection without deprecated options
    await mongoose.connect(MONGODB_URI);
    mongooseConnected = true;
    console.log('✅ Connected to MongoDB');
    
    // ✅ Import User model directly
    const UserModel = mongoose.model('User', new mongoose.Schema({
      email: String,
      password: String,
      name: String,
      username: String,
      role: String,
      phone: String,
      profileCompleted: Boolean,
      sellerVerified: Boolean,
      address: Object,
      bankDetails: Object,
      instaId: String,
      sellerVerificationStatus: String,
      verificationId: String
    }));
    
    // Check if admin already exists
    const existingAdmin = await UserModel.findOne({ email: 'admin@justbecho.com' });
    
    if (existingAdmin) {
      console.log('👑 Admin already exists, checking role...');
      console.log('Current role:', existingAdmin.role || 'not set');
      
      // Update existing admin if not admin
      if (existingAdmin.role !== 'admin') {
        console.log('🔄 Updating role to admin...');
        
        existingAdmin.role = 'admin';
        existingAdmin.name = 'Super Admin';
        existingAdmin.phone = '9999999999';
        existingAdmin.profileCompleted = true;
        existingAdmin.sellerVerified = true;
        existingAdmin.address = existingAdmin.address || {
          street: 'Admin Street',
          city: 'Admin City',
          state: 'Admin State',
          pincode: '123456'
        };
        
        // Update password if needed
        const isOldPassword = await bcrypt.compare('admin123', existingAdmin.password);
        if (isOldPassword) {
          const hashedPassword = await bcrypt.hash('Admin@12345', 10);
          existingAdmin.password = hashedPassword;
          console.log('🔑 Password updated');
        }
        
        await existingAdmin.save();
        console.log('✅ Existing admin updated to role: admin');
      } else {
        console.log('✅ Admin already has admin role');
        
        // Still update other fields if needed
        if (!existingAdmin.name || existingAdmin.name !== 'Super Admin') {
          existingAdmin.name = 'Super Admin';
          existingAdmin.phone = '9999999999';
          await existingAdmin.save();
          console.log('✅ Admin details updated');
        }
      }
      
    } else {
      // Create new admin
      console.log('👑 Creating new admin user...');
      const hashedPassword = await bcrypt.hash('Admin@12345', 10);
      
      const adminUser = new UserModel({
        email: 'admin@justbecho.com',
        password: hashedPassword,
        name: 'Super Admin',
        phone: '9999999999',
        role: 'admin',
        profileCompleted: true,
        sellerVerified: true,
        username: 'superadmin@justbecho',
        address: {
          street: 'Admin Street',
          city: 'Admin City',
          state: 'Admin State',
          pincode: '123456'
        },
        sellerVerificationStatus: 'approved',
        verificationId: `ADMIN-${Date.now()}`
      });
      
      await adminUser.save();
      console.log('✅ New admin user created with role: admin');
    }
    
    // Verify admin creation
    const verifiedAdmin = await UserModel.findOne({ email: 'admin@justbecho.com' });
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ADMIN DATABASE VERIFICATION');
    console.log('='.repeat(60));
    console.log('📧 Email:', verifiedAdmin.email);
    console.log('👑 Role:', verifiedAdmin.role);
    console.log('👤 Name:', verifiedAdmin.name);
    console.log('📱 Phone:', verifiedAdmin.phone);
    console.log('🆔 MongoDB ID:', verifiedAdmin._id);
    console.log('✅ Profile Completed:', verifiedAdmin.profileCompleted);
    console.log('✅ Seller Verified:', verifiedAdmin.sellerVerified);
    console.log('='.repeat(60));
    
    if (verifiedAdmin.role === 'admin') {
      console.log('\n✅ SUCCESS! Admin role is correctly set to "admin"');
    } else {
      console.log('\n❌ WARNING: Role is still:', verifiedAdmin.role);
      console.log('   Manually updating in database...');
      
      // Force update
      await UserModel.updateOne(
        { email: 'admin@justbecho.com' },
        { $set: { role: 'admin' } }
      );
      console.log('   Manual update completed.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Try alternative approach
    console.log('\n🔄 Trying alternative approach...');
    
    try {
      // Direct MongoDB driver
      const { MongoClient } = await import('mongodb');
      const client = new MongoClient("mongodb+srv://Karan:Karan2021@justbecho-cluster.cbqu2mf.mongodb.net");
      
      await client.connect();
      const db = client.db('justbecho');
      const users = db.collection('users');
      
      // Update admin
      const result = await users.updateOne(
        { email: 'admin@justbecho.com' },
        { $set: { role: 'admin', name: 'Super Admin' } },
        { upsert: true }
      );
      
      console.log('✅ Direct MongoDB update successful');
      console.log('Matched:', result.matchedCount, 'Modified:', result.modifiedCount);
      
      await client.close();
      
    } catch (mongoError) {
      console.error('❌ MongoDB direct update failed:', mongoError.message);
    }
    
  } finally {
    if (mongooseConnected && mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
};

// Run the script
createPermanentAdmin();