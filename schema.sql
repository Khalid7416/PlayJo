-- =====================================================================
-- PlayJo – PostgreSQL schema
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;  -- for the no-overlap booking constraint

-- ---------- Roles ----------
CREATE TABLE roles (
    id          SMALLSERIAL PRIMARY KEY,
    name        VARCHAR(30) UNIQUE NOT NULL   -- customer | facility_owner | super_admin
);

-- ---------- Users ----------
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    role_id         SMALLINT NOT NULL REFERENCES roles(id),
    full_name       VARCHAR(120) NOT NULL,
    email           VARCHAR(190) UNIQUE NOT NULL,
    phone           VARCHAR(20)  UNIQUE NOT NULL,          -- E.164, e.g. +962791234567
    password_hash   TEXT NOT NULL,
    phone_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    status          VARCHAR(15) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','suspended','deleted')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at   TIMESTAMPTZ
);
CREATE INDEX idx_users_role ON users(role_id);

-- ---------- OTP logs ----------
CREATE TABLE otp_verifications (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT REFERENCES users(id) ON DELETE CASCADE,
    phone         VARCHAR(20) NOT NULL,
    code_hash     TEXT NOT NULL,                  -- never store the raw code
    purpose       VARCHAR(20) NOT NULL DEFAULT 'register'
                  CHECK (purpose IN ('register','login','reset_password','change_phone')),
    attempts      SMALLINT NOT NULL DEFAULT 0,
    max_attempts  SMALLINT NOT NULL DEFAULT 5,
    expires_at    TIMESTAMPTZ NOT NULL,
    verified_at   TIMESTAMPTZ,
    ip_address    INET,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_phone_created ON otp_verifications(phone, created_at DESC);

-- ---------- Facilities ----------
CREATE TABLE facilities (
    id             BIGSERIAL PRIMARY KEY,
    owner_id       BIGINT NOT NULL REFERENCES users(id),
    name           VARCHAR(150) NOT NULL,
    description    TEXT,
    city           VARCHAR(80) NOT NULL,
    address        VARCHAR(255),
    latitude       NUMERIC(9,6),
    longitude      NUMERIC(9,6),
    phone          VARCHAR(20),
    opens_at       TIME NOT NULL DEFAULT '08:00',
    closes_at      TIME NOT NULL DEFAULT '24:00',
    approval_status VARCHAR(15) NOT NULL DEFAULT 'pending'
                   CHECK (approval_status IN ('pending','approved','rejected','removed')),
    approved_by    BIGINT REFERENCES users(id),
    approved_at    TIMESTAMPTZ,
    rating_avg     NUMERIC(2,1) DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_facilities_owner ON facilities(owner_id);
CREATE INDEX idx_facilities_status ON facilities(approval_status);

CREATE TABLE facility_images (
    id           BIGSERIAL PRIMARY KEY,
    facility_id  BIGINT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    url          TEXT NOT NULL,
    is_cover     BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order   SMALLINT NOT NULL DEFAULT 0
);

-- ---------- Courts / pitches within a facility ----------
CREATE TABLE courts (
    id              BIGSERIAL PRIMARY KEY,
    facility_id     BIGINT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,                -- "Court 1", "Pitch A"
    sport           VARCHAR(30) NOT NULL
                    CHECK (sport IN ('padel','football','basketball','golf','tennis','volleyball','other')),
    price_per_hour  NUMERIC(8,2) NOT NULL CHECK (price_per_hour >= 0),
    capacity        SMALLINT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_courts_facility ON courts(facility_id);
CREATE INDEX idx_courts_sport ON courts(sport);

-- Weekly availability schedule (owner-managed)
CREATE TABLE availability_schedules (
    id          BIGSERIAL PRIMARY KEY,
    court_id    BIGINT NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
    weekday     SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0 = Sunday
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    CHECK (end_time > start_time)
);

-- ---------- Promotions ----------
CREATE TABLE promotions (
    id               BIGSERIAL PRIMARY KEY,
    facility_id      BIGINT REFERENCES facilities(id) ON DELETE CASCADE, -- NULL = platform-wide
    created_by       BIGINT NOT NULL REFERENCES users(id),
    title            VARCHAR(150) NOT NULL,
    description      TEXT,
    code             VARCHAR(30) UNIQUE,
    discount_type    VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent','fixed')),
    discount_value   NUMERIC(8,2) NOT NULL CHECK (discount_value > 0),
    min_booking_amount NUMERIC(8,2) DEFAULT 0,
    max_redemptions  INTEGER,
    redemptions_used INTEGER NOT NULL DEFAULT 0,
    valid_from       DATE NOT NULL,
    valid_until      DATE NOT NULL,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (valid_until >= valid_from)
);
CREATE INDEX idx_promotions_facility ON promotions(facility_id);

-- ---------- Bookings ----------
CREATE TABLE bookings (
    id              BIGSERIAL PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES users(id),
    court_id        BIGINT NOT NULL REFERENCES courts(id),
    facility_id     BIGINT NOT NULL REFERENCES facilities(id),
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    status          VARCHAR(15) NOT NULL DEFAULT 'confirmed'
                    CHECK (status IN ('pending','confirmed','cancelled','completed','no_show')),
    subtotal        NUMERIC(8,2) NOT NULL,
    promotion_id    BIGINT REFERENCES promotions(id),
    discount_amount NUMERIC(8,2) NOT NULL DEFAULT 0,
    points_redeemed INTEGER NOT NULL DEFAULT 0,
    total_paid      NUMERIC(8,2) NOT NULL,
    payment_method  VARCHAR(10) NOT NULL DEFAULT 'cash'
                    CHECK (payment_method IN ('cash','cliq','card','wallet','points')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at),
    -- Prevent double-booking the same court
    EXCLUDE USING gist (
        court_id WITH =,
        tstzrange(starts_at, ends_at) WITH &&
    ) WHERE (status IN ('pending','confirmed','completed'))
);
CREATE INDEX idx_bookings_customer ON bookings(customer_id, starts_at DESC);
CREATE INDEX idx_bookings_facility ON bookings(facility_id, starts_at DESC);

-- ---------- Payments (one row per payment attempt for a booking) ----------
CREATE TABLE payments (
    id            BIGSERIAL PRIMARY KEY,
    booking_id    BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    method        VARCHAR(10) NOT NULL CHECK (method IN ('cash','cliq','card','wallet','points')),
    status        VARCHAR(15) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','paid','pay_at_venue','failed','refunded')),
    amount        NUMERIC(8,2) NOT NULL CHECK (amount >= 0),
    provider_ref  VARCHAR(100),          -- gateway / CliQ / wallet reference
    card_last4    CHAR(4),               -- never store full card numbers or CVC
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_booking ON payments(booking_id);

-- ---------- Loyalty ----------
CREATE TABLE loyalty_accounts (
    user_id          BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    points_balance   INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
    lifetime_points  INTEGER NOT NULL DEFAULT 0,
    tier             VARCHAR(10) NOT NULL DEFAULT 'bronze'
                     CHECK (tier IN ('bronze','silver','gold'))
);

CREATE TABLE loyalty_transactions (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    booking_id   BIGINT REFERENCES bookings(id),
    type         VARCHAR(10) NOT NULL CHECK (type IN ('earn','redeem','bonus','expire','adjust')),
    points       INTEGER NOT NULL,                 -- positive for earn, negative for redeem
    multiplier   NUMERIC(3,2) NOT NULL DEFAULT 1.00,
    note         VARCHAR(200),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_loyalty_tx_user ON loyalty_transactions(user_id, created_at DESC);

-- Discounts a user has claimed/unlocked
CREATE TABLE user_promotions (
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    promotion_id  BIGINT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    claimed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    used_at       TIMESTAMPTZ,
    PRIMARY KEY (user_id, promotion_id)
);

-- =====================================================================
-- SEED DATA  (password hashes are placeholders – replace with bcrypt)
-- =====================================================================
INSERT INTO roles (name) VALUES ('customer'), ('facility_owner'), ('super_admin');

INSERT INTO users (role_id, full_name, email, phone, password_hash, phone_verified) VALUES
 (3, 'PlayJo Admin',  'admin@playjo.example.com',  '+962799000000', '$2b$12$PLACEHOLDER', TRUE),
 (2, 'Layla Nasser',  'owner@trax.example.com',    '+962781112233', '$2b$12$PLACEHOLDER', TRUE),
 (2, 'Khaled Mansour','owner@padelarena.example.com','+962777445566','$2b$12$PLACEHOLDER', TRUE),
 (2, 'Rana Tarawneh', 'owner@aylagolf.example.com','+962788223344', '$2b$12$PLACEHOLDER', TRUE),
 (1, 'Omar Haddad',   'omar@example.com',          '+962791234567', '$2b$12$PLACEHOLDER', TRUE);

INSERT INTO facilities (owner_id, name, description, city, address, latitude, longitude, approval_status, rating_avg) VALUES
 (2, 'Trax Amman',   'Multi-sport complex with football pitches and padel courts.', 'Amman', 'Abdoun, Amman',        31.9454, 35.9020, 'approved', 4.7),
 (3, 'Padel Arena',  'Premium indoor and outdoor padel courts.',                    'Amman', 'Deir Ghbar, Amman',    31.9552, 35.8780, 'approved', 4.6),
 (4, 'Ayla Golf Club','18-hole championship golf course on the Red Sea.',           'Aqaba', 'Ayla Oasis, Aqaba',    29.5430, 35.0070, 'approved', 4.9),
 (3, 'Hoops Zone',   'Indoor basketball courts, pending approval.',                 'Zarqa', 'Zarqa, Jordan',        32.0728, 36.0880, 'pending',  0);

INSERT INTO facilities (owner_id, name, description, city, address, latitude, longitude, approval_status, rating_avg) VALUES
 (2, 'Sports City Amman',  'Indoor and outdoor multi-sport venue.',           'Amman',  'Shmeisani, Amman',            31.9680, 35.9050, 'approved', 4.5),
 (4, 'Aqaba Beach Padel',  'Three sea-view padel courts.',                    'Aqaba',  'South Beach, Aqaba',          29.4780, 35.0000, 'approved', 4.8),
 (3, 'Irbid Arena',        'Turf football pitches and a volleyball court.',   'Irbid',  'University Street, Irbid',    32.5556, 35.8500, 'approved', 4.3),
 (2, 'Amman Tennis Club',  'Clay and hard tennis courts.',                    'Amman',  'Jabal Amman, Amman',          31.9530, 35.9250, 'approved', 4.6),
 (3, 'Madaba Sports Hub',  'Football field, basketball and padel courts.',    'Madaba', 'City Center, Madaba',         31.7160, 35.7940, 'approved', 4.4);

INSERT INTO courts (facility_id, name, sport, price_per_hour, capacity) VALUES
 (1, 'Pitch A',  'football',   40.00, 14),
 (1, 'Padel 1',  'padel',      24.00, 4),
 (2, 'Court 1',  'padel',      28.00, 4),
 (2, 'Court 2',  'padel',      28.00, 4),
 (3, 'Main Course','golf',     85.00, 4),
 (4, 'Court A',  'basketball', 30.00, 10);

INSERT INTO courts (facility_id, name, sport, price_per_hour, capacity) VALUES
 (1, 'Pitch B (7-a-side)',        'football',   40.00, 14),   -- 7
 (1, 'Pitch C (11-a-side)',       'football',   55.00, 22),   -- 8
 (1, 'Padel 2',                   'padel',      24.00, 4),    -- 9
 (2, 'Court 3 (Indoor)',          'padel',      34.00, 4),    -- 10
 (2, 'Court 4 (Panoramic)',       'padel',      32.00, 4),    -- 11
 (3, 'Driving Range',             'golf',       20.00, 4),    -- 12
 (4, 'Court B',                   'basketball', 30.00, 10),   -- 13
 (4, 'Half-court (3-on-3)',       'basketball', 18.00, 6),    -- 14
 (5, 'Pitch 1 (5-a-side)',        'football',   30.00, 10),   -- 15
 (5, 'Pitch 2 (5-a-side)',        'football',   30.00, 10),   -- 16
 (5, 'Basketball Hall',           'basketball', 35.00, 10),   -- 17
 (5, 'Volleyball Court',          'volleyball', 22.00, 12),   -- 18
 (6, 'Sea View 1',                'padel',      26.00, 4),    -- 19
 (6, 'Sea View 2',                'padel',      26.00, 4),    -- 20
 (6, 'Sunset Court',              'padel',      30.00, 4),    -- 21
 (7, 'Pitch A (7-a-side)',        'football',   28.00, 14),   -- 22
 (7, 'Pitch B (7-a-side)',        'football',   28.00, 14),   -- 23
 (7, 'Court 1',                   'volleyball', 18.00, 12),   -- 24
 (8, 'Clay 1',                    'tennis',     22.00, 4),    -- 25
 (8, 'Clay 2',                    'tennis',     22.00, 4),    -- 26
 (8, 'Hard Court',                'tennis',     20.00, 4),    -- 27
 (9, 'Main Field (11-a-side)',    'football',   45.00, 22),   -- 28
 (9, 'Basketball Court',          'basketball', 25.00, 10),   -- 29
 (9, 'Padel Court',               'padel',      22.00, 4);    -- 30

INSERT INTO promotions (facility_id, created_by, title, description, code, discount_type, discount_value, valid_from, valid_until) VALUES
 (2, 3, 'Weekday Padel 20% Off', 'Book Sunday–Thursday before 5 PM.',        'PADEL20',  'percent', 20, '2026-10-01', '2026-12-31'),
 (1, 2, 'Football Night: 5 JOD off', 'Evening slots after 9 PM.',            'TRAX5',    'fixed',    5, '2026-10-15', '2026-11-30'),
 (NULL, 1, 'Welcome to PlayJo',  'Platform-wide 10% off your first booking.', 'WELCOME10','percent', 10, '2026-01-01', '2026-12-31');

INSERT INTO loyalty_accounts (user_id, points_balance, lifetime_points, tier) VALUES (5, 1250, 2100, 'silver');
INSERT INTO user_promotions (user_id, promotion_id) VALUES (5, 3);

INSERT INTO bookings (customer_id, court_id, facility_id, starts_at, ends_at, status, subtotal, discount_amount, total_paid) VALUES
 (5, 3, 2, '2026-10-10 19:00+03', '2026-10-10 20:00+03', 'completed', 28.00, 0,    28.00),
 (5, 1, 1, '2026-10-17 21:00+03', '2026-10-17 22:00+03', 'completed', 40.00, 5.00, 35.00),
 (5, 3, 2, '2026-10-28 18:00+03', '2026-10-28 19:00+03', 'confirmed', 28.00, 5.60, 22.40);

INSERT INTO payments (booking_id, method, status, amount) VALUES
 (1, 'cash', 'paid',         28.00),
 (2, 'cliq', 'paid',         35.00),
 (3, 'cash', 'pay_at_venue', 22.40);

INSERT INTO loyalty_transactions (user_id, booking_id, type, points, multiplier, note) VALUES
 (5, 1, 'earn', 280, 1.00, 'Padel Arena booking'),
 (5, 2, 'earn', 438, 1.25, 'Repeat-booking multiplier x1.25'),
 (5, NULL, 'bonus', 100, 1.00, 'Welcome bonus');
