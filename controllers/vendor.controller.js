const pool = require('../config/db');
const slugify = require('slugify');
const { uploadToImageKit } = require('../config/imagekit');

exports.registerVendor = async (req, res) => {
    try {
        let { store_name, description, logo } = req.body;
        let slug = slugify(store_name, { lower: true, strict: true });
        if (req.user.role === 'vendor') return res.status(400).json({ message: 'User is already a vendor' });

        if (logo && logo.startsWith('data:image')) {
            logo = await uploadToImageKit(logo, '/Vendors', `${slug}-${Date.now()}`);
        }

        const newVendor = await pool.query(
            'INSERT INTO vendors (user_id, store_name, slug, description, logo) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [req.user.id, store_name, slug, description, logo]
        );

        await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['vendor', req.user.id]);

        res.status(201).json({ status: 'success', data: { vendor: newVendor.rows[0] } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.getVendorProfile = async (req, res) => {
    try {
        const vendor = await pool.query('SELECT * FROM vendors WHERE user_id = $1', [req.user.id]);
        if (vendor.rowCount === 0) return res.status(404).json({ message: 'No vendor profile found' });
        res.status(200).json({ status: 'success', data: { vendor: vendor.rows[0] } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.updateVendorProfile = async (req, res) => {
    try {
        let { store_name, description, logo } = req.body;
        let slug = store_name ? slugify(store_name, { lower: true, strict: true }) : null;

        if (logo && logo.startsWith('data:image')) {
            logo = await uploadToImageKit(logo, '/Vendors', `${slug || 'vendor'}-${Date.now()}`);
        }

        const updatedVendor = await pool.query(
            'UPDATE vendors SET store_name = COALESCE($1, store_name), slug = COALESCE($2, slug), description = COALESCE($3, description), logo = COALESCE($4, logo), updated_at = CURRENT_TIMESTAMP WHERE user_id = $5 RETURNING *',
            [store_name, slug, description, logo, req.user.id]
        );
        if (updatedVendor.rowCount === 0) return res.status(404).json({ message: 'No vendor profile found' });
        res.status(200).json({ status: 'success', data: { vendor: updatedVendor.rows[0] } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.getAllVendors = async (req, res) => {
    try {
        const vendors = await pool.query('SELECT v.*, u.name as owner_name, u.email as owner_email FROM vendors v JOIN users u ON v.user_id = u.id ORDER BY v.created_at DESC');
        res.status(200).json({ status: 'success', results: vendors.rowCount, data: { vendors: vendors.rows } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.verifyVendor = async (req, res) => {
    try {
        const { status } = req.body;
        const updatedVendor = await pool.query(
            'UPDATE vendors SET verification_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [status, req.params.id]
        );
        if (updatedVendor.rowCount === 0) return res.status(404).json({ message: 'Vendor not found' });
        res.status(200).json({ status: 'success', data: { vendor: updatedVendor.rows[0] } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};
