const fs = require('fs').promises;
const path = require('path');
const { testConnection, initializeDatabase } = require('../config/database');
const Pharmacy = require('../models/Pharmacy');
const Drug = require('../models/Drug');

async function migratePharmacyData() {
    console.log('🚀 Starting data migration...');
    
    try {
        // Test database connection
        const isConnected = await testConnection();
        if (!isConnected) {
            console.error('❌ Database connection failed. Please check your database configuration.');
            return false;
        }

        // Initialize database schema
        console.log('📋 Initializing database schema...');
        await initializeDatabase();

        // Read existing pharmacy data
        const dataPath = path.join(__dirname, '../data/pharmacies.json');
        let pharmacyData;
        
        try {
            const rawData = await fs.readFile(dataPath, 'utf8');
            pharmacyData = JSON.parse(rawData);
        } catch (error) {
            console.error('❌ Error reading pharmacy data file:', error.message);
            return false;
        }

        if (!pharmacyData.pharmacies || !Array.isArray(pharmacyData.pharmacies)) {
            console.error('❌ Invalid pharmacy data format');
            return false;
        }

        console.log(`📊 Found ${pharmacyData.pharmacies.length} pharmacies to migrate`);

        let successCount = 0;
        let errorCount = 0;

        // Migrate each pharmacy
        for (const pharmacy of pharmacyData.pharmacies) {
            try {
                console.log(`\n📍 Migrating: ${pharmacy.name}`);

                // Create pharmacy record
                const pharmacyResult = await Pharmacy.create({
                    name: pharmacy.name,
                    email: pharmacy.email,
                    phone: pharmacy.phone,
                    address: pharmacy.address,
                    gps_lat: pharmacy.coordinates.latitude,
                    gps_long: pharmacy.coordinates.longitude,
                    status: 'approved', // Auto-approve existing pharmacies
                    password: 'pharmacy123', // Default password - should be changed
                    created_by_admin: true,
                    operating_hours: pharmacy.operatingHours || {},
                    services: pharmacy.services || []
                });

                if (!pharmacyResult.success) {
                    console.error(`❌ Failed to create pharmacy: ${pharmacyResult.error}`);
                    errorCount++;
                    continue;
                }

                const pharmacyId = pharmacyResult.pharmacy_id;
                console.log(`✅ Created pharmacy with ID: ${pharmacyId}`);

                // Migrate drugs for this pharmacy
                if (pharmacy.inventory && Array.isArray(pharmacy.inventory)) {
                    console.log(`💊 Migrating ${pharmacy.inventory.length} drugs...`);
                    
                    let drugSuccessCount = 0;
                    let drugErrorCount = 0;

                    for (const drug of pharmacy.inventory) {
                        const drugResult = await Drug.create({
                            pharmacy_id: pharmacyId,
                            name: drug.name,
                            category: drug.category,
                            description: drug.description,
                            manufacturer: drug.manufacturer,
                            price: drug.price,
                            currency: drug.currency || 'XAF',
                            stock: drug.stock,
                            expiry_date: drug.expiryDate || null
                        });

                        if (drugResult.success) {
                            drugSuccessCount++;
                        } else {
                            console.error(`❌ Failed to create drug ${drug.name}: ${drugResult.error}`);
                            drugErrorCount++;
                        }
                    }

                    console.log(`💊 Drugs: ${drugSuccessCount} success, ${drugErrorCount} errors`);
                }

                successCount++;
                console.log(`✅ Successfully migrated: ${pharmacy.name}`);

            } catch (error) {
                console.error(`❌ Error migrating pharmacy ${pharmacy.name}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n🎉 Migration completed!');
        console.log(`✅ Successfully migrated: ${successCount} pharmacies`);
        console.log(`❌ Errors: ${errorCount} pharmacies`);

        // Display summary statistics
        const { getDatabaseStats } = require('../config/database');
        const stats = await getDatabaseStats();
        if (stats.success) {
            console.log('\n📊 Database Statistics:');
            console.log(`- Total Pharmacies: ${stats.data.total_pharmacies}`);
            console.log(`- Approved Pharmacies: ${stats.data.approved_pharmacies}`);
            console.log(`- Total Drugs: ${stats.data.total_drugs}`);
            console.log(`- Total Users: ${stats.data.total_users}`);
        }

        return true;

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        return false;
    }
}

// Run migration if called directly
if (require.main === module) {
    migratePharmacyData()
        .then(success => {
            if (success) {
                console.log('\n🎉 Data migration completed successfully!');
                process.exit(0);
            } else {
                console.log('\n❌ Data migration failed!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ Migration error:', error);
            process.exit(1);
        });
}

module.exports = { migratePharmacyData };
