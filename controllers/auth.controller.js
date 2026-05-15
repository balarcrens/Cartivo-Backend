const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/db');
const { sendEmail, getResetPasswordTemplate } = require('../utils/email');

const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '90d',
    });
};

exports.signup = async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 12);

        const newUser = await pool.query(
            'INSERT INTO public.users (name, email, password, phone, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role',
            [name, email, hashedPassword, phone, role || 'customer']
        );

        const token = signToken(newUser.rows[0].id);

        res.status(201).json({
            status: 'success',
            token,
            data: { user: newUser.rows[0] }
        });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Please provide email and password' });
        }

        const userResult = await pool.query('SELECT * FROM public.users WHERE email = $1', [email]);
        const user = userResult.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Incorrect email or password' });
        }

        const token = signToken(user.id);
        user.password = undefined;

        res.status(200).json({
            status: 'success',
            token,
            data: { user }
        });
    } catch (error) {
    console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Please provide an email address' });
        }

        const userResult = await pool.query('SELECT id, name, email FROM public.users WHERE email = $1', [email]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'There is no user with that email address' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');

        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expires = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

        await pool.query(
            'UPDATE public.users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3',
            [hashedToken, expires, user.id]
        );

        const resetURL = `${process.env.FRONTEND_URL}/auth/reset-password/${resetToken}`;
        
        try {
            await sendEmail({
                email: user.email,
                subject: 'Reset Password Request - Cartivo',
                html: getResetPasswordTemplate(resetURL, user.name)
            });

            res.status(200).json({
                status: 'success',
                message: 'Token sent to email!'
            });
        } catch (err) {
            // If email fails, clear token fields
            await pool.query(
                'UPDATE public.users SET reset_password_token = NULL, reset_password_expires = NULL WHERE id = $1',
                [user.id]
            );
            console.error('ERROR SENDING EMAIL:', err);
            return res.status(500).json({ 
                status: 'error',
                message: 'There was an error sending the email. Try again later',
                error: err.message // Send error message for easier debugging
            });
        }
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        const userResult = await pool.query(
            'SELECT id FROM public.users WHERE reset_password_token = $1 AND reset_password_expires > $2',
            [hashedToken, new Date()]
        );
        const user = userResult.rows[0];

        if (!user) {
            return res.status(400).json({ message: 'Token is invalid or has expired' });
        }

        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ message: 'Please provide a new password' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await pool.query(
            'UPDATE public.users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
            [hashedPassword, user.id]
        );

        const token = signToken(user.id);

        res.status(200).json({
            status: 'success',
            token
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};
