const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const generateStuTokens = async (req, res) => {
    try {
        const { count = 1, expiresIn = '1h' } = req.body;
        const creatorId = req.admin.id; // From the adminOnly middleware

        if (count <= 0 || count > 50) { // Limit generation count
        return res.status(400).json({ message: 'Count must be between 1 and 50.' });
        }

        // Simple parser for expiresIn string (e.g., '1h', '7d', '30m')
        const calculateExpiryDate = (duration) => {
        const now = new Date();
        const value = parseInt(duration.slice(0, -1));
        const unit = duration.slice(-1).toLowerCase();

        switch (unit) {
            case 'h': return new Date(now.setHours(now.getHours() + value));
            case 'd': return new Date(now.setDate(now.getDate() + value));
            case 'm': return new Date(now.setMinutes(now.getMinutes() + value));
            default: return new Date(now.setHours(now.getHours() + 1)); // Default to 1 hour
        }
        };

        const newTokensData = [];
        for (let i = 0; i < count; i++) {
            // Loop to ensure token is unique, though collisions are highly unlikely
            let token;
            let isUnique = false;
            while (!isUnique) {
                token = crypto.randomBytes(16).toString('hex');
                const existingToken = await prisma.stuLink.findUnique({ where: { token } });
                if (!existingToken) isUnique = true;
            }

        newTokensData.push({
            token,
            expiresAt: calculateExpiryDate(expiresIn),
            creatorId,
        });
    }

    // Create all tokens in a single database transaction
    await prisma.stuLink.createMany({
        data: newTokensData,
    });

    res.status(201).json(newTokensData);

    } catch (error) {
        console.error('STU generation error:', error);
        res.status(500).json({ message: 'An error occurred during token generation.' });
    }
};

const validateStuToken = async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.id; // From the 'protect' user middleware

        if (!token) {
        return res.status(400).json({ message: 'Token is required.' });
        }

        // 1. Find the token in the database
        const stuLink = await prisma.stuLink.findUnique({
        where: { token },
        });

        // 2. Perform validation checks
        if (!stuLink) {
        return res.status(404).json({ message: 'Invalid token.' });
        }
        if (stuLink.used) {
        return res.status(409).json({ message: 'This token has already been used.' });
        }
        if (new Date() > new Date(stuLink.expiresAt)) {
        return res.status(410).json({ message: 'This token has expired.' });
        }

        // 3. Use a transaction to mark token as used and create a user session
        const [updatedLink, newSession] = await prisma.$transaction([
        prisma.stuLink.update({
            where: { id: stuLink.id },
            data: { used: true, usedAt: new Date() },
        }),
        prisma.userSession.create({
            data: {
            userId,
            stuLinkId: stuLink.id,
            },
        }),
        ]);
        
        // In the future, we could issue a new, short-lived JWT here
        // For now, a success message is sufficient
        res.status(200).json({ message: 'Token validated successfully. Access granted.' });

    } catch (error) {
        console.error('STU validation error:', error);
        res.status(500).json({ message: 'An error occurred during token validation.' });
    }
};

module.exports = { generateStuTokens, validateStuToken };