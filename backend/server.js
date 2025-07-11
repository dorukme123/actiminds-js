// backend/server.js
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/userRoutes');
const stuRoutes = require('./routes/stuRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rate Limiter Middleware
const limiter = rateLimit({
	windowMs: config.rateLimit.windowMs, // <-- Use config value
	max: config.rateLimit.max,           // <-- Use config value
	standardHeaders: true,
	legacyHeaders: false,
    message: { message: `Too many requests from this IP, please try again after ${config.rateLimit.windowMs / 60000} minutes` },
});
app.use('/api', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stus', stuRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 5000;

// Only start listening if the file is run directly (not imported)
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}

// Export the app for testing purposes
module.exports = app;