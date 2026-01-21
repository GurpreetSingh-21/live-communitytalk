// Apply Prisma schema changes
// Run with: node scripts/apply-migrations.js [push|deploy]
// - push: Uses `prisma db push` (faster, good for dev/prototyping)
// - deploy: Uses `prisma migrate deploy` (safer for production, uses migration files)

const { execSync } = require('child_process');
const path = require('path');

const mode = process.argv[2] || 'push'; // Default to 'push'

console.log(`🔄 Applying Prisma schema changes (mode: ${mode})...\n`);

try {
  // Change to backend directory
  process.chdir(path.join(__dirname, '..'));
  
  if (mode === 'push') {
    console.log('📦 Running: npx prisma db push');
    execSync('npx prisma db push', { stdio: 'inherit' });
  } else if (mode === 'deploy') {
    console.log('📦 Running: npx prisma migrate deploy');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  } else {
    console.error('❌ Invalid mode. Use "push" or "deploy"');
    process.exit(1);
  }
  
  console.log('\n✅ Schema changes applied successfully!');
} catch (error) {
  console.error('\n❌ Failed:', error.message);
  process.exit(1);
}
