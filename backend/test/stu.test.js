const supertest = require('supertest');
const { expect } = require('chai');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { app } = require('../server.js');

const prisma = new PrismaClient();
const request = supertest(app);

describe('STU API - /api/stus', () => {
    let adminToken;
    let userToken;
    let validStu;

    before(async () => {
        // Clean up previous test data
        await prisma.userSession.deleteMany({});
        await prisma.stuLink.deleteMany({});
        await prisma.user.deleteMany({});
        await prisma.admin.deleteMany({});

        // Create an admin
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('adminpass', salt);
        await prisma.admin.create({
        data: { username: 'tokenmaster', password: hashedPassword, role: 'TokenGenerator' },
        });
        // Create a user
        await prisma.user.create({
            data: { name: 'Stu User', username: 'stuuser', email: 'stu@test.com', password: 'password123', referralCode: 'stu123' },
        });

        // Log in admin and user to get tokens
        const adminLoginRes = await request.post('/api/auth/admin/login').send({ username: 'tokenmaster', password: 'adminpass' });
        adminToken = adminLoginRes.body.token;
        const userLoginRes = await request.post('/api/auth/login').send({ emailOrUsername: 'stuuser', password: 'password123' });
        userToken = userLoginRes.body.token;
    });

    describe('POST /generate', () => {
        it('✅ should allow an authorized admin to generate 5 STU tokens', async () => {
        const res = await request
            .post('/api/stus/generate')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ count: 5, expiresIn: '7d' })
            .expect(201);

        // Assertions on the response
        expect(res.body).to.be.an('array').with.lengthOf(5);
        expect(res.body[0]).to.have.property('token');
        expect(res.body[0]).to.have.property('expiresAt');

        // Verify in the database
        const tokenCount = await prisma.stuLink.count();
        expect(tokenCount).to.equal(5);
        });
        
        it('❌ should return 401 Unauthorized if no token is provided', async () => {
            await request.post('/api/stus/generate').send({ count: 1 }).expect(401);
        });
    });

    describe('POST /validate', () => {
        // Before each validation test, ensure there is a fresh, valid STU
        beforeEach(async () => {
            await prisma.userSession.deleteMany({});
            await prisma.stuLink.deleteMany({});
            const res = await request.post('/api/stus/generate').set('Authorization', `Bearer ${adminToken}`).send({ count: 1 });
            validStu = res.body[0].token;
        });

        it('✅ should validate a correct, unused token', async () => {
            await request
                .post('/api/stus/validate')
                .set('Authorization', `Bearer ${userToken}`) // Authenticate as a user
                .send({ token: validStu })
                .expect(200);
            
            // Verify the token is marked as used in the DB
            const usedToken = await prisma.stuLink.findUnique({ where: { token: validStu } });
            expect(usedToken.used).to.be.true;
        });

        it('❌ should return 409 if the token has already been used', async () => {
            // Use the token once
            await request.post('/api/stus/validate').set('Authorization', `Bearer ${userToken}`).send({ token: validStu });
            
            // Try to use it again
            const res = await request
                .post('/api/stus/validate')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ token: validStu })
                .expect(409);
            
            expect(res.body.message).to.equal('This token has already been used.');
        });

        it('❌ should return 404 for a non-existent token', async () => {
            await request
                .post('/api/stus/validate')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ token: 'thisisafaketoken' })
                .expect(404);
        });

        it('❌ should return 401 if no user token is provided', async () => {
            await request
                .post('/api/stus/validate')
                .send({ token: validStu })
                .expect(401);
        });
    });
});