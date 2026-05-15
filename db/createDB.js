const pool = require('../config/db');

const createTables = async () => {
    const client = await pool.connect();
    try {
        console.log('Starting database table creation...');

        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

        // Users & Authentication
        await client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    phone VARCHAR(20),
                    role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'vendor', 'admin')),
                    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
                    profile_image TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
                CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
            `);

        // Vendors
        await client.query(`
                CREATE TABLE IF NOT EXISTS vendors (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    store_name VARCHAR(255) UNIQUE NOT NULL,
                    slug VARCHAR(255) UNIQUE NOT NULL,
                    description TEXT,
                    logo TEXT,
                    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
                    rating DECIMAL(3,2) DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_vendors_user ON vendors(user_id);
                CREATE INDEX IF NOT EXISTS idx_vendors_slug ON vendors(slug);
            `);

        // Users Addresses
        await client.query(`
                CREATE TABLE IF NOT EXISTS user_addresses (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    full_name VARCHAR(255) NOT NULL,
                    phone VARCHAR(20) NOT NULL,
                    address_line1 TEXT NOT NULL,
                    address_line2 TEXT,
                    city VARCHAR(100) NOT NULL,
                    state VARCHAR(100) NOT NULL,
                    country VARCHAR(100) NOT NULL,
                    pincode VARCHAR(20) NOT NULL,
                    is_default BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

        // Categories
        await client.query(`
                CREATE TABLE IF NOT EXISTS categories (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    name VARCHAR(255) NOT NULL,
                    slug VARCHAR(255) UNIQUE NOT NULL,
                    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
                    image TEXT,
                    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
                CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
            `);

        // Brands
        await client.query(`
                CREATE TABLE IF NOT EXISTS brands (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    name VARCHAR(255) NOT NULL,
                    slug VARCHAR(255) UNIQUE NOT NULL,
                    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
                    logo TEXT,
                    description TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug);
            `);

        // Products
        await client.query(`
                CREATE TABLE IF NOT EXISTS products (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    name VARCHAR(255) NOT NULL,
                    slug VARCHAR(255) UNIQUE NOT NULL,
                    description TEXT,
                    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
                    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
                    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
                    price DECIMAL(12,2) NOT NULL DEFAULT 0,
                    discount DECIMAL(12,2) DEFAULT 0,
                    stock INTEGER DEFAULT 0,
                    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'out_of_stock')),
                    images JSONB DEFAULT '[]',
                    attributes JSONB DEFAULT '{}',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
                CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
                CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
                CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);
            `);

        // Product Variants (Size, Color, etc.)
        await client.query(`
                CREATE TABLE IF NOT EXISTS product_variants (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
                    name VARCHAR(255) NOT NULL,
                    sku VARCHAR(100) UNIQUE,
                    price DECIMAL(12,2),
                    stock INTEGER DEFAULT 0,
                    variant_attributes JSONB DEFAULT '{}', -- e.g., {"color": "red", "size": "XL"}
                    images JSONB DEFAULT '[]',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
            `);

        // Wishlist
        await client.query(`
                CREATE TABLE IF NOT EXISTS wishlist (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, product_id)
                );
            `);

        // Cart Items
        await client.query(`
                CREATE TABLE IF NOT EXISTS cart_items (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
                    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
                    price DECIMAL(12, 2),
                    quantity INTEGER DEFAULT 1,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, product_id, variant_id)
                );
            `);

        // Coupons
        await client.query(`
            CREATE TABLE IF NOT EXISTS coupons (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                code VARCHAR(50) UNIQUE NOT NULL,
                discount_type VARCHAR(20) CHECK (discount_type IN ('percentage', 'fixed')),
                value DECIMAL(12,2) NOT NULL,
                min_order_value DECIMAL(12,2) DEFAULT 0,
                max_discount DECIMAL(12,2),
                expiry_date TIMESTAMP WITH TIME ZONE,
                usage_limit INTEGER DEFAULT 1,
                usage_count INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
        `);

        // Orders
        await client.query(`
                CREATE TABLE IF NOT EXISTS orders (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                    total_price DECIMAL(12,2) NOT NULL,
                    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned')),
                    payment_status VARCHAR(50) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'failed', 'refunded')),
                    shipping_address JSONB NOT NULL,
                    coupon_id UUID REFERENCES coupons(id),
                    discount_amount DECIMAL(12,2),
                    final_price DECIMAL(12,2),
                    payment_method VARCHAR(50),
                    shipping_info JSONB DEFAULT '{}', -- tracking_id, carrier, etc.
                    razorpay_order_id VARCHAR(255),
                    razorpay_payment_id VARCHAR(255),
                    razorpay_signature TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
                CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
            `);

        // Order Items
        await client.query(`
                CREATE TABLE IF NOT EXISTS order_items (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
                    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
                    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
                    quantity INTEGER NOT NULL,
                    price DECIMAL(12,2) NOT NULL,
                    total_price DECIMAL(12,2) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
            `);

        // Order Status History
        await client.query(`
                CREATE TABLE IF NOT EXISTS order_status_history (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
                    status VARCHAR(50) NOT NULL,
                    comment TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            `);

        // Payments
        await client.query(`
                CREATE TABLE IF NOT EXISTS payments (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
                    method VARCHAR(50) NOT NULL, -- razorpay, stripe, cod, etc.
                    transaction_id VARCHAR(255),
                    status VARCHAR(50) CHECK (status IN ('pending','success','failed','refunded')),
                    amount DECIMAL(12,2) NOT NULL,
                    payment_details JSONB DEFAULT '{}', -- Gateway specific response
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
            `);
        // Product Reviews
        await client.query(`
                CREATE TABLE IF NOT EXISTS product_reviews (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
                    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                    comment TEXT,
                    images JSONB DEFAULT '[]',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id);
                CREATE INDEX IF NOT EXISTS idx_reviews_user ON product_reviews(user_id);
            `);

        // Hero Banners
        await client.query(`
                CREATE TABLE IF NOT EXISTS hero_banners (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    title VARCHAR(255),
                    subtitle VARCHAR(255),
                    description TEXT,
                    image_url TEXT NOT NULL,
                    button_text VARCHAR(50) DEFAULT 'Shop Now',
                    link_url VARCHAR(255),
                    is_active BOOLEAN DEFAULT true,
                    display_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            `);

        // Contact Messages
        await client.query(`
                CREATE TABLE IF NOT EXISTS contact_messages (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    subject VARCHAR(255),
                    message TEXT NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'read', 'replied', 'archived')),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_contact_email ON contact_messages(email);
                CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_messages(status);
            `);
        
        // Return Requests
        await client.query(`
                CREATE TABLE IF NOT EXISTS return_requests (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
                    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    reason TEXT NOT NULL,
                    images JSONB DEFAULT '[]',
                    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
                    admin_comment TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_return_order ON return_requests(order_id);
                CREATE INDEX IF NOT EXISTS idx_return_user ON return_requests(user_id);
                CREATE INDEX IF NOT EXISTS idx_return_status ON return_requests(status);
            `);

        console.log('All tables created successfully!');
    } catch (err) {
        console.error('Error creating tables:', err);
    } finally {
        client.release();
    }
};

createTables();