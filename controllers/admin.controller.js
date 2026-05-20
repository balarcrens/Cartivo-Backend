const pool = require('../config/db');

exports.getDashboardStats = async (req, res) => {
    try {
        // Total Sales
        const totalSalesResult = await pool.query(
            "SELECT SUM(final_price) as total FROM orders WHERE payment_status = 'paid'"
        );
        const totalSales = parseFloat(totalSalesResult.rows[0].total || 0);

        // Total Orders
        const totalOrdersResult = await pool.query("SELECT COUNT(*) FROM orders");
        const totalOrders = parseInt(totalOrdersResult.rows[0].count);

        // Total Users
        const totalUsersResult = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'customer'");
        const totalUsers = parseInt(totalUsersResult.rows[0].count);

        // Total Products
        const totalProductsResult = await pool.query("SELECT COUNT(*) FROM products");
        const totalProducts = parseInt(totalProductsResult.rows[0].count);

        // Monthly Sales (simplified for now - last 6 months)
        const monthlySalesResult = await pool.query(`
            SELECT 
                TO_CHAR(created_at, 'Mon') as month,
                SUM(final_price) as amount
            FROM orders 
            WHERE created_at >= NOW() - INTERVAL '6 months'
            AND payment_status = 'paid'
            GROUP BY TO_CHAR(created_at, 'Mon'), DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at)
        `);

        res.status(200).json({
            status: 'success',
            data: {
                stats: {
                    totalSales,
                    totalOrders,
                    totalUsers,
                    totalProducts
                },
                monthlySales: monthlySalesResult.rows
            }
        });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.getRecentOrders = async (req, res) => {
    try {
        const recentOrders = await pool.query(`
            SELECT o.*, u.name as user_name, u.email as user_email 
            FROM orders o 
            LEFT JOIN users u ON o.user_id = u.id 
            ORDER BY o.created_at DESC 
            LIMIT 5
        `);
        
        res.status(200).json({
            status: 'success',
            data: {
                orders: recentOrders.rows
            }
        });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};
