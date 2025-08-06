const express = require('express');
const router = express.Router();
const { 
  getNearbyPharmacies,
  getPharmacyById
} = require('../utils/database');

// Get nearby pharmacies (public)
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusKm = parseFloat(radius);

    if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusKm)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates or radius'
      });
    }

    const pharmacies = await getNearbyPharmacies(latitude, longitude, radiusKm);

    const formattedPharmacies = pharmacies.map(pharmacy => ({
      id: pharmacy.id,
      name: pharmacy.pharmacy_name,
      license_number: pharmacy.license_number,
      description: pharmacy.description,
      address: pharmacy.address,
      city: pharmacy.city,
      state: pharmacy.state,
      country: pharmacy.country,
      phone: pharmacy.phone,
      email: pharmacy.email,
      operating_hours: pharmacy.operating_hours,
      distance: pharmacy.distance,
      is_verified: pharmacy.is_verified,
      is_active: pharmacy.is_active,
      pharmacist: {
        name: `${pharmacy.first_name} ${pharmacy.last_name}`
      }
    }));

    res.json({
      success: true,
      data: {
        location: { latitude, longitude },
        radius: radiusKm,
        total_pharmacies: formattedPharmacies.length,
        pharmacies: formattedPharmacies
      }
    });

  } catch (error) {
    console.error('Nearby pharmacies error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get nearby pharmacies'
    });
  }
});

// Get pharmacy details (public)
router.get('/:pharmacyId', async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    
    const pharmacy = await getPharmacyById(pharmacyId);
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found'
      });
    }

    // Only return active and verified pharmacies
    if (!pharmacy.is_active || !pharmacy.is_verified) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not available'
      });
    }

    const formattedPharmacy = {
      id: pharmacy.id,
      name: pharmacy.pharmacy_name,
      license_number: pharmacy.license_number,
      description: pharmacy.description,
      address: pharmacy.address,
      city: pharmacy.city,
      state: pharmacy.state,
      country: pharmacy.country,
      latitude: pharmacy.latitude,
      longitude: pharmacy.longitude,
      phone: pharmacy.phone,
      email: pharmacy.email,
      operating_hours: pharmacy.operating_hours,
      is_verified: pharmacy.is_verified,
      is_active: pharmacy.is_active,
      pharmacist: {
        name: `${pharmacy.first_name} ${pharmacy.last_name}`,
        email: pharmacy.user_email
      },
      created_at: pharmacy.created_at,
      updated_at: pharmacy.updated_at
    };

    res.json({
      success: true,
      data: formattedPharmacy
    });

  } catch (error) {
    console.error('Get pharmacy details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pharmacy details'
    });
  }
});

module.exports = router; 