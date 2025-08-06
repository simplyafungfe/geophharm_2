const { executeQuery } = require('../config/database');

class User {
    constructor(data) {
        this.id = data.id;
        this.email = data.email;
        this.phone = data.phone;
        this.name = data.name;
        this.gps_lat = data.gps_lat;
        this.gps_long = data.gps_long;
        this.blood_group = data.blood_group;
        this.allergies = data.allergies;
        this.medical_conditions = data.medical_conditions;
        this.created_at = data.created_at;
        this.last_search = data.last_search;
    }

    // Create new user
    static async create(userData) {
        try {
            const query = `
                INSERT INTO users (
                    email, phone, name, gps_lat, gps_long, 
                    blood_group, allergies, medical_conditions
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
                userData.email || null,
                userData.phone || null,
                userData.name || null,
                userData.gps_lat || null,
                userData.gps_long || null,
                userData.blood_group || null,
                userData.allergies || null,
                userData.medical_conditions || null
            ];

            const result = await executeQuery(query, params);
            
            if (result.success) {
                return { success: true, user_id: result.data.insertId };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Find user by ID
    static async findById(id) {
        try {
            const query = 'SELECT * FROM users WHERE id = ?';
            const result = await executeQuery(query, [id]);
            
            if (result.success && result.data.length > 0) {
                return { success: true, data: new User(result.data[0]) };
            }
            
            return { success: false, error: 'User not found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Find user by email
    static async findByEmail(email) {
        try {
            const query = 'SELECT * FROM users WHERE email = ?';
            const result = await executeQuery(query, [email]);
            
            if (result.success && result.data.length > 0) {
                return { success: true, data: new User(result.data[0]) };
            }
            
            return { success: false, error: 'User not found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Update user information
    static async update(id, updateData) {
        try {
            const allowedFields = [
                'email', 'phone', 'name', 'gps_lat', 'gps_long', 
                'blood_group', 'allergies', 'medical_conditions'
            ];
            
            const updates = [];
            const params = [];
            
            for (const [key, value] of Object.entries(updateData)) {
                if (allowedFields.includes(key)) {
                    updates.push(`${key} = ?`);
                    params.push(value);
                }
            }
            
            if (updates.length === 0) {
                return { success: false, error: 'No valid fields to update' };
            }
            
            params.push(id);
            
            const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
            const result = await executeQuery(query, params);
            
            return { success: result.success, affected_rows: result.data?.affectedRows || 0 };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Update last search timestamp
    static async updateLastSearch(id) {
        try {
            const query = 'UPDATE users SET last_search = CURRENT_TIMESTAMP WHERE id = ?';
            const result = await executeQuery(query, [id]);
            return { success: result.success };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Log user search
    static async logSearch(userId, searchTerm, userLocation, resultsCount) {
        try {
            const query = `
                INSERT INTO search_logs (user_id, search_term, user_lat, user_long, results_count)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            const params = [
                userId || null,
                searchTerm,
                userLocation?.lat || null,
                userLocation?.lng || null,
                resultsCount || 0
            ];

            const result = await executeQuery(query, params);
            return { success: result.success };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get user search history
    static async getSearchHistory(userId, limit = 10) {
        try {
            const query = `
                SELECT search_term, results_count, created_at
                FROM search_logs 
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            `;
            
            const result = await executeQuery(query, [userId, limit]);
            
            if (result.success) {
                return { success: true, data: result.data };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Rate a pharmacy
    static async ratePharmacy(userId, pharmacyId, rating, review = null) {
        try {
            const query = `
                INSERT INTO pharmacy_ratings (user_id, pharmacy_id, rating, review)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                rating = VALUES(rating), 
                review = VALUES(review),
                created_at = CURRENT_TIMESTAMP
            `;
            
            const params = [userId, pharmacyId, rating, review];
            const result = await executeQuery(query, params);
            
            return { success: result.success };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Report a pharmacy
    static async reportPharmacy(userId, pharmacyId, reason, description = null) {
        try {
            const query = `
                INSERT INTO flags (user_id, pharmacy_id, reason, description)
                VALUES (?, ?, ?, ?)
            `;
            
            const params = [userId || null, pharmacyId, reason, description];
            const result = await executeQuery(query, params);
            
            return { success: result.success, flag_id: result.data?.insertId };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get nearby users (for analytics)
    static async getNearbyUsers(location, radius = 10, limit = 100) {
        try {
            const query = `
                SELECT id, name, gps_lat, gps_long,
                (
                    6371 * acos(
                        cos(radians(?)) * cos(radians(gps_lat)) * 
                        cos(radians(gps_long) - radians(?)) + 
                        sin(radians(?)) * sin(radians(gps_lat))
                    )
                ) as distance_km
                FROM users 
                WHERE gps_lat IS NOT NULL AND gps_long IS NOT NULL
                HAVING distance_km <= ?
                ORDER BY distance_km ASC
                LIMIT ?
            `;
            
            const params = [location.lat, location.lng, location.lat, radius, limit];
            const result = await executeQuery(query, params);
            
            if (result.success) {
                return { success: true, data: result.data };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get user statistics
    static async getStats() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as registered_users,
                    COUNT(CASE WHEN last_search >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as active_users_week,
                    COUNT(CASE WHEN last_search >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as active_users_month
                FROM users
            `;
            
            const result = await executeQuery(query);
            
            if (result.success && result.data.length > 0) {
                return { success: true, data: result.data[0] };
            }
            
            return { success: false, error: 'No data found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = User;
