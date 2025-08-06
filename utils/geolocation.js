const axios = require('axios');
const { calculateDistance, isValidCoordinates } = require('./calculations');

// Get user's current location by IP
const getCurrentLocationByIP = async (ipAddress) => {
  try {
    const response = await axios.get(`http://ip-api.com/json/${ipAddress}`);
    
    if (response.data.status === 'success') {
      return {
        success: true,
        data: {
          latitude: response.data.lat,
          longitude: response.data.lon,
          city: response.data.city,
          region: response.data.regionName,
          country: response.data.country,
          countryCode: response.data.countryCode,
          timezone: response.data.timezone,
          isp: response.data.isp,
          org: response.data.org
        }
      };
    } else {
      return {
        success: false,
        error: 'Unable to determine location from IP'
      };
    }
  } catch (error) {
    console.error('IP geolocation error:', error);
    return {
      success: false,
      error: 'Failed to get location from IP'
    };
  }
};

// Geocode address to coordinates
const geocodeAddress = async (address) => {
  try {
    // Using OpenStreetMap Nominatim API (free, no API key required)
    const encodedAddress = encodeURIComponent(address);
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`
    );

    if (response.data && response.data.length > 0) {
      const location = response.data[0];
      return {
        success: true,
        data: {
          latitude: parseFloat(location.lat),
          longitude: parseFloat(location.lon),
          display_name: location.display_name,
          type: location.type
        }
      };
    } else {
      return {
        success: false,
        error: 'Address not found'
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    return {
      success: false,
      error: 'Failed to geocode address'
    };
  }
};

// Reverse geocode coordinates to address
const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
    );

    if (response.data) {
      return {
        success: true,
        data: {
          display_name: response.data.display_name,
          address: response.data.address,
          city: response.data.address?.city || response.data.address?.town,
          state: response.data.address?.state,
          country: response.data.address?.country,
          postcode: response.data.address?.postcode
        }
      };
    } else {
      return {
        success: false,
        error: 'Location not found'
      };
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return {
      success: false,
      error: 'Failed to reverse geocode coordinates'
    };
  }
};

// Calculate optimal route between two points (simplified)
const calculateRoute = async (startLat, startLng, endLat, endLng) => {
  try {
    // Using OSRM (Open Source Routing Machine) for route calculation
    const response = await axios.get(
      `http://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`
    );

    if (response.data && response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      return {
        success: true,
        data: {
          distance: route.distance / 1000, // Convert to kilometers
          duration: route.duration / 60, // Convert to minutes
          geometry: route.geometry,
          waypoints: response.data.waypoints
        }
      };
    } else {
      return {
        success: false,
        error: 'Route not found'
      };
    }
  } catch (error) {
    console.error('Route calculation error:', error);
    // Fallback to simple distance calculation
    const distance = calculateDistance(startLat, startLng, endLat, endLng);
    return {
      success: true,
      data: {
        distance: distance,
        duration: distance * 2, // Rough estimate: 2 minutes per km
        geometry: null,
        waypoints: null
      }
    };
  }
};

// Get nearby pharmacies with enhanced geolocation data
const getNearbyPharmaciesWithRoute = async (userLat, userLng, pharmacies, radius = 10) => {
  try {
    const nearbyPharmacies = [];
    
    for (const pharmacy of pharmacies) {
      if (pharmacy.latitude && pharmacy.longitude) {
        const distance = calculateDistance(userLat, userLng, pharmacy.latitude, pharmacy.longitude);
        
        if (distance <= radius) {
          // Calculate route for each nearby pharmacy
          const route = await calculateRoute(userLat, userLng, pharmacy.latitude, pharmacy.longitude);
          
          nearbyPharmacies.push({
            ...pharmacy,
            distance: distance,
            route: route.success ? route.data : null,
            estimated_delivery_time: route.success ? 
              Math.ceil(route.data.duration) + ' minutes' : 
              Math.ceil(distance * 2) + ' minutes'
          });
        }
      }
    }
    
    // Sort by distance
    nearbyPharmacies.sort((a, b) => a.distance - b.distance);
    
    return {
      success: true,
      data: nearbyPharmacies
    };
  } catch (error) {
    console.error('Nearby pharmacies with route error:', error);
    return {
      success: false,
      error: 'Failed to get nearby pharmacies with routes'
    };
  }
};

// Validate and format coordinates
const validateAndFormatCoordinates = (latitude, longitude) => {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  
  if (!isValidCoordinates(lat, lng)) {
    return {
      success: false,
      error: 'Invalid coordinates provided'
    };
  }
  
  return {
    success: true,
    data: {
      latitude: lat,
      longitude: lng,
      formatted: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    }
  };
};

// Get map bounds for multiple locations
const getMapBounds = (locations) => {
  if (!locations || locations.length === 0) {
    return null;
  }
  
  let minLat = locations[0].latitude;
  let maxLat = locations[0].latitude;
  let minLng = locations[0].longitude;
  let maxLng = locations[0].longitude;
  
  locations.forEach(location => {
    if (location.latitude < minLat) minLat = location.latitude;
    if (location.latitude > maxLat) maxLat = location.latitude;
    if (location.longitude < minLng) minLng = location.longitude;
    if (location.longitude > maxLng) maxLng = location.longitude;
  });
  
  return {
    north: maxLat,
    south: minLat,
    east: maxLng,
    west: minLng,
    center: {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2
    }
  };
};

// Generate map markers data for pharmacies
const generateMapMarkers = (pharmacies, userLocation = null) => {
  const markers = pharmacies.map(pharmacy => ({
    id: pharmacy.id,
    type: 'pharmacy',
    position: {
      latitude: pharmacy.latitude,
      longitude: pharmacy.longitude
    },
    title: pharmacy.pharmacy_name,
    description: pharmacy.address,
    distance: pharmacy.distance,
    isVerified: pharmacy.is_verified,
    isActive: pharmacy.is_active
  }));
  
  // Add user location marker if provided
  if (userLocation) {
    markers.unshift({
      id: 'user-location',
      type: 'user',
      position: {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude
      },
      title: 'Your Location',
      description: 'Current location'
    });
  }
  
  return markers;
};

// Calculate delivery zones
const calculateDeliveryZones = (pharmacyLat, pharmacyLng) => {
  const zones = [
    { name: 'Immediate', radius: 2, deliveryFee: 500, time: '15-30 minutes' },
    { name: 'Local', radius: 5, deliveryFee: 800, time: '30-45 minutes' },
    { name: 'Extended', radius: 10, deliveryFee: 1200, time: '45-60 minutes' },
    { name: 'Far', radius: 15, deliveryFee: 1500, time: '60-90 minutes' }
  ];
  
  return zones.map(zone => ({
    ...zone,
    center: { latitude: pharmacyLat, longitude: pharmacyLng }
  }));
};

module.exports = {
  getCurrentLocationByIP,
  geocodeAddress,
  reverseGeocode,
  calculateRoute,
  getNearbyPharmaciesWithRoute,
  validateAndFormatCoordinates,
  getMapBounds,
  generateMapMarkers,
  calculateDeliveryZones
}; 