const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');

// Submit a rating for a pharmacy
router.post('/', async (req, res) => {
    try {
        const { pharmacy_id, rating, comment, user_email } = req.body;

        if (!pharmacy_id || !rating) {
            return res.status(400).json({
                success: false,
                message: 'Pharmacy ID and rating are required'
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        // Check if pharmacy exists
        const pharmacyCheck = await executeQuery(
            'SELECT id FROM pharmacies WHERE id = ? AND status = "approved"',
            [pharmacy_id]
        );

        if (pharmacyCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pharmacy not found or not approved'
            });
        }

        // Insert the rating
        const insertQuery = `
            INSERT INTO pharmacy_ratings (pharmacy_id, rating, comment, user_email, created_at)
            VALUES (?, ?, ?, ?, NOW())
        `;

        const result = await executeQuery(insertQuery, [
            pharmacy_id,
            rating,
            comment || null,
            user_email || null
        ]);

        // Update pharmacy's average rating
        await updatePharmacyAverageRating(pharmacy_id);

        res.json({
            success: true,
            message: 'Rating submitted successfully',
            rating_id: result.insertId
        });

    } catch (error) {
        console.error('Rating submission error:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting rating'
        });
    }
});

// Get ratings for a pharmacy
router.get('/pharmacy/:id', async (req, res) => {
    try {
        const pharmacyId = req.params.id;
        const { limit = 10, offset = 0 } = req.query;

        const query = `
            SELECT 
                id, rating, comment, user_email, created_at
            FROM pharmacy_ratings
            WHERE pharmacy_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;

        const ratings = await executeQuery(query, [
            pharmacyId, 
            parseInt(limit), 
            parseInt(offset)
        ]);

        // Get rating statistics
        const statsQuery = `
            SELECT 
                COUNT(*) as total_ratings,
                AVG(rating) as average_rating,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
            FROM pharmacy_ratings
            WHERE pharmacy_id = ?
        `;

        const [stats] = await executeQuery(statsQuery, [pharmacyId]);

        res.json({
            success: true,
            ratings: ratings,
            statistics: {
                ...stats,
                average_rating: parseFloat(stats.average_rating || 0).toFixed(1)
            }
        });

    } catch (error) {
        console.error('Get ratings error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching ratings'
        });
    }
});

// Get top-rated pharmacies
router.get('/top-rated', async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const query = `
            SELECT 
                p.id,
                p.name,
                p.address,
                p.phone,
                p.rating,
                COUNT(pr.id) as total_ratings
            FROM pharmacies p
            LEFT JOIN pharmacy_ratings pr ON p.id = pr.pharmacy_id
            WHERE p.status = 'approved' AND p.rating > 0
            GROUP BY p.id
            HAVING total_ratings >= 3
            ORDER BY p.rating DESC, total_ratings DESC
            LIMIT ?
        `;

        const topRated = await executeQuery(query, [parseInt(limit)]);

        res.json({
            success: true,
            pharmacies: topRated
        });

    } catch (error) {
        console.error('Top rated pharmacies error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching top-rated pharmacies'
        });
    }
});

// Helper function to update pharmacy average rating
async function updatePharmacyAverageRating(pharmacyId) {
    try {
        const query = `
            UPDATE pharmacies 
            SET rating = (
                SELECT AVG(rating) 
                FROM pharmacy_ratings 
                WHERE pharmacy_id = ?
            )
            WHERE id = ?
        `;

        await executeQuery(query, [pharmacyId, pharmacyId]);
    } catch (error) {
        console.error('Error updating pharmacy average rating:', error);
    }
}

module.exports = router;
