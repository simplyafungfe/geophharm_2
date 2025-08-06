const express = require('express');
const router = express.Router();
const { 
  getAllDrugs,
  searchDrugs,
  searchDrugsInPharmacies
} = require('../utils/database');

// Get all drugs
router.get('/', async (req, res) => {
  try {
    const { category, limit = 50, offset = 0 } = req.query;
    
    const drugs = await getAllDrugs();
    
    // Filter by category if provided
    let filteredDrugs = drugs;
    if (category) {
      filteredDrugs = drugs.filter(drug => 
        drug.category_name && drug.category_name.toLowerCase() === category.toLowerCase()
      );
    }
    
    // Apply pagination
    const paginatedDrugs = filteredDrugs.slice(offset, offset + limit);
    
    const formattedDrugs = paginatedDrugs.map(drug => ({
      id: drug.id,
      name: drug.name,
      generic_name: drug.generic_name,
      category: drug.category_name,
      description: drug.description,
      dosage_form: drug.dosage_form,
      strength: drug.strength,
      manufacturer: drug.manufacturer,
      prescription_required: drug.prescription_required,
      created_at: drug.created_at
    }));

    res.json({
      success: true,
      data: {
        drugs: formattedDrugs,
        total: filteredDrugs.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Get drugs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get drugs'
    });
  }
});

// Search drugs
router.get('/search', async (req, res) => {
  try {
    const { q, category, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const drugs = await searchDrugs(q);
    
    // Filter by category if provided
    let filteredDrugs = drugs;
    if (category) {
      filteredDrugs = drugs.filter(drug => 
        drug.category_name && drug.category_name.toLowerCase() === category.toLowerCase()
      );
    }
    
    // Apply limit
    const limitedDrugs = filteredDrugs.slice(0, limit);
    
    const formattedDrugs = limitedDrugs.map(drug => ({
      id: drug.id,
      name: drug.name,
      generic_name: drug.generic_name,
      category: drug.category_name,
      description: drug.description,
      dosage_form: drug.dosage_form,
      strength: drug.strength,
      manufacturer: drug.manufacturer,
      prescription_required: drug.prescription_required,
      created_at: drug.created_at
    }));

    res.json({
      success: true,
      data: {
        search_query: q,
        drugs: formattedDrugs,
        total_found: filteredDrugs.length,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Search drugs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search drugs'
    });
  }
});

// Search drugs in pharmacies
router.get('/available', async (req, res) => {
  try {
    const { drugName, lat, lng, radius = 10 } = req.query;

    if (!drugName) {
      return res.status(400).json({
        success: false,
        error: 'Drug name is required'
      });
    }

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Location coordinates are required'
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

    const searchResults = await searchDrugsInPharmacies(drugName, latitude, longitude, radiusKm);

    // Group results by pharmacy
    const groupedResults = searchResults.reduce((acc, item) => {
      const pharmacyKey = item.pharmacy_id;
      if (!acc[pharmacyKey]) {
        acc[pharmacyKey] = {
          pharmacy: {
            id: item.pharmacy_id,
            name: item.pharmacy_name,
            address: item.address,
            city: item.city,
            state: item.state,
            phone: item.phone,
            distance: item.distance
          },
          drugs: []
        };
      }
      
      acc[pharmacyKey].drugs.push({
        id: item.id,
        drug_name: item.drug_name,
        generic_name: item.generic_name,
        dosage_form: item.dosage_form,
        strength: item.strength,
        manufacturer: item.manufacturer,
        prescription_required: item.prescription_required,
        quantity: item.quantity,
        price: item.price,
        formatted_price: new Intl.NumberFormat('en-NG', {
          style: 'currency',
          currency: 'NGN'
        }).format(item.price),
        expiry_date: item.expiry_date
      });
      
      return acc;
    }, {});

    const pharmacies = Object.values(groupedResults).sort((a, b) => a.pharmacy.distance - b.pharmacy.distance);

    res.json({
      success: true,
      data: {
        search_term: drugName,
        location: { latitude, longitude },
        radius: radiusKm,
        total_pharmacies: pharmacies.length,
        pharmacies: pharmacies
      }
    });

  } catch (error) {
    console.error('Search available drugs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search available drugs'
    });
  }
});

// Get drug categories
router.get('/categories', async (req, res) => {
  try {
    const { getAllDrugs } = require('../utils/database');
    const drugs = await getAllDrugs();
    
    // Extract unique categories
    const categories = [...new Set(drugs.map(drug => drug.category_name).filter(Boolean))];
    
    const formattedCategories = categories.map(category => ({
      name: category,
      description: getCategoryDescription(category),
      drug_count: drugs.filter(drug => drug.category_name === category).length
    }));

    res.json({
      success: true,
      data: {
        categories: formattedCategories,
        total_categories: categories.length
      }
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get drug categories'
    });
  }
});

// Helper function to get category descriptions
function getCategoryDescription(category) {
  const descriptions = {
    'Antibiotics': 'Medications that fight bacterial infections',
    'Pain Relievers': 'Medications for pain management',
    'Vitamins & Supplements': 'Nutritional supplements and vitamins',
    'Cardiovascular': 'Medications for heart and blood vessel conditions',
    'Diabetes': 'Medications for diabetes management',
    'Respiratory': 'Medications for breathing and lung conditions',
    'Mental Health': 'Medications for mental health conditions',
    'First Aid': 'Basic first aid supplies and medications'
  };
  
  return descriptions[category] || 'Medication category';
}

module.exports = router; 