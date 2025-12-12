#!/usr/bin/env node

/**
 * Configuration Validation Script for GeniusQA Desktop
 * 
 * This script validates that the Firebase configuration and Tauri setup
 * are properly configured before running the application.
 */

const fs = require('fs');
const path = require('path');

const errors = [];
const warnings = [];

console.log('🔍 Validating GeniusQA Desktop Configuration...\n');

// Check 1: Firebase Config
console.log('1️⃣  Checking Firebase configuration...');
const firebaseConfigPath = path.join(__dirname, '../src/config/firebase.config.ts');

if (!fs.existsSync(firebaseConfigPath)) {
  errors.push('❌ Firebase config file not found at src/config/firebase.config.ts');
} else {
  const firebaseConfig = fs.readFileSync(firebaseConfigPath, 'utf8');

  if (firebaseConfig.includes('YOUR_API_KEY') ||
    firebaseConfig.includes('your-project-id') ||
    firebaseConfig.includes('YOUR_WEB_CLIENT_ID')) {
    warnings.push('⚠️  Firebase config contains placeholder values. Update src/config/firebase.config.ts with your actual Firebase credentials.');
  } else {
    console.log('   ✅ Firebase config appears to be configured');
  }
}

// Check 2: Tauri Config
console.log('\n2️⃣  Checking Tauri configuration...');
const tauriConfigPath = path.join(__dirname, '../src-tauri/tauri.conf.json');

if (!fs.existsSync(tauriConfigPath)) {
  errors.push('❌ Tauri config file not found at src-tauri/tauri.conf.json');
} else {
  try {
    const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));

    // Check HTTP scope
    const httpScope = tauriConfig?.tauri?.allowlist?.http?.scope || [];
    const requiredDomains = [
      'googleapis.com',
      'firebaseapp.com',
      'firebase.com',
      'accounts.google.com'
    ];

    const missingDomains = requiredDomains.filter(domain =>
      !httpScope.some(scope => scope.includes(domain))
    );

    if (missingDomains.length > 0) {
      warnings.push(`⚠️  Some Firebase domains may be missing from HTTP scope: ${missingDomains.join(', ')}`);
    } else {
      console.log('   ✅ Tauri HTTP scope includes Firebase domains');
    }

    // Check CSP
    const csp = tauriConfig?.tauri?.security?.csp || '';
    if (!csp.includes('googleapis.com') || !csp.includes('firebaseapp.com')) {
      warnings.push('⚠️  CSP may not include all required Firebase domains');
    } else {
      console.log('   ✅ Tauri CSP includes Firebase domains');
    }
  } catch (e) {
    errors.push(`❌ Failed to parse Tauri config: ${e.message}`);
  }
}

// Check 3: Rust Installation
console.log('\n3️⃣  Checking Rust installation...');
const { execSync } = require('child_process');

try {
  const rustVersion = execSync('rustc --version', { encoding: 'utf8' }).trim();
  console.log(`   ✅ Rust installed: ${rustVersion}`);
} catch (e) {
  errors.push('❌ Rust is not installed. Install from https://rustup.rs/');
}

// Check 4: Dependencies
console.log('\n4️⃣  Checking dependencies...');
const packageJsonPath = path.join(__dirname, '../package.json');

if (!fs.existsSync(packageJsonPath)) {
  errors.push('❌ package.json not found');
} else {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const requiredDeps = [
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    '@react-native-google-signin/google-signin',
    '@react-native-async-storage/async-storage',
    '@react-navigation/native',
    '@react-navigation/stack'
  ];

  const missingDeps = requiredDeps.filter(dep =>
    !packageJson.dependencies?.[dep]
  );

  if (missingDeps.length > 0) {
    errors.push(`❌ Missing dependencies: ${missingDeps.join(', ')}`);
  } else {
    console.log('   ✅ All required dependencies are listed');
  }

  const nodeModulesPath = path.join(__dirname, '../node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    warnings.push('⚠️  node_modules not found. Run "pnpm install" from the monorepo root.');
  }
}

// Check 5: Icons
console.log('\n5️⃣  Checking application icons...');
const iconsPath = path.join(__dirname, '../src-tauri/icons');

if (!fs.existsSync(iconsPath)) {
  warnings.push('⚠️  Icons directory not found. Create icons using "pnpm tauri icon <source-image>"');
} else {
  const requiredIcons = ['32x32.png', '128x128.png', 'icon.icns', 'icon.ico'];
  const existingIcons = fs.readdirSync(iconsPath);
  const missingIcons = requiredIcons.filter(icon => !existingIcons.includes(icon));

  if (missingIcons.length > 0) {
    warnings.push(`⚠️  Missing icon files: ${missingIcons.join(', ')}. Generate using "pnpm tauri icon <source-image>"`);
  } else {
    console.log('   ✅ All required icon files present');
  }
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Validation Summary\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All checks passed! Your configuration looks good.\n');
  console.log('Next steps:');
  console.log('  1. Run "pnpm --filter @geniusqa/desktop dev" to start development');
  console.log('  2. Test authentication flows');
  console.log('  3. Run "pnpm --filter @geniusqa/desktop build" for production build\n');
  process.exit(0);
}

if (errors.length > 0) {
  console.log('❌ ERRORS (must fix):');
  errors.forEach(error => console.log(`   ${error}`));
  console.log('');
}

if (warnings.length > 0) {
  console.log('⚠️  WARNINGS (recommended to fix):');
  warnings.forEach(warning => console.log(`   ${warning}`));
  console.log('');
}

console.log('📖 For detailed setup instructions, see SETUP.md\n');

process.exit(errors.length > 0 ? 1 : 0);
