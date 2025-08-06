const { executeQuery } = require('../config/database');

class EndUser {
    constructor(data) {
        this.id = data.id;
        this.email = data.email;
        this.gps_lat = data.gps_lat;
        this.gps_long = data.gps_long;
        this.created_at = data.created_at;
    }

    // Create new end user (for location-based searches)
    static async create(userData) {
        try {
            const query = `
                INSERT INTO users (email, gps_lat, gps_long)
                VALUES (?, ?, ?)
            `;
            
            const params = [
                userData.email || null,
                userData.gps_lat,
                userData.gps_long
            ];
            
            const result = await executeQuery(query, params);
            
            return {
                id: result.insertId,
                ...userData
            };
        } catch (error) {
            console.error('Error creating end user:', error);
            throw error;
        }
    }

    // Find user by ID
    static async findById(id) {
        try {
            const query = 'SELECT * FROM users WHERE id = ?';
            const results = await executeQuery(query, [id]);
            
            if (results.length === 0) {
                return null;
            }
            
            return new EndUser(results[0]);
        } catch (error) {
            console.error('Error finding user by ID:', error);
            throw error;
        }
    }

    // Find user by email
    static async findByEmail(email) {
        try {
            const query = 'SELECT * FROM users WHERE email = ?';
            const results = await executeQuery(query, [email]);
            
            if (results.length === 0) {
                return null;
            }
            
            return new EndUser(results[0]);
        } catch (error) {
            console.error('Error finding user by email:', error);
            throw error;
        }
    }

    // Update user location
    static async updateLocation(id, lat, lng) {
        try {
            const query = `
                UPDATE users 
                SET gps_lat = ?, gps_long = ?, updated_at = NOW()
                WHERE id = ?
            `;
            
            await executeQuery(query, [lat, lng, id]);
            return true;
        } catch (error) {
            console.error('Error updating user location:', error);
            throw error;
        }
    }

    // Get user search history (if we want to track this)
    static async getSearchHistory(userId, limit = 10) {
        try {
            const query = `
                SELECT * FROM search_logs 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT ?
            `;
            
            const results = await executeQuery(query, [userId, limit]);
            return results;
        } catch (error) {
            console.error('Error getting search history:', error);
            throw error;
        }
    }

    // Log a search (for analytics)
    static async logSearch(searchData) {
        try {
            const query = `
                INSERT INTO search_logs (
                    user_id, search_term, user_lat, user_lng, 
                    results_count, created_at
                )
                VALUES (?, ?, ?, ?, ?, NOW())
            `;
            
            const params = [
                searchData.user_id || null,
                searchData.search_term,
                searchData.user_lat || null,
                searchData.user_lng || null,
                searchData.results_count || 0
            ];
            
            await executeQuery(query, params);
            return true;
        } catch (error) {
            console.error('Error logging search:', error);
            // Don't throw error for logging failures
            return false;
        }
    }

    // Get nearby users (for analytics)
    static async findNearbyUsers(lat, lng, radius = 10) {
        try {
            const query = `
                SELECT id, email, gps_lat, gps_long, created_at,
                       (6371 * acos(cos(radians(?)) * cos(radians(gps_lat)) * 
                        cos(radians(gps_long) - radians(?)) + 
                        sin(radians(?)) * sin(radians(gps_lat)))) AS distance
                FROM users
                WHERE (6371 * acos(cos(radians(?)) * cos(radians(gps_lat)) * 
                       cos(radians(gps_long) - radians(?)) + 
                       sin(radians(?)) * sin(radians(gps_lat)))) <= ?
                ORDER BY distance ASC
            `;
            
            const results = await executeQuery(query, [
                lat, lng, lat, lat, lng, lat, radius
            ]);
            
            return results.map(user => new EndUser(user));
        } catch (error) {
            console.error('Error finding nearby users:', error);
            throw error;
        }
    }

    // Delete user (GDPR compliance)
    static async delete(id) {
        try {
            const query = 'DELETE FROM users WHERE id = ?';
            await executeQuery(query, [id]);
            return true;
        } catch (error) {
            console.error('Error deleting user:', error);
            throw error;
        }
    }
}

module.exports = EndUser;
