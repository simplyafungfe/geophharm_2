const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requirePharmacist, requireAdmin } = require('../utils/auth');
const {
  createPharmacyRegistration,
  getPharmacyRegistrationById,
  getAllPharmacyRegistrations,
  updatePharmacyRegistrationStatus,
  approvePharmacyRegistration,
  addPharmacyRegistrationInventory,
  getPharmacyRegistrationInventory,
  deletePharmacyRegistrationInventory
} = require('../utils/database');

const router = express.Router();

// Validation middleware
const validatePharmacyRegistration = [
  body('pharmacy_name').trim().isLength({ min: 2, max: 100 }).withMessage('Pharmacy name must be between 2 and 100 characters'),
  body('license_number').optional().trim().isLength({ min: 5, max: 50 }).withMessage('License number must be between 5 and 50 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('address').trim().isLength({ min: 5, max: 200 }).withMessage('Address must be between 5 and 200 characters'),
  body('city').trim().isLength({ min: 2, max: 50 }).withMessage('City must be between 2 and 50 characters'),
  body('state').trim().isLength({ min: 2, max: 50 }).withMessage('State must be between 2 and 50 characters'),
  body('country').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Country must be between 2 and 50 characters'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  body('phone').trim().isLength({ min: 10, max: 20 }).withMessage('Phone number must be between 10 and 20 characters'),
  body('email').optional().isEmail().withMessage('Email must be valid'),
  body('operating_hours').optional().trim().isLength({ max: 200 }).withMessage('Operating hours must be less than 200 characters')
];

const validateInventoryItem = [
  body('drug_name').trim().isLength({ min: 2, max: 100 }).withMessage('Drug name must be between 2 and 100 characters'),
  body('generic_name').optional().trim().isLength({ max: 100 }).withMessage('Generic name must be less than 100 characters'),
  body('category').optional().trim().isLength({ max: 50 }).withMessage('Category must be less than 50 characters'),
  body('dosage_form').optional().trim().isLength({ max: 50 }).withMessage('Dosage form must be less than 50 characters'),
  body('strength').optional().trim().isLength({ max: 50 }).withMessage('Strength must be less than 50 characters'),
  body('manufacturer').optional().trim().isLength({ max: 100 }).withMessage('Manufacturer must be less than 100 characters'),
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a positive integer'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('expiry_date').optional().isISO8601().withMessage('Expiry date must be a valid date'),
  body('batch_number').optional().trim().isLength({ max: 50 }).withMessage('Batch number must be less than 50 characters'),
  body('prescription_required').optional().isBoolean().withMessage('Prescription required must be a boolean')
];

// Create pharmacy registration (Pharmacist only)
router.post('/register', authenticateToken, requirePharmacist, validatePharmacyRegistration, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const registrationData = {
      user_id: req.user.id,
      pharmacy_name: req.body.pharmacy_name,
      license_number: req.body.license_number,
      description: req.body.description,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      country: req.body.country || 'Cameroon',
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      phone: req.body.phone,
      email: req.body.email,
      operating_hours: req.body.operating_hours
    };

    const registrationId = await createPharmacyRegistration(registrationData);

    res.status(201).json({
      success: true,
      message: 'Pharmacy registration submitted successfully. Waiting for admin approval.',
      data: {
        registration_id: registrationId,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Error creating pharmacy registration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create pharmacy registration'
    });
  }
});

// Get pharmacy registration by ID (Owner or Admin)
router.get('/:registrationId', authenticateToken, async (req, res) => {
  try {
    const registration = await getPharmacyRegistrationById(req.params.registrationId);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy registration not found'
      });
    }

    // Check if user can access this registration
    if (req.user.role !== 'admin' && registration.user_id !== req.user.id) {
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

// Get all pharmacy registrations (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const registrations = await getAllPharmacyRegistrations(status);

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

// Update registration status (Admin only)
router.put('/:registrationId/status', authenticateToken, requireAdmin, [
  body('status').isIn(['pending', 'approved', 'rejected']).withMessage('Status must be pending, approved, or rejected'),
  body('admin_notes').optional().trim().isLength({ max: 500 }).withMessage('Admin notes must be less than 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { status, admin_notes } = req.body;
    const registrationId = req.params.registrationId;

    // Check if registration exists
    const registration = await getPharmacyRegistrationById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy registration not found'
      });
    }

    if (status === 'approved') {
      // Approve the registration (creates pharmacy and moves inventory)
      const result = await approvePharmacyRegistration(registrationId);
      
      res.json({
        success: true,
        message: 'Pharmacy registration approved successfully',
        data: {
          pharmacy_id: result.pharmacyId,
          inventory_count: result.inventoryCount
        }
      });
    } else {
      // Update status to rejected or pending
      await updatePharmacyRegistrationStatus(registrationId, status, admin_notes);
      
      res.json({
        success: true,
        message: `Pharmacy registration ${status}`,
        data: {
          registration_id: registrationId,
          status
        }
      });
    }

  } catch (error) {
    console.error('Error updating pharmacy registration status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update pharmacy registration status'
    });
  }
});

// Add inventory item to registration (Owner only)
router.post('/:registrationId/inventory', authenticateToken, validateInventoryItem, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const registrationId = req.params.registrationId;

    // Check if registration exists and belongs to user
    const registration = await getPharmacyRegistrationById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy registration not found'
      });
    }

    if (registration.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (registration.registration_status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify inventory for non-pending registration'
      });
    }

    const inventoryData = {
      drug_name: req.body.drug_name,
      generic_name: req.body.generic_name,
      category: req.body.category,
      dosage_form: req.body.dosage_form,
      strength: req.body.strength,
      manufacturer: req.body.manufacturer,
      quantity: req.body.quantity,
      price: req.body.price,
      expiry_date: req.body.expiry_date,
      batch_number: req.body.batch_number,
      prescription_required: req.body.prescription_required || false
    };

    const inventoryId = await addPharmacyRegistrationInventory(registrationId, inventoryData);

    res.status(201).json({
      success: true,
      message: 'Inventory item added successfully',
      data: {
        inventory_id: inventoryId
      }
    });

  } catch (error) {
    console.error('Error adding inventory item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add inventory item'
    });
  }
});

// Get registration inventory (Owner or Admin)
router.get('/:registrationId/inventory', authenticateToken, async (req, res) => {
  try {
    const registrationId = req.params.registrationId;

    // Check if registration exists
    const registration = await getPharmacyRegistrationById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy registration not found'
      });
    }

    // Check if user can access this registration
    if (req.user.role !== 'admin' && registration.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const inventory = await getPharmacyRegistrationInventory(registrationId);

    res.json({
      success: true,
      data: {
        inventory,
        count: inventory.length
      }
    });

  } catch (error) {
    console.error('Error getting registration inventory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get registration inventory'
    });
  }
});

// Delete inventory item from registration (Owner only)
router.delete('/:registrationId/inventory/:inventoryId', authenticateToken, async (req, res) => {
  try {
    const { registrationId, inventoryId } = req.params;

    // Check if registration exists and belongs to user
    const registration = await getPharmacyRegistrationById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy registration not found'
      });
    }

    if (registration.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (registration.registration_status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify inventory for non-pending registration'
      });
    }

    const deleted = await deletePharmacyRegistrationInventory(registrationId, inventoryId);

    if (deleted === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inventory item not found'
      });
    }

    res.json({
      success: true,
      message: 'Inventory item deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting inventory item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete inventory item'
    });
  }
});

module.exports = router; 