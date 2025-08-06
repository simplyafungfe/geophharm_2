const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const router = express.Router();
const db = require('../config/database');

// Middleware to verify admin authentication
const verifyAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }
    
    // For now, we'll use a simple token verification
    // In production, you'd want proper JWT verification
    if (token === 'admin-token') {
        next();
    } else {
        res.status(403).json({ message: 'Admin access required' });
    }
};

// Generate temporary password
function generateTempPassword() {
    return crypto.randomBytes(8).toString('hex').toUpperCase();
}

// Send email notification (mock implementation)
async function sendCredentialsEmail(email, pharmacyName, tempPassword) {
    // In production, integrate with email service like SendGrid, Nodemailer, etc.
    console.log(`
        Email sent to: ${email}
        Subject: Welcome to Geopharm Platform - Your Account is Ready!
        
        Dear ${pharmacyName} Team,
        
        Your pharmacy has been successfully registered on the Geopharm platform by our admin team.
        
        Login Details:
        - Email: ${email}
        - Temporary Password: ${tempPassword}
        
        Please log in and change your password immediately.
        
        Best regards,
        Geopharm Admin Team
    `);
    
    return true; // Simulate successful email send
}

// Register pharmacy only (without inventory)
router.post('/register-pharmacy-only', verifyAdmin, async (req, res) => {
    try {
        const { name, ownerName, email, phone, address, latitude, longitude } = req.body;
        
        // Generate temporary password
        const tempPassword = crypto.randomBytes(8).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        // Insert pharmacy
        const [result] = await db.execute(
            `INSERT INTO pharmacies (name, owner_name, email, phone, address, gps_lat, gps_long, 
             password_hash, created_by_admin, status, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'approved', NOW())`,
            [name, ownerName, email, phone, address, latitude, longitude, hashedPassword]
        );
        
        const pharmacyId = result.insertId;
        
        // Log admin action
        await db.execute(
            'INSERT INTO admin_actions (action_type, pharmacy_id, details, created_at) VALUES (?, ?, ?, NOW())',
            ['pharmacy_registered', pharmacyId, `Registered pharmacy: ${name}`]
        );
        
        // Mock email sending (replace with real email service)
        console.log(`Email sent to ${email}:`);
        console.log(`Subject: Welcome to Geopharm Platform`);
        console.log(`Temporary Password: ${tempPassword}`);
        console.log(`Pharmacy ID: ${pharmacyId}`);
        
        res.json({ 
            success: true, 
            message: 'Pharmacy registered successfully',
            pharmacyId,
            tempPassword // Remove in production
        });
        
    } catch (error) {
        console.error('Error registering pharmacy:', error);
        res.status(500).json({ success: false, message: 'Failed to register pharmacy' });
    }
});

// Register pharmacy with inventory (original route)
router.post('/register-pharmacy', verifyAdmin, async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const {
            name,
            ownerName,
            email,
            phone,
            address,
            latitude,
            longitude,
            inventory
        } = req.body;

        // Generate temporary password
        const tempPassword = generateTempPassword();
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Insert pharmacy
        const [pharmacyResult] = await connection.execute(
            `INSERT INTO pharmacies (
                name, owner_name, email, phone, address, 
                gps_lat, gps_long, password_hash, status, 
                created_by_admin, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 1, NOW())`,
            [name, ownerName, email, phone, address, latitude, longitude, hashedPassword]
        );

        const pharmacyId = pharmacyResult.insertId;

        // Insert inventory items
        if (inventory && inventory.length > 0) {
            const inventoryValues = inventory.map(drug => [
                pharmacyId,
                drug.name,
                drug.price,
                drug.stock,
                drug.expiry
            ]);

            const placeholders = inventory.map(() => '(?, ?, ?, ?, ?)').join(', ');
            const flatValues = inventoryValues.flat();

            await connection.execute(
                `INSERT INTO drugs (pharmacy_id, name, price, stock, expiry_date) VALUES ${placeholders}`,
                flatValues
            );
        }

        // Log admin action
        await connection.execute(
            `INSERT INTO admin_actions (
                action_type, pharmacy_id, details, created_at
            ) VALUES ('pharmacy_registered', ?, ?, NOW())`,
            [pharmacyId, JSON.stringify({ 
                admin_action: 'field_registration',
                inventory_items: inventory.length,
                temp_password_sent: true
            })]
        );

        await connection.commit();

        // Send credentials email
        await sendCredentialsEmail(email, name, tempPassword);

        res.status(201).json({
            message: 'Pharmacy registered successfully',
            pharmacyId: pharmacyId,
            tempPassword: tempPassword, // Remove in production
            credentialsSent: true
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error registering pharmacy:', error);
        res.status(500).json({ 
            message: 'Error registering pharmacy',
            error: error.message 
        });
    } finally {
        connection.release();
    }
});

// Get all pharmacies (Admin only)
router.get('/pharmacies', verifyAdmin, async (req, res) => {
    try {
        const [pharmacies] = await db.execute(`
            SELECT 
                p.*,
                COUNT(d.id) as drug_count,
                COALESCE(AVG(pr.rating), 0) as avg_rating
            FROM pharmacies p
            LEFT JOIN drugs d ON p.id = d.pharmacy_id
            LEFT JOIN pharmacy_ratings pr ON p.id = pr.pharmacy_id
            WHERE p.created_by_admin = 1
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `);

        res.json(pharmacies);
    } catch (error) {
        console.error('Error fetching pharmacies:', error);
        res.status(500).json({ 
            message: 'Error fetching pharmacies',
            error: error.message 
        });
    }
});

// Get pharmacy details with inventory (Admin only)
router.get('/pharmacy/:id', verifyAdmin, async (req, res) => {
    try {
        const pharmacyId = req.params.id;

        // Get pharmacy details
        const [pharmacyRows] = await db.execute(
            'SELECT * FROM pharmacies WHERE id = ? AND created_by_admin = 1',
            [pharmacyId]
        );

        if (pharmacyRows.length === 0) {
            return res.status(404).json({ message: 'Pharmacy not found' });
        }

        const pharmacy = pharmacyRows[0];

        // Get inventory
        const [inventory] = await db.execute(
            'SELECT * FROM drugs WHERE pharmacy_id = ? ORDER BY name',
            [pharmacyId]
        );

        // Get recent activity logs
        const [activityLogs] = await db.execute(`
            SELECT * FROM admin_actions 
            WHERE pharmacy_id = ? 
            ORDER BY created_at DESC 
            LIMIT 10
        `, [pharmacyId]);

        // Get ratings and reviews
        const [ratings] = await db.execute(`
            SELECT pr.*, u.email as user_email 
            FROM pharmacy_ratings pr
            LEFT JOIN users u ON pr.user_id = u.id
            WHERE pr.pharmacy_id = ?
            ORDER BY pr.created_at DESC
            LIMIT 5
        `, [pharmacyId]);

        res.json({
            pharmacy,
            inventory,
            activityLogs,
            ratings,
            stats: {
                totalDrugs: inventory.length,
                lowStockItems: inventory.filter(drug => drug.stock < 10).length,
                expiringSoon: inventory.filter(drug => {
                    const expiryDate = new Date(drug.expiry_date);
                    const thirtyDaysFromNow = new Date();
                    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
                    return expiryDate <= thirtyDaysFromNow;
                }).length
            }
        });

    } catch (error) {
        console.error('Error fetching pharmacy details:', error);
        res.status(500).json({ 
            message: 'Error fetching pharmacy details',
            error: error.message 
        });
    }
});

// Update pharmacy information (Admin only)
router.put('/pharmacy/:id', verifyAdmin, async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const pharmacyId = req.params.id;
        const {
            name,
            ownerName,
            email,
            phone,
            address,
            latitude,
            longitude,
            status
        } = req.body;

        // Update pharmacy
        await connection.execute(`
            UPDATE pharmacies SET 
                name = ?, owner_name = ?, email = ?, phone = ?, 
                address = ?, gps_lat = ?, gps_long = ?, status = ?,
                updated_at = NOW()
            WHERE id = ? AND created_by_admin = 1
        `, [name, ownerName, email, phone, address, latitude, longitude, status, pharmacyId]);

        // Log admin action
        await connection.execute(
            `INSERT INTO admin_actions (
                action_type, pharmacy_id, details, created_at
            ) VALUES ('pharmacy_updated', ?, ?, NOW())`,
            [pharmacyId, JSON.stringify({ 
                admin_action: 'pharmacy_info_updated',
                updated_fields: Object.keys(req.body)
            })]
        );

        await connection.commit();

        res.json({ message: 'Pharmacy updated successfully' });

    } catch (error) {
        await connection.rollback();
        console.error('Error updating pharmacy:', error);
        res.status(500).json({ 
            message: 'Error updating pharmacy',
            error: error.message 
        });
    } finally {
        connection.release();
    }
});

// Add batch inventory for a pharmacy
router.post('/pharmacy/:id/batch-inventory', verifyAdmin, async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        const pharmacyId = req.params.id;
        const { drugs } = req.body;
        
        await connection.beginTransaction();
        
        for (const drug of drugs) {
            const { drugName, genericName, priceCard, qtyCarton, priceCarton, stock } = drug;
            
            // Insert drug into inventory
            await connection.execute(
                `INSERT INTO drugs (pharmacy_id, name, generic_name, price_per_card, qty_per_carton, 
                 price_per_carton, stock, added_on) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
                [pharmacyId, drugName, genericName, priceCard, qtyCarton, priceCarton, stock]
            );
        }
        
        // Log admin action
        await connection.execute(
            'INSERT INTO admin_actions (action_type, pharmacy_id, details, created_at) VALUES (?, ?, ?, NOW())',
            ['batch_inventory_added', pharmacyId, `Added ${drugs.length} drugs to inventory`]
        );
        
        await connection.commit();
        
        res.json({ 
            success: true, 
            message: `Successfully added ${drugs.length} drugs to pharmacy inventory` 
        });
        
    } catch (error) {
        await connection.rollback();
        console.error('Error adding batch inventory:', error);
        res.status(500).json({ success: false, message: 'Failed to add batch inventory' });
    } finally {
        connection.release();
    }
});

// Add/Update inventory item (Admin only)
router.post('/pharmacy/:id/inventory', verifyAdmin, async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const pharmacyId = req.params.id;
        const { name, price, stock, expiryDate } = req.body;

        // Check if drug already exists
        const [existingDrug] = await connection.execute(
            'SELECT id FROM drugs WHERE pharmacy_id = ? AND name = ?',
            [pharmacyId, name]
        );

        let drugId;
        if (existingDrug.length > 0) {
            // Update existing drug
            drugId = existingDrug[0].id;
            await connection.execute(
                'UPDATE drugs SET price = ?, stock = ?, expiry_date = ?, updated_at = NOW() WHERE id = ?',
                [price, stock, expiryDate, drugId]
            );
        } else {
            // Add new drug
            const [result] = await connection.execute(
                'INSERT INTO drugs (pharmacy_id, name, price, stock, expiry_date) VALUES (?, ?, ?, ?, ?)',
                [pharmacyId, name, price, stock, expiryDate]
            );
            drugId = result.insertId;
        }

        // Log admin action
        await connection.execute(
            `INSERT INTO admin_actions (
                action_type, pharmacy_id, details, created_at
            ) VALUES ('inventory_updated', ?, ?, NOW())`,
            [pharmacyId, JSON.stringify({ 
                admin_action: 'inventory_item_updated',
                drug_name: name,
                drug_id: drugId,
                action: existingDrug.length > 0 ? 'updated' : 'added'
            })]
        );

        await connection.commit();

        res.json({ 
            message: existingDrug.length > 0 ? 'Drug updated successfully' : 'Drug added successfully',
            drugId: drugId
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error updating inventory:', error);
        res.status(500).json({ 
            message: 'Error updating inventory',
            error: error.message 
        });
    } finally {
        connection.release();
    }
});

// Get admin activity logs
router.get('/activity-logs', verifyAdmin, async (req, res) => {
    try {
        const [logs] = await db.execute(`
            SELECT 
                aa.*,
                p.name as pharmacy_name
            FROM admin_actions aa
            LEFT JOIN pharmacies p ON aa.pharmacy_id = p.id
            ORDER BY aa.created_at DESC
            LIMIT 50
        `);

        res.json(logs);
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ 
            message: 'Error fetching activity logs',
            error: error.message 
        });
    }
});

// Get dashboard statistics
router.get('/dashboard-stats', verifyAdmin, async (req, res) => {
    try {
        // Get pharmacy counts
        const [pharmacyCounts] = await db.execute(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM pharmacies 
            WHERE created_by_admin = 1
        `);

        // Get total drugs and low stock count
        const [drugStats] = await db.execute(`
            SELECT 
                COUNT(*) as total_drugs,
                SUM(CASE WHEN stock < 10 THEN 1 ELSE 0 END) as low_stock_items
            FROM drugs d
            JOIN pharmacies p ON d.pharmacy_id = p.id
            WHERE p.created_by_admin = 1
        `);

        // Get recent activity count
        const [recentActivity] = await db.execute(`
            SELECT COUNT(*) as recent_actions
            FROM admin_actions
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `);

        res.json({
            pharmacies: pharmacyCounts[0],
            drugs: drugStats[0],
            recentActivity: recentActivity[0].recent_actions
        });

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ 
            message: 'Error fetching dashboard stats',
            error: error.message 
        });
    }
});

module.exports = router;
