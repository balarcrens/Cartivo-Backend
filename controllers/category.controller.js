const pool = require('../config/db');
const slugify = require('slugify');
const { uploadToImageKit } = require('../config/imagekit');


exports.getAllCategories = async (req, res) => {
    try {
        const { status } = req.query;
        let query = 'SELECT * FROM categories';
        let queryParams = [];

        if (status && status !== 'all') {
            query += ' WHERE status = $1';
            queryParams.push(status);
        } else if (!status) {
            query += ' WHERE status = \'active\'';
        }

        query += ' ORDER BY name ASC';
        
        const categories = await pool.query(query, queryParams);
        res.status(200).json({ status: 'success', data: { categories: categories.rows } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};


exports.getCategoryTree = async (req, res) => {
    try {
        const query = `
            WITH RECURSIVE category_tree AS (
                -- Base case: Root categories
                SELECT id, name, slug, parent_id, image, 0 as level
                FROM categories
                WHERE parent_id IS NULL AND status = 'active'
                
                UNION ALL
                
                -- Recursive step: Child categories
                SELECT c.id, c.name, c.slug, c.parent_id, c.image, ct.level + 1
                FROM categories c
                JOIN category_tree ct ON c.parent_id = ct.id
                WHERE c.status = 'active'
            )
            SELECT * FROM category_tree ORDER BY level, name;
        `;
        const result = await pool.query(query);
        
        // Build the nested structure
        const categories = result.rows;
        const map = {};
        const roots = [];
        
        categories.forEach(cat => {
            map[cat.id] = { ...cat, children: [] };
        });
        
        categories.forEach(cat => {
            if (cat.parent_id && map[cat.parent_id]) {
                map[cat.parent_id].children.push(map[cat.id]);
            } else {
                roots.push(map[cat.id]);
            }
        });

        res.status(200).json({ status: 'success', data: { categories: roots } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.getCategoryBySlug = async (req, res) => {
    try {
        const category = await pool.query('SELECT * FROM categories WHERE slug = $1', [req.params.slug]);
        if (category.rowCount === 0) return res.status(404).json({ message: 'Category not found' });

        const pathQuery = `
            WITH RECURSIVE cat_path AS (
                SELECT id, name, slug, parent_id, 0 as depth
                FROM categories
                WHERE id = $1
                UNION ALL
                SELECT c.id, c.name, c.slug, c.parent_id, cp.depth + 1
                FROM categories c
                JOIN cat_path cp ON c.id = cp.parent_id
            )
            SELECT * FROM cat_path ORDER BY depth DESC;
        `;
        const path = await pool.query(pathQuery, [category.rows[0].id]);

        res.status(200).json({ 
            status: 'success', 
            data: { 
                category: category.rows[0],
                path: path.rows
            } 
        });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};


exports.createCategory = async (req, res) => {
    try {
        let { name, parent_id, image, attributes, status } = req.body;
        let slug = slugify(name, { lower: true, strict: true });

        if (image && image.startsWith('data:image')) {
            image = await uploadToImageKit(image, '/Categories', `${slug}-${Date.now()}`);
        }

        const newCategory = await pool.query(
            'INSERT INTO categories (name, slug, parent_id, image, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, slug, parent_id || null, image, status || 'active']
        );
        res.status(201).json({ status: 'success', data: { category: newCategory.rows[0] } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        let { name, parent_id, image, attributes, status } = req.body;
        let slug = name ? slugify(name, { lower: true, strict: true }) : null;

        if (image && image.startsWith('data:image')) {
            image = await uploadToImageKit(image, '/Categories', `${slug || 'category'}-${Date.now()}`);
        }

        const updatedCategory = await pool.query(
            'UPDATE categories SET name = COALESCE($1, name), slug = COALESCE($2, slug), parent_id = COALESCE($3, parent_id), image = COALESCE($4, image), status = COALESCE($5, status) WHERE id = $6 RETURNING *',
            [name, slug, parent_id, image, status, req.params.id]
        );
        if (updatedCategory.rowCount === 0) return res.status(404).json({ message: 'Category not found' });
        res.status(200).json({ status: 'success', data: { category: updatedCategory.rows[0] } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Category not found' });
        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};
