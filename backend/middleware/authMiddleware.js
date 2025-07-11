const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const protect = async (req, res, next) => {
    let token;

    // Check for the token in the Auth header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
        token = req.headers.authorization.split(' ')[1]; // Get token from header "Bearer <token>"

        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify

        // 4. Get user from the token's payload and attach to request object
        // Exclude the password from the user object that gets attached
        req.user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
            id: true,
            name: true,
            username: true,
            email: true,
            registeredAt: true,
            referralCode: true,
            },
        });

        // 5. Proceed to the next middleware/route handler
        next();
        } catch (error) {
        console.error(error);
        return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const adminOnly = (allowedRoles = []) => async (req, res, next) => {
    let token;
  
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
    
            // Verify the token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
            // Check if it's an admin token and has the required role
            if (!decoded.adminId || !decoded.role) {
            return res.status(401).json({ message: 'Not authorized, not an admin token' });
            }
    
            // Superadmin has all permissions
            if (decoded.role !== 'Superadmin' && !allowedRoles.includes(decoded.role)) {
                return res.status(403).json({ message: 'Forbidden: You do not have the required role.' });
            }

            // Attach admin to the request
            req.admin = await prisma.admin.findUnique({
            where: { id: decoded.adminId },
            });

            if (!req.admin) {
                return res.status(401).json({ message: 'Not authorized, admin not found' });
            }
    
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }
  
    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

module.exports = { protect, adminOnly };