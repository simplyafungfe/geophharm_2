const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../utils/auth');
const { 
  getCurrentLocationByIP,
  geocodeAddress,
  reverseGeocode,
  calculateRoute,
  getNearbyPharmaciesWithRoute,
  validateAndFormatCoordinates,
  getMapBounds,
  generateMapMarkers,
  calculateDeliveryZones
} = require('../utils/geolocation');
const { getNearbyPharmacies } = require('../utils/database');

// Get current location by IP (public)
router.get('/current', async (req, res) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const location = await getCurrentLocationByIP(clientIP);
    
    if (location.success) {
      res.json({
        success: true,
        data: {
          ...location.data,
          ip: clientIP,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: location.error
      });
    }
  } catch (error) {
    console.error('Current location error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get current location'
    });
  }
});

// Geocode address to coordinates (public)
router.get('/geocode', async (req, res) => {
  try {
    const { address } = req.query;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Address parameter is required'
      });
    }
    
    const result = await geocodeAddress(address);
    
    if (result.success) {
      res.json({
        success: true,
        data: {
          ...result.data,
          original_address: address,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to geocode address'
    });
  }
});

// Reverse geocode coordinates to address (public)
router.get('/reverse-geocode', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude parameters are required'
      });
    }
    
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates provided'
      });
    }
    
    const result = await reverseGeocode(latitude, longitude);
    
    if (result.success) {
      res.json({
        success: true,
        data: {
          ...result.data,
          coordinates: { latitude, longitude },
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reverse geocode coordinates'
    });
  }
});

// Calculate route between two points (public)
router.get('/route', async (req, res) => {
  try {
    const { startLat, startLng, endLat, endLng } = req.query;
    
    if (!startLat || !startLng || !endLat || !endLng) {
      return res.status(400).json({
        success: false,
        error: 'Start and end coordinates are required'
      });
    }
    
    const startLatNum = parseFloat(startLat);
    const startLngNum = parseFloat(startLng);
    const endLatNum = parseFloat(endLat);
    const endLngNum = parseFloat(endLng);
    
    if (isNaN(startLatNum) || isNaN(startLngNum) || isNaN(endLatNum) || isNaN(endLngNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates provided'
      });
    }
    
    const result = await calculateRoute(startLatNum, startLngNum, endLatNum, endLngNum);
    
    if (result.success) {
      res.json({
        success: true,
        data: {
          ...result.data,
          start: { latitude: startLatNum, longitude: startLngNum },
          end: { latitude: endLatNum, longitude: endLngNum },
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Route calculation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate route'
    });
  }
});

// Get nearby pharmacies with enhanced geolocation data (authenticated)
router.get('/nearby-pharmacies', authenticateToken, async (req, res) => {
  try {
    const { lat, lng, radius = 10, includeRoutes = false } = req.query;
    
    // Use user's location if not provided
    const searchLat = lat || req.user.latitude;
    const searchLng = lng || req.user.longitude;
    
    if (!searchLat || !searchLng) {
      return res.status(400).json({
        success: false,
        error: 'Location coordinates are required'
      });
    }
    
    const latitude = parseFloat(searchLat);
    const longitude = parseFloat(searchLng);
    const radiusKm = parseFloat(radius);
    
    if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusKm)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates or radius'
      });
    }
    
    // Get basic nearby pharmacies
    const pharmacies = await getNearbyPharmacies(latitude, longitude, radiusKm);
    
    if (includeRoutes === 'true') {
      // Get enhanced data with routes
      const enhancedResult = await getNearbyPharmaciesWithRoute(latitude, longitude, pharmacies, radiusKm);
      
      if (enhancedResult.success) {
        // Generate map data
        const mapBounds = getMapBounds(enhancedResult.data);
        const mapMarkers = generateMapMarkers(enhancedResult.data, { latitude, longitude });
        
        res.json({
          success: true,
          data: {
            user_location: { latitude, longitude },
            search_radius: radiusKm,
            pharmacies: enhancedResult.data,
            map_data: {
              bounds: mapBounds,
              markers: mapMarkers
            },
            total_pharmacies: enhancedResult.data.length,
            timestamp: new Date().toISOString()
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: enhancedResult.error
        });
      }
    } else {
      // Basic nearby pharmacies without routes
      const mapBounds = getMapBounds(pharmacies);
      const mapMarkers = generateMapMarkers(pharmacies, { latitude, longitude });
      
      res.json({
        success: true,
        data: {
          user_location: { latitude, longitude },
          search_radius: radiusKm,
          pharmacies: pharmacies,
          map_data: {
            bounds: mapBounds,
            markers: mapMarkers
          },
          total_pharmacies: pharmacies.length,
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    console.error('Nearby pharmacies error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get nearby pharmacies'
    });
  }
});

// Get delivery zones for a pharmacy (public)
router.get('/delivery-zones/:pharmacyId', async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Pharmacy coordinates are required'
      });
    }
    
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates provided'
      });
    }
    
    const deliveryZones = calculateDeliveryZones(latitude, longitude);
    
    res.json({
      success: true,
      data: {
        pharmacy_id: pharmacyId,
        pharmacy_location: { latitude, longitude },
        delivery_zones: deliveryZones,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Delivery zones error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get delivery zones'
    });
  }
});

// Validate coordinates (public)
router.get('/validate-coordinates', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude parameters are required'
      });
    }
    
    const result = validateAndFormatCoordinates(lat, lng);
    
    if (result.success) {
      res.json({
        success: true,
        data: {
          ...result.data,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Coordinate validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate coordinates'
    });
  }
});

// Get map data for multiple pharmacies (authenticated)
router.get('/map-data', authenticateToken, async (req, res) => {
  try {
    const { lat, lng, radius = 10, pharmacyIds } = req.query;
    
    // Use user's location if not provided
    const searchLat = lat || req.user.latitude;
    const searchLng = lng || req.user.longitude;
    
    if (!searchLat || !searchLng) {
      return res.status(400).json({
        success: false,
        error: 'Location coordinates are required'
      });
    }
    
    const latitude = parseFloat(searchLat);
    const longitude = parseFloat(searchLng);
    const radiusKm = parseFloat(radius);
    
    if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusKm)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates or radius'
      });
    }
    
    // Get pharmacies
    let pharmacies;
    if (pharmacyIds) {
      // Get specific pharmacies by IDs
      const ids = pharmacyIds.split(',').map(id => parseInt(id.trim()));
      // This would need to be implemented in the database utility
      // For now, we'll get all nearby pharmacies
      pharmacies = await getNearbyPharmacies(latitude, longitude, radiusKm);
    } else {
      // Get all nearby pharmacies
      pharmacies = await getNearbyPharmacies(latitude, longitude, radiusKm);
    }
    
    // Generate map data
    const mapBounds = getMapBounds(pharmacies);
    const mapMarkers = generateMapMarkers(pharmacies, { latitude, longitude });
    
    res.json({
      success: true,
      data: {
        user_location: { latitude, longitude },
        search_radius: radiusKm,
        map_data: {
          bounds: mapBounds,
          markers: mapMarkers,
          center: mapBounds ? mapBounds.center : { latitude, longitude }
        },
        total_pharmacies: pharmacies.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Map data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get map data'
    });
  }
});

module.exports = router; 