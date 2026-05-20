const pool = require('../config/db');
const { uploadToImageKit } = require('../config/imagekit');

exports.getMe = (req, res, next) => {
    req.params.id = req.user.id;
    next();
};

exports.getUser = async (req, res) => {
    try {
        const user = await pool.query(
            'SELECT id, name, email, phone, role, status, profile_image, created_at, updated_at FROM users WHERE id = $1',
            [req.params.id]
        );
        if (user.rowCount === 0) return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ status: 'success', data: { user: user.rows[0] } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.updateMe = async (req, res) => {
    try {
        let { name, phone, profile_image } = req.body;

        if (profile_image && profile_image.startsWith('data:image')) {
            profile_image = await uploadToImageKit(profile_image, '/Users', `user-${req.user.id}-${Date.now()}`);
        }

        const updatedUser = await pool.query(
            'UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone), profile_image = COALESCE($3, profile_image), updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING id, name, email, phone, role, status, profile_image',
            [name, phone, profile_image, req.user.id]
        );
        res.status(200).json({ status: 'success', data: { user: updatedUser.rows[0] } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const users = await pool.query('SELECT id, name, email, phone, role, status, created_at FROM users ORDER BY created_at DESC');
        res.status(200).json({ status: 'success', results: users.rowCount, data: { users: users.rows } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.updateUserStatus = async (req, res) => {
    try {
        const { status, role } = req.body;
        const updatedUser = await pool.query(
            'UPDATE users SET status = COALESCE($1, status), role = COALESCE($2, role), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [status, role, req.params.id]
        );
        if (updatedUser.rowCount === 0) return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ status: 'success', data: { user: updatedUser.rows[0] } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'User not found' });
        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};