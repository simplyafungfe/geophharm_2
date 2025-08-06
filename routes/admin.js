const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin } = require('../utils/auth');
const { 
  getAllOrders, 
  getPlatformStats,
  getUserById,
  updateUser,
  getAllPharmacyRegistrations,
  getPharmacyRegistrationById,
  getPharmacyRegistrationInventory,
  approvePharmacyRegistration,
  updatePharmacyRegistrationStatus
} = require('../utils/database');

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// Get admin dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const stats = await getPlatformStats();
    
    res.json({
      success: true,
      data: {
        platform_stats: {
          total_clients: stats.totalClients,
          total_pharmacists: stats.totalPharmacists,
          total_pharmacies: stats.totalPharmacies,
          total_orders: stats.totalOrders,
          total_revenue: stats.totalRevenue,
          formatted_total_revenue: new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN'
          }).format(stats.totalRevenue)
        },
        recent_activity: {
          last_updated: new Date().toISOString()
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

// Get all orders (admin view)
router.get('/orders', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    const orders = await getAllOrders();
    
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
        name: `${order.client_first_name} ${order.client_last_name}`
      },
      pharmacy: {
        name: order.pharmacy_name
      },
      total_amount: order.total_amount,
      formatted_amount: new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN'
      }).format(order.total_amount),
      status: order.status,
      payment_status: order.payment_status,
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
    console.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get orders'
    });
  }
});

// Get order details (admin view)
router.get('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const { getOrderById } = require('../utils/database');
    const order = await getOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    const formattedOrder = {
      id: order.id,
      client: {
        id: order.client_id,
        name: `${order.client_first_name} ${order.client_last_name}`,
        phone: order.client_phone
      },
      pharmacy: {
        id: order.pharmacy_id,
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
        formatted_unit_price: new Intl.NumberFormat('en-NG', {
          style: 'currency',
          currency: 'NGN'
        }).format(item.unit_price),
        total_price: item.total_price,
        formatted_total_price: new Intl.NumberFormat('en-NG', {
          style: 'currency',
          currency: 'NGN'
        }).format(item.total_price)
      })),
      total_amount: order.total_amount,
      formatted_total_amount: new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN'
      }).format(order.total_amount),
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

// Update order status (admin)
router.put('/orders/:orderId/status', [
  body('status').isIn(['pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled']).withMessage('Valid status is required')
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

    const { orderId } = req.params;
    const { status } = req.body;
    
    // Verify order exists
    const { getOrderById, updateOrderStatus } = require('../utils/database');
    const order = await getOrderById(orderId);
    
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

// Get user details (admin)
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const { password, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      data: userWithoutPassword
    });

  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user details'
    });
  }
});

// Update user status (admin)
router.put('/users/:userId/status', [
  body('is_active').isBoolean().withMessage('Valid active status is required')
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

    const { userId } = req.params;
    const { is_active } = req.body;
    
    // Verify user exists
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prevent admin from deactivating themselves
    if (userId == req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot deactivate your own account'
      });
    }

    await updateUser(userId, { is_active });

    res.json({
      success: true,
      message: 'User status updated successfully',
      data: {
        user_id: userId,
        is_active: is_active,
        updated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user status'
    });
  }
});

// Get system health
router.get('/system/health', (req, res) => {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      environment: process.env.NODE_ENV,
      version: '1.0.0'
    };
    
    res.json({
      success: true,
      data: healthData
    });

  } catch (error) {
    console.error('System health error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system health'
    });
  }
});

// Get platform analytics
router.get('/analytics', async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    
    const stats = await getPlatformStats();
    
    // Calculate growth metrics (placeholder - would need historical data)
    const analytics = {
      period_days: parseInt(period),
      user_growth: {
        total_clients: stats.totalClients,
        total_pharmacists: stats.totalPharmacists,
        growth_rate: '15%' // Placeholder
      },
      order_analytics: {
        total_orders: stats.totalOrders,
        average_order_value: stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0,
        formatted_average_order_value: new Intl.NumberFormat('en-NG', {
          style: 'currency',
          currency: 'NGN'
        }).format(stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0)
      },
      revenue_analytics: {
        total_revenue: stats.totalRevenue,
        formatted_total_revenue: new Intl.NumberFormat('en-NG', {
          style: 'currency',
          currency: 'NGN'
        }).format(stats.totalRevenue),
        monthly_growth: '12%' // Placeholder
      },
      pharmacy_analytics: {
        total_pharmacies: stats.totalPharmacies,
        active_pharmacies: stats.totalPharmacies,
        verification_rate: '85%' // Placeholder
      }
    };
    
    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics'
    });
  }
});

// Get pharmacy registrations (Admin only)
router.get('/pharmacy-registrations', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const registrations = await getAllPharmacyRegistrations(status);

    // Get additional stats
    const pendingCount = registrations.filter(r => r.registration_status === 'pending').length;
    const approvedCount = registrations.filter(r => r.registration_status === 'approved').length;
    const rejectedCount = registrations.filter(r => r.registration_status === 'rejected').length;

    res.json({
      success: true,
      data: {
        registrations,
        stats: {
          total: registrations.length,
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount
        }
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

// Get specific pharmacy registration (Admin only)
router.get('/pharmacy-registrations/:registrationId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const registration = await getPharmacyRegistrationById(req.params.registrationId);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy registration not found'
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

// Approve pharmacy registration (Admin only)
router.put('/pharmacy-registrations/:registrationId/approve', authenticateToken, requireAdmin, [
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

    const registrationId = req.params.registrationId;
    const { admin_notes } = req.body;

    // Check if registration exists
    const registration = await getPharmacyRegistrationById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy registration not found'
      });
    }

    if (registration.registration_status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Registration is not pending approval'
      });
    }

    // Approve the registration
    const result = await approvePharmacyRegistration(registrationId);
    
    res.json({
      success: true,
      message: 'Pharmacy registration approved successfully',
      data: {
        pharmacy_id: result.pharmacyId,
        inventory_count: result.inventoryCount,
        registration_id: registrationId
      }
    });

  } catch (error) {
    console.error('Error approving pharmacy registration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve pharmacy registration'
    });
  }
});

// Reject pharmacy registration (Admin only)
router.put('/pharmacy-registrations/:registrationId/reject', authenticateToken, requireAdmin, [
  body('admin_notes').trim().isLength({ min: 1, max: 500 }).withMessage('Admin notes are required and must be less than 500 characters')
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

    const registrationId = req.params.registrationId;
    const { admin_notes } = req.body;

    // Check if registration exists
    const registration = await getPharmacyRegistrationById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Pharmacy registration not found'
      });
    }

    if (registration.registration_status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Registration is not pending approval'
      });
    }

    // Reject the registration
    await updatePharmacyRegistrationStatus(registrationId, 'rejected', admin_notes);
    
    res.json({
      success: true,
      message: 'Pharmacy registration rejected',
      data: {
        registration_id: registrationId,
        status: 'rejected',
        admin_notes
      }
    });

  } catch (error) {
    console.error('Error rejecting pharmacy registration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject pharmacy registration'
    });
  }
});

module.exports = router; 