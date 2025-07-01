const bcrypt = require('bcryptjs');

async function hashPassword() {
  const password = 'Demo123!';
  const hash = await bcrypt.hash(password, 12);
  console.log('Password:', password);
  console.log('Hash:', hash);
  
  // Test verification
  const valid = await bcrypt.compare(password, hash);
  console.log('Verification:', valid);
}

hashPassword();