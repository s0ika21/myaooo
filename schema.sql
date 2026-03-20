-- Orders table
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    product_name TEXT NOT NULL,
    price INTEGER NOT NULL,
    final_price INTEGER NOT NULL,
    promo_code TEXT,
    discount INTEGER DEFAULT 0,
    account_type TEXT,
    account_data TEXT,
    telegram_user_id TEXT,
    telegram_username TEXT,
    status TEXT DEFAULT 'awaiting_payment',
    wata_link_id TEXT,
    wata_payment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Promos table
CREATE TABLE promos (
    code TEXT PRIMARY KEY,
    discount_type TEXT NOT NULL,
    discount_value INTEGER NOT NULL,
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_orders_telegram_user ON orders(telegram_user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
