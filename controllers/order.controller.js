const pool = require('../config/db');
const Razorpay = require('razorpay');
const crypto = require('crypto');

let razorpay;
const getRazorpayInstance = () => {
    if (!razorpay) {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            console.error('Razorpay keys are missing in environment variables');
            return null;
        }
        razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }
    return razorpay;
};

exports.createOrder = async (req, res) => {
    const client = await pool.connect();
    try {
        const { shipping_address, items, coupon_id, payment_method } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ status: 'fail', message: 'Cart is empty' });
        }

        await client.query('BEGIN');

        // 1. Calculate Prices from Database
        let subtotal = 0;
        const processedItems = [];

        for (const item of items) {
            let dbPrice = 0;
            if (item.variant_id) {
                const variantRes = await client.query('SELECT price, stock FROM product_variants WHERE id = $1', [item.variant_id]);
                if (variantRes.rowCount === 0) throw new Error('Product variant not found');
                dbPrice = parseFloat(variantRes.rows[0].price);
                if (variantRes.rows[0].stock < item.quantity) throw new Error('Insufficient stock for some items');
            } else {
                const productRes = await client.query('SELECT price, stock FROM products WHERE id = $1', [item.product_id]);
                if (productRes.rowCount === 0) throw new Error('Product not found');
                dbPrice = parseFloat(productRes.rows[0].price);
                if (productRes.rows[0].stock < item.quantity) throw new Error('Insufficient stock for some items');
            }

            subtotal += dbPrice * item.quantity;
            processedItems.push({ ...item, price: dbPrice });
        }

        // 2. Handle Coupon
        let discount_amount = 0;
        let applied_coupon_id = null;
        if (coupon_id) {
            const couponRes = await client.query('SELECT * FROM coupons WHERE id = $1 AND status = $2', [coupon_id, 'active']);
            if (couponRes.rowCount > 0) {
                const coupon = couponRes.rows[0];
                if (subtotal >= parseFloat(coupon.min_order_value)) {
                    if (coupon.discount_type === 'percentage') {
                        discount_amount = (subtotal * parseFloat(coupon.value)) / 100;
                        if (coupon.max_discount && discount_amount > parseFloat(coupon.max_discount)) {
                            discount_amount = parseFloat(coupon.max_discount);
                        }
                    } else {
                        discount_amount = parseFloat(coupon.value);
                    }
                    applied_coupon_id = coupon.id;
                }
            }
        }

        const final_price = subtotal - discount_amount;

        // 3. Handle Order Logic based on Method
        if (payment_method === 'Cash on Delivery') {
            // Create Order Immediately for COD
            const orderRes = await client.query(
                `INSERT INTO orders (user_id, total_price, shipping_address, coupon_id, discount_amount, final_price, payment_method, status, payment_status) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [req.user.id, subtotal, JSON.stringify(shipping_address), applied_coupon_id, discount_amount, final_price, payment_method, 'pending', 'unpaid']
            );
            const order = orderRes.rows[0];

            // Insert Order Items
            for (const item of processedItems) {
                await client.query(
                    `INSERT INTO order_items (order_id, product_id, variant_id, quantity, price, total_price) 
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [order.id, item.product_id, item.variant_id || null, item.quantity, item.price, item.price * item.quantity]
                );
            }

            // Deduct stock immediately for COD
            for (const item of processedItems) {
                if (item.variant_id) {
                    await client.query('UPDATE product_variants SET stock = stock - $1 WHERE id = $2', [item.quantity, item.variant_id]);
                } else {
                    const stockRes = await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2 RETURNING stock', [item.quantity, item.product_id]);
                    if (stockRes.rows[0].stock === 0) {
                        await client.query("UPDATE products SET status = 'out_of_stock' WHERE id = $1", [item.product_id]);
                    }
                }
            }

            // Update coupon usage
            if (applied_coupon_id) {
                await client.query('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = $1', [applied_coupon_id]);
            }
            // Clear cart
            await client.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);
            // Status History
            await client.query('INSERT INTO order_status_history (order_id, status, comment) VALUES ($1, $2, $3)', [order.id, 'pending', 'Order placed (COD)']);

            await client.query('COMMIT');
            return res.status(201).json({
                status: 'success',
                data: { order, razorpay_order: null }
            });
        } else {
            // Online Payment: Create Razorpay Order WITHOUT database insertion
            const rzp = getRazorpayInstance();
            if (!rzp) throw new Error('Payment gateway not configured');

            const options = {
                amount: Math.round(final_price * 100),
                currency: 'INR',
                receipt: `rcpt_${Date.now()}`,
            };

            const razorpayOrder = await rzp.orders.create(options);

            await client.query('COMMIT');
            return res.status(200).json({
                status: 'success',
                data: {
                    order: null, // No order in DB yet
                    razorpay_order: razorpayOrder,
                    razorpay_key_id: process.env.RAZORPAY_KEY_ID,
                    temp_order_data: { // Send back to frontend to be used in verifyPayment
                        shipping_address,
                        items,
                        coupon_id,
                        payment_method,
                        final_price
                    }
                }
            });
        }

    } catch (error) {
        console.error(error);
        await client.query('ROLLBACK');
        console.error('Order creation error:', error);
        res.status(400).json({ status: 'fail', message: error.message || 'Failed to place order' });
    } finally {
        client.release();
    }
};

exports.verifyPayment = async (req, res) => {
    const client = await pool.connect();
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, temp_order_data } = req.body;
        const { shipping_address, items, coupon_id, payment_method } = temp_order_data;

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ status: 'fail', message: 'Invalid payment signature' });
        }

        await client.query('BEGIN');

        let subtotal = 0;
        const processedItems = [];

        for (const item of items) {
            let dbPrice = 0;
            if (item.variant_id) {
                const variantRes = await client.query('SELECT price, stock FROM product_variants WHERE id = $1', [item.variant_id]);
                if (variantRes.rowCount === 0) throw new Error('Product variant not found');
                dbPrice = parseFloat(variantRes.rows[0].price);
                if (variantRes.rows[0].stock < item.quantity) throw new Error('Insufficient stock for some items');
            } else {
                const productRes = await client.query('SELECT price, stock FROM products WHERE id = $1', [item.product_id]);
                if (productRes.rowCount === 0) throw new Error('Product not found');
                dbPrice = parseFloat(productRes.rows[0].price);
                if (productRes.rows[0].stock < item.quantity) throw new Error('Insufficient stock for some items');
            }
            subtotal += dbPrice * item.quantity;
            processedItems.push({ ...item, price: dbPrice });
        }

        let discount_amount = 0;
        let applied_coupon_id = null;
        if (coupon_id) {
            const couponRes = await client.query('SELECT * FROM coupons WHERE id = $1 AND status = $2', [coupon_id, 'active']);
            if (couponRes.rowCount > 0) {
                const coupon = couponRes.rows[0];
                if (subtotal >= parseFloat(coupon.min_order_value)) {
                    discount_amount = coupon.discount_type === 'percentage'
                        ? Math.min((subtotal * parseFloat(coupon.value)) / 100, parseFloat(coupon.max_discount || Infinity))
                        : parseFloat(coupon.value);
                    applied_coupon_id = coupon.id;
                }
            }
        }
        const final_price = subtotal - discount_amount;

        // Create Order in Database
        const orderRes = await client.query(
            `INSERT INTO orders (user_id, total_price, shipping_address, coupon_id, discount_amount, final_price, payment_method, status, payment_status, razorpay_order_id, razorpay_payment_id, razorpay_signature) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [req.user.id, subtotal, JSON.stringify(shipping_address), applied_coupon_id, discount_amount, final_price, payment_method, 'processing', 'paid', razorpay_order_id, razorpay_payment_id, razorpay_signature]
        );
        const order = orderRes.rows[0];

        // Insert Order Items
        for (const item of processedItems) {
            await client.query(
                `INSERT INTO order_items (order_id, product_id, variant_id, quantity, price, total_price) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [order.id, item.product_id, item.variant_id || null, item.quantity, item.price, item.price * item.quantity]
            );
        }

        // Deduct Stock
        for (const item of processedItems) {
            if (item.variant_id) {
                const stockRes = await client.query(
                    'UPDATE product_variants SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING stock',
                    [item.quantity, item.variant_id]
                );
                if (stockRes.rowCount === 0) throw new Error('Insufficient stock for one or more items');
            } else {
                const stockRes = await client.query(
                    'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING stock',
                    [item.quantity, item.product_id]
                );
                if (stockRes.rowCount === 0) throw new Error('Insufficient stock for one or more items');
                if (stockRes.rows[0].stock === 0) {
                    await client.query("UPDATE products SET status = 'out_of_stock' WHERE id = $1", [item.product_id]);
                }
            }
        }

        // Update Coupon Usage
        if (applied_coupon_id) {
            await client.query('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = $1', [applied_coupon_id]);
        }

        // Clear Cart
        await client.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);

        // Status History
        await client.query(
            'INSERT INTO order_status_history (order_id, status, comment) VALUES ($1, $2, $3)',
            [order.id, 'processing', 'Payment verified and order created successfully via Razorpay']
        );

        // Record Payment
        await client.query(
            `INSERT INTO payments (order_id, method, transaction_id, status, amount, payment_details) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [order.id, 'razorpay', razorpay_payment_id, 'success', final_price, JSON.stringify(req.body)]
        );

        await client.query('COMMIT');
        res.status(200).json({ status: 'success', message: 'Payment verified and order created', order_id: order.id });

    } catch (error) {
        console.error(error);
        await client.query('ROLLBACK');
        console.error('Payment verification error:', error);
        res.status(400).json({ status: 'fail', message: error.message || 'Payment verification failed' });
    } finally {
        client.release();
    }
};

exports.getMyOrders = async (req, res) => {
    try {
        const orders = await pool.query(
            `SELECT o.*, 
             (SELECT json_agg(json_build_object('name', p.name, 'image', p.images->>0))
              FROM order_items oi
              JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = o.id) as item_details
             FROM orders o 
             WHERE o.user_id = $1 
             ORDER BY o.created_at DESC`,
            [req.user.id]
        );
        res.status(200).json({ status: 'success', data: { orders: orders.rows } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.getOrder = async (req, res) => {
    try {
        const order = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
        if (order.rowCount === 0) return res.status(404).json({ message: 'Order not found' });

        if (order.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Permission denied' });
        }

        const items = await pool.query(
            `SELECT oi.*, p.name as product_name, p.images->>0 as product_image, p.slug,
                    v.variant_attributes, v.name as variant_name
             FROM order_items oi 
             JOIN products p ON oi.product_id = p.id
             LEFT JOIN product_variants v ON oi.variant_id = v.id
             WHERE oi.order_id = $1`,
            [req.params.id]
        );

        const history = await pool.query(
            'SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY created_at DESC',
            [req.params.id]
        );

        res.status(200).json({
            status: 'success',
            data: {
                order: order.rows[0],
                items: items.rows,
                history: history.rows
            }
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const { status, payment_status, comment } = req.body;

        let updateQuery = 'UPDATE orders SET updated_at = CURRENT_TIMESTAMP';
        const queryParams = [];
        let paramCount = 1;

        if (status) {
            updateQuery += `, status = $${paramCount}`;
            queryParams.push(status);
            paramCount++;
        }

        if (payment_status) {
            updateQuery += `, payment_status = $${paramCount}`;
            queryParams.push(payment_status);
            paramCount++;
        }

        updateQuery += ` WHERE id = $${paramCount} RETURNING *`;
        queryParams.push(req.params.id);

        const updatedOrder = await pool.query(updateQuery, queryParams);

        if (updatedOrder.rowCount === 0) return res.status(404).json({ message: 'Order not found' });

        if (status) {
            await pool.query(
                'INSERT INTO order_status_history (order_id, status, comment) VALUES ($1, $2, $3)',
                [req.params.id, status, comment || `Status updated to ${status}`]
            );
        }

        res.status(200).json({ status: 'success', data: { order: updatedOrder.rows[0] } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.getAllOrders = async (req, res) => {
    try {
        const orders = await pool.query('SELECT o.*, u.name as user_name FROM orders o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC');
        res.status(200).json({ status: 'success', results: orders.rowCount, data: { orders: orders.rows } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};
