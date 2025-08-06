const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');

// Submit a new report/flag
router.post('/', async (req, res) => {
    try {
        const { pharmacy_id, reason, details, user_email } = req.body;

        if (!pharmacy_id || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Pharmacy ID and reason are required'
            });
        }

        // Insert the report
        const query = `
            INSERT INTO flags (pharmacy_id, reason, details, user_email, status, created_at)
            VALUES (?, ?, ?, ?, 'open', NOW())
        `;

        const result = await executeQuery(query, [
            pharmacy_id,
            reason,
            details || null,
            user_email || null
        ]);

        res.json({
            success: true,
            message: 'Report submitted successfully',
            report_id: result.insertId
        });

    } catch (error) {
        console.error('Report submission error:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting report'
        });
    }
});

// Get all reports (admin only)
router.get('/', async (req, res) => {
    try {
        const { status, pharmacy_id } = req.query;
        
        let query = `
            SELECT 
                f.id,
                f.pharmacy_id,
                f.reason,
                f.details,
                f.user_email,
                f.status,
                f.created_at,
                f.reviewed_at,
                f.admin_notes,
                p.name as pharmacy_name,
                p.address as pharmacy_address
            FROM flags f
            JOIN pharmacies p ON f.pharmacy_id = p.id
        `;
        
        const params = [];
        const conditions = [];

        if (status) {
            conditions.push('f.status = ?');
            params.push(status);
        }

        if (pharmacy_id) {
            conditions.push('f.pharmacy_id = ?');
            params.push(pharmacy_id);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY f.created_at DESC';

        const reports = await executeQuery(query, params);

        res.json({
            success: true,
            reports: reports
        });

    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching reports'
        });
    }
});

// Update report status (admin only)
router.put('/:id', async (req, res) => {
    try {
        const reportId = req.params.id;
        const { status, admin_notes } = req.body;

        if (!['open', 'reviewed', 'closed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be: open, reviewed, or closed'
            });
        }

        const query = `
            UPDATE flags 
            SET status = ?, admin_notes = ?, reviewed_at = NOW()
            WHERE id = ?
        `;

        await executeQuery(query, [status, admin_notes || null, reportId]);

        res.json({
            success: true,
            message: 'Report updated successfully'
        });

    } catch (error) {
        console.error('Update report error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating report'
        });
    }
});

// Get report statistics
router.get('/stats', async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                COUNT(*) as total_reports,
                SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_reports,
                SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) as reviewed_reports,
                SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_reports,
                COUNT(DISTINCT pharmacy_id) as pharmacies_reported
            FROM flags
        `;

        const reasonStatsQuery = `
            SELECT reason, COUNT(*) as count
            FROM flags
            GROUP BY reason
            ORDER BY count DESC
        `;

        const [stats] = await executeQuery(statsQuery);
        const reasonStats = await executeQuery(reasonStatsQuery);

        res.json({
            success: true,
            stats: {
                ...stats,
                reports_by_reason: reasonStats
            }
        });

    } catch (error) {
        console.error('Report stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching report statistics'
        });
    }
});

module.exports = router;
