const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './config.env' });

const dbPath = process.env.DB_PATH || './data/pharmacy.db';

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

// Initialize database tables
async function initDatabase() {
  console.log('🚀 Initializing Pharmacy Management Database...');

  // Users table (for all user types: clients, pharmacists, admin)
  await createTable(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('client', 'pharmacist', 'admin')),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      country TEXT DEFAULT 'Nigeria',
      latitude REAL,
      longitude REAL,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Pharmacies table
  await createTable(`
    CREATE TABLE IF NOT EXISTS pharmacies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      pharmacy_name TEXT NOT NULL,
      license_number TEXT UNIQUE,
      description TEXT,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      country TEXT DEFAULT 'Nigeria',
      latitude REAL,
      longitude REAL,
      phone TEXT NOT NULL,
      email TEXT,
      operating_hours TEXT,
      is_verified BOOLEAN DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Drug categories table
  await createTable(`
    CREATE TABLE IF NOT EXISTS drug_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Drugs table
  await createTable(`
    CREATE TABLE IF NOT EXISTS drugs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      generic_name TEXT,
      category_id INTEGER,
      description TEXT,
      dosage_form TEXT,
      strength TEXT,
      manufacturer TEXT,
      prescription_required BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES drug_categories (id)
    )
  `);

  // Pharmacy inventory table
  await createTable(`
    CREATE TABLE IF NOT EXISTS pharmacy_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pharmacy_id INTEGER NOT NULL,
      drug_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      price DECIMAL(10,2) NOT NULL,
      expiry_date DATE,
      batch_number TEXT,
      is_available BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pharmacy_id) REFERENCES pharmacies (id),
      FOREIGN KEY (drug_id) REFERENCES drugs (id),
      UNIQUE(pharmacy_id, drug_id, batch_number)
    )
  `);

  // Orders table
  await createTable(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      pharmacy_id INTEGER NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled')),
      delivery_address TEXT,
      delivery_latitude REAL,
      delivery_longitude REAL,
      delivery_notes TEXT,
      payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'failed')),
      payment_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users (id),
      FOREIGN KEY (pharmacy_id) REFERENCES pharmacies (id)
    )
  `);

  // Order items table
  await createTable(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      drug_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      total_price DECIMAL(10,2) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders (id),
      FOREIGN KEY (drug_id) REFERENCES drugs (id)
    )
  `);

  // Pharmacy registrations table (for pending approvals)
  await createTable(`
    CREATE TABLE IF NOT EXISTS pharmacy_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      pharmacy_name TEXT NOT NULL,
      license_number TEXT UNIQUE,
      description TEXT,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      country TEXT DEFAULT 'Cameroon',
      latitude REAL,
      longitude REAL,
      phone TEXT NOT NULL,
      email TEXT,
      operating_hours TEXT,
      registration_status TEXT DEFAULT 'pending' CHECK(registration_status IN ('pending', 'approved', 'rejected')),
      admin_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Pharmacy registration inventory (temporary until approved)
  await createTable(`
    CREATE TABLE IF NOT EXISTS pharmacy_registration_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_id INTEGER NOT NULL,
      drug_name TEXT NOT NULL,
      generic_name TEXT,
      category TEXT,
      dosage_form TEXT,
      strength TEXT,
      manufacturer TEXT,
      quantity INTEGER NOT NULL DEFAULT 0,
      price DECIMAL(10,2) NOT NULL,
      expiry_date DATE,
      batch_number TEXT,
      prescription_required BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (registration_id) REFERENCES pharmacy_registrations (id)
    )
  `);

  // Insert default admin user
  await insertDefaultAdmin();

  // Insert sample drug categories
  await insertSampleCategories();

  // Insert sample drugs
  await insertSampleDrugs();

  console.log('✅ Database initialization completed successfully!');
  db.close();
}

function createTable(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) {
        console.error('Error creating table:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function insertDefaultAdmin() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminSql = `
    INSERT OR IGNORE INTO users (email, password, role, first_name, last_name, phone, city, state, country)
    VALUES ('admin@bamenda-pharmacy.com', ?, 'admin', 'System', 'Administrator', '+237 6XX XXX XXX', 'Bamenda', 'North West', 'Cameroon')
  `;
  
  return new Promise((resolve, reject) => {
    db.run(adminSql, [hashedPassword], (err) => {
      if (err) {
        console.error('Error inserting admin:', err);
        reject(err);
      } else {
        console.log('👤 Default admin user created');
        resolve();
      }
    });
  });
}

async function insertSampleCategories() {
  const categories = [
    { name: 'Antibiotics', description: 'Medications that fight bacterial infections' },
    { name: 'Pain Relievers', description: 'Medications for pain management' },
    { name: 'Vitamins & Supplements', description: 'Nutritional supplements and vitamins' },
    { name: 'Cardiovascular', description: 'Medications for heart and blood vessel conditions' },
    { name: 'Diabetes', description: 'Medications for diabetes management' },
    { name: 'Respiratory', description: 'Medications for breathing and lung conditions' },
    { name: 'Mental Health', description: 'Medications for mental health conditions' },
    { name: 'First Aid', description: 'Basic first aid supplies and medications' }
  ];

  for (const category of categories) {
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO drug_categories (name, description) VALUES (?, ?)',
        [category.name, category.description],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  console.log('📦 Sample drug categories inserted');
}

async function insertSampleDrugs() {
  const drugs = [
    { name: 'Paracetamol', generic_name: 'Acetaminophen', category: 'Pain Relievers', dosage_form: 'Tablet', strength: '500mg', manufacturer: 'Various', prescription_required: false },
    { name: 'Amoxicillin', generic_name: 'Amoxicillin', category: 'Antibiotics', dosage_form: 'Capsule', strength: '500mg', manufacturer: 'Various', prescription_required: true },
    { name: 'Vitamin C', generic_name: 'Ascorbic Acid', category: 'Vitamins & Supplements', dosage_form: 'Tablet', strength: '1000mg', manufacturer: 'Various', prescription_required: false },
    { name: 'Ibuprofen', generic_name: 'Ibuprofen', category: 'Pain Relievers', dosage_form: 'Tablet', strength: '400mg', manufacturer: 'Various', prescription_required: false },
    { name: 'Metformin', generic_name: 'Metformin', category: 'Diabetes', dosage_form: 'Tablet', strength: '500mg', manufacturer: 'Various', prescription_required: true },
    { name: 'Omeprazole', generic_name: 'Omeprazole', category: 'Gastrointestinal', dosage_form: 'Capsule', strength: '20mg', manufacturer: 'Various', prescription_required: false },
    { name: 'Cetirizine', generic_name: 'Cetirizine', category: 'Allergy', dosage_form: 'Tablet', strength: '10mg', manufacturer: 'Various', prescription_required: false },
    { name: 'Bandages', generic_name: 'Adhesive Bandage', category: 'First Aid', dosage_form: 'Roll', strength: 'Various', manufacturer: 'Various', prescription_required: false }
  ];

  for (const drug of drugs) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO drugs (name, generic_name, category_id, dosage_form, strength, manufacturer, prescription_required) 
         SELECT ?, ?, c.id, ?, ?, ?, ? 
         FROM drug_categories c WHERE c.name = ?`,
        [drug.name, drug.generic_name, drug.dosage_form, drug.strength, drug.manufacturer, drug.prescription_required, drug.category],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  console.log('💊 Sample drugs inserted');
}

// Run initialization
initDatabase().catch(console.error); 