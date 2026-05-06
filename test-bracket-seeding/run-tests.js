/**
 * Simple test runner for the alternating bracket seeding algorithm
 * Since we can't use TypeScript directly, this compiles and runs the tests
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Compiling and running alternating bracket seeding tests...\n');

try {
  // Compile TypeScript files
  console.log('📦 Compiling TypeScript...');
  + execSync('npx tsc --target es2018 --module commonjs --skipLibCheck --outDir ./dist ./test-algorithm.ts ./alternating-bracket-algorithm.ts', {    cwd: __dirname,
    stdio: 'inherit'
  });
  
  // Run the tests
  console.log('\n🧪 Running tests...');
  execSync('node ./dist/test-algorithm.js', {
    cwd: __dirname,
    stdio: 'inherit'
  });
  
} catch (error) {
  console.error('❌ Error running tests:', error.message);
  process.exit(1);
}