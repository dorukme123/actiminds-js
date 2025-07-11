const { PrismaClient, AdminRole } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const createAdmin = async (req, res) => {
    try {
        const { username, password, role } = req.body;

        // 1. Validation
        if (!username || !password || !role) {
        return res.status(400).json({ message: 'Username, password, and role are required.' });
        }

        // Check if the provided role is a valid enum value
        if (!Object.values(AdminRole).includes(role)) {
            return res.status(400).json({ message: 'Invalid role provided.' });
        }

        const adminExists = await prisma.admin.findUnique({
        where: { username },
        });

        if (adminExists) {
        return res.status(409).json({ message: 'Admin username already exists.' });
        }

        // 2. Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Create the new admin
        const newAdmin = await prisma.admin.create({
        data: {
            username,
            password: hashedPassword,
            role,
        },
        });

        // 4. Send response (excluding password)
        res.status(201).json({
        id: newAdmin.id,
        username: newAdmin.username,
        role: newAdmin.role,
        });
    } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({ message: 'An error occurred while creating the admin.' });
    }
};

const listAdmins = async (req, res) => {
    try {
        const admins = await prisma.admin.findMany({
        orderBy: { username: 'asc' },
        select: {
            id: true,
            username: true,
            role: true,
        },
        });
        res.status(200).json(admins);
    } catch (error) {
        console.error('List admins error:', error);
        res.status(500).json({ message: 'An error occurred while fetching admins.' });
    }
};

const listUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { registeredAt: 'desc' },
            select: {
            id: true,
            name: true,
            username: true,
            email: true,
            registeredAt: true,
            isVerified: true,
            referralCode: true,
            },
        });
        res.status(200).json(users);
    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({ message: 'An error occurred while fetching users.' });
    }
};

const deleteAdmin = async (req, res) => {
    try {
        const adminIdToDelete = parseInt(req.params.id);
        const loggedInAdminId = req.admin.id; // From adminOnly middleware

        // Prevent a superadmin from deleting themselves
        if (adminIdToDelete === loggedInAdminId) {
        return res.status(400).json({ message: 'You cannot delete your own account.' });
        }

        // Check if admin to be deleted exists
        const admin = await prisma.admin.findUnique({ where: { id: adminIdToDelete } });
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found.' });
        }

        await prisma.admin.delete({ where: { id: adminIdToDelete } });

        res.status(200).json({ message: 'Admin account deleted successfully.' });
    } catch (error) {
        console.error('Delete admin error:', error);
        res.status(500).json({ message: 'An error occurred while deleting the admin.' });
    }
};

const deleteUser = async (req, res) => {
    try {
        const userIdToDelete = parseInt(req.params.id);
        
        // Check if user to be deleted exists
        const user = await prisma.user.findUnique({ where: { id: userIdToDelete } });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        await prisma.user.delete({ where: { id: userIdToDelete } });

        res.status(200).json({ message: 'User account deleted successfully.' });
    } catch (error)
    {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'An error occurred while deleting the user.' });
    }
};

const changeAdminPassword = async (req, res) => {
    try {
        const { password } = req.body;
        const adminIdToUpdate = parseInt(req.params.id);

        if (!password || password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
        }
        
        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await prisma.admin.update({
        where: { id: adminIdToUpdate },
        data: { password: hashedPassword },
        });

        res.status(200).json({ message: "Admin's password updated successfully." });
    } catch (error) {
        console.error('Change admin password error:', error);
        res.status(500).json({ message: 'An error occurred while updating the password.' });
    }
};

const changeUserPassword = async (req, res) => {
    try {
        const { password } = req.body;
        const userIdToUpdate = parseInt(req.params.id);
    
        if (!password || password.length < 8) {
          return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
        }
    
        await prisma.user.update({
          where: { id: userIdToUpdate },
          // Storing password in plaintext as per original instruction
          data: { password: password }, 
        });
    
        res.status(200).json({ message: "User's password updated successfully." });
      } catch (error) {
        console.error('Change user password error:', error);
        res.status(500).json({ message: 'An error occurred while updating the password.' });
      }
};

const getDashboardStats = async (req, res) => {
    try {
        // Run count queries in parallel using a transaction
        const [totalUsers, totalTokens, usedTokens] = await prisma.$transaction([
        prisma.user.count(),
        prisma.stuLink.count(),
        prisma.stuLink.count({ where: { used: true } }),
        ]);

        const stats = {
        totalUsers,
        totalTokens,
        usedTokens,
        unusedTokens: totalTokens - usedTokens,
        };

        res.status(200).json(stats);
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ message: 'An error occurred while fetching statistics.' });
    }
};

const searchUsers = async (req, res) => {
    try {
        const { by, term } = req.query;

        // 1. Validation
        if (!by || !term) {
        return res.status(400).json({ message: 'Search parameters "by" and "term" are required.' });
        }
        if (!['username', 'email'].includes(by)) {
        return res.status(400).json({ message: 'Search parameter "by" must be either "username" or "email".' });
        }

        // 2. Perform a case-insensitive search
        const users = await prisma.user.findMany({
        where: {
            [by]: { // Using computed property name to search on the 'by' field
            contains: term,
            mode: 'insensitive', // Case-insensitive search
            },
        },
        select: { 
            id: true,
            name: true,
            username: true,
            email: true,
            password: true,
            registeredAt: true,
        },
        });

        res.status(200).json(users);
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ message: 'An error occurred during user search.' });
    }
};

module.exports = { createAdmin, listAdmins, listUsers, deleteAdmin, deleteUser, changeAdminPassword, changeUserPassword, getDashboardStats, searchUsers };