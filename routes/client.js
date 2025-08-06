const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireClient } = require('../utils/auth');
const { 
  getClientOrders, 
  createOrder, 
  getOrderById,
  searchDrugsInPharmacies,
  getNearbyPharmacies
} = require('../utils/database');
const { 
  calculateDistance, 
  calculateDeliveryFee, 
  calculateDeliveryTime,
  formatPrice 
} = require('../utils/calculations');

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(requireClient);

// Get client profile
router.get('/profile', (req, res) => {
  try {
    const { password, ...userWithoutPassword } = req.user;
    res.json({
      success: true,
      data: userWithoutPassword
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
});

// Search for drugs in nearby pharmacies
router.get('/search-drugs', async (req, res) => {
  try {
    const { drugName, lat, lng, radius = 10 } = req.query;

    if (!drugName) {
      return res.status(400).json({
        success: false,
        error: 'Drug name is required'
      });
    }

    // Use client's location if not provided
    const searchLat = lat || req.user.latitude;
    const searchLng = lng || req.user.longitude;

    if (!searchLat || !searchLng) {
      return res.status(400).json({
        success: false,
        error: 'Location is required. Please update your profile with your location.'
      });
    }

    const searchResults = await searchDrugsInPharmacies(drugName, searchLat, searchLng, radius);

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
        formatted_price: formatPrice(item.price),
        expiry_date: item.expiry_date
      });
      
      return acc;
    }, {});

    const pharmacies = Object.values(groupedResults).sort((a, b) => a.pharmacy.distance - b.pharmacy.distance);

    res.json({
      success: true,
      data: {
        search_term: drugName,
        location: { latitude: searchLat, longitude: searchLng },
        radius: radius,
        total_pharmacies: pharmacies.length,
        pharmacies: pharmacies
      }
    });

  } catch (error) {
    console.error('Drug search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search for drugs'
    });
  }
});

// Get nearby pharmacies
router.get('/nearby-pharmacies', async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;

    // Use client's location if not provided
    const searchLat = lat || req.user.latitude;
    const searchLng = lng || req.user.longitude;

    if (!searchLat || !searchLng) {
      return res.status(400).json({
        success: false,
        error: 'Location is required. Please update your profile with your location.'
      });
    }

    const pharmacies = await getNearbyPharmacies(searchLat, searchLng, radius);

    const formattedPharmacies = pharmacies.map(pharmacy => ({
      id: pharmacy.id,
      name: pharmacy.pharmacy_name,
      address: pharmacy.address,
      city: pharmacy.city,
      state: pharmacy.state,
      phone: pharmacy.phone,
      email: pharmacy.email,
      operating_hours: pharmacy.operating_hours,
      distance: pharmacy.distance,
      pharmacist: {
        name: `${pharmacy.first_name} ${pharmacy.last_name}`
      }
    }));

    res.json({
      success: true,
      data: {
        location: { latitude: searchLat, longitude: searchLng },
        radius: radius,
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

// Get client orders
router.get('/orders', async (req, res) => {
  try {
    const { status, limit = 20, offset = 0 } = req.query;
    
    const orders = await getClientOrders(req.user.id);
    
    // Filter by status if provided
    let filteredOrders = orders;
    if (status) {
      filteredOrders = orders.filter(order => order.status === status);
    }
    
    // Apply pagination
    const paginatedOrders = filteredOrders.slice(offset, offset + limit);
    
    const formattedOrders = paginatedOrders.map(order => ({
      id: order.id,
      pharmacy_name: order.pharmacy_name,
      pharmacy_phone: order.pharmacy_phone,
      total_amount: order.total_amount,
      formatted_amount: formatPrice(order.total_amount),
      status: order.status,
      payment_status: order.payment_status,
      delivery_address: order.delivery_address,
      delivery_notes: order.delivery_notes,
      created_at: order.created_at,
      updated_at: order.updated_at
    }));

    res.json({
      success: true,
      data: {
        orders: formattedOrders,
        total: filteredOrders.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get orders'
    });
  }
});

// Get specific order details
router.get('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await getOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    // Check if order belongs to the authenticated client
    if (order.client_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    const formattedOrder = {
      id: order.id,
      pharmacy: {
        name: order.pharmacy_name,
        phone: order.pharmacy_phone
      },
      items: order.items.map(item => ({
        id: item.id,
        drug_name: item.drug_name,
        generic_name: item.generic_name,
        dosage_form: item.dosage_form,
        strength: item.strength,
        quantity: item.quantity,
        unit_price: item.unit_price,
        formatted_unit_price: formatPrice(item.unit_price),
        total_price: item.total_price,
        formatted_total_price: formatPrice(item.total_price)
      })),
      total_amount: order.total_amount,
      formatted_total_amount: formatPrice(order.total_amount),
      status: order.status,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      delivery_address: order.delivery_address,
      delivery_notes: order.delivery_notes,
      created_at: order.created_at,
      updated_at: order.updated_at
    };
    
    res.json({
      success: true,
      data: formattedOrder
    });

  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get order details'
    });
  }
});

// Create new order
router.post('/orders', [
  body('pharmacy_id').isInt().withMessage('Valid pharmacy ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.drug_id').isInt().withMessage('Valid drug ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Valid quantity is required'),
  body('delivery_address').notEmpty().withMessage('Delivery address is required'),
  body('delivery_latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid delivery latitude is required'),
  body('delivery_longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid delivery longitude is required'),
  body('delivery_notes').optional().trim()
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { 
      pharmacy_id, 
      items, 
      delivery_address, 
      delivery_latitude, 
      delivery_longitude, 
      delivery_notes 
    } = req.body;

    // Calculate total amount and validate items
    let totalAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      // Here you would typically validate against actual inventory
      // For now, we'll use a placeholder price
      const unitPrice = 1000; // This should come from the inventory
      const itemTotal = unitPrice * item.quantity;
      
      validatedItems.push({
        drug_id: item.drug_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: itemTotal
      });
      
      totalAmount += itemTotal;
    }

    // Calculate delivery fee based on distance
    const clientLat = req.user.latitude;
    const clientLng = req.user.longitude;
    let deliveryFee = 0;

    if (clientLat && clientLng) {
      const distance = calculateDistance(clientLat, clientLng, delivery_latitude, delivery_longitude);
      deliveryFee = calculateDeliveryFee(distance);
      totalAmount += deliveryFee;
    }

    // Create order
    const orderData = {
      client_id: req.user.id,
      pharmacy_id,
      total_amount: totalAmount,
      delivery_address,
      delivery_latitude,
      delivery_longitude,
      delivery_notes,
      items: validatedItems
    };

    const newOrder = await createOrder(orderData);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order_id: newOrder.id,
        total_amount: totalAmount,
        formatted_total_amount: formatPrice(totalAmount),
        delivery_fee: deliveryFee,
        formatted_delivery_fee: formatPrice(deliveryFee),
        estimated_delivery: clientLat && clientLng ? 
          calculateDeliveryTime(calculateDistance(clientLat, clientLng, delivery_latitude, delivery_longitude)) : 
          '45-60 minutes'
      }
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order'
    });
  }
});

// Cancel order
router.put('/orders/:orderId/cancel', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await getOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    // Check if order belongs to the authenticated client
    if (order.client_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Check if order can be cancelled
    if (order.status !== 'pending' && order.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        error: 'Order cannot be cancelled at this stage'
      });
    }
    
    // Update order status
    const { updateOrderStatus } = require('../utils/database');
    await updateOrderStatus(orderId, 'cancelled');
    
    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order'
    });
  }
});

module.exports = router; 