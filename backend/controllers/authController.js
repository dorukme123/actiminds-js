// backend/controllers/authController.js
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function generateUniqueReferralCode() {
    let referralCode;
    let isUnique = false;
    while (!isUnique) {
        referralCode = crypto.randomBytes(8).toString('hex');
        const existingUser = await prisma.user.findUnique({
        where: { referralCode },
        });
        if (!existingUser) {
        isUnique = true;
        }
    }
    return referralCode;
}

exports.registerUser = async (req, res) => {
    try {
        const { name, username, email, password, referredByCode } = req.body;

        // 1. Basic Validation
        if (!name || !username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
        }

        // 2. Check if username or email already exist
        const existingUser = await prisma.user.findFirst({
        where: {
            OR: [{ email: email.toLowerCase() }, { username }],
        },
        });

        if (existingUser) {
        return res.status(409).json({ message: 'Email or username already exists.' });
        }

        // 3. Handle incoming referral
        let referrerId = null;
        if (referredByCode) {
        const referrer = await prisma.user.findUnique({
            where: { referralCode: referredByCode },
        });
        if (referrer) {
            referrerId = referrer.id;
        }
        }

        // 4. Generate a unique referral code for the new user
        const newUserReferralCode = await generateUniqueReferralCode();

        // 5. Create the new user in the database
        const newUser = await prisma.user.create({
        data: {
            name,
            username,
            email: email.toLowerCase(),
            password, // Storing password in plaintext as per instructions
            referralCode: newUserReferralCode,
            referredById: referrerId,
            isVerified: true, // Auto-verified as in the original app
        },
        });

        // 6. Generate a JWT for the new user
        const token = jwt.sign(
        { userId: newUser.id },
        process.env.JWT_SECRET,
        { expiresIn: '8h' } // Token expires in 8 hours
        );

        // 7. Send the response
        res.status(201).json({
        message: `Account for ${newUser.username} created successfully!`,
        token,
        user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
        },
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'An error occurred during registration.' });
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { emailOrUsername, password } = req.body;

        // 1. Basic validation
        if (!emailOrUsername || !password) {
        return res.status(400).json({ message: 'Email/username and password are required.' });
        }

        // 2. Find the user by either email or username
        const user = await prisma.user.findFirst({
        where: {
            OR: [
            { email: emailOrUsername.toLowerCase() },
            { username: emailOrUsername }
            ],
        },
        });

        // 3. Validate user and password
        // Note: A generic error message is used for both cases to prevent user enumeration.
        if (!user || user.password !== password) {
        return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        // 4. Check if user is verified (as in original app)
        if (!user.isVerified) {
            return res.status(403).json({ message: 'User account is not verified.' });
        }

        // 5. Generate a JWT for the user
        const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
        );

        // 6. Send the response
        res.status(200).json({
        message: `Welcome back, ${user.username}!`,
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
        },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'An error occurred during login.' });
    }
};

exports.loginAdmin = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
        }

        // 1. Find the admin by username
        const admin = await prisma.admin.findUnique({
        where: { username },
        });

        // 2. Validate admin exists and password is correct
        if (admin && (await bcrypt.compare(password, admin.password))) {
        // 3. Generate a JWT with admin details in the payload
        const token = jwt.sign(
            { adminId: admin.id, role: admin.role }, // Payload includes role
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        // 4. Send response
        res.status(200).json({
            message: `Admin ${admin.username} logged in successfully!`,
            token,
        });
        } else {
        // Generic error for security
        return res.status(401).json({ message: 'Invalid credentials.' });
        }
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ message: 'An error occurred during admin login.' });
    }
};