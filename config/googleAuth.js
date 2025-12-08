import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

// ✅ HARDCODED CONFIGURATION FOR PRODUCTION
const GOOGLE_CONFIG = {
  clientID: '711574038874-r069ib4ureqbir5sukg69at13hspa9a8.apps.googleusercontent.com',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET, // Keep secret in env
  callbackURL: 'https://just-becho-backend.vercel.app/api/auth/google/callback',
  passReqToCallback: true
};

console.log("🔐 Google OAuth Configuration Loaded");
console.log("   Client ID:", GOOGLE_CONFIG.clientID.substring(0, 20) + "...");
console.log("   Callback URL:", GOOGLE_CONFIG.callbackURL);
console.log("   Client Secret:", GOOGLE_CONFIG.clientSecret ? "✅ Set" : "❌ Missing");

// Only initialize if we have client secret
if (GOOGLE_CONFIG.clientSecret) {
  passport.use(
    new GoogleStrategy(
      GOOGLE_CONFIG,
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          console.log('✅ Google OAuth Successful');
          console.log('   Email:', profile.emails[0].value);
          console.log('   Name:', profile.displayName);
          
          const email = profile.emails[0].value;
          
          // Find or create user
          let user = await User.findOne({ 
            $or: [
              { email: email },
              { googleId: profile.id }
            ]
          });

          if (!user) {
            // Create new user
            user = new User({
              email: email,
              name: profile.displayName || email.split('@')[0],
              googleId: profile.id,
              profileCompleted: false,
              role: 'user'
            });
            
            await user.save();
            console.log('   ✅ New user created');
          } else {
            // Update existing user
            if (!user.googleId) {
              user.googleId = profile.id;
              await user.save();
            }
            console.log('   ✅ Existing user found');
          }

          return done(null, user);
        } catch (err) {
          console.error('❌ Google Strategy Error:', err);
          return done(err, null);
        }
      }
    )
  );
} else {
  console.warn('⚠️ Google OAuth disabled: Client secret not found');
}

// Serialize/Deserialize
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;