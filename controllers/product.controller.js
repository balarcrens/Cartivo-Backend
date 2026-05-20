const pool = require('../config/db');
const slugify = require('slugify');
const { uploadToImageKit } = require('../config/imagekit');

const updateProductStock = async (productId, client = pool) => {
    const variantCountResult = await client.query('SELECT count(*) FROM product_variants WHERE product_id = $1', [productId]);
    const hasVariants = parseInt(variantCountResult.rows[0].count) > 0;

    if (hasVariants) {
        const result = await client.query(
            'SELECT SUM(stock) as total_stock FROM product_variants WHERE product_id = $1',
            [productId]
        );
        const totalStock = parseInt(result.rows[0].total_stock) || 0;
        await client.query(
            'UPDATE products SET stock = $1 WHERE id = $2',
            [totalStock, productId]
        );
    }
};

exports.getAllProducts = async (req, res) => {
    try {
        const { category, brand, minPrice, maxPrice, sort, search, status } = req.query;
        let queryParams = [];
        let whereClauses = [];

        if (status && status !== 'all') {
            queryParams.push(status);
            whereClauses.push(`p.status = $${queryParams.length}`);
        } else if (!status) {
            whereClauses.push("p.status = 'active'");
        }

        if (category) {
            queryParams.push(category);
            whereClauses.push(`
                p.category_id IN (
                    WITH RECURSIVE 
                    target_cat AS (
                        SELECT id, parent_id FROM categories WHERE slug = $${queryParams.length}
                    ),
                    descendants AS (
                        SELECT id FROM target_cat
                        UNION ALL
                        SELECT c.id FROM categories c JOIN descendants d ON c.parent_id = d.id
                    ),
                    ancestors AS (
                        SELECT id, parent_id FROM target_cat
                        UNION ALL
                        SELECT c.id, c.parent_id FROM categories c JOIN ancestors a ON c.id = a.parent_id
                    )
                    SELECT id FROM descendants
                    UNION
                    SELECT id FROM ancestors
                )
            `);
        }

        if (brand) {
            const brandList = brand.split(',');
            const brandPlaceholders = brandList.map((_, i) => {
                queryParams.push(brandList[i]);
                return `$${queryParams.length}`;
            }).join(',');
            whereClauses.push(`b.slug IN (${brandPlaceholders})`);
        }

        if (minPrice) {
            queryParams.push(minPrice);
            whereClauses.push(`p.price >= $${queryParams.length}`);
        }
        if (maxPrice) {
            queryParams.push(maxPrice);
            whereClauses.push(`p.price <= $${queryParams.length}`);
        }

        if (search) {
            queryParams.push(`%${search}%`);
            whereClauses.push(`(p.name ILIKE $${queryParams.length} OR p.description ILIKE $${queryParams.length})`);
        }

        let orderBy = 'p.created_at DESC';
        if (sort) {
            switch (sort) {
                case 'low-to-high': orderBy = 'p.price ASC'; break;
                case 'high-to-low': orderBy = 'p.price DESC'; break;
                case 'newest': orderBy = 'p.created_at DESC'; break;
                case 'popular': orderBy = 'p.created_at ASC'; break;
            }
        }

        const query = `
            SELECT p.*, c.name as category_name, b.name as brand_name, b.slug as brand_slug,
                   COALESCE(
                       (SELECT json_agg(r.rating) FROM product_reviews r WHERE r.product_id = p.id),
                       '[]'::json
                   ) as ratings
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            LEFT JOIN brands b ON p.brand_id = b.id
            ${whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''}
            ORDER BY ${orderBy}
        `;

        const products = await pool.query(query, queryParams);
        res.status(200).json({
            status: 'success',
            results: products.rowCount,
            data: { products: products.rows }
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};


exports.getProduct = async (req, res) => {
    try {
        const product = await pool.query(`
            SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name, b.slug as brand_slug,
                   COALESCE(
                       (SELECT json_agg(r.rating) FROM product_reviews r WHERE r.product_id = p.id),
                       '[]'::json
                   ) as ratings
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            LEFT JOIN brands b ON p.brand_id = b.id
            WHERE p.id = $1`, [req.params.id]);

        if (product.rowCount === 0) return res.status(404).json({ message: 'Product not found' });

        const variants = await pool.query('SELECT * FROM product_variants WHERE product_id = $1', [req.params.id]);

        res.status(200).json({ status: 'success', data: { product: product.rows[0], variants: variants.rows } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.getProductBySlug = async (req, res) => {
    try {
        const product = await pool.query(`
            SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name, b.slug as brand_slug,
                   COALESCE(
                       (SELECT json_agg(r.rating) FROM product_reviews r WHERE r.product_id = p.id),
                       '[]'::json
                   ) as ratings
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            LEFT JOIN brands b ON p.brand_id = b.id
            WHERE p.slug = $1`, [req.params.slug]);

        if (product.rowCount === 0) return res.status(404).json({ message: 'Product not found' });

        const variants = await pool.query('SELECT * FROM product_variants WHERE product_id = $1', [product.rows[0].id]);

        res.status(200).json({ status: 'success', data: { product: product.rows[0], variants: variants.rows } });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};


exports.createProduct = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let { name, description, category_id, vendor_id, brand_id, price, discount, stock, status, images, attributes, variants } = req.body;
        let slug = slugify(name, { lower: true, strict: true });

        price = parseFloat(price) || 0;
        discount = parseFloat(discount) || 0;
        stock = parseInt(stock) || 0;

        category_id = category_id || null;
        vendor_id = vendor_id || null;
        brand_id = brand_id || null;

        const uploadedImages = [];
        if (images && Array.isArray(images)) {
            for (let i = 0; i < images.length; i++) {
                if (images[i].startsWith('data:image')) {
                    const url = await uploadToImageKit(images[i], '/Products', `${slug}-${i}-${Date.now()}`);
                    uploadedImages.push(url);
                } else {
                    uploadedImages.push(images[i]);
                }
            }
        }

        const newProduct = await client.query(
            `INSERT INTO products (name, slug, description, category_id, vendor_id, brand_id, price, discount, stock, status, images, attributes) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [name, slug, description, category_id, vendor_id || null, brand_id || null, price, discount, stock, status, JSON.stringify(uploadedImages), JSON.stringify(attributes || {})]
        );

        const productId = newProduct.rows[0].id;

        if (variants && Array.isArray(variants)) {
            for (const variant of variants) {
                const uploadedVariantImages = [];
                if (variant.images && Array.isArray(variant.images)) {
                    for (let j = 0; j < variant.images.length; j++) {
                        if (variant.images[j].startsWith('data:image')) {
                            const url = await uploadToImageKit(variant.images[j], '/Products/Variants', `${slug}-var-${j}-${Date.now()}`);
                            uploadedVariantImages.push(url);
                        } else {
                            uploadedVariantImages.push(variant.images[j]);
                        }
                    }
                }

                const vPrice = parseFloat(variant.price) || price;
                const vStock = parseInt(variant.stock) || 0;

                await client.query(
                    `INSERT INTO product_variants (product_id, name, sku, price, stock, variant_attributes, images) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [productId, variant.name, variant.sku, vPrice, vStock, JSON.stringify(variant.variant_attributes || {}), JSON.stringify(uploadedVariantImages)]
                );
            }
            await updateProductStock(productId, client);
        }

        await client.query('COMMIT');
        res.status(201).json({ status: 'success', data: { product: newProduct.rows[0] } });
    } catch (error) {
        console.error(error);
        await client.query('ROLLBACK');
        res.status(400).json({ status: 'fail', message: error.message });
    } finally {
        client.release();
    }
};

exports.updateProduct = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let { name, description, category_id, vendor_id, brand_id, price, discount, stock, status, images, attributes, variants } = req.body;

        let slug = name ? slugify(name, { lower: true, strict: true }) : null;

        if (price !== undefined) price = parseFloat(price) || 0;
        if (discount !== undefined) discount = parseFloat(discount) || 0;
        if (stock !== undefined) stock = parseInt(stock) || 0;

        if (category_id === "") category_id = null;
        if (vendor_id === "") vendor_id = null;
        if (brand_id === "") brand_id = null;

        let finalImages = images;
        if (images && Array.isArray(images)) {
            const uploadedImages = [];
            for (let i = 0; i < images.length; i++) {
                if (images[i].startsWith('data:image')) {
                    const url = await uploadToImageKit(images[i], '/Products', `${slug || 'prod'}-${i}-${Date.now()}`);
                    uploadedImages.push(url);
                } else {
                    uploadedImages.push(images[i]);
                }
            }
            finalImages = JSON.stringify(uploadedImages);
        }

        const updatedProduct = await client.query(
            `UPDATE products SET 
                name = COALESCE($1, name), 
                slug = COALESCE($2, slug), 
                description = COALESCE($3, description), 
                category_id = COALESCE($4, category_id), 
                vendor_id = COALESCE($5, vendor_id), 
                brand_id = COALESCE($6, brand_id), 
                price = COALESCE($7, price), 
                discount = COALESCE($8, discount), 
                stock = COALESCE($9, stock), 
                status = COALESCE($10, status), 
                images = COALESCE($11, images), 
                attributes = COALESCE($12, attributes),
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = $13 RETURNING *`,
            [
                name, slug, description, category_id, vendor_id, brand_id, price, discount, stock, status,
                finalImages,
                attributes ? JSON.stringify(attributes) : null,
                req.params.id
            ]
        );

        if (updatedProduct.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Product not found' });
        }

        if (variants && Array.isArray(variants)) {
            for (const variant of variants) {
                let finalVariantImages = variant.images || [];
                if (variant.images && Array.isArray(variant.images)) {
                    const uploadedVarImages = [];
                    for (let j = 0; j < variant.images.length; j++) {
                        if (variant.images[j].startsWith('data:image')) {
                            const url = await uploadToImageKit(variant.images[j], '/Products/Variants', `${slug || 'var'}-${j}-${Date.now()}`);
                            uploadedVarImages.push(url);
                        } else {
                            uploadedVarImages.push(variant.images[j]);
                        }
                    }
                    finalVariantImages = uploadedVarImages;
                }

                if (variant.id) {
                    await client.query(
                        `UPDATE product_variants SET 
                            name = $1, sku = $2, price = $3, stock = $4, variant_attributes = $5, images = $6
                         WHERE id = $7 AND product_id = $8`,
                        [variant.name, variant.sku, variant.price, variant.stock, JSON.stringify(variant.variant_attributes || {}), JSON.stringify(finalVariantImages), variant.id, req.params.id]
                    );
                } else {
                    await client.query(
                        `INSERT INTO product_variants (product_id, name, sku, price, stock, variant_attributes, images) 
                         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [req.params.id, variant.name, variant.sku, variant.price, variant.stock, JSON.stringify(variant.variant_attributes || {}), JSON.stringify(finalVariantImages)]
                    );
                }
            }
            await updateProductStock(req.params.id, client);
        }

        await client.query('COMMIT');
        res.status(200).json({ status: 'success', data: { product: updatedProduct.rows[0] } });
    } catch (error) {
        console.error(error);
        await client.query('ROLLBACK');
        res.status(400).json({ status: 'fail', message: error.message });
    } finally {
        client.release();
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Product not found' });
        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

