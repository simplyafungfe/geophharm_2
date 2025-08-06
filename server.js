const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Database connection
const { testConnection, initializeDatabase } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/client');
const pharmacistRoutes = require('./routes/pharmacist');
const adminRoutes = require('./routes/admin');
const pharmacyRoutes = require('./routes/pharmacy');
const drugsRoutes = require('./routes/drugs');
const ordersRoutes = require('./routes/orders');
const geolocationRoutes = require('./routes/geolocation');
const pharmacyRegistrationRoutes = require('./routes/pharmacy-registration');
const searchRoutes = require('./routes/search');
const reportsRoutes = require('./routes/reports');
const ratingsRoutes = require('./routes/ratings');
const adminPharmacyRoutes = require('./routes/admin-pharmacy');

const app = express();
const PORT = process.env.PORT || 3004;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000 / 60)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Middleware
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from public directory
app.use(express.static('public'));

// Serve data files
app.use('/data', express.static('data'));

// Serve JavaScript modules
app.use('/js', express.static('public/js'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/pharmacist', pharmacistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/drugs', drugsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/geolocation', geolocationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/admin', adminPharmacyRoutes);

// New database-driven API routes
const pharmacyDbRoutes = require('./routes/api/pharmacy-db');
app.use('/api/v2/pharmacy', pharmacyDbRoutes);

app.use('/api/pharmacy-registration', pharmacyRegistrationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    platform: 'Pharmacy Management System'
  });
});

// API Documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    message: 'Pharmacy Management Platform API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register new user',
        'POST /api/auth/login': 'User login',
        'POST /api/auth/logout': 'User logout'
      },
      client: {
        'GET /api/client/profile': 'Get client profile',
        'PUT /api/client/profile': 'Update client profile',
        'GET /api/client/orders': 'Get client orders',
        'POST /api/client/orders': 'Create new order'
      },
      pharmacist: {
        'GET /api/pharmacist/profile': 'Get pharmacist profile',
        'GET /api/pharmacist/pharmacies': 'Get pharmacist pharmacies',
        'GET /api/pharmacist/inventory': 'Get pharmacy inventory',
        'POST /api/pharmacist/inventory': 'Add to inventory'
      },
      admin: {
        'GET /api/admin/dashboard': 'Get admin dashboard stats',
        'GET /api/admin/users': 'Get all users',
        'GET /api/admin/pharmacies': 'Get all pharmacies',
        'GET /api/admin/orders': 'Get all orders'
      },
      pharmacy: {
        'GET /api/pharmacy/nearby': 'Get nearby pharmacies',
        'GET /api/pharmacy/:id': 'Get pharmacy details'
      },
      drugs: {
        'GET /api/drugs': 'Get all drugs',
        'GET /api/drugs/search': 'Search drugs',
        'GET /api/drugs/available': 'Get available drugs in pharmacies'
      },
      orders: {
        'GET /api/orders/:id': 'Get order details',
        'PUT /api/orders/:id/status': 'Update order status'
      },
      geolocation: {
        'GET /api/geolocation/current': 'Get current location by IP',
        'GET /api/geolocation/geocode': 'Geocode address to coordinates',
        'GET /api/geolocation/reverse-geocode': 'Reverse geocode coordinates to address',
        'GET /api/geolocation/route': 'Calculate route between two points',
        'GET /api/geolocation/nearby-pharmacies': 'Get nearby pharmacies with map data',
        'GET /api/geolocation/delivery-zones/:id': 'Get delivery zones for pharmacy',
        'GET /api/geolocation/map-data': 'Get map data for pharmacies'
      }
    }
  });
});

// Serve the main application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Route for home page (both / and /home.html)
app.get('/home.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Route for registration page
app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Route for login page
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route for client dashboard
app.get('/client-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'client-dashboard.html'));
});

// Route for pharmacist dashboard
app.get('/pharmacist-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pharmacist-dashboard.html'));
});

// Route for admin dashboard
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The route ${req.originalUrl} does not exist`,
    availableRoutes: [
      '/api/health',
      '/api/docs',
      '/api/auth',
      '/api/client',
      '/api/pharmacist',
      '/api/admin',
      '/api/pharmacy',
      '/api/drugs',
      '/api/orders',
      '/api/geolocation'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!'
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    console.log('🔍 Testing database connection...');
    const isConnected = await testConnection();
    
    if (isConnected) {
      console.log('✅ Database connection successful');
      
      // Initialize database schema if needed
      console.log('📋 Initializing database schema...');
      await initializeDatabase();
      console.log('✅ Database schema ready');
    } else {
      console.warn('⚠️  Database connection failed - running without database features');
    }
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Pharmacy Management Platform server running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV}`);
      console.log(`🌐 API Documentation: http://localhost:${PORT}/api/docs`);
      console.log(`🎨 Web Interface: http://localhost:${PORT}`);
      console.log(`💊 Health Check: http://localhost:${PORT}/api/health`);
      if (isConnected) {
        console.log(`🗄️  Database API: http://localhost:${PORT}/api/v2/pharmacy`);
      }
    });
    
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app; 