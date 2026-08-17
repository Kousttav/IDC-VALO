// Run once: `npm run seed:admin`
// Creates the very first admin login from SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD in .env.
// After that, log in and create further admin/staff accounts from the Admin Panel.
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');

(async () => {
  const { MONGO_URI, SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD } = process.env;
  if (!MONGO_URI || !SEED_ADMIN_USERNAME || !SEED_ADMIN_PASSWORD) {
    console.error('❌ Set MONGO_URI, SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD in .env first.');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);

  const existing = await User.findOne({ username: SEED_ADMIN_USERNAME });
  if (existing) {
    console.log(`ℹ️  User "${SEED_ADMIN_USERNAME}" already exists — nothing to do.`);
  } else {
    const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 12);
    await User.create({ username: SEED_ADMIN_USERNAME, passwordHash, role: 'admin' });
    console.log(`✅ Admin "${SEED_ADMIN_USERNAME}" created. Log in, then change this password.`);
  }

  await mongoose.disconnect();
  process.exit(0);
})();
