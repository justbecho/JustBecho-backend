// fixAdmin.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

async function fixAdmin() {
  console.log('🚀 EMERGENCY ADMIN FIX STARTING...\n');
  
  const MONGODB_URI = "mongodb+srv://Karan:Karan2021@justbecho-cluster.cbqu2mf.mongodb.net/justbecho";
  
  try {
    // Connect
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB Connected\n');
    
    // Simple User model
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    
    // 1. DELETE existing problematic admin
    console.log('1. 🗑️  Deleting old admin@justbecho.com...');
    const deleteResult = await User.deleteMany({ 
      $or: [
        { email: 'admin@justbecho.com' },
        { email: 'ADMIN@JUSTBECHO.COM' },
        { email: /admin@justbecho/i }
      ]
    });
    console.log(`   Deleted ${deleteResult.deletedCount} users\n`);
    
    // 2. CREATE NEW SIMPLE ADMIN
    console.log('2. 👑 Creating new admin...');
    
    const password = 'admin123'; // Simple password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newAdmin = new User({
      _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), // Fixed ID
      email: 'admin@justbecho.com',
      password: hashedPassword,
      name: 'Super Admin',
      role: 'admin',
      phone: '9999999999',
      profileCompleted: true,
      sellerVerified: true,
      sellerVerificationStatus: 'approved',
      isActive: true,
      isNewUser: false,
      address: {
        street: 'Admin Street',
        city: 'Admin City',
        state: 'Admin State',
        pincode: '110001'
      },
      bankDetails: {
        accountNumber: '1234567890',
        ifscCode: 'SBIN0001234',
        accountName: 'Super Admin'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await newAdmin.save();
    console.log('✅ New admin created!\n');
    
    // 3. VERIFY
    console.log('3. ✅ Verifying login...');
    
    const savedAdmin = await User.findOne({ email: 'admin@justbecho.com' });
    
    if (!savedAdmin) {
      console.log('❌ Admin not saved!');
      return;
    }
    
    console.log('📋 Admin Details:');
    console.log(`   Email: ${savedAdmin.email}`);
    console.log(`   Role: ${savedAdmin.role}`);
    console.log(`   ID: ${savedAdmin._id}`);
    console.log(`   Active: ${savedAdmin.isActive}`);
    
    // Password test
    const passwordTest = await bcrypt.compare('admin123', savedAdmin.password);
    console.log(`   Password 'admin123' matches: ${passwordTest ? '✅ YES' : '❌ NO'}`);
    
    // 4. CREATE TEST USER (Optional)
    console.log('\n4. 👤 Creating test user...');
    
    const testUser = new User({
      email: 'test@justbecho.com',
      password: await bcrypt.hash('test123', 10),
      name: 'Test User',
      role: 'buyer',
      profileCompleted: true,
      isActive: true
    });
    
    await testUser.save();
    console.log('✅ Test user created: test@justbecho.com / test123\n');
    
    // 5. FINAL CREDENTIALS
    console.log('🎉 ================================================');
    console.log('✅ FIX COMPLETED SUCCESSFULLY!');
    console.log('================================================');
    console.log('👑 ADMIN LOGIN:');
    console.log('   Email: admin@justbecho.com');
    console.log('   Password: admin123');
    console.log('   Role: admin');
    console.log('================================================');
    console.log('👤 TEST USER LOGIN:');
    console.log('   Email: test@justbecho.com');
    console.log('   Password: test123');
    console.log('   Role: buyer');
    console.log('================================================\n');
    
    console.log('🚀 NOW TEST IN POSTMAN WITH THESE CREDENTIALS!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

fixAdmin();