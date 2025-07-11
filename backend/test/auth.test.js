const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
const bcrypt = require('bcryptjs');
const supertest = require('supertest');
const { expect } = require('chai');
const { PrismaClient } = require('@prisma/client');
const { app } = require(serverPath); // Using the path we just built and logged

const prisma = new PrismaClient();
const request = supertest(app);

describe('Auth API - /api/auth', () => {
    // Before each test, we clean the User table to ensure a fresh start.
    beforeEach(async () => {
        await prisma.user.deleteMany({});
    });

    describe('POST /register', () => {
        it('✅ should register a new user successfully and return a token', async () => {
        const newUser = {
            name: 'Test User',
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123',
        };

        const res = await request
            .post('/api/auth/register')
            .send(newUser)
            .expect(201); // Assert status code is 201 Created

        // Assertions on the response body
        expect(res.body).to.be.an('object');
        expect(res.body).to.have.property('token');
        expect(res.body.user.username).to.equal(newUser.username);

        // Verify user was actually created in the database
        const dbUser = await prisma.user.findUnique({ where: { email: newUser.email } });
        expect(dbUser).to.not.be.null;
        expect(dbUser.name).to.equal(newUser.name);
        });

        it('❌ should return 409 if the email already exists', async () => {
        // First, create a user
        await prisma.user.create({
            data: {
            name: 'Existing User',
            username: 'existinguser',
            email: 'exists@example.com',
            password: 'password123',
            referralCode: 'abcde123',
            },
        });

        // Then, attempt to register with the same email
        const duplicateUser = {
            name: 'Another User',
            username: 'anotheruser',
            email: 'exists@example.com',
            password: 'password456',
        };

        const res = await request
            .post('/api/auth/register')
            .send(duplicateUser)
            .expect(409); // Assert status code is 409 Conflict

        expect(res.body.message).to.equal('Email or username already exists.');
        });

        it('❌ should return 400 if required fields are missing', async () => {
        const incompleteUser = {
            name: 'Test User',
            email: 'test@example.com',
            // Password is intentionally missing
        };

        const res = await request
            .post('/api/auth/register')
            .send(incompleteUser)
            .expect(400); // Assert status code is 400 Bad Request

        expect(res.body.message).to.equal('All fields are required.');
        });
    });

    describe('POST /login', () => {
        // Before each login test, we need a user to exist in the database.
        beforeEach(async () => {
        await prisma.user.create({
            data: {
            name: 'Login Test User',
            username: 'logintest',
            email: 'login@test.com',
            password: 'password123', // Plaintext password
            referralCode: 'login123',
            },
        });
        });

        it('✅ should log in an existing user with email and return a token', async () => {
        const res = await request
            .post('/api/auth/login')
            .send({
            emailOrUsername: 'login@test.com',
            password: 'password123',
            })
            .expect(200);

        expect(res.body).to.have.property('token');
        expect(res.body.user.username).to.equal('logintest');
        });

        it('✅ should log in an existing user with username and return a token', async () => {
            const res = await request
            .post('/api/auth/login')
            .send({
                emailOrUsername: 'logintest',
                password: 'password123',
            })
            .expect(200);
    
            expect(res.body).to.have.property('token');
        });

        it('❌ should return 401 for an incorrect password', async () => {
        const res = await request
            .post('/api/auth/login')
            .send({
            emailOrUsername: 'login@test.com',
            password: 'wrongpassword',
            })
            .expect(401);

        expect(res.body.message).to.equal('Invalid credentials.');
        });

        it('❌ should return 401 for a non-existent user', async () => {
        const res = await request
            .post('/api/auth/login')
            .send({
            emailOrUsername: 'nouser@test.com',
            password: 'password123',
            })
            .expect(401);

        expect(res.body.message).to.equal('Invalid credentials.');
        });
    });

    describe('POST /admin/login', () => {
        // Before tests, create an admin user with a hashed password
        before(async () => {
        await prisma.admin.deleteMany({}); // Clean up admins first
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('adminpass', salt);

        await prisma.admin.create({
            data: {
            username: 'testadmin',
            password: hashedPassword,
            role: 'Admin',
            },
        });
        });

        it('✅ should log in an existing admin with correct credentials', async () => {
        const res = await request
            .post('/api/auth/admin/login')
            .send({ username: 'testadmin', password: 'adminpass' })
            .expect(200);

        expect(res.body).to.have.property('token');
        });

        it('❌ should return 401 for an admin with an incorrect password', async () => {
        await request
            .post('/api/auth/admin/login')
            .send({ username: 'testadmin', password: 'wrongpassword' })
            .expect(401);
        });
    });
});