const pool = require('../config/db');

exports.getHomeData = async (req, res) => {
    try {
        const bannersPromise = pool.query("SELECT * FROM public.hero_banners WHERE is_active = true ORDER BY display_order ASC");

        const categoriesPromise = pool.query("SELECT * FROM public.categories WHERE status = 'active' AND parent_id IS NULL ORDER BY created_at LIMIT 10");

        const featuredPromise = pool.query(`
            SELECT p.*, b.name as brand_name 
            FROM public.products p 
            LEFT JOIN public.brands b ON p.brand_id = b.id 
            WHERE p.status = 'active' 
            ORDER BY p.created_at DESC 
            LIMIT 10
        `);
        
        const winterPromise = pool.query(`
            WITH RECURSIVE CategoryTree AS (
                SELECT id FROM public.categories 
                WHERE (slug ILIKE '%winter%' OR name ILIKE '%winter%')
                UNION ALL
                SELECT c.id FROM public.categories c
                JOIN CategoryTree ct ON c.parent_id = ct.id
            )
            SELECT p.*, b.name as brand_name 
            FROM public.products p 
            LEFT JOIN public.brands b ON p.brand_id = b.id
            WHERE p.category_id IN (SELECT id FROM CategoryTree)
            AND p.status = 'active' 
            LIMIT 10
        `);

        const trendingPromise = pool.query(`
            SELECT p.*, b.name as brand_name 
            FROM public.products p 
            LEFT JOIN public.brands b ON p.brand_id = b.id
            WHERE p.status = 'active' 
            ORDER BY RANDOM() LIMIT 10
        `);

        const groceryPromise = pool.query(`
            WITH RECURSIVE CategoryTree AS (
                SELECT id FROM public.categories 
                WHERE (slug ILIKE '%grocery%' OR name ILIKE '%grocery%')
                UNION ALL
                SELECT c.id FROM public.categories c
                JOIN CategoryTree ct ON c.parent_id = ct.id
            )
            SELECT p.*, b.name as brand_name 
            FROM public.products p 
            LEFT JOIN public.brands b ON p.brand_id = b.id
            WHERE p.category_id IN (SELECT id FROM CategoryTree)
            AND p.status = 'active' 
            LIMIT 10
        `);

        const homeAppliancesPromise = pool.query(`
            WITH RECURSIVE CategoryTree AS (
                SELECT id FROM public.categories 
                WHERE (slug ILIKE '%home-appliance%' OR name ILIKE '%home appliance%')
                UNION ALL
                SELECT c.id FROM public.categories c
                JOIN CategoryTree ct ON c.parent_id = ct.id
            )
            SELECT p.*, b.name as brand_name 
            FROM public.products p 
            LEFT JOIN public.brands b ON p.brand_id = b.id
            WHERE p.category_id IN (SELECT id FROM CategoryTree)
            AND p.status = 'active' 
            LIMIT 10
        `);

        const [banners, categories, featured, winter, trending, grocery, homeAppliances] = await Promise.all([
            bannersPromise, categoriesPromise, featuredPromise, winterPromise, trendingPromise, groceryPromise, homeAppliancesPromise
        ]);

        res.status(200).json({
            status: 'success',
            data: {
                heroBanners: banners.rows,
                categories: categories.rows,
                featuredArrivals: featured.rows,
                winterEssentials: winter.rows,
                trendingNow: trending.rows,
                groceryBestsellers: grocery.rows,
                homeAppliancesBestsellers: homeAppliances.rows
            }
        });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};
