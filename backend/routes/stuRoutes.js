const express = require('express');
const router = express.Router();
const { generateStuTokens, validateStuToken } = require('../controllers/stuController');
const { adminOnly, protect } = require('../middleware/authMiddleware');

const allowedRoles = ['Superadmin', 'Admin', 'TokenGenerator'];

// This route is protected by the adminOnly middleware
router.post('/generate', adminOnly(allowedRoles), generateStuTokens);
router.post('/validate', protect, validateStuToken);

module.exports = router;