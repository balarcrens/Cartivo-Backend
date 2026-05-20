const pool = require('../config/db');

exports.getAllCoupons = async (req, res) => {
    try {
        const coupons = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
        res.status(200).json({ status: 'success', results: coupons.rowCount, data: { coupons: coupons.rows } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.getActiveCoupons = async (req, res) => {
    try {
        const userId = req.user?.id;
        let query = `
            SELECT id, code, discount_type, value, min_order_value, max_discount, expiry_date 
            FROM coupons c
            WHERE status = 'active' 
            AND (expiry_date > NOW() OR expiry_date IS NULL) 
            AND (usage_limit IS NULL OR usage_count < usage_limit)
        `;
        let params = [];

        if (userId) {
            query += ` AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = $1 AND o.coupon_id = c.id)`;
            params.push(userId);
        }

        query += " ORDER BY created_at DESC";

        const coupons = await pool.query(query, params);
        res.status(200).json({ status: 'success', results: coupons.rowCount, data: { coupons: coupons.rows } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.getCouponByCode = async (req, res) => {
    try {
        const { code } = req.params;
        const coupon = await pool.query(`SELECT * FROM coupons WHERE code = $1 AND status = 'active' AND (expiry_date > NOW() OR expiry_date IS NULL)`, [code]);

        if (coupon.rowCount === 0) return res.status(404).json({ message: 'Coupon not found or expired' });

        const c = coupon.rows[0];

        if (c.usage_limit && c.usage_count >= c.usage_limit) {
            return res.status(400).json({ message: 'Coupon usage limit reached' });
        }

        if (req.user) {
            const userUsage = await pool.query(
                'SELECT 1 FROM orders WHERE user_id = $1 AND coupon_id = $2 LIMIT 1',
                [req.user.id, c.id]
            );
            if (userUsage.rowCount > 0) {
                return res.status(400).json({ message: 'You have already used this coupon' });
            }
        }

        res.status(200).json({ status: 'success', data: { coupon: c } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.createCoupon = async (req, res) => {
    try {
        const { code, discount_type, value, min_order_value, max_discount, expiry_date, usage_limit } = req.body;
        const newCoupon = await pool.query(
            `INSERT INTO coupons (code, discount_type, value, min_order_value, max_discount, expiry_date, usage_limit) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [code, discount_type, value, min_order_value || 0, max_discount, expiry_date, usage_limit || 1]
        );
        res.status(201).json({ status: 'success', data: { coupon: newCoupon.rows[0] } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.updateCoupon = async (req, res) => {
    try {
        const { code, discount_type, value, min_order_value, max_discount, expiry_date, usage_limit, status } = req.body;
        const updatedCoupon = await pool.query(
            `UPDATE coupons SET 
                code = COALESCE($1, code), 
                discount_type = COALESCE($2, discount_type), 
                value = COALESCE($3, value), 
                min_order_value = COALESCE($4, min_order_value), 
                max_discount = COALESCE($5, max_discount), 
                expiry_date = COALESCE($6, expiry_date), 
                usage_limit = COALESCE($7, usage_limit), 
                status = COALESCE($8, status) 
             WHERE id = $9 RETURNING *`,
            [code, discount_type, value, min_order_value, max_discount, expiry_date, usage_limit, status, req.params.id]
        );
        if (updatedCoupon.rowCount === 0) return res.status(404).json({ message: 'Coupon not found' });
        res.status(200).json({ status: 'success', data: { coupon: updatedCoupon.rows[0] } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.deleteCoupon = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM coupons WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Coupon not found' });
        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};
