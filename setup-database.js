#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function setupDatabase() {
  console.log('🏥 Welcome to Geopharm Database Setup\n');
  console.log('This script will help you configure the database connection for your Geopharm platform.\n');

  try {
    // Check if .env already exists
    const envPath = path.join(__dirname, '.env');
    const envExamplePath = path.join(__dirname, '.env.example');
    
    if (fs.existsSync(envPath)) {
      const overwrite = await askQuestion('⚠️  .env file already exists. Do you want to overwrite it? (y/N): ');
      if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
        console.log('✅ Setup cancelled. Using existing .env file.');
        rl.close();
        return;
      }
    }

    console.log('\n📋 Please provide your database configuration:\n');

    // Get database configuration
    const dbHost = await askQuestion('Database Host (default: localhost): ') || 'localhost';
    const dbPort = await askQuestion('Database Port (default: 3306): ') || '3306';
    const dbUser = await askQuestion('Database Username (default: root): ') || 'root';
    const dbPassword = await askQuestion('Database Password: ');
    const dbName = await askQuestion('Database Name (default: geopharm_bamenda): ') || 'geopharm_bamenda';
    
    console.log('\n⚙️  Server configuration:\n');
    const serverPort = await askQuestion('Server Port (default: 3000): ') || '3000';
    const nodeEnv = await askQuestion('Environment (development/production, default: development): ') || 'development';

    // Create .env content
    const envContent = `# Database Configuration
DB_HOST=${dbHost}
DB_USER=${dbUser}
DB_PASSWORD=${dbPassword}
DB_NAME=${dbName}
DB_PORT=${dbPort}

# Server Configuration
PORT=${serverPort}
NODE_ENV=${nodeEnv}

# Security
JWT_SECRET=${generateRandomString(64)}
BCRYPT_ROUNDS=10

# Platform Settings
PLATFORM_NAME=Geopharm Bamenda
CONTACT_EMAIL=info@geopharm.cm
CONTACT_PHONE=+237 123 456 789

# Search Settings
DEFAULT_SEARCH_RADIUS_KM=10
MAX_SEARCH_RESULTS=50

# File Upload (if needed later)
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5MB

# Email Configuration (for future features)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Maps API (if using external maps)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
`;

    // Write .env file
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ .env file created successfully!');

    // Ask about database setup
    console.log('\n🗄️  Database Setup Options:\n');
    console.log('1. Create database schema only (tables, views, triggers)');
    console.log('2. Create schema AND migrate existing pharmacy data');
    console.log('3. Skip database setup (I\'ll do it manually)');
    
    const setupChoice = await askQuestion('\nChoose an option (1-3): ');

    switch (setupChoice) {
      case '1':
        console.log('\n📋 Creating database schema...');
        await runCommand('npm run db:init');
        break;
      case '2':
        console.log('\n📋 Creating database schema and migrating data...');
        await runCommand('npm run db:setup');
        break;
      case '3':
        console.log('\n⏭️  Skipping database setup.');
        console.log('\n📝 Manual setup instructions:');
        console.log('   1. Create your MySQL database');
        console.log('   2. Run: npm run db:init (to create schema)');
        console.log('   3. Run: npm run db:migrate (to import pharmacy data)');
        break;
      default:
        console.log('\n⚠️  Invalid choice. Skipping database setup.');
    }

    console.log('\n🎉 Setup completed!');
    console.log('\n🚀 To start your Geopharm server:');
    console.log('   npm install  (install dependencies)');
    console.log('   npm start    (start the server)');
    console.log('\n📖 Visit http://localhost:' + serverPort + ' to access your platform');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const [cmd, ...args] = command.split(' ');
    
    const child = spawn(cmd, args, { stdio: 'inherit' });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };
