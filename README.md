# Geopharm Bamenda - Pharmacy Management Platform

A comprehensive geolocation-based pharmacy management platform for Bamenda, Cameroon. Built with Node.js, Express.js, and MySQL, featuring real-time drug search, pharmacy inventory management, and geolocation services with a robust database-driven architecture.

## Features

### 🔐 Authentication & User Management
- **Multi-role system**: Client, Pharmacist, and Admin roles
- **JWT-based authentication** with secure password hashing
- **Profile management** for all user types
- **Role-based access control** with middleware protection

### 👥 Client Features
- **Drug search** with geolocation-based pharmacy discovery
- **Nearby pharmacy finder** with distance calculations
- **Order management** with real-time tracking
- **Order history** and status updates
- **Profile management** with location settings

### 💊 Pharmacist Features
- **Pharmacy management** with multiple pharmacy support
- **Inventory management** with stock tracking
- **Order processing** with status updates
- **Dashboard analytics** with sales and inventory stats
- **Low stock alerts** and expiry date tracking

### 👨‍💼 Admin Features
- **Platform oversight** with comprehensive analytics
- **User management** with account activation/deactivation
- **Order monitoring** across all pharmacies
- **System health monitoring**
- **Revenue tracking** and growth analytics

### 🏥 Bamenda Pharmacy Management
- **Geolocation-based search** using Haversine formula for Bamenda town
- **Drug availability** across 6 surveyed pharmacies in Bamenda
- **Price comparison** between local pharmacies
- **Delivery fee calculation** based on distance within Bamenda
- **Operating hours** and contact information for local pharmacies

### 📦 Order System
- **Multi-item orders** with quantity management
- **Order status tracking** (pending → confirmed → processing → ready → delivered)
- **Delivery address management** with coordinates
- **Payment status tracking**
- **Order cancellation** for clients

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite3 (can be easily migrated to PostgreSQL/MySQL)
- **Authentication**: JWT, bcryptjs
- **Validation**: express-validator
- **Security**: Helmet, CORS, Rate limiting
- **API Documentation**: Built-in endpoint documentation

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pharmacy-management-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp config.env.example config.env
   # Edit config.env with your configuration
   ```

4. **Initialize the database**
   ```bash
   npm run db:init
   ```

5. **Initialize Bamenda pharmacies (with survey data)**
   ```bash
   npm run bamenda:init
   ```

5. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## Environment Configuration

Create a `config.env` file with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d

# Database Configuration
DB_PATH=./data/bamenda_pharmacy.db

# Email Configuration (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/logout` - User logout

### Client Routes
- `GET /api/client/profile` - Get client profile
- `GET /api/client/search-drugs` - Search drugs in nearby pharmacies
- `GET /api/client/nearby-pharmacies` - Find nearby pharmacies
- `GET /api/client/orders` - Get client orders
- `GET /api/client/orders/:orderId` - Get order details
- `POST /api/client/orders` - Create new order
- `PUT /api/client/orders/:orderId/cancel` - Cancel order

### Pharmacist Routes
- `GET /api/pharmacist/profile` - Get pharmacist profile
- `GET /api/pharmacist/pharmacies` - Get pharmacist's pharmacies
- `POST /api/pharmacist/pharmacies` - Create new pharmacy
- `GET /api/pharmacist/inventory/:pharmacyId` - Get pharmacy inventory
- `POST /api/pharmacist/inventory/:pharmacyId` - Add to inventory
- `PUT /api/pharmacist/inventory/:pharmacyId/:itemId` - Update inventory
- `GET /api/pharmacist/orders/:pharmacyId` - Get pharmacy orders
- `PUT /api/pharmacist/orders/:pharmacyId/:orderId/status` - Update order status
- `GET /api/pharmacist/dashboard/:pharmacyId` - Get dashboard stats

### Admin Routes
- `GET /api/admin/dashboard` - Get admin dashboard stats
- `GET /api/admin/orders` - Get all orders
- `GET /api/admin/orders/:orderId` - Get order details
- `PUT /api/admin/orders/:orderId/status` - Update order status
- `GET /api/admin/users/:userId` - Get user details
- `PUT /api/admin/users/:userId/status` - Update user status
- `GET /api/admin/system/health` - Get system health
- `GET /api/admin/analytics` - Get platform analytics

### Public Routes
- `GET /api/pharmacy/nearby` - Get nearby pharmacies
- `GET /api/pharmacy/:pharmacyId` - Get pharmacy details
- `GET /api/drugs` - Get all drugs
- `GET /api/drugs/search` - Search drugs
- `GET /api/drugs/available` - Search drugs in pharmacies
- `GET /api/drugs/categories` - Get drug categories
- `GET /api/orders/:orderId` - Get order details (authenticated)
- `PUT /api/orders/:orderId/status` - Update order status (authenticated)
- `GET /api/orders/:orderId/tracking` - Get order tracking (authenticated)

## Database Schema

### Users Table
- `id` (Primary Key)
- `email` (Unique)
- `password` (Hashed)
- `role` (client/pharmacist/admin)
- `first_name`, `last_name`
- `phone`, `address`, `city`, `state`, `country`
- `latitude`, `longitude`
- `is_active`, `created_at`, `updated_at`

### Pharmacies Table
- `id` (Primary Key)
- `user_id` (Foreign Key to Users)
- `pharmacy_name`, `license_number`
- `description`, `address`, `city`, `state`, `country`
- `latitude`, `longitude`
- `phone`, `email`, `operating_hours`
- `is_verified`, `is_active`, `created_at`, `updated_at`

### Drugs Table
- `id` (Primary Key)
- `name`, `generic_name`
- `category_id` (Foreign Key to Drug Categories)
- `description`, `dosage_form`, `strength`
- `manufacturer`, `prescription_required`
- `created_at`

### Pharmacy Inventory Table
- `id` (Primary Key)
- `pharmacy_id` (Foreign Key to Pharmacies)
- `drug_id` (Foreign Key to Drugs)
- `quantity`, `price`
- `expiry_date`, `batch_number`
- `is_available`, `created_at`, `updated_at`

### Orders Table
- `id` (Primary Key)
- `client_id` (Foreign Key to Users)
- `pharmacy_id` (Foreign Key to Pharmacies)
- `total_amount`
- `status`, `payment_status`, `payment_method`
- `delivery_address`, `delivery_latitude`, `delivery_longitude`
- `delivery_notes`, `created_at`, `updated_at`

### Order Items Table
- `id` (Primary Key)
- `order_id` (Foreign Key to Orders)
- `drug_id` (Foreign Key to Drugs)
- `quantity`, `unit_price`, `total_price`
- `created_at`

## Bamenda Pharmacies

The platform includes 6 pharmacies from the Bamenda survey:

1. **Bamenda Central Pharmacy** - Commercial Avenue
2. **HealthPlus Bamenda** - Station Road  
3. **Bamenda Medical Store** - Hospital Road
4. **City Pharmacy Bamenda** - Main Street
5. **Bamenda Community Pharmacy** - Community Road
6. **Bamenda Express Pharmacy** - Express Road

## Default Admin Account

After running `npm run db:init`, a default admin account is created:

- **Email**: admin@bamenda-pharmacy.com
- **Password**: admin123

**⚠️ Important**: Change these credentials immediately after first login!

## Usage Examples

### Register a Client
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@example.com",
    "password": "password123",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+237 6XX XXX XXX",
    "role": "client",
    "address": "123 Main St",
    "city": "Bamenda",
    "state": "North West"
  }'
```

### Search for Drugs in Bamenda
```bash
curl "http://localhost:3000/api/client/search-drugs?drugName=paracetamol&lat=5.9597&lng=10.1460&radius=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Create a Pharmacy (Pharmacist)
```bash
curl -X POST http://localhost:3000/api/pharmacist/pharmacies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "pharmacy_name": "New Bamenda Pharmacy",
    "license_number": "PHARM-BAM-007",
    "address": "New Street, Bamenda",
    "city": "Bamenda",
    "state": "North West",
    "phone": "+237 6XX XXX XXX",
    "description": "Your trusted health partner in Bamenda"
  }'
```

## Security Features

- **JWT Authentication** with configurable expiration
- **Password Hashing** using bcryptjs
- **Rate Limiting** to prevent abuse
- **Input Validation** using express-validator
- **CORS Protection** for cross-origin requests
- **Helmet Security Headers** for additional protection
- **SQL Injection Prevention** using parameterized queries

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please contact the development team or create an issue in the repository.

## Roadmap

- [ ] Mobile app development (React Native)
- [ ] Payment gateway integration
- [ ] Push notifications
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Prescription upload and verification
- [ ] Delivery partner integration
- [ ] SMS notifications
- [ ] Advanced search filters
- [ ] Drug interaction warnings 