-- Geopharm Database Schema
-- Database: geopharm_bamenda

-- Create database (run this separately if needed)
-- CREATE DATABASE geopharm_bamenda;
-- USE geopharm_bamenda;

-- =============================================
-- PHARMACIES TABLE
-- =============================================
CREATE TABLE pharmacies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name TEXT NOT NULL,
    owner_name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    gps_lat FLOAT(10, 6) NOT NULL,
    gps_long FLOAT(10, 6) NOT NULL,
    status ENUM('pending', 'approved', 'suspended') DEFAULT 'pending',
    password_hash TEXT NOT NULL,
    created_by_admin BOOLEAN DEFAULT FALSE,
    license_url TEXT,
    rating FLOAT(2, 1) DEFAULT 0.0,
    operating_hours JSON, -- Store operating hours as JSON
    services JSON, -- Store services array as JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_location (gps_lat, gps_long),
    INDEX idx_status (status),
    INDEX idx_rating (rating)
);

-- =============================================
-- DRUGS TABLE
-- =============================================
CREATE TABLE drugs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pharmacy_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    category VARCHAR(100),
    description TEXT,
    manufacturer VARCHAR(255),
    price DECIMAL(10, 2) NOT NULL,
    price_per_card DECIMAL(10, 2),
    qty_per_carton INT,
    price_per_carton DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'XAF',
    stock INT NOT NULL DEFAULT 0,
    expiry_date DATE,
    added_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE,
    INDEX idx_pharmacy_drug (pharmacy_id, name),
    INDEX idx_drug_name (name),
    INDEX idx_category (category),
    INDEX idx_stock (stock),
    INDEX idx_expiry (expiry_date)
);

-- =============================================
-- USERS TABLE (End Users)
-- =============================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    name VARCHAR(255),
    gps_lat FLOAT(10, 6),
    gps_long FLOAT(10, 6),
    blood_group VARCHAR(5),
    allergies TEXT,
    medical_conditions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_search TIMESTAMP,
    
    INDEX idx_location (gps_lat, gps_long),
    INDEX idx_email (email)
);

-- =============================================
-- FLAGS TABLE (Reports)
-- =============================================
CREATE TABLE IF NOT EXISTS flags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    pharmacy_id INT NOT NULL,
    reason VARCHAR(100) NOT NULL,
    details TEXT,
    status ENUM('open', 'reviewed', 'closed') DEFAULT 'open',
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE,
    INDEX idx_flags_pharmacy (pharmacy_id),
    INDEX idx_flags_status (status),
    INDEX idx_flags_created (created_at)
);

-- Create admin_actions table for tracking admin activities
CREATE TABLE IF NOT EXISTS admin_actions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,
    pharmacy_id INT,
    admin_id INT,
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE,
    INDEX idx_admin_actions_type (action_type),
    INDEX idx_admin_actions_pharmacy (pharmacy_id),
    INDEX idx_admin_actions_created (created_at)
);

-- =============================================
-- ADMIN USERS TABLE
-- =============================================
CREATE TABLE admin_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role ENUM('super_admin', 'admin', 'moderator') DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    
    INDEX idx_username (username),
    INDEX idx_role (role)
);

-- =============================================
-- SEARCH LOGS TABLE (For Analytics)
-- =============================================
CREATE TABLE search_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    search_term VARCHAR(255) NOT NULL,
    user_lat FLOAT(10, 6),
    user_long FLOAT(10, 6),
    results_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_search_term (search_term),
    INDEX idx_location (user_lat, user_long),
    INDEX idx_created (created_at)
);

-- =============================================
-- PHARMACY RATINGS TABLE
-- =============================================
CREATE TABLE pharmacy_ratings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    pharmacy_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_pharmacy (user_id, pharmacy_id),
    INDEX idx_pharmacy_rating (pharmacy_id, rating),
    INDEX idx_created (created_at)
);

-- =============================================
-- SYSTEM SETTINGS TABLE
-- =============================================
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by INT,
    
    FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL
);

-- =============================================
-- INSERT DEFAULT DATA
-- =============================================

-- Insert default admin user (password: admin123 - change this!)
INSERT INTO admin_users (username, email, password_hash, full_name, role) VALUES 
('admin', 'admin@geopharm.cm', '$2b$10$rQZ8kqH5F5F5F5F5F5F5FuF5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5', 'System Administrator', 'super_admin');

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES 
('search_radius_km', '10', 'Default search radius in kilometers'),
('max_results_per_search', '50', 'Maximum number of results to return per search'),
('pharmacy_approval_required', 'true', 'Whether pharmacy registration requires admin approval'),
('enable_user_ratings', 'true', 'Allow users to rate pharmacies'),
('enable_drug_expiry_alerts', 'true', 'Send alerts for expiring drugs'),
('currency', 'XAF', 'Default currency for the platform'),
('platform_name', 'Geopharm Bamenda', 'Platform display name'),
('contact_email', 'info@geopharm.cm', 'Platform contact email'),
('contact_phone', '+237 123 456 789', 'Platform contact phone');

-- =============================================
-- VIEWS FOR COMMON QUERIES
-- =============================================

-- View for pharmacy search with drug availability
CREATE VIEW pharmacy_drug_view AS
SELECT 
    p.id as pharmacy_id,
    p.name as pharmacy_name,
    p.email,
    p.phone,
    p.address,
    p.gps_lat,
    p.gps_long,
    p.rating,
    p.status,
    d.id as drug_id,
    d.name as drug_name,
    d.category,
    d.price,
    d.currency,
    d.stock,
    d.expiry_date,
    CASE 
        WHEN d.stock = 0 THEN 'Out of Stock'
        WHEN d.stock < 20 THEN CONCAT('Low Stock (', d.stock, ' left)')
        ELSE 'In Stock'
    END as stock_status
FROM pharmacies p
LEFT JOIN drugs d ON p.id = d.pharmacy_id
WHERE p.status = 'approved';

-- View for pharmacy statistics
CREATE VIEW pharmacy_stats AS
SELECT 
    p.id,
    p.name,
    p.rating,
    COUNT(DISTINCT d.id) as total_drugs,
    COUNT(DISTINCT CASE WHEN d.stock > 0 THEN d.id END) as available_drugs,
    COUNT(DISTINCT CASE WHEN d.stock = 0 THEN d.id END) as out_of_stock_drugs,
    COUNT(DISTINCT r.id) as total_ratings,
    AVG(r.rating) as avg_rating,
    MAX(p.last_active) as last_active
FROM pharmacies p
LEFT JOIN drugs d ON p.id = d.pharmacy_id
LEFT JOIN pharmacy_ratings r ON p.id = r.pharmacy_id
WHERE p.status = 'approved'
GROUP BY p.id, p.name, p.rating;

-- =============================================
-- TRIGGERS
-- =============================================

-- Update pharmacy rating when new rating is added
DELIMITER //
CREATE TRIGGER update_pharmacy_rating 
AFTER INSERT ON pharmacy_ratings
FOR EACH ROW
BEGIN
    UPDATE pharmacies 
    SET rating = (
        SELECT AVG(rating) 
        FROM pharmacy_ratings 
        WHERE pharmacy_id = NEW.pharmacy_id
    )
    WHERE id = NEW.pharmacy_id;
END//

-- Update pharmacy rating when rating is updated
CREATE TRIGGER update_pharmacy_rating_on_update
AFTER UPDATE ON pharmacy_ratings
FOR EACH ROW
BEGIN
    UPDATE pharmacies 
    SET rating = (
        SELECT AVG(rating) 
        FROM pharmacy_ratings 
        WHERE pharmacy_id = NEW.pharmacy_id
    )
    WHERE id = NEW.pharmacy_id;
END//

-- Update pharmacy rating when rating is deleted
CREATE TRIGGER update_pharmacy_rating_on_delete
AFTER DELETE ON pharmacy_ratings
FOR EACH ROW
BEGIN
    UPDATE pharmacies 
    SET rating = COALESCE((
        SELECT AVG(rating) 
        FROM pharmacy_ratings 
        WHERE pharmacy_id = OLD.pharmacy_id
    ), 0.0)
    WHERE id = OLD.pharmacy_id;
END//

DELIMITER ;

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Composite indexes for common search patterns
CREATE INDEX idx_drug_search ON drugs (name, category, stock);
CREATE INDEX idx_pharmacy_location_status ON pharmacies (status, gps_lat, gps_long);
CREATE INDEX idx_search_logs_analytics ON search_logs (created_at, search_term, results_count);

-- =============================================
-- FLAGS TABLE (Reports)
-- =============================================
CREATE TABLE flags (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    pharmacy_id INT NOT NULL,
    reason ENUM('closed', 'fake_drugs', 'overpricing', 'poor_service', 'other') NOT NULL,
    details TEXT,
    user_email VARCHAR(255),
    status ENUM('open', 'reviewed', 'closed') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL,
    admin_notes TEXT,
    
    FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE,
    INDEX idx_pharmacy_reports (pharmacy_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- =============================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================

-- Note: This will be populated by the migration script with real data
-- from the existing pharmacies.json file
