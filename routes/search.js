const express = require('express');
const router = express.Router();
const Drug = require('../models/Drug');
const Pharmacy = require('../models/Pharmacy');

// Search for drugs and nearby pharmacies
router.get('/drugs', async (req, res) => {
    try {
        const { drug, lat, lng, location, radius = 10 } = req.query;

        if (!drug) {
            return res.status(400).json({
                success: false,
                message: 'Drug name is required'
            });
        }

        let searchResults = [];

        // If GPS coordinates provided, search by location
        if (lat && lng) {
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lng);
            const searchRadius = parseFloat(radius);

            // Search for drugs with nearby pharmacies using Haversine formula
            const query = `
                SELECT 
                    p.id as pharmacy_id,
                    p.name as pharmacy_name,
                    p.email,
                    p.phone,
                    p.address,
                    p.gps_lat,
                    p.gps_long,
                    p.status,
                    p.rating,
                    d.id as drug_id,
                    d.name as drug_name,
                    d.price,
                    d.stock,
                    d.expiry_date,
                    (6371 * acos(cos(radians(?)) * cos(radians(p.gps_lat)) * 
                     cos(radians(p.gps_long) - radians(?)) + 
                     sin(radians(?)) * sin(radians(p.gps_lat)))) AS distance
                FROM pharmacies p
                JOIN drugs d ON p.id = d.pharmacy_id
                WHERE d.name LIKE ? 
                    AND d.stock > 0 
                    AND p.status = 'approved'
                    AND (6371 * acos(cos(radians(?)) * cos(radians(p.gps_lat)) * 
                         cos(radians(p.gps_long) - radians(?)) + 
                         sin(radians(?)) * sin(radians(p.gps_lat)))) <= ?
                ORDER BY distance ASC, d.price ASC
            `;

            const { executeQuery } = require('../config/database');
            const results = await executeQuery(query, [
                latitude, longitude, latitude, `%${drug}%`,
                latitude, longitude, latitude, searchRadius
            ]);

            // Group results by pharmacy
            const pharmacyMap = new Map();
            
            results.forEach(row => {
                if (!pharmacyMap.has(row.pharmacy_id)) {
                    pharmacyMap.set(row.pharmacy_id, {
                        id: row.pharmacy_id,
                        name: row.pharmacy_name,
                        email: row.email,
                        phone: row.phone,
                        address: row.address,
                        gps_lat: row.gps_lat,
                        gps_long: row.gps_long,
                        status: row.status,
                        rating: row.rating,
                        distance: row.distance,
                        drugs: []
                    });
                }
                
                pharmacyMap.get(row.pharmacy_id).drugs.push({
                    id: row.drug_id,
                    name: row.drug_name,
                    price: row.price,
                    stock: row.stock,
                    expiry_date: row.expiry_date
                });
            });

            searchResults = Array.from(pharmacyMap.values());

        } else {
            // Search without location - just find drugs by name
            const drugs = await Drug.search(drug);
            
            // Group by pharmacy and get pharmacy details
            const pharmacyMap = new Map();
            
            for (const drugItem of drugs) {
                if (!pharmacyMap.has(drugItem.pharmacy_id)) {
                    const pharmacy = await Pharmacy.findById(drugItem.pharmacy_id);
                    if (pharmacy && pharmacy.status === 'approved') {
                        pharmacyMap.set(drugItem.pharmacy_id, {
                            id: pharmacy.id,
                            name: pharmacy.name,
                            email: pharmacy.email,
                            phone: pharmacy.phone,
                            address: pharmacy.address,
                            gps_lat: pharmacy.gps_lat,
                            gps_long: pharmacy.gps_long,
                            status: pharmacy.status,
                            rating: pharmacy.rating,
                            drugs: []
                        });
                    }
                }
                
                if (pharmacyMap.has(drugItem.pharmacy_id)) {
                    pharmacyMap.get(drugItem.pharmacy_id).drugs.push({
                        id: drugItem.id,
                        name: drugItem.name,
                        price: drugItem.price,
                        stock: drugItem.stock,
                        expiry_date: drugItem.expiry_date
                    });
                }
            }

            searchResults = Array.from(pharmacyMap.values());
        }

        res.json({
            success: true,
            pharmacies: searchResults,
            count: searchResults.length,
            search_params: {
                drug,
                location: lat && lng ? `${lat}, ${lng}` : location,
                radius
            }
        });

    } catch (error) {
        console.error('Drug search error:', error);
        res.status(500).json({
            success: false,
            message: 'Error searching for drugs',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get popular/trending drugs
router.get('/popular', async (req, res) => {
    try {
        const query = `
            SELECT 
                d.name,
                COUNT(*) as search_count,
                AVG(d.price) as avg_price,
                COUNT(DISTINCT d.pharmacy_id) as pharmacy_count
            FROM drugs d
            JOIN pharmacies p ON d.pharmacy_id = p.id
            WHERE p.status = 'approved' AND d.stock > 0
            GROUP BY d.name
            ORDER BY search_count DESC, pharmacy_count DESC
            LIMIT 20
        `;

        const { executeQuery } = require('../config/database');
        const results = await executeQuery(query);

        res.json({
            success: true,
            popular_drugs: results
        });

    } catch (error) {
        console.error('Popular drugs error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching popular drugs'
        });
    }
});

// Search suggestions/autocomplete
router.get('/suggestions', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.json({
                success: true,
                suggestions: []
            });
        }

        const query = `
            SELECT DISTINCT d.name
            FROM drugs d
            JOIN pharmacies p ON d.pharmacy_id = p.id
            WHERE d.name LIKE ? 
                AND p.status = 'approved' 
                AND d.stock > 0
            ORDER BY d.name ASC
            LIMIT 10
        `;

        const { executeQuery } = require('../config/database');
        const results = await executeQuery(query, [`%${q}%`]);

        res.json({
            success: true,
            suggestions: results.map(row => row.name)
        });

    } catch (error) {
        console.error('Search suggestions error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching suggestions'
        });
    }
});

// Get pharmacy details with drugs
router.get('/pharmacy/:id', async (req, res) => {
    try {
        const pharmacyId = req.params.id;
        
        const pharmacy = await Pharmacy.findById(pharmacyId);
        if (!pharmacy) {
            return res.status(404).json({
                success: false,
                message: 'Pharmacy not found'
            });
        }

        // Get all drugs for this pharmacy
        const drugs = await Drug.findByPharmacyId(pharmacyId);
        
        res.json({
            success: true,
            pharmacy: {
                ...pharmacy,
                drugs: drugs
            }
        });

    } catch (error) {
        console.error('Pharmacy details error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching pharmacy details'
        });
    }
});

module.exports = router;
