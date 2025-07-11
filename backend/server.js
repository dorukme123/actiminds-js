// backend/server.js
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
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
	windowMs: 300000, // 5 minutes (user's setting)
	max: 50,
	standardHeaders: true,
	legacyHeaders: false,
    message: { message: 'Too many requests from this IP, please try again after 5 minutes' },
    
    // --- Add this function ---
    keyGenerator: (req, res) => {
        // Use a static key for all requests in the test environment
        if (process.env.NODE_ENV === 'test') {
          return 'test-key';
        }
        // Use the default IP address for production/development
        return req.ip;
      },
    // --- End of addition ---
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
module.exports = { app, limiter };