require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
// For Local
// require('./db/createDB');

const pool = require('./config/db');
const authRouter = require('./routes/auth.routes');
const productRouter = require('./routes/product.routes');
const categoryRouter = require('./routes/category.routes');
const brandRouter = require('./routes/brand.routes');
const vendorRouter = require('./routes/vendor.routes');
const orderRouter = require('./routes/order.routes');
const cartRouter = require('./routes/cart.routes');
const userRouter = require('./routes/user.routes');
const variantRouter = require('./routes/variant.routes');
const addressRouter = require('./routes/address.routes');
const couponRouter = require('./routes/coupon.routes');
const reviewRouter = require('./routes/review.routes');
const adminRouter = require('./routes/admin.routes');
const homeRouter = require('./routes/home.routes');
const heroRouter = require('./routes/hero.routes');
const contactRouter = require('./routes/contact.routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/products', productRouter);
app.use('/api/v1/categories', categoryRouter);
app.use('/api/v1/brands', brandRouter);
app.use('/api/v1/vendors', vendorRouter);
app.use('/api/v1/orders', orderRouter);
app.use('/api/v1/cart', cartRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/variants', variantRouter);
app.use('/api/v1/addresses', addressRouter);
app.use('/api/v1/coupons', couponRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/home', homeRouter);
app.use('/api/v1/hero', heroRouter);
app.use('/api/v1/contacts', contactRouter);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ status: 'OK', server_time: result.rows[0].now });
    } catch (err) {
        res.status(500).json({ status: 'Error', message: err.message });
    }
});

app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ status: 'error', message: err.message || 'Something went wrong' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});