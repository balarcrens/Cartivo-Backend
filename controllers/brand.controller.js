const pool = require('../config/db');
const slugify = require('slugify');
const { uploadToImageKit } = require('../config/imagekit');

exports.getAllBrands = async (req, res) => {
    try {
        const brands = await pool.query(`
            SELECT b.*, c.name as category_name 
            FROM brands b 
            LEFT JOIN categories c ON b.category_id = c.id 
            ORDER BY b.name ASC
        `);
        res.status(200).json({ status: 'success', data: { brands: brands.rows } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.getBrandsByCategory = async (req, res) => {
    try {
        const categoryId = req.params.categoryId;

        const brands = await pool.query(`
            WITH RECURSIVE descendant_categories AS (
                SELECT id FROM categories WHERE id = $1
                UNION ALL
                SELECT c.id FROM categories c
                JOIN descendant_categories dc ON c.parent_id = dc.id
            )
            SELECT DISTINCT b.*, c.name as category_name 
            FROM brands b 
            LEFT JOIN categories c ON b.category_id = c.id 
            WHERE b.category_id IN (SELECT id FROM descendant_categories)
            ORDER BY b.name ASC
        `, [categoryId]);
        res.status(200).json({ status: 'success', data: { brands: brands.rows } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.createBrand = async (req, res) => {
    try {
        let { name, logo, description, category_id } = req.body;
        let slug = slugify(name, { lower: true, strict: true });

        if (logo && logo.startsWith('data:image')) {
            logo = await uploadToImageKit(logo, '/Brands', `${slug}-${Date.now()}`);
        }

        const newBrand = await pool.query(
            'INSERT INTO brands (name, slug, logo, description, category_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, slug, logo, description, category_id]
        );
        res.status(201).json({ status: 'success', data: { brand: newBrand.rows[0] } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.updateBrand = async (req, res) => {
    try {
        let { name, logo, description, category_id } = req.body;
        let slug = name ? slugify(name, { lower: true, strict: true }) : null;

        if (logo && logo.startsWith('data:image')) {
            logo = await uploadToImageKit(logo, '/Brands', `${slug || 'brand'}-${Date.now()}`);
        }

        const updatedBrand = await pool.query(
            'UPDATE brands SET name = COALESCE($1, name), slug = COALESCE($2, slug), category_id = $3, logo = COALESCE($4, logo), description = COALESCE($5, description) WHERE id = $6 RETURNING *',
            [name, slug, category_id, logo, description, req.params.id]
        );
        if (updatedBrand.rowCount === 0) return res.status(404).json({ message: 'Brand not found' });
        res.status(200).json({ status: 'success', data: { brand: updatedBrand.rows[0] } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.deleteBrand = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM brands WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Brand not found' });
        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};
