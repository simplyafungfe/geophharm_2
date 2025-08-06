const { executeQuery, executeTransaction } = require('../config/database');
const bcrypt = require('bcrypt');

class Pharmacy {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.email = data.email;
        this.phone = data.phone;
        this.address = data.address;
        this.gps_lat = data.gps_lat;
        this.gps_long = data.gps_long;
        this.status = data.status || 'pending';
        this.password_hash = data.password_hash;
        this.created_by_admin = data.created_by_admin || false;
        this.license_url = data.license_url;
        this.rating = data.rating || 0.0;
        this.operating_hours = data.operating_hours;
        this.services = data.services;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
        this.last_active = data.last_active;
    }

    // Create new pharmacy
    static async create(pharmacyData) {
        try {
            const hashedPassword = await bcrypt.hash(pharmacyData.password, 10);
            
            const query = `
                INSERT INTO pharmacies (
                    name, email, phone, address, gps_lat, gps_long, 
                    status, password_hash, created_by_admin, license_url, 
                    operating_hours, services
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
                pharmacyData.name,
                pharmacyData.email,
                pharmacyData.phone,
                pharmacyData.address,
                pharmacyData.gps_lat,
                pharmacyData.gps_long,
                pharmacyData.status || 'pending',
                hashedPassword,
                pharmacyData.created_by_admin || false,
                pharmacyData.license_url || null,
                JSON.stringify(pharmacyData.operating_hours || {}),
                JSON.stringify(pharmacyData.services || [])
            ];

            const result = await executeQuery(query, params);
            
            if (result.success) {
                return { success: true, pharmacy_id: result.data.insertId };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Find pharmacy by ID
    static async findById(id) {
        try {
            const query = 'SELECT * FROM pharmacies WHERE id = ?';
            const result = await executeQuery(query, [id]);
            
            if (result.success && result.data.length > 0) {
                const pharmacy = result.data[0];
                // Parse JSON fields
                pharmacy.operating_hours = JSON.parse(pharmacy.operating_hours || '{}');
                pharmacy.services = JSON.parse(pharmacy.services || '[]');
                return { success: true, data: new Pharmacy(pharmacy) };
            }
            
            return { success: false, error: 'Pharmacy not found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Find pharmacy by email
    static async findByEmail(email) {
        try {
            const query = 'SELECT * FROM pharmacies WHERE email = ?';
            const result = await executeQuery(query, [email]);
            
            if (result.success && result.data.length > 0) {
                const pharmacy = result.data[0];
                pharmacy.operating_hours = JSON.parse(pharmacy.operating_hours || '{}');
                pharmacy.services = JSON.parse(pharmacy.services || '[]');
                return { success: true, data: new Pharmacy(pharmacy) };
            }
            
            return { success: false, error: 'Pharmacy not found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get all pharmacies with optional filters
    static async findAll(filters = {}) {
        try {
            let query = 'SELECT * FROM pharmacies WHERE 1=1';
            const params = [];

            if (filters.status) {
                query += ' AND status = ?';
                params.push(filters.status);
            }

            if (filters.search) {
                query += ' AND (name LIKE ? OR address LIKE ?)';
                params.push(`%${filters.search}%`, `%${filters.search}%`);
            }

            if (filters.location && filters.radius) {
                // Add distance calculation using Haversine formula
                query += ` AND (
                    6371 * acos(
                        cos(radians(?)) * cos(radians(gps_lat)) * 
                        cos(radians(gps_long) - radians(?)) + 
                        sin(radians(?)) * sin(radians(gps_lat))
                    )
                ) <= ?`;
                params.push(filters.location.lat, filters.location.lng, filters.location.lat, filters.radius);
            }

            query += ' ORDER BY rating DESC, name ASC';

            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(parseInt(filters.limit));
            }

            const result = await executeQuery(query, params);
            
            if (result.success) {
                const pharmacies = result.data.map(pharmacy => {
                    pharmacy.operating_hours = JSON.parse(pharmacy.operating_hours || '{}');
                    pharmacy.services = JSON.parse(pharmacy.services || '[]');
                    return new Pharmacy(pharmacy);
                });
                return { success: true, data: pharmacies };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Search pharmacies by drug availability
    static async searchByDrug(drugName, userLocation = null, radius = 10) {
        try {
            let query = `
                SELECT DISTINCT p.*, d.name as drug_name, d.price, d.stock, d.category,
                CASE 
                    WHEN d.stock = 0 THEN 'Out of Stock'
                    WHEN d.stock < 20 THEN CONCAT('Low Stock (', d.stock, ' left)')
                    ELSE 'In Stock'
                END as stock_status
            `;

            if (userLocation) {
                query += `, (
                    6371 * acos(
                        cos(radians(?)) * cos(radians(p.gps_lat)) * 
                        cos(radians(p.gps_long) - radians(?)) + 
                        sin(radians(?)) * sin(radians(p.gps_lat))
                    )
                ) as distance_km`;
            }

            query += `
                FROM pharmacies p
                INNER JOIN drugs d ON p.id = d.pharmacy_id
                WHERE p.status = 'approved' 
                AND (d.name LIKE ? OR d.category LIKE ?)
                AND d.stock > 0
            `;

            const params = [];
            if (userLocation) {
                params.push(userLocation.lat, userLocation.lng, userLocation.lat);
            }
            params.push(`%${drugName}%`, `%${drugName}%`);

            if (userLocation && radius) {
                query += ` HAVING distance_km <= ?`;
                params.push(radius);
            }

            query += ` ORDER BY ${userLocation ? 'distance_km ASC,' : ''} d.stock DESC, p.rating DESC`;

            const result = await executeQuery(query, params);
            
            if (result.success) {
                const pharmacies = result.data.map(row => {
                    const pharmacy = { ...row };
                    pharmacy.operating_hours = JSON.parse(pharmacy.operating_hours || '{}');
                    pharmacy.services = JSON.parse(pharmacy.services || '[]');
                    return pharmacy;
                });
                return { success: true, data: pharmacies };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Update pharmacy information
    static async update(id, updateData) {
        try {
            const allowedFields = [
                'name', 'phone', 'address', 'gps_lat', 'gps_long', 
                'license_url', 'operating_hours', 'services', 'status'
            ];
            
            const updates = [];
            const params = [];
            
            for (const [key, value] of Object.entries(updateData)) {
                if (allowedFields.includes(key)) {
                    updates.push(`${key} = ?`);
                    if (key === 'operating_hours' || key === 'services') {
                        params.push(JSON.stringify(value));
                    } else {
                        params.push(value);
                    }
                }
            }
            
            if (updates.length === 0) {
                return { success: false, error: 'No valid fields to update' };
            }
            
            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(id);
            
            const query = `UPDATE pharmacies SET ${updates.join(', ')} WHERE id = ?`;
            const result = await executeQuery(query, params);
            
            return { success: result.success, affected_rows: result.data?.affectedRows || 0 };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Update last active timestamp
    static async updateLastActive(id) {
        try {
            const query = 'UPDATE pharmacies SET last_active = CURRENT_TIMESTAMP WHERE id = ?';
            const result = await executeQuery(query, [id]);
            return { success: result.success };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Verify pharmacy password
    static async verifyPassword(email, password) {
        try {
            const pharmacyResult = await this.findByEmail(email);
            if (!pharmacyResult.success) {
                return { success: false, error: 'Pharmacy not found' };
            }

            const pharmacy = pharmacyResult.data;
            const isValid = await bcrypt.compare(password, pharmacy.password_hash);
            
            if (isValid) {
                // Update last active
                await this.updateLastActive(pharmacy.id);
                return { success: true, data: pharmacy };
            }
            
            return { success: false, error: 'Invalid password' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Change pharmacy password
    static async changePassword(id, newPassword) {
        try {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            const query = 'UPDATE pharmacies SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
            const result = await executeQuery(query, [hashedPassword, id]);
            
            return { success: result.success };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Delete pharmacy (soft delete by changing status)
    static async delete(id) {
        try {
            const query = 'UPDATE pharmacies SET status = "suspended", updated_at = CURRENT_TIMESTAMP WHERE id = ?';
            const result = await executeQuery(query, [id]);
            
            return { success: result.success, affected_rows: result.data?.affectedRows || 0 };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get pharmacy statistics
    static async getStats(id) {
        try {
            const query = `
                SELECT 
                    p.name,
                    p.rating,
                    COUNT(DISTINCT d.id) as total_drugs,
                    COUNT(DISTINCT CASE WHEN d.stock > 0 THEN d.id END) as available_drugs,
                    COUNT(DISTINCT CASE WHEN d.stock = 0 THEN d.id END) as out_of_stock_drugs,
                    COUNT(DISTINCT r.id) as total_ratings,
                    AVG(r.rating) as avg_rating
                FROM pharmacies p
                LEFT JOIN drugs d ON p.id = d.pharmacy_id
                LEFT JOIN pharmacy_ratings r ON p.id = r.pharmacy_id
                WHERE p.id = ?
                GROUP BY p.id, p.name, p.rating
            `;
            
            const result = await executeQuery(query, [id]);
            
            if (result.success && result.data.length > 0) {
                return { success: true, data: result.data[0] };
            }
            
            return { success: false, error: 'Pharmacy not found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = Pharmacy;
