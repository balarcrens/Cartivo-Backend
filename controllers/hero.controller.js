const pool = require('../config/db');
const { uploadToImageKit } = require('../config/imagekit');

exports.getAllBanners = async (req, res) => {
    try {
        const banners = await pool.query('SELECT * FROM public.hero_banners ORDER BY display_order ASC, created_at DESC');
        res.status(200).json({ status: 'success', data: { banners: banners.rows } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.createBanner = async (req, res) => {
    try {
        let { title, subtitle, description, image_url, button_text, link_url, is_active, display_order } = req.body;
        
        if (image_url && image_url.startsWith('data:image')) {
            const uploadedUrl = await uploadToImageKit(image_url, '/HeroBanners', `hero-${Date.now()}`);
            image_url = uploadedUrl;
        }

        const newBanner = await pool.query(
            `INSERT INTO public.hero_banners (title, subtitle, description, image_url, button_text, link_url, is_active, display_order) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [title, subtitle, description, image_url, button_text || 'Shop Now', link_url, is_active ?? true, display_order || 0]
        );

        res.status(201).json({ status: 'success', data: { banner: newBanner.rows[0] } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.updateBanner = async (req, res) => {
    try {
        let { title, subtitle, description, image_url, button_text, link_url, is_active, display_order } = req.body;
        
        if (image_url && image_url.startsWith('data:image')) {
            const uploadedUrl = await uploadToImageKit(image_url, '/HeroBanners', `hero-${Date.now()}`);
            image_url = uploadedUrl;
        }

        const updatedBanner = await pool.query(
            `UPDATE public.hero_banners SET 
                title = $1, subtitle = $2, description = $3, image_url = $4, 
                button_text = $5, link_url = $6, is_active = $7, display_order = $8,
                updated_at = CURRENT_TIMESTAMP 
             WHERE id = $9 RETURNING *`,
            [title, subtitle, description, image_url, button_text, link_url, is_active, display_order, req.params.id]
        );

        if (updatedBanner.rowCount === 0) return res.status(404).json({ message: 'Banner not found' });
        res.status(200).json({ status: 'success', data: { banner: updatedBanner.rows[0] } });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.deleteBanner = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM public.hero_banners WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Banner not found' });
        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};
