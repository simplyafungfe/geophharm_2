const express = require('express');
const router = express.Router();
const Pharmacy = require('../../models/Pharmacy');
const Drug = require('../../models/Drug');
const User = require('../../models/User');

// Search drugs across all pharmacies (main search endpoint)
router.get('/search-drugs', async (req, res) => {
    try {
        const { drugName, lat, lng, radius = 10, limit = 50 } = req.query;
        
        if (!drugName) {
            return res.status(400).json({
                success: false,
                error: 'Drug name is required'
            });
        }

        // Prepare search filters
        const filters = {
            limit: parseInt(limit),
            in_stock_only: true
        };

        // Add location filter if provided
        if (lat && lng) {
            filters.location = { lat: parseFloat(lat), lng: parseFloat(lng) };
            filters.radius = parseFloat(radius);
        }

        // Search for drugs
        const searchResult = await Drug.search(drugName, filters);
        
        if (!searchResult.success) {
            return res.status(500).json({
                success: false,
                error: searchResult.error
            });
        }

        // Calculate distances if location provided
        const results = searchResult.data.map(item => {
            const result = {
                pharmacy: {
                    id: item.pharmacy_id,
                    name: item.pharmacy_name,
                    address: item.pharmacy_address,
                    phone: item.pharmacy_phone,
                    coordinates: {
                        latitude: item.gps_lat,
                        longitude: item.gps_long
                    },
                    rating: item.rating
                },
                drug: {
                    id: item.id,
                    name: item.name,
                    category: item.category,
                    description: item.description,
                    manufacturer: item.manufacturer,
                    price: item.price,
                    currency: item.currency,
                    stock: item.stock
                },
                availability: item.stock_status,
                distance: lat && lng ? calculateDistance(
                    parseFloat(lat), parseFloat(lng),
                    item.gps_lat, item.gps_long
                ) : null
            };
            return result;
        });

        // Log search for analytics
        if (req.user?.id) {
            await User.logSearch(
                req.user.id, 
                drugName, 
                lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
                results.length
            );
        }

        res.json({
            success: true,
            data: {
                results,
                total: results.length,
                search_term: drugName,
                location: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null
            }
        });

    } catch (error) {
        console.error('Drug search error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get pharmacy details by ID
router.get('/pharmacy/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const pharmacyResult = await Pharmacy.findById(id);
        if (!pharmacyResult.success) {
            return res.status(404).json({
                success: false,
                error: 'Pharmacy not found'
            });
        }

        const pharmacy = pharmacyResult.data;
        
        // Get pharmacy drugs
        const drugsResult = await Drug.findByPharmacy(id, { in_stock_only: false });
        const drugs = drugsResult.success ? drugsResult.data : [];

        // Get pharmacy statistics
        const statsResult = await Pharmacy.getStats(id);
        const stats = statsResult.success ? statsResult.data : {};

        res.json({
            success: true,
            data: {
                pharmacy: {
                    id: pharmacy.id,
                    name: pharmacy.name,
                    email: pharmacy.email,
                    phone: pharmacy.phone,
                    address: pharmacy.address,
                    coordinates: {
                        latitude: pharmacy.gps_lat,
                        longitude: pharmacy.gps_long
                    },
                    rating: pharmacy.rating,
                    operating_hours: pharmacy.operating_hours,
                    services: pharmacy.services,
                    status: pharmacy.status
                },
                inventory: drugs.map(drug => ({
                    id: drug.id,
                    name: drug.name,
                    category: drug.category,
                    description: drug.description,
                    manufacturer: drug.manufacturer,
                    price: drug.price,
                    currency: drug.currency,
                    stock: drug.stock,
                    stock_status: drug.stock === 0 ? 'Out of Stock' : 
                                 drug.stock < 20 ? `Low Stock (${drug.stock} left)` : 'In Stock',
                    expiry_date: drug.expiry_date
                })),
                statistics: stats
            }
        });

    } catch (error) {
        console.error('Get pharmacy error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get nearby pharmacies
router.get('/nearby', async (req, res) => {
    try {
        const { lat, lng, radius = 10, limit = 20 } = req.query;
        
        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required'
            });
        }

        const filters = {
            status: 'approved',
            location: { lat: parseFloat(lat), lng: parseFloat(lng) },
            radius: parseFloat(radius),
            limit: parseInt(limit)
        };

        const pharmaciesResult = await Pharmacy.findAll(filters);
        
        if (!pharmaciesResult.success) {
            return res.status(500).json({
                success: false,
                error: pharmaciesResult.error
            });
        }

        const pharmacies = pharmaciesResult.data.map(pharmacy => ({
            id: pharmacy.id,
            name: pharmacy.name,
            address: pharmacy.address,
            phone: pharmacy.phone,
            coordinates: {
                latitude: pharmacy.gps_lat,
                longitude: pharmacy.gps_long
            },
            rating: pharmacy.rating,
            services: pharmacy.services,
            distance: calculateDistance(
                parseFloat(lat), parseFloat(lng),
                pharmacy.gps_lat, pharmacy.gps_long
            )
        }));

        res.json({
            success: true,
            data: {
                pharmacies,
                total: pharmacies.length,
                center: { lat: parseFloat(lat), lng: parseFloat(lng) },
                radius: parseFloat(radius)
            }
        });

    } catch (error) {
        console.error('Nearby pharmacies error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get drug categories
router.get('/categories', async (req, res) => {
    try {
        const categoriesResult = await Drug.getCategories();
        
        if (!categoriesResult.success) {
            return res.status(500).json({
                success: false,
                error: categoriesResult.error
            });
        }

        res.json({
            success: true,
            data: {
                categories: categoriesResult.data
            }
        });

    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get popular drugs
router.get('/popular-drugs', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        const popularResult = await Drug.getPopular(parseInt(limit));
        
        if (!popularResult.success) {
            return res.status(500).json({
                success: false,
                error: popularResult.error
            });
        }

        res.json({
            success: true,
            data: {
                drugs: popularResult.data
            }
        });

    } catch (error) {
        console.error('Get popular drugs error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Rate a pharmacy
router.post('/pharmacy/:id/rate', async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, review, user_id } = req.body;
        
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                error: 'Rating must be between 1 and 5'
            });
        }

        // Create user if not exists (for anonymous ratings)
        let userId = user_id;
        if (!userId && req.body.user_info) {
            const userResult = await User.create(req.body.user_info);
            if (userResult.success) {
                userId = userResult.user_id;
            }
        }

        const ratingResult = await User.ratePharmacy(userId, id, rating, review);
        
        if (!ratingResult.success) {
            return res.status(500).json({
                success: false,
                error: ratingResult.error
            });
        }

        res.json({
            success: true,
            message: 'Rating submitted successfully'
        });

    } catch (error) {
        console.error('Rate pharmacy error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Report a pharmacy
router.post('/pharmacy/:id/report', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, description, user_id } = req.body;
        
        if (!reason) {
            return res.status(400).json({
                success: false,
                error: 'Reason is required'
            });
        }

        const reportResult = await User.reportPharmacy(user_id, id, reason, description);
        
        if (!reportResult.success) {
            return res.status(500).json({
                success: false,
                error: reportResult.error
            });
        }

        res.json({
            success: true,
            message: 'Report submitted successfully',
            flag_id: reportResult.flag_id
        });

    } catch (error) {
        console.error('Report pharmacy error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Helper function to calculate distance between two points
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return `${distance.toFixed(1)} km`;
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

module.exports = router;
