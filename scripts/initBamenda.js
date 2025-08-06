require('dotenv').config({ path: './config.env' });
const { initializeBamendaPharmacies } = require('../utils/bamendaPharmacies');

async function main() {
  try {
    console.log('🏥 Initializing Bamenda Pharmacy Platform...');
    console.log('📍 Location: Bamenda, North West Region, Cameroon');
    console.log('📊 Loading 6 pharmacies from survey data...\n');
    
    await initializeBamendaPharmacies();
    
    console.log('\n🎉 Bamenda Pharmacy Platform is ready!');
    console.log('\n📋 Available Pharmacies:');
    console.log('1. Bamenda Central Pharmacy - Commercial Avenue');
    console.log('2. HealthPlus Bamenda - Station Road');
    console.log('3. Bamenda Medical Store - Hospital Road');
    console.log('4. City Pharmacy Bamenda - Main Street');
    console.log('5. Bamenda Community Pharmacy - Community Road');
    console.log('6. Bamenda Express Pharmacy - Express Road');
    
    console.log('\n💊 Common Drugs Available:');
    console.log('- Pain Relievers: Paracetamol, Ibuprofen, Aspirin, Diclofenac, Naproxen, Ketorolac, Mefenamic Acid');
    console.log('- Antibiotics: Amoxicillin, Ciprofloxacin, Doxycycline, Azithromycin, Clarithromycin, Erythromycin');
    console.log('- Vitamins & Supplements: Vitamin C, Multivitamin, Iron, Calcium, Zinc, Vitamin D');
    console.log('- Cardiovascular: Losartan, Amlodipine, Enalapril, Captopril');
    console.log('- Other: Omeprazole, Metformin');
    
    console.log('\n🔑 Default Admin Login:');
    console.log('Email: admin@bamenda-pharmacy.com');
    console.log('Password: admin123');
    
    console.log('\n🔑 Pharmacist Logins:');
    console.log('Email: pharmacist1@bamenda-pharmacy.com (Password: pharmacy123)');
    console.log('Email: pharmacist2@healthplus-bamenda.com (Password: pharmacy123)');
    console.log('Email: pharmacist3@bamenda-medical.com (Password: pharmacy123)');
    console.log('Email: pharmacist4@citypharmacy-bamenda.com (Password: pharmacy123)');
    console.log('Email: pharmacist5@community-pharmacy-bamenda.com (Password: pharmacy123)');
    console.log('Email: pharmacist6@express-pharmacy-bamenda.com (Password: pharmacy123)');
    
    console.log('\n🚀 Start the server with: npm run dev');
    console.log('🌐 Access the platform at: http://localhost:3000');
    
  } catch (error) {
    console.error('❌ Error initializing Bamenda platform:', error);
    process.exit(1);
  }
}

main(); 