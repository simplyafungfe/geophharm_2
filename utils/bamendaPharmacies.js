const { createPharmacy, addDrugToInventory, createUser } = require('./database');
const { hashPassword } = require('./auth');

// Bamenda Pharmacy Data from Survey
const bamendaPharmacies = [
  {
    pharmacy: {
      pharmacy_name: "Bamenda Central Pharmacy",
      license_number: "PHARM-BAM-001",
      description: "Your trusted pharmacy in the heart of Bamenda",
      address: "Commercial Avenue, Bamenda",
      city: "Bamenda",
      state: "North West",
      country: "Cameroon",
      latitude: 5.9597,
      longitude: 10.1460,
      phone: "+237 6XX XXX XXX",
      email: "central@bamenda-pharmacy.com",
      operating_hours: "8:00 AM - 8:00 PM"
    },
    pharmacist: {
      email: "pharmacist1@bamenda-pharmacy.com",
      password: "pharmacy123",
      first_name: "Dr. John",
      last_name: "Mbah",
      phone: "+237 6XX XXX XXX",
      role: "pharmacist"
    },
    inventory: [
      { drug_name: "Paracetamol", quantity: 500, price: 200, expiry_date: "2025-12-31" },
      { drug_name: "Amoxicillin", quantity: 200, price: 1500, expiry_date: "2025-06-30" },
      { drug_name: "Ibuprofen", quantity: 300, price: 300, expiry_date: "2025-10-15" },
      { drug_name: "Vitamin C", quantity: 400, price: 800, expiry_date: "2025-08-20" },
      { drug_name: "Omeprazole", quantity: 150, price: 2500, expiry_date: "2025-05-10" }
    ]
  },
  {
    pharmacy: {
      pharmacy_name: "HealthPlus Bamenda",
      license_number: "PHARM-BAM-002",
      description: "Quality healthcare products and services",
      address: "Station Road, Bamenda",
      city: "Bamenda",
      state: "North West",
      country: "Cameroon",
      latitude: 5.9612,
      longitude: 10.1485,
      phone: "+237 6XX XXX XXX",
      email: "info@healthplus-bamenda.com",
      operating_hours: "7:30 AM - 9:00 PM"
    },
    pharmacist: {
      email: "pharmacist2@healthplus-bamenda.com",
      password: "pharmacy123",
      first_name: "Dr. Sarah",
      last_name: "Nfor",
      phone: "+237 6XX XXX XXX",
      role: "pharmacist"
    },
    inventory: [
      { drug_name: "Paracetamol", quantity: 600, price: 180, expiry_date: "2025-11-30" },
      { drug_name: "Ciprofloxacin", quantity: 100, price: 3000, expiry_date: "2025-07-15" },
      { drug_name: "Aspirin", quantity: 250, price: 250, expiry_date: "2025-09-20" },
      { drug_name: "Multivitamin", quantity: 300, price: 1200, expiry_date: "2025-12-01" },
      { drug_name: "Metformin", quantity: 80, price: 1800, expiry_date: "2025-04-30" }
    ]
  },
  {
    pharmacy: {
      pharmacy_name: "Bamenda Medical Store",
      license_number: "PHARM-BAM-003",
      description: "Comprehensive medical supplies and medications",
      address: "Hospital Road, Bamenda",
      city: "Bamenda",
      state: "North West",
      country: "Cameroon",
      latitude: 5.9580,
      longitude: 10.1445,
      phone: "+237 6XX XXX XXX",
      email: "contact@bamenda-medical.com",
      operating_hours: "8:00 AM - 7:00 PM"
    },
    pharmacist: {
      email: "pharmacist3@bamenda-medical.com",
      password: "pharmacy123",
      first_name: "Dr. Michael",
      last_name: "Tanjong",
      phone: "+237 6XX XXX XXX",
      role: "pharmacist"
    },
    inventory: [
      { drug_name: "Paracetamol", quantity: 400, price: 220, expiry_date: "2025-10-31" },
      { drug_name: "Doxycycline", quantity: 120, price: 2800, expiry_date: "2025-08-15" },
      { drug_name: "Diclofenac", quantity: 180, price: 450, expiry_date: "2025-11-10" },
      { drug_name: "Iron Supplements", quantity: 200, price: 900, expiry_date: "2025-12-15" },
      { drug_name: "Losartan", quantity: 60, price: 3200, expiry_date: "2025-06-20" }
    ]
  },
  {
    pharmacy: {
      pharmacy_name: "City Pharmacy Bamenda",
      license_number: "PHARM-BAM-004",
      description: "Your neighborhood pharmacy for all your health needs",
      address: "Main Street, Bamenda",
      city: "Bamenda",
      state: "North West",
      country: "Cameroon",
      latitude: 5.9625,
      longitude: 10.1498,
      phone: "+237 6XX XXX XXX",
      email: "hello@citypharmacy-bamenda.com",
      operating_hours: "7:00 AM - 8:30 PM"
    },
    pharmacist: {
      email: "pharmacist4@citypharmacy-bamenda.com",
      password: "pharmacy123",
      first_name: "Dr. Grace",
      last_name: "Fon",
      phone: "+237 6XX XXX XXX",
      role: "pharmacist"
    },
    inventory: [
      { drug_name: "Paracetamol", quantity: 350, price: 190, expiry_date: "2025-12-15" },
      { drug_name: "Azithromycin", quantity: 90, price: 3500, expiry_date: "2025-09-30" },
      { drug_name: "Naproxen", quantity: 120, price: 380, expiry_date: "2025-10-25" },
      { drug_name: "Calcium Supplements", quantity: 150, price: 1100, expiry_date: "2025-11-20" },
      { drug_name: "Amlodipine", quantity: 70, price: 2800, expiry_date: "2025-07-10" }
    ]
  },
  {
    pharmacy: {
      pharmacy_name: "Bamenda Community Pharmacy",
      license_number: "PHARM-BAM-005",
      description: "Serving the Bamenda community with quality healthcare",
      address: "Community Road, Bamenda",
      city: "Bamenda",
      state: "North West",
      country: "Cameroon",
      latitude: 5.9575,
      longitude: 10.1475,
      phone: "+237 6XX XXX XXX",
      email: "info@community-pharmacy-bamenda.com",
      operating_hours: "8:30 AM - 7:30 PM"
    },
    pharmacist: {
      email: "pharmacist5@community-pharmacy-bamenda.com",
      password: "pharmacy123",
      first_name: "Dr. Paul",
      last_name: "Nkeng",
      phone: "+237 6XX XXX XXX",
      role: "pharmacist"
    },
    inventory: [
      { drug_name: "Paracetamol", quantity: 450, price: 210, expiry_date: "2025-11-30" },
      { drug_name: "Clarithromycin", quantity: 75, price: 4200, expiry_date: "2025-08-20" },
      { drug_name: "Ketorolac", quantity: 100, price: 550, expiry_date: "2025-12-05" },
      { drug_name: "Zinc Supplements", quantity: 180, price: 750, expiry_date: "2025-10-15" },
      { drug_name: "Enalapril", quantity: 55, price: 2400, expiry_date: "2025-06-25" }
    ]
  },
  {
    pharmacy: {
      pharmacy_name: "Bamenda Express Pharmacy",
      license_number: "PHARM-BAM-006",
      description: "Fast and reliable pharmaceutical services",
      address: "Express Road, Bamenda",
      city: "Bamenda",
      state: "North West",
      country: "Cameroon",
      latitude: 5.9630,
      longitude: 10.1455,
      phone: "+237 6XX XXX XXX",
      email: "service@express-pharmacy-bamenda.com",
      operating_hours: "6:30 AM - 9:00 PM"
    },
    pharmacist: {
      email: "pharmacist6@express-pharmacy-bamenda.com",
      password: "pharmacy123",
      first_name: "Dr. Linda",
      last_name: "Mbi",
      phone: "+237 6XX XXX XXX",
      role: "pharmacist"
    },
    inventory: [
      { drug_name: "Paracetamol", quantity: 550, price: 175, expiry_date: "2025-12-20" },
      { drug_name: "Erythromycin", quantity: 110, price: 2800, expiry_date: "2025-07-30" },
      { drug_name: "Mefenamic Acid", quantity: 140, price: 420, expiry_date: "2025-11-15" },
      { drug_name: "Vitamin D", quantity: 220, price: 950, expiry_date: "2025-12-10" },
      { drug_name: "Captopril", quantity: 65, price: 2600, expiry_date: "2025-05-20" }
    ]
  }
];

// Common drugs available in Bamenda
const commonDrugs = [
  { name: "Paracetamol", generic_name: "Acetaminophen", category: "Pain Relievers", dosage_form: "Tablet", strength: "500mg", manufacturer: "Various", prescription_required: false },
  { name: "Amoxicillin", generic_name: "Amoxicillin", category: "Antibiotics", dosage_form: "Capsule", strength: "500mg", manufacturer: "Various", prescription_required: true },
  { name: "Ibuprofen", generic_name: "Ibuprofen", category: "Pain Relievers", dosage_form: "Tablet", strength: "400mg", manufacturer: "Various", prescription_required: false },
  { name: "Ciprofloxacin", generic_name: "Ciprofloxacin", category: "Antibiotics", dosage_form: "Tablet", strength: "500mg", manufacturer: "Various", prescription_required: true },
  { name: "Aspirin", generic_name: "Acetylsalicylic Acid", category: "Pain Relievers", dosage_form: "Tablet", strength: "100mg", manufacturer: "Various", prescription_required: false },
  { name: "Doxycycline", generic_name: "Doxycycline", category: "Antibiotics", dosage_form: "Capsule", strength: "100mg", manufacturer: "Various", prescription_required: true },
  { name: "Diclofenac", generic_name: "Diclofenac", category: "Pain Relievers", dosage_form: "Tablet", strength: "50mg", manufacturer: "Various", prescription_required: false },
  { name: "Azithromycin", generic_name: "Azithromycin", category: "Antibiotics", dosage_form: "Tablet", strength: "500mg", manufacturer: "Various", prescription_required: true },
  { name: "Naproxen", generic_name: "Naproxen", category: "Pain Relievers", dosage_form: "Tablet", strength: "250mg", manufacturer: "Various", prescription_required: false },
  { name: "Clarithromycin", generic_name: "Clarithromycin", category: "Antibiotics", dosage_form: "Tablet", strength: "500mg", manufacturer: "Various", prescription_required: true },
  { name: "Ketorolac", generic_name: "Ketorolac", category: "Pain Relievers", dosage_form: "Tablet", strength: "10mg", manufacturer: "Various", prescription_required: true },
  { name: "Erythromycin", generic_name: "Erythromycin", category: "Antibiotics", dosage_form: "Tablet", strength: "250mg", manufacturer: "Various", prescription_required: true },
  { name: "Mefenamic Acid", generic_name: "Mefenamic Acid", category: "Pain Relievers", dosage_form: "Capsule", strength: "250mg", manufacturer: "Various", prescription_required: false },
  { name: "Vitamin C", generic_name: "Ascorbic Acid", category: "Vitamins & Supplements", dosage_form: "Tablet", strength: "500mg", manufacturer: "Various", prescription_required: false },
  { name: "Multivitamin", generic_name: "Multivitamin", category: "Vitamins & Supplements", dosage_form: "Tablet", strength: "Various", manufacturer: "Various", prescription_required: false },
  { name: "Iron Supplements", generic_name: "Ferrous Sulfate", category: "Vitamins & Supplements", dosage_form: "Tablet", strength: "325mg", manufacturer: "Various", prescription_required: false },
  { name: "Calcium Supplements", generic_name: "Calcium Carbonate", category: "Vitamins & Supplements", dosage_form: "Tablet", strength: "500mg", manufacturer: "Various", prescription_required: false },
  { name: "Zinc Supplements", generic_name: "Zinc Sulfate", category: "Vitamins & Supplements", dosage_form: "Tablet", strength: "220mg", manufacturer: "Various", prescription_required: false },
  { name: "Vitamin D", generic_name: "Cholecalciferol", category: "Vitamins & Supplements", dosage_form: "Tablet", strength: "1000IU", manufacturer: "Various", prescription_required: false },
  { name: "Omeprazole", generic_name: "Omeprazole", category: "Gastrointestinal", dosage_form: "Capsule", strength: "20mg", manufacturer: "Various", prescription_required: true },
  { name: "Metformin", generic_name: "Metformin", category: "Diabetes", dosage_form: "Tablet", strength: "500mg", manufacturer: "Various", prescription_required: true },
  { name: "Losartan", generic_name: "Losartan", category: "Cardiovascular", dosage_form: "Tablet", strength: "50mg", manufacturer: "Various", prescription_required: true },
  { name: "Amlodipine", generic_name: "Amlodipine", category: "Cardiovascular", dosage_form: "Tablet", strength: "5mg", manufacturer: "Various", prescription_required: true },
  { name: "Enalapril", generic_name: "Enalapril", category: "Cardiovascular", dosage_form: "Tablet", strength: "5mg", manufacturer: "Various", prescription_required: true },
  { name: "Captopril", generic_name: "Captopril", category: "Cardiovascular", dosage_form: "Tablet", strength: "25mg", manufacturer: "Various", prescription_required: true }
];

// Initialize Bamenda pharmacies
async function initializeBamendaPharmacies() {
  try {
    console.log('🚀 Initializing Bamenda Pharmacy Platform...');
    
    // Create drug categories first
    const { createDrugCategory } = require('./database');
    const categories = ['Pain Relievers', 'Antibiotics', 'Vitamins & Supplements', 'Gastrointestinal', 'Diabetes', 'Cardiovascular'];
    
    for (const categoryName of categories) {
      await createDrugCategory(categoryName, `${categoryName} medications`);
    }
    
    // Create drugs
    const { createDrug } = require('./database');
    for (const drug of commonDrugs) {
      await createDrug(drug);
    }
    
    // Create pharmacies and pharmacists
    for (const pharmacyData of bamendaPharmacies) {
      console.log(`📦 Creating pharmacy: ${pharmacyData.pharmacy.pharmacy_name}`);
      
      // Create pharmacist user
      const hashedPassword = await hashPassword(pharmacyData.pharmacist.password);
      const pharmacist = await createUser({
        ...pharmacyData.pharmacist,
        password: hashedPassword
      });
      
      // Create pharmacy
      const pharmacy = await createPharmacy({
        ...pharmacyData.pharmacy,
        user_id: pharmacist.id
      });
      
      // Add inventory
      for (const item of pharmacyData.inventory) {
        await addDrugToInventory({
          pharmacy_id: pharmacy.id,
          drug_name: item.drug_name,
          quantity: item.quantity,
          price: item.price,
          expiry_date: item.expiry_date
        });
      }
      
      console.log(`✅ Created ${pharmacyData.pharmacy.pharmacy_name} with ${pharmacyData.inventory.length} drugs`);
    }
    
    console.log('🎉 Bamenda Pharmacy Platform initialized successfully!');
    console.log(`📊 Created ${bamendaPharmacies.length} pharmacies with ${commonDrugs.length} different drugs`);
    
  } catch (error) {
    console.error('❌ Error initializing Bamenda pharmacies:', error);
    throw error;
  }
}

module.exports = {
  bamendaPharmacies,
  commonDrugs,
  initializeBamendaPharmacies
}; 