const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken, requirePharmacist } = require('../utils/auth');
const { 
  getPharmaciesByUserId,
  createPharmacy,
  getPharmacyInventory,
  addToInventory,
  updateInventory,
  getPharmacyOrders,
  updateOrderStatus,
  getAllPharmacyRegistrations,
  getPharmacyRegistrationById,
  getPharmacyRegistrationInventory
} = require('../utils/database');
const { 
  formatPrice, 
  isExpiringSoon, 
  getLowStockItems,
  calculateInventoryValue 
} = require('../utils/calculations');

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(requirePharmacist);

// Get pharmacist profile
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

// Get pharmacist's pharmacies
router.get('/pharmacies', async (req, res) => {
  try {
    const pharmacies = await getPharmaciesByUserId(req.user.id);
    
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
      is_verified: pharmacy.is_verified,
      is_active: pharmacy.is_active,
      created_at: pharmacy.created_at,
      updated_at: pharmacy.updated_at
    }));

    res.json({
      success: true,
      data: {
        total_pharmacies: formattedPharmacies.length,
        pharmacies: formattedPharmacies
      }
    });

  } catch (error) {
    console.error('Get pharmacies error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pharmacies'
    });
  }
});

// Create new pharmacy
router.post('/pharmacies', [
  body('pharmacy_name').notEmpty().withMessage('Pharmacy name is required'),
  body('license_number').notEmpty().withMessage('License number is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('description').optional().trim(),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('operating_hours').optional().trim(),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 })
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

    const pharmacyData = {
      user_id: req.user.id,
      ...req.body
    };

    const newPharmacy = await createPharmacy(pharmacyData);

    res.status(201).json({
      success: true,
      message: 'Pharmacy created successfully',
      data: {
        id: newPharmacy.id,
        name: newPharmacy.pharmacy_name,
        license_number: newPharmacy.license_number,
        address: newPharmacy.address,
        city: newPharmacy.city,
        state: newPharmacy.state,
        phone: newPharmacy.phone,
        is_verified: newPharmacy.is_verified,
        created_at: newPharmacy.created_at
      }
    });

  } catch (error) {
    console.error('Create pharmacy error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create pharmacy'
    });
  }
});

// Get pharmacy inventory
router.get('/inventory/:pharmacyId', async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    
    // Verify pharmacy belongs to pharmacist
    const pharmacies = await getPharmaciesByUserId(req.user.id);
    const pharmacy = pharmacies.find(p => p.id == pharmacyId);
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found'
      });
    }

    const inventory = await getPharmacyInventory(pharmacyId);
    
    // Calculate inventory statistics
    const totalItems = inventory.length;
    const totalValue = calculateInventoryValue(inventory);
    const lowStockItems = getLowStockItems(inventory);
    const expiringItems = inventory.filter(item => isExpiringSoon(item.expiry_date));
    
    const formattedInventory = inventory.map(item => ({
      id: item.id,
      drug: {
        id: item.drug_id,
        name: item.drug_name,
        generic_name: item.generic_name,
        dosage_form: item.dosage_form,
        strength: item.strength,
        manufacturer: item.manufacturer,
        prescription_required: item.prescription_required,
        category: item.category_name
      },
      quantity: item.quantity,
      price: item.price,
      formatted_price: formatPrice(item.price),
      expiry_date: item.expiry_date,
      batch_number: item.batch_number,
      is_available: item.is_available,
      is_low_stock: item.quantity < 10,
      is_expiring_soon: isExpiringSoon(item.expiry_date),
      total_value: item.quantity * item.price,
      formatted_total_value: formatPrice(item.quantity * item.price),
      created_at: item.created_at,
      updated_at: item.updated_at
    }));

    res.json({
      success: true,
      data: {
        pharmacy: {
          id: pharmacy.id,
          name: pharmacy.pharmacy_name,
          address: pharmacy.address,
          city: pharmacy.city,
          state: pharmacy.state
        },
        inventory: {
          items: formattedInventory,
          total_items: totalItems,
          total_value: totalValue,
          formatted_total_value: formatPrice(totalValue),
          low_stock_count: lowStockItems.length,
          expiring_count: expiringItems.length
        }
      }
    });

  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get inventory'
    });
  }
});

// Add item to inventory
router.post('/inventory/:pharmacyId', [
  body('drug_id').isInt().withMessage('Valid drug ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Valid quantity is required'),
  body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
  body('expiry_date').isISO8601().withMessage('Valid expiry date is required'),
  body('batch_number').optional().trim()
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

    const { pharmacyId } = req.params;
    
    // Verify pharmacy belongs to pharmacist
    const pharmacies = await getPharmaciesByUserId(req.user.id);
    const pharmacy = pharmacies.find(p => p.id == pharmacyId);
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found'
      });
    }

    const inventoryData = {
      pharmacy_id: pharmacyId,
      ...req.body
    };

    const newInventoryItem = await addToInventory(inventoryData);

    res.status(201).json({
      success: true,
      message: 'Item added to inventory successfully',
      data: {
        id: newInventoryItem.id,
        drug_id: newInventoryItem.drug_id,
        quantity: newInventoryItem.quantity,
        price: newInventoryItem.price,
        formatted_price: formatPrice(newInventoryItem.price),
        expiry_date: newInventoryItem.expiry_date,
        batch_number: newInventoryItem.batch_number,
        created_at: newInventoryItem.created_at
      }
    });

  } catch (error) {
    console.error('Add inventory error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add item to inventory'
    });
  }
});

// Update inventory item
router.put('/inventory/:pharmacyId/:itemId', [
  body('quantity').optional().isInt({ min: 0 }).withMessage('Valid quantity is required'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Valid price is required'),
  body('is_available').optional().isBoolean().withMessage('Valid availability status is required')
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

    const { pharmacyId, itemId } = req.params;
    
    // Verify pharmacy belongs to pharmacist
    const pharmacies = await getPharmaciesByUserId(req.user.id);
    const pharmacy = pharmacies.find(p => p.id == pharmacyId);
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found'
      });
    }

    const updateData = { ...req.body };
    const updatedItem = await updateInventory(itemId, updateData);

    res.json({
      success: true,
      message: 'Inventory item updated successfully',
      data: {
        id: updatedItem.id,
        ...updateData,
        formatted_price: updateData.price ? formatPrice(updateData.price) : undefined
      }
    });

  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update inventory item'
    });
  }
});

// Get pharmacy orders
router.get('/orders/:pharmacyId', async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { status, limit = 20, offset = 0 } = req.query;
    
    // Verify pharmacy belongs to pharmacist
    const pharmacies = await getPharmaciesByUserId(req.user.id);
    const pharmacy = pharmacies.find(p => p.id == pharmacyId);
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found'
      });
    }

    const orders = await getPharmacyOrders(pharmacyId);
    
    // Filter by status if provided
    let filteredOrders = orders;
    if (status) {
      filteredOrders = orders.filter(order => order.status === status);
    }
    
    // Apply pagination
    const paginatedOrders = filteredOrders.slice(offset, offset + limit);
    
    const formattedOrders = paginatedOrders.map(order => ({
      id: order.id,
      client: {
        name: `${order.client_first_name} ${order.client_last_name}`,
        phone: order.client_phone
      },
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
        pharmacy: {
          id: pharmacy.id,
          name: pharmacy.pharmacy_name
        },
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

// Update order status
router.put('/orders/:pharmacyId/:orderId/status', [
  body('status').isIn(['confirmed', 'processing', 'ready', 'delivered', 'cancelled']).withMessage('Valid status is required')
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

    const { pharmacyId, orderId } = req.params;
    const { status } = req.body;
    
    // Verify pharmacy belongs to pharmacist
    const pharmacies = await getPharmaciesByUserId(req.user.id);
    const pharmacy = pharmacies.find(p => p.id == pharmacyId);
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found'
      });
    }

    // Verify order belongs to pharmacy
    const orders = await getPharmacyOrders(pharmacyId);
    const order = orders.find(o => o.id == orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    await updateOrderStatus(orderId, status);

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        order_id: orderId,
        new_status: status,
        updated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status'
    });
  }
});

// Get pharmacist's pharmacy registrations
router.get('/registrations', authenticateToken, requirePharmacist, async (req, res) => {
  try {
    const { status } = req.query;
    let registrations = await getAllPharmacyRegistrations(status);
    
    // Filter to only show registrations belonging to this pharmacist
    registrations = registrations.filter(r => r.user_id === req.user.id);

    res.json({
      success: true,
      data: {
        registrations,
        count: registrations.length
      }
    });

  } catch (error) {
    console.error('Error getting pharmacy registrations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pharmacy registrations'
    });
  }
});

// Get specific pharmacy registration (Owner only)
router.get('/registrations/:registrationId', authenticateToken, requirePharmacist, async (req, res) => {
  try {
    const registration = await getPharmacyRegistrationById(req.params.registrationId);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy registration not found'
      });
    }

    // Check if registration belongs to this pharmacist
    if (registration.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get inventory items
    const inventory = await getPharmacyRegistrationInventory(req.params.registrationId);

    res.json({
      success: true,
      data: {
        ...registration,
        inventory
      }
    });

  } catch (error) {
    console.error('Error getting pharmacy registration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pharmacy registration'
    });
  }
});

// Get pharmacy dashboard stats
router.get('/dashboard/:pharmacyId', async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    
    // Verify pharmacy belongs to pharmacist
    const pharmacies = await getPharmaciesByUserId(req.user.id);
    const pharmacy = pharmacies.find(p => p.id == pharmacyId);
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy not found'
      });
    }

    // Get inventory stats
    const inventory = await getPharmacyInventory(pharmacyId);
    const totalItems = inventory.length;
    const totalValue = calculateInventoryValue(inventory);
    const lowStockItems = getLowStockItems(inventory);
    const expiringItems = inventory.filter(item => isExpiringSoon(item.expiry_date));

    // Get order stats
    const orders = await getPharmacyOrders(pharmacyId);
    const pendingOrders = orders.filter(o => o.status === 'pending');
    const processingOrders = orders.filter(o => o.status === 'processing');
    const readyOrders = orders.filter(o => o.status === 'ready');
    const totalRevenue = orders
      .filter(o => o.payment_status === 'paid')
      .reduce((sum, o) => sum + o.total_amount, 0);

    res.json({
      success: true,
      data: {
        pharmacy: {
          id: pharmacy.id,
          name: pharmacy.pharmacy_name,
          address: pharmacy.address,
          city: pharmacy.city,
          state: pharmacy.state
        },
        inventory: {
          total_items: totalItems,
          total_value: totalValue,
          formatted_total_value: formatPrice(totalValue),
          low_stock_count: lowStockItems.length,
          expiring_count: expiringItems.length
        },
        orders: {
          total: orders.length,
          pending: pendingOrders.length,
          processing: processingOrders.length,
          ready: readyOrders.length,
          total_revenue: totalRevenue,
          formatted_total_revenue: formatPrice(totalRevenue)
        }
      }
    });

  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard stats'
    });
  }
});

module.exports = router; 