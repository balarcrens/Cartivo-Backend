const pool = require('../config/db');

exports.requestReturn = async (req, res) => {
    const client = await pool.connect();
    try {
        const { order_id, reason, images } = req.body;
        const user_id = req.user.id;

        if (!order_id || !reason || !images || images.length === 0) {
            return res.status(400).json({ status: 'fail', message: 'Reason and at least one product image are required' });
        }

        const orderRes = await client.query(
            'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
            [order_id, user_id]
        );

        if (orderRes.rowCount === 0) {
            return res.status(404).json({ status: 'fail', message: 'Order not found' });
        }

        const order = orderRes.rows[0];

        if (order.status !== 'delivered') {
            return res.status(400).json({ status: 'fail', message: 'Returns can only be requested for delivered orders' });
        }

        const orderDate = new Date(order.created_at);
        const currentDate = new Date();
        const diffTime = Math.abs(currentDate - orderDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 7) {
            return res.status(400).json({ status: 'fail', message: 'Return window (7 days) has expired' });
        }

        const existingRequest = await client.query(
            'SELECT id FROM return_requests WHERE order_id = $1',
            [order_id]
        );

        if (existingRequest.rowCount > 0) {
            return res.status(400).json({ status: 'fail', message: 'A return request already exists for this order' });
        }

        await client.query('BEGIN');

        const returnRes = await client.query(
            `INSERT INTO return_requests (order_id, user_id, reason, images, status) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [order_id, user_id, reason, JSON.stringify(images), 'pending']
        );

        await client.query('COMMIT');

        res.status(201).json({
            status: 'success',
            message: 'Return request submitted successfully',
            data: { return_request: returnRes.rows[0] }
        });

    } catch (error) {
    console.error(error);
        await client.query('ROLLBACK');
        console.error('Return request error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    } finally {
        client.release();
    }
};

exports.getOrderReturnStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const user_id = req.user.id;

        const returnRes = await pool.query(
            'SELECT * FROM return_requests WHERE order_id = $1 AND user_id = $2',
            [orderId, user_id]
        );

        res.status(200).json({
            status: 'success',
            data: { return_request: returnRes.rows[0] || null }
        });
    } catch (error) {
    console.error(error);
        console.error('Get return status error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};

exports.getAllReturns = async (req, res) => {
    try {
        const returnsRes = await pool.query(`
            SELECT rr.*, o.total_price, o.payment_status, o.status as order_status, u.name as user_name, u.email as user_email
            FROM return_requests rr
            JOIN orders o ON rr.order_id = o.id
            JOIN users u ON rr.user_id = u.id
            ORDER BY rr.created_at DESC
        `);

        res.status(200).json({
            status: 'success',
            results: returnsRes.rowCount,
            data: { returns: returnsRes.rows }
        });
    } catch (error) {
    console.error(error);
        console.error('Get all returns error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};

exports.updateReturnStatus = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { status, admin_comment, order_status, payment_status } = req.body;

        await client.query('BEGIN');

        const returnRes = await client.query(
            `UPDATE return_requests 
             SET status = $1, admin_comment = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $3 RETURNING *`,
            [status, admin_comment, id]
        );

        if (returnRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ status: 'fail', message: 'Return request not found' });
        }

        const returnRequest = returnRes.rows[0];

        if (order_status) {
            await client.query(
                'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [order_status, returnRequest.order_id]
            );
        }

        if (payment_status) {
            await client.query(
                'UPDATE orders SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [payment_status, returnRequest.order_id]
            );
        }

        await client.query('COMMIT');

        res.status(200).json({
            status: 'success',
            message: 'Return status updated successfully',
            data: { return_request: returnRequest }
        });

    } catch (error) {
    console.error(error);
        await client.query('ROLLBACK');
        console.error('Update return status error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    } finally {
        client.release();
    }
};
