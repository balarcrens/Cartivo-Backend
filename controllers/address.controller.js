const pool = require('../config/db');

exports.getAddresses = async (req, res) => {
    try {
        const addresses = await pool.query('SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC', [req.user.id]);
        res.status(200).json({ status: 'success', data: { addresses: addresses.rows } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.addAddress = async (req, res) => {
    try {
        const { full_name, phone, address_line1, address_line2, city, state, country, pincode, is_default } = req.body;

        if (is_default) {
            await pool.query('UPDATE user_addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
        }

        const newAddress = await pool.query(
            `INSERT INTO user_addresses (user_id, full_name, phone, address_line1, address_line2, city, state, country, pincode, is_default) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [req.user.id, full_name, phone, address_line1, address_line2, city, state, country, pincode, is_default || false]
        );

        res.status(201).json({ status: 'success', data: { address: newAddress.rows[0] } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.updateAddress = async (req, res) => {
    try {
        const { full_name, phone, address_line1, address_line2, city, state, country, pincode, is_default } = req.body;

        if (is_default) {
            await pool.query('UPDATE user_addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
        }

        const updatedAddress = await pool.query(
            `UPDATE user_addresses SET 
                full_name = COALESCE($1, full_name), 
                phone = COALESCE($2, phone), 
                address_line1 = COALESCE($3, address_line1), 
                address_line2 = COALESCE($4, address_line2), 
                city = COALESCE($5, city), 
                state = COALESCE($6, state), 
                country = COALESCE($7, country), 
                pincode = COALESCE($8, pincode), 
                is_default = COALESCE($9, is_default)
            WHERE id = $10 AND user_id = $11 RETURNING *`,
            [full_name, phone, address_line1, address_line2, city, state, country, pincode, is_default, req.params.id, req.user.id]
        );

        if (updatedAddress.rowCount === 0) return res.status(404).json({ message: 'Address not found' });
        res.status(200).json({ status: 'success', data: { address: updatedAddress.rows[0] } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.deleteAddress = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM user_addresses WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.setDefaultAddress = async (req, res) => {
    try {
        await pool.query('UPDATE user_addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
        const updatedAddress = await pool.query(
            'UPDATE user_addresses SET is_default = true WHERE id = $1 AND user_id = $2 RETURNING *',
            [req.params.id, req.user.id]
        );
        if (updatedAddress.rowCount === 0) return res.status(404).json({ message: 'Address not found' });
        res.status(200).json({ status: 'success', data: { address: updatedAddress.rows[0] } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};
