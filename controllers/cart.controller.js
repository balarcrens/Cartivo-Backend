const pool = require('../config/db');

exports.getCart = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*, p.name as product_name, p.images as product_images, 
                    v.variant_attributes, v.name as variant_name
             FROM cart_items c
             JOIN products p ON c.product_id = p.id
             LEFT JOIN product_variants v ON c.variant_id = v.id
             WHERE c.user_id = $1
             ORDER BY c.created_at DESC`,
            [req.user.id]
        );

        const cart = result.rows;

        const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
        const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

        res.status(200).json({
            status: 'success',
            data: { cart, subtotal, totalItems }
        });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.addToCart = async (req, res) => {
    try {
        const { product_id, variant_id, quantity } = req.body;

        let actualPrice;
        if (variant_id) {
            const variant = await pool.query(`SELECT price FROM product_variants WHERE id = $1`, [variant_id]);
            actualPrice = variant.rows[0].price;
        } else {
            const product = await pool.query(`SELECT price FROM products WHERE id = $1`, [product_id]);
            actualPrice = product.rows[0].price;
        }

        const item = await pool.query(
            'INSERT INTO cart_items (user_id, product_id, variant_id, quantity, price) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, product_id, variant_id) DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity RETURNING *',
            [req.user.id, product_id, variant_id || null, quantity || 1, actualPrice]
        );
        res.status(201).json({ status: 'success', data: { item: item.rows[0] } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.removeFromCart = async (req, res) => {
    try {
        await pool.query('DELETE FROM cart_items WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.clearCart = async (req, res) => {
    try {
        await pool.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);
        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.getWishlist = async (req, res) => {
    try {
        const wishlist = await pool.query(
            `SELECT w.*, p.name, p.price, p.images, p.slug, c.name as category_name 
             FROM wishlist w 
             JOIN products p ON w.product_id = p.id 
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE w.user_id = $1`,
            [req.user.id]
        );
        res.status(200).json({ status: 'success', data: { wishlist: wishlist.rows } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.addToWishlist = async (req, res) => {
    try {
        const { product_id } = req.body;
        const item = await pool.query(
            'INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *',
            [req.user.id, product_id]
        );
        res.status(201).json({ status: 'success', data: { item: item.rows?.[0] } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.updateCartQuantity = async (req, res) => {
    try {
        const { id, quantity } = req.body;

        if (quantity < 1) {
            return res.status(400).json({ message: 'Quantity must be at least 1' });
        }

        const updated = await pool.query(
            `UPDATE cart_items 
             SET quantity = $1 
             WHERE id = $2 AND user_id = $3 
             RETURNING *`,
            [quantity, id, req.user.id]
        );

        res.status(200).json({
            status: 'success',
            data: updated.rows[0]
        });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.removeFromWishlist = async (req, res) => {
    try {
        await pool.query('DELETE FROM wishlist WHERE product_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};
