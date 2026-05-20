const pool = require('../config/db');
const { uploadToImageKit } = require('../config/imagekit');

exports.createReview = async (req, res) => {
    try {
        const { product_id, rating, comment, images } = req.body;
        const user_id = req.user.id;

        let uploadedImages = [];
        if (images && Array.isArray(images)) {
            for (const img of images) {
                if (img.startsWith('data:image')) {
                    const imageUrl = await uploadToImageKit(img, '/Cartivo/Reviews');
                    uploadedImages.push(imageUrl);
                } else {
                    uploadedImages.push(img);
                }
            }
        }

        const newReview = await pool.query(
            'INSERT INTO product_reviews (product_id, user_id, rating, comment, images) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [product_id, user_id, rating, comment, JSON.stringify(uploadedImages)]
        );

        res.status(201).json({
            status: 'success',
            data: {
                review: newReview.rows[0]
            }
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.getProductReviews = async (req, res) => {
    try {
        const { product_id } = req.params;

        const reviews = await pool.query(
            `SELECT r.*, u.name as user_name, u.profile_image 
             FROM product_reviews r 
             JOIN users u ON r.user_id = u.id 
             WHERE r.product_id = $1 
             ORDER BY r.created_at DESC`,
            [product_id]
        );

        res.status(200).json({
            status: 'success',
            results: reviews.rowCount,
            data: {
                reviews: reviews.rows
            }
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};
