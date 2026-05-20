const pool = require('../config/db');

// Helper to update product total stock
const updateProductStock = async (productId, client = pool) => {
    const result = await client.query(
        'SELECT SUM(stock) as total_stock FROM product_variants WHERE product_id = $1',
        [productId]
    );
    const totalStock = parseInt(result.rows[0].total_stock) || 0;
    await client.query(
        'UPDATE products SET stock = $1 WHERE id = $2',
        [totalStock, productId]
    );
};

exports.getAllVariants = async (req, res) => {
    try {
        const { productId } = req.params;
        const variants = await pool.query('SELECT * FROM product_variants WHERE product_id = $1 ORDER BY created_at DESC', [productId]);
        res.status(200).json({ status: 'success', results: variants.rowCount, data: { variants: variants.rows } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.getVariant = async (req, res) => {
    try {
        const variant = await pool.query('SELECT * FROM product_variants WHERE id = $1', [req.params.id]);
        if (variant.rowCount === 0) return res.status(404).json({ message: 'Variant not found' });
        res.status(200).json({ status: 'success', data: { variant: variant.rows[0] } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.createVariant = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { product_id, name, sku, price, stock, variant_attributes, images } = req.body;

        // 1. Check uniqueness: check if variant with same attributes already exists for this product
        const existingVariant = await client.query(
            'SELECT * FROM product_variants WHERE product_id = $1 AND variant_attributes = $2',
            [product_id, JSON.stringify(variant_attributes || {})]
        );

        if (existingVariant.rowCount > 0) {
            throw new Error('A variant with these attributes already exists for this product.');
        }

        // 2. Auto-generate name if not provided
        let finalName = name;
        if (!finalName && variant_attributes) {
            finalName = Object.values(variant_attributes).join(' / ');
        }

        const newVariant = await client.query(
            `INSERT INTO product_variants (product_id, name, sku, price, stock, variant_attributes, images) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [product_id, finalName || 'Default Variant', sku, price, stock || 0, JSON.stringify(variant_attributes || {}), JSON.stringify(images || [])]
        );

        // 3. Update Product Total Stock
        await updateProductStock(product_id, client);

        await client.query('COMMIT');
        res.status(201).json({ status: 'success', data: { variant: newVariant.rows[0] } });
    } catch (error) {
        console.error(error);
        await client.query('ROLLBACK');
        res.status(400).json({ status: 'fail', message: error.message });
    } finally {
        client.release();
    }
};

exports.updateVariant = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { name, sku, price, stock, variant_attributes, images } = req.body;

        // Fetch existing variant to get product_id
        const variantData = await client.query('SELECT * FROM product_variants WHERE id = $1', [req.params.id]);
        if (variantData.rowCount === 0) throw new Error('Variant not found');
        const productId = variantData.rows[0].product_id;

        // Check uniqueness if attributes are being changed
        if (variant_attributes) {
            const existingVariant = await client.query(
                'SELECT * FROM product_variants WHERE product_id = $1 AND variant_attributes = $2 AND id != $3',
                [productId, JSON.stringify(variant_attributes), req.params.id]
            );
            if (existingVariant.rowCount > 0) {
                throw new Error('A variant with these attributes already exists.');
            }
        }

        const updatedVariant = await client.query(
            `UPDATE product_variants SET 
                name = COALESCE($1, name), 
                sku = COALESCE($2, sku), 
                price = COALESCE($3, price), 
                stock = COALESCE($4, stock), 
                variant_attributes = COALESCE($5, variant_attributes), 
                images = COALESCE($6, images)
            WHERE id = $7 RETURNING *`,
            [
                name, sku, price, stock,
                variant_attributes ? JSON.stringify(variant_attributes) : null,
                images ? JSON.stringify(images) : null,
                req.params.id
            ]
        );

        // Update Product Total Stock
        await updateProductStock(productId, client);

        await client.query('COMMIT');
        res.status(200).json({ status: 'success', data: { variant: updatedVariant.rows[0] } });
    } catch (error) {
        console.error(error);
        await client.query('ROLLBACK');
        res.status(400).json({ status: 'fail', message: error.message });
    } finally {
        client.release();
    }
};

exports.deleteVariant = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Fetch variant to get product_id before deleting
        const variantData = await client.query('SELECT product_id FROM product_variants WHERE id = $1', [req.params.id]);
        if (variantData.rowCount === 0) throw new Error('Variant not found');
        const productId = variantData.rows[0].product_id;

        await client.query('DELETE FROM product_variants WHERE id = $1', [req.params.id]);

        // Update Product Total Stock
        await updateProductStock(productId, client);

        await client.query('COMMIT');
        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
        console.error(error);
        await client.query('ROLLBACK');
        res.status(400).json({ status: 'fail', message: error.message });
    } finally {
        client.release();
    }
};

