const jwt = require('jsonwebtoken');
const pool = require('../config/db');

exports.protect = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ message: 'No token provided, please login' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userResult = await pool.query('SELECT * FROM public.users WHERE id = $1', [decoded.id]);

        if (userResult.rowCount === 0) {
            return res.status(401).json({ message: 'The user belonging to this token no longer exists' });
        }

        req.user = userResult.rows[0];
        next();
    } catch (error) {
    console.error(error);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'You do not have permission to perform this action' });
        }
        next();
    };
};
