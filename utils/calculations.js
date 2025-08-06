// Calculate distance between two points using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
};

// Calculate delivery fee based on distance
const calculateDeliveryFee = (distance) => {
  if (distance <= 2) {
    return 500; // ₦500 for distances up to 2km
  } else if (distance <= 5) {
    return 800; // ₦800 for distances up to 5km
  } else if (distance <= 10) {
    return 1200; // ₦1200 for distances up to 10km
  } else {
    return 1500; // ₦1500 for distances over 10km
  }
};

// Calculate estimated delivery time based on distance
const calculateDeliveryTime = (distance) => {
  if (distance <= 2) {
    return '15-30 minutes';
  } else if (distance <= 5) {
    return '30-45 minutes';
  } else if (distance <= 10) {
    return '45-60 minutes';
  } else {
    return '60-90 minutes';
  }
};

// Calculate total order amount including delivery fee
const calculateTotalAmount = (subtotal, deliveryFee = 0) => {
  return subtotal + deliveryFee;
};

// Validate coordinates
const isValidCoordinates = (lat, lng) => {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

// Format price to Nigerian Naira
const formatPrice = (amount) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN'
  }).format(amount);
};

// Calculate discount percentage
const calculateDiscount = (originalPrice, discountedPrice) => {
  return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
};

// Validate Nigerian phone number
const validateNigerianPhone = (phone) => {
  const phoneRegex = /^(\+234|0)[789][01]\d{8}$/;
  return phoneRegex.test(phone);
};

// Format Nigerian phone number
const formatNigerianPhone = (phone) => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If it starts with 0, replace with +234
  if (cleaned.startsWith('0')) {
    return '+234' + cleaned.substring(1);
  }
  
  // If it starts with 234, add +
  if (cleaned.startsWith('234')) {
    return '+' + cleaned;
  }
  
  // If it's already in international format
  if (cleaned.startsWith('234')) {
    return '+' + cleaned;
  }
  
  return phone; // Return as is if no pattern matches
};

// Calculate order summary
const calculateOrderSummary = (items) => {
  const subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  
  return {
    subtotal,
    totalItems,
    formattedSubtotal: formatPrice(subtotal)
  };
};

// Generate order number
const generateOrderNumber = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${timestamp.slice(-6)}-${random}`;
};

// Calculate average rating
const calculateAverageRating = (ratings) => {
  if (!ratings || ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, rating) => acc + rating, 0);
  return Math.round((sum / ratings.length) * 10) / 10; // Round to 1 decimal place
};

// Check if drug is expiring soon (within 30 days)
const isExpiringSoon = (expiryDate) => {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
};

// Calculate inventory value
const calculateInventoryValue = (inventory) => {
  return inventory.reduce((total, item) => {
    return total + (item.quantity * item.price);
  }, 0);
};

// Get low stock items (less than 10 units)
const getLowStockItems = (inventory) => {
  return inventory.filter(item => item.quantity < 10);
};

// Calculate profit margin
const calculateProfitMargin = (costPrice, sellingPrice) => {
  if (costPrice === 0) return 0;
  return Math.round(((sellingPrice - costPrice) / costPrice) * 100);
};

module.exports = {
  calculateDistance,
  calculateDeliveryFee,
  calculateDeliveryTime,
  calculateTotalAmount,
  isValidCoordinates,
  formatPrice,
  calculateDiscount,
  validateNigerianPhone,
  formatNigerianPhone,
  calculateOrderSummary,
  generateOrderNumber,
  calculateAverageRating,
  isExpiringSoon,
  calculateInventoryValue,
  getLowStockItems,
  calculateProfitMargin
}; 