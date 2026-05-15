const pool = require('../config/db');

const submitContactMessage = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ status: 'error', message: 'Please provide name, email, and message' });
        }

        const result = await pool.query(
            'INSERT INTO public.contact_messages (name, email, subject, message) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, email, subject, message]
        );

        res.status(201).json({
            status: 'success',
            data: result.rows[0],
            message: 'Message sent successfully'
        });
    } catch (err) {
        console.error('Error submitting contact message:', err);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};

const getAllContactMessages = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM public.contact_messages ORDER BY created_at DESC');
        res.status(200).json({
            status: 'success',
            results: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        console.error('Error fetching contact messages:', err);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};

const updateContactStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const result = await pool.query(
            'UPDATE public.contact_messages SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Message not found' });
        }

        res.status(200).json({
            status: 'success',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Error updating contact status:', err);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};

const deleteContactMessage = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query('DELETE FROM public.contact_messages WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Message not found' });
        }

        res.status(200).json({
            status: 'success',
            message: 'Message deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting contact message:', err);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};

module.exports = {
    submitContactMessage,
    getAllContactMessages,
    updateContactStatus,
    deleteContactMessage
};
