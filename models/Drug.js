const { executeQuery, executeTransaction } = require('../config/database');

class Drug {
    constructor(data) {
        this.id = data.id;
        this.pharmacy_id = data.pharmacy_id;
        this.name = data.name;
        this.category = data.category;
        this.description = data.description;
        this.manufacturer = data.manufacturer;
        this.price = data.price;
        this.currency = data.currency || 'XAF';
        this.stock = data.stock;
        this.expiry_date = data.expiry_date;
        this.added_on = data.added_on;
        this.updated_at = data.updated_at;
    }

    // Create new drug
    static async create(drugData) {
        try {
            const query = `
                INSERT INTO drugs (
                    pharmacy_id, name, category, description, manufacturer, 
                    price, currency, stock, expiry_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
                drugData.pharmacy_id,
                drugData.name,
                drugData.category || null,
                drugData.description || null,
                drugData.manufacturer || null,
                drugData.price,
                drugData.currency || 'XAF',
                drugData.stock || 0,
                drugData.expiry_date || null
            ];

            const result = await executeQuery(query, params);
            
            if (result.success) {
                return { success: true, drug_id: result.data.insertId };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Find drug by ID
    static async findById(id) {
        try {
            const query = 'SELECT * FROM drugs WHERE id = ?';
            const result = await executeQuery(query, [id]);
            
            if (result.success && result.data.length > 0) {
                return { success: true, data: new Drug(result.data[0]) };
            }
            
            return { success: false, error: 'Drug not found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get all drugs for a pharmacy
    static async findByPharmacy(pharmacyId, filters = {}) {
        try {
            let query = 'SELECT * FROM drugs WHERE pharmacy_id = ?';
            const params = [pharmacyId];

            if (filters.category) {
                query += ' AND category = ?';
                params.push(filters.category);
            }

            if (filters.search) {
                query += ' AND (name LIKE ? OR description LIKE ?)';
                params.push(`%${filters.search}%`, `%${filters.search}%`);
            }

            if (filters.in_stock_only) {
                query += ' AND stock > 0';
            }

            if (filters.expiring_soon) {
                query += ' AND expiry_date <= DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY)';
            }

            query += ' ORDER BY name ASC';

            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(parseInt(filters.limit));
            }

            const result = await executeQuery(query, params);
            
            if (result.success) {
                const drugs = result.data.map(drug => new Drug(drug));
                return { success: true, data: drugs };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Search drugs across all pharmacies
    static async search(searchTerm, filters = {}) {
        try {
            let query = `
                SELECT d.*, p.name as pharmacy_name, p.address as pharmacy_address,
                       p.phone as pharmacy_phone, p.gps_lat, p.gps_long, p.rating,
                       CASE 
                           WHEN d.stock = 0 THEN 'Out of Stock'
                           WHEN d.stock < 20 THEN CONCAT('Low Stock (', d.stock, ' left)')
                           ELSE 'In Stock'
                       END as stock_status
                FROM drugs d
                INNER JOIN pharmacies p ON d.pharmacy_id = p.id
                WHERE p.status = 'approved'
                AND (d.name LIKE ? OR d.category LIKE ? OR d.description LIKE ?)
            `;

            const params = [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`];

            if (filters.category) {
                query += ' AND d.category = ?';
                params.push(filters.category);
            }

            if (filters.max_price) {
                query += ' AND d.price <= ?';
                params.push(filters.max_price);
            }

            if (filters.in_stock_only) {
                query += ' AND d.stock > 0';
            }

            if (filters.location && filters.radius) {
                query += ` AND (
                    6371 * acos(
                        cos(radians(?)) * cos(radians(p.gps_lat)) * 
                        cos(radians(p.gps_long) - radians(?)) + 
                        sin(radians(?)) * sin(radians(p.gps_lat))
                    )
                ) <= ?`;
                params.push(filters.location.lat, filters.location.lng, filters.location.lat, filters.radius);
            }

            // Order by stock availability, then by price, then by pharmacy rating
            query += ' ORDER BY d.stock DESC, d.price ASC, p.rating DESC';

            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(parseInt(filters.limit));
            }

            const result = await executeQuery(query, params);
            
            if (result.success) {
                return { success: true, data: result.data };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Update drug information
    static async update(id, updateData) {
        try {
            const allowedFields = [
                'name', 'category', 'description', 'manufacturer', 
                'price', 'currency', 'stock', 'expiry_date'
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
            
            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(id);
            
            const query = `UPDATE drugs SET ${updates.join(', ')} WHERE id = ?`;
            const result = await executeQuery(query, params);
            
            return { success: result.success, affected_rows: result.data?.affectedRows || 0 };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Update stock quantity
    static async updateStock(id, newStock) {
        try {
            const query = 'UPDATE drugs SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
            const result = await executeQuery(query, [newStock, id]);
            
            return { success: result.success, affected_rows: result.data?.affectedRows || 0 };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Bulk update stocks for a pharmacy
    static async bulkUpdateStock(pharmacyId, stockUpdates) {
        try {
            const queries = stockUpdates.map(update => ({
                query: 'UPDATE drugs SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND pharmacy_id = ?',
                params: [update.stock, update.drug_id, pharmacyId]
            }));

            const result = await executeTransaction(queries);
            return { success: result.success, data: result.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Delete drug
    static async delete(id, pharmacyId = null) {
        try {
            let query = 'DELETE FROM drugs WHERE id = ?';
            const params = [id];
            
            if (pharmacyId) {
                query += ' AND pharmacy_id = ?';
                params.push(pharmacyId);
            }
            
            const result = await executeQuery(query, params);
            
            return { success: result.success, affected_rows: result.data?.affectedRows || 0 };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get drug categories
    static async getCategories() {
        try {
            const query = 'SELECT DISTINCT category FROM drugs WHERE category IS NOT NULL ORDER BY category';
            const result = await executeQuery(query);
            
            if (result.success) {
                const categories = result.data.map(row => row.category);
                return { success: true, data: categories };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get popular drugs (most searched/available)
    static async getPopular(limit = 10) {
        try {
            const query = `
                SELECT d.name, d.category, COUNT(*) as pharmacy_count,
                       AVG(d.price) as avg_price, SUM(d.stock) as total_stock
                FROM drugs d
                INNER JOIN pharmacies p ON d.pharmacy_id = p.id
                WHERE p.status = 'approved' AND d.stock > 0
                GROUP BY d.name, d.category
                ORDER BY pharmacy_count DESC, total_stock DESC
                LIMIT ?
            `;
            
            const result = await executeQuery(query, [limit]);
            
            if (result.success) {
                return { success: true, data: result.data };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get expiring drugs for a pharmacy
    static async getExpiring(pharmacyId, days = 30) {
        try {
            const query = `
                SELECT * FROM drugs 
                WHERE pharmacy_id = ? 
                AND expiry_date IS NOT NULL 
                AND expiry_date <= DATE_ADD(CURRENT_DATE, INTERVAL ? DAY)
                AND expiry_date >= CURRENT_DATE
                ORDER BY expiry_date ASC
            `;
            
            const result = await executeQuery(query, [pharmacyId, days]);
            
            if (result.success) {
                const drugs = result.data.map(drug => new Drug(drug));
                return { success: true, data: drugs };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get low stock drugs for a pharmacy
    static async getLowStock(pharmacyId, threshold = 20) {
        try {
            const query = `
                SELECT * FROM drugs 
                WHERE pharmacy_id = ? 
                AND stock > 0 
                AND stock <= ?
                ORDER BY stock ASC
            `;
            
            const result = await executeQuery(query, [pharmacyId, threshold]);
            
            if (result.success) {
                const drugs = result.data.map(drug => new Drug(drug));
                return { success: true, data: drugs };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get drug statistics for a pharmacy
    static async getPharmacyStats(pharmacyId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_drugs,
                    COUNT(CASE WHEN stock > 0 THEN 1 END) as available_drugs,
                    COUNT(CASE WHEN stock = 0 THEN 1 END) as out_of_stock_drugs,
                    COUNT(CASE WHEN stock <= 20 AND stock > 0 THEN 1 END) as low_stock_drugs,
                    COUNT(CASE WHEN expiry_date <= DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY) AND expiry_date >= CURRENT_DATE THEN 1 END) as expiring_soon,
                    AVG(price) as avg_price,
                    SUM(stock * price) as total_inventory_value
                FROM drugs 
                WHERE pharmacy_id = ?
            `;
            
            const result = await executeQuery(query, [pharmacyId]);
            
            if (result.success && result.data.length > 0) {
                return { success: true, data: result.data[0] };
            }
            
            return { success: false, error: 'No data found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = Drug;
