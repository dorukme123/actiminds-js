const express = require('express');
const router = express.Router();
const { createAdmin, listAdmins, listUsers, deleteAdmin, deleteUser, changeAdminPassword, changeUserPassword, getDashboardStats, searchUsers } = require('../controllers/adminController');
const { adminOnly } = require('../middleware/authMiddleware');

// This route is protected and only accessible by Superadmins
router.post('/admins', adminOnly(['Superadmin']), createAdmin);
router.get('/admins', adminOnly(['Superadmin']), listAdmins);
router.get('/users', adminOnly(['Superadmin']), listUsers);
router.delete('/admins/:id', adminOnly(['Superadmin']), deleteAdmin);
router.delete('/users/:id', adminOnly(['Superadmin']), deleteUser);
router.put('/admins/:id/password', adminOnly(['Superadmin']), changeAdminPassword);
router.put('/users/:id/password', adminOnly(['Superadmin']), changeUserPassword);
router.get('/stats', adminOnly(['Superadmin', 'Admin']), getDashboardStats);
router.get('/users/search', adminOnly(['Superadmin', 'Admin']), searchUsers);

module.exports = router;