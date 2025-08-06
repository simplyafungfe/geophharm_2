const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../utils/auth');
const { 
  getOrderById,
  updateOrderStatus
} = require('../utils/database');

// Get order details (authenticated users)
router.get('/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await getOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    // Check if user has access to this order
    const isClient = req.user.role === 'client' && order.client_id === req.user.id;
    const isPharmacist = req.user.role === 'pharmacist';
    const isAdmin = req.user.role === 'admin';
    
    if (!isClient && !isPharmacist && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
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

// Update order status (authenticated users with appropriate permissions)
router.put('/:orderId/status', [
  body('status').isIn(['pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled']).withMessage('Valid status is required')
], authenticateToken, async (req, res) => {
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
    const order = await getOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check permissions
    const isClient = req.user.role === 'client' && order.client_id === req.user.id;
    const isPharmacist = req.user.role === 'pharmacist';
    const isAdmin = req.user.role === 'admin';
    
    if (!isClient && !isPharmacist && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Clients can only cancel orders
    if (req.user.role === 'client' && status !== 'cancelled') {
      return res.status(403).json({
        success: false,
        error: 'Clients can only cancel orders'
      });
    }

    // Check if order can be updated
    if (order.status === 'delivered' || order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Order cannot be updated at this stage'
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

// Get order tracking information
router.get('/:orderId/tracking', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await getOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    // Check if user has access to this order
    const isClient = req.user.role === 'client' && order.client_id === req.user.id;
    const isPharmacist = req.user.role === 'pharmacist';
    const isAdmin = req.user.role === 'admin';
    
    if (!isClient && !isPharmacist && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Define order status flow
    const statusFlow = [
      { status: 'pending', description: 'Order received', completed: true },
      { status: 'confirmed', description: 'Order confirmed by pharmacy', completed: order.status !== 'pending' },
      { status: 'processing', description: 'Order being prepared', completed: ['processing', 'ready', 'delivered'].includes(order.status) },
      { status: 'ready', description: 'Order ready for delivery', completed: ['ready', 'delivered'].includes(order.status) },
      { status: 'delivered', description: 'Order delivered', completed: order.status === 'delivered' }
    ];

    // If cancelled, show cancellation
    if (order.status === 'cancelled') {
      statusFlow.push({ status: 'cancelled', description: 'Order cancelled', completed: true });
    }

    const trackingInfo = {
      order_id: order.id,
      current_status: order.status,
      status_flow: statusFlow,
      estimated_delivery: getEstimatedDelivery(order.status),
      last_updated: order.updated_at,
      pharmacy: {
        name: order.pharmacy_name,
        phone: order.pharmacy_phone
      },
      delivery_address: order.delivery_address,
      delivery_notes: order.delivery_notes
    };

    res.json({
      success: true,
      data: trackingInfo
    });

  } catch (error) {
    console.error('Get order tracking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get order tracking'
    });
  }
});

// Helper function to get estimated delivery time
function getEstimatedDelivery(status) {
  const estimates = {
    'pending': '45-60 minutes',
    'confirmed': '30-45 minutes',
    'processing': '15-30 minutes',
    'ready': '10-20 minutes',
    'delivered': 'Delivered',
    'cancelled': 'N/A'
  };
  
  return estimates[status] || '45-60 minutes';
}

module.exports = router; 