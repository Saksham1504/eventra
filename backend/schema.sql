-- EVENTRA schema (MySQL 8.0+), exactly as created for the project
CREATE DATABASE IF NOT EXISTS eventra CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE eventra;

CREATE TABLE colleges (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id CHAR(36) PRIMARY KEY,
    google_uid VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    avatar_url TEXT,
    role ENUM('STUDENT', 'ORGANIZER', 'ADMIN') DEFAULT 'STUDENT',
    college_id CHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL
);

CREATE TABLE organizer_profiles (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL UNIQUE,
    club_name VARCHAR(200) NOT NULL,
    description TEXT,
    verification_status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE events (
    id CHAR(36) PRIMARY KEY,
    organizer_id CHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    banner_url TEXT,
    venue VARCHAR(255) NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    registration_deadline DATETIME,
    status ENUM('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED') DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE RESTRICT,
    CHECK (end_time > start_time)
);

CREATE TABLE ticket_types (
    id CHAR(36) PRIMARY KEY,
    event_id CHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    capacity INT NOT NULL,
    sold_count INT DEFAULT 0,
    reserved_count INT DEFAULT 0,
    base_price DECIMAL(10,2) NOT NULL,
    current_price DECIMAL(10,2) NOT NULL,
    increment_percent DECIMAL(5,2) DEFAULT 25.00,
    capacity_step_percent DECIMAL(5,2) DEFAULT 20.00,
    currency VARCHAR(10) DEFAULT 'INR',
    sales_start DATETIME,
    sales_end DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT,
    UNIQUE (event_id, name),
    CHECK (capacity > 0),
    CHECK (sold_count >= 0),
    CHECK (reserved_count >= 0),
    CHECK (sold_count + reserved_count <= capacity),
    CHECK (base_price >= 0),
    CHECK (current_price >= 0)
);

CREATE TABLE pricing_tiers (
    id CHAR(36) PRIMARY KEY,
    ticket_type_id CHAR(36) NOT NULL,
    tier_number INT NOT NULL,
    min_sold_percent DECIMAL(5,2) NOT NULL,
    price_multiplier DECIMAL(10,4) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT,
    UNIQUE (ticket_type_id, tier_number)
);

CREATE TABLE price_history (
    id CHAR(36) PRIMARY KEY,
    ticket_type_id CHAR(36) NOT NULL,
    old_price DECIMAL(10,2) NOT NULL,
    new_price DECIMAL(10,2) NOT NULL,
    sold_count INT NOT NULL,
    tier_number INT NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT
);

CREATE TABLE bookings (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    ticket_type_id CHAR(36) NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    status ENUM('PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED', 'CANCELLED') DEFAULT 'PENDING',
    idempotency_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT,
    UNIQUE (user_id, idempotency_key),
    CHECK (quantity > 0),
    CHECK (unit_price >= 0),
    CHECK (total_amount >= 0)
);

CREATE TABLE tickets (
    id CHAR(36) PRIMARY KEY,
    booking_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    ticket_type_id CHAR(36) NOT NULL,
    qr_token_hash CHAR(64) NOT NULL UNIQUE,
    status ENUM('ACTIVE', 'USED', 'CANCELLED', 'REFUNDED') DEFAULT 'ACTIVE',
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT
);

CREATE TABLE payments (
    id CHAR(36) PRIMARY KEY,
    booking_id CHAR(36) NOT NULL,
    provider VARCHAR(100),
    provider_payment_id VARCHAR(255) UNIQUE,
    amount DECIMAL(12,2) NOT NULL,
    status ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
    CHECK (amount >= 0)
);

CREATE TABLE check_ins (
    id CHAR(36) PRIMARY KEY,
    ticket_id CHAR(36) NOT NULL UNIQUE,
    event_id CHAR(36) NOT NULL,
    verified_by CHAR(36),
    gate_name VARCHAR(100),
    checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE RESTRICT,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT,
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE notifications (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_organizer ON events(organizer_id);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_ticket_type ON bookings(ticket_type_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_tickets_user ON tickets(user_id);
CREATE INDEX idx_tickets_booking ON tickets(booking_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_pricing_ticket_type ON pricing_tiers(ticket_type_id);
