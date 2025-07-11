const {
  request,
  expect,
  bcrypt,
  PrismaClient,
} = require('./testHelper.js');

const prisma = new PrismaClient();

describe('Admin Management API - /api/admin', () => {
    let superAdminToken;
    let regularAdminToken;
    let superAdminId;
    let regularAdminId;
    let testUserId;

    before(async () => {
        // Clean up admins
        await prisma.admin.deleteMany({});
        
        // Create a Superadmin and a regular Admin
        const salt = await bcrypt.genSalt(10);
        const superAdminPassword = await bcrypt.hash('superpass', salt);
        const regularAdminPassword = await bcrypt.hash('regpass', salt);

        await prisma.admin.createMany({
        data: [
            { username: 'superadmin', password: superAdminPassword, role: 'Superadmin' },
            { username: 'regularadmin', password: regularAdminPassword, role: 'Admin' },
        ],
        });

        // Log in both to get tokens
        const superAdminRes = await request.post('/api/auth/admin/login').send({ username: 'superadmin', password: 'superpass' });
        superAdminToken = superAdminRes.body.token;

        const regularAdminRes = await request.post('/api/auth/admin/login').send({ username: 'regularadmin', password: 'regpass' });
        regularAdminToken = regularAdminRes.body.token;

        const superAdmin = await prisma.admin.findUnique({ where: { username: 'superadmin' } });
        superAdminId = superAdmin.id;

        const regularAdmin = await prisma.admin.findUnique({ where: { username: 'regularadmin' } });
        regularAdminId = regularAdmin.id;

        await prisma.user.deleteMany({});
        await prisma.user.createMany({
            data: [
                { name: 'User One', username: 'userone', email: 'one@test.com', password: 'password', referralCode: 'user1' },
                { name: 'User Two', username: 'usertwo', email: 'two@test.com', password: 'password', referralCode: 'user2' },
            ]
        });
        const userForPassChange = await prisma.user.create({
            data: { name: 'Test User', username: 'testuser', email: 'user@test.com', password: 'password', referralCode: 'usertest1' },
        });
        testUserId = userForPassChange.id;
    });

    describe('POST /admins', () => {
        it('✅ should allow a Superadmin to create a new Admin', async () => {
        const newAdminData = {
            username: 'newlycreated',
            password: 'newpassword123',
            role: 'Admin',
        };

        const res = await request
            .post('/api/admin/admins')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send(newAdminData)
            .expect(201);

        expect(res.body.username).to.equal(newAdminData.username);
        expect(res.body.role).to.equal(newAdminData.role);
        });

        it('❌ should return 403 Forbidden if a non-Superadmin tries to create an admin', async () => {
        await request
            .post('/api/admin/admins')
            .set('Authorization', `Bearer ${regularAdminToken}`) // Using regular admin token
            .send({ username: 'anotheradmin', password: 'password', role: 'Admin' })
            .expect(403);
        });

        it('❌ should return 409 Conflict if the admin username already exists', async () => {
        await request
            .post('/api/admin/admins')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ username: 'newlycreated', password: 'password', role: 'Admin' })
            .expect(409);
        });
        
        it('❌ should return 400 Bad Request if the role is invalid', async () => {
            await request
            .post('/api/admin/admins')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ username: 'invalidroleadmin', password: 'password', role: 'InvalidRole' })
            .expect(400);
        });
    });

    describe('GET /admins', () => {
            it('✅ should allow a Superadmin to fetch a list of all admins', async () => {
                const res = await request
                    .get('/api/admin/admins')
                    .set('Authorization', `Bearer ${superAdminToken}`)
                    .expect(200);
                
                expect(res.body).to.be.an('array');
                expect(res.body.length).to.be.at.least(2); // superadmin and regularadmin
                expect(res.body[0]).to.not.have.property('password');
            });

            it('❌ should return 403 Forbidden if a non-Superadmin tries to fetch admins', async () => {
                await request
                    .get('/api/admin/admins')
                    .set('Authorization', `Bearer ${regularAdminToken}`)
                    .expect(403);
            });
        });

    describe('GET /users', () => {
        it('✅ should allow a Superadmin to fetch a list of all users', async () => {
            const res = await request
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .expect(200);
            
            expect(res.body).to.be.an('array').with.lengthOf(3);
        });
    });

    describe('DELETE /admins/:id', () => {
        it('✅ should allow a Superadmin to delete another admin', async () => {
            // Create a disposable admin to delete
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('deleteme', salt);
            const tempAdmin = await prisma.admin.create({
                data: { username: 'deletableadmin', password: hashedPassword, role: 'Admin' },
            });

            await request
                .delete(`/api/admin/admins/${tempAdmin.id}`)
                .set('Authorization', `Bearer ${superAdminToken}`)
                .expect(200);
        });

        it('❌ should prevent a Superadmin from deleting themselves', async () => {
            await request
                .delete(`/api/admin/admins/${superAdminId}`) // Use the stored ID
                .set('Authorization', `Bearer ${superAdminToken}`)
                .expect(400);
        });
    });

    describe('DELETE /users/:id', () => {
        it('✅ should allow a Superadmin to delete a user', async () => {
            // Create a disposable user
            const tempUser = await prisma.user.create({
                data: { name: 'Delete Me', username: 'deleteme', email: 'delete@me.com', password: 'password', referralCode: 'deleteme1' },
            });

            await request
                .delete(`/api/admin/users/${tempUser.id}`)
                .set('Authorization', `Bearer ${superAdminToken}`)
                .expect(200);
            
            // Verify user is gone from DB
            const userInDb = await prisma.user.findUnique({ where: { id: tempUser.id } });
            expect(userInDb).to.be.null;
        });
    });

    describe('PUT /admins/:id/password', () => {
        it('✅ should allow a Superadmin to change another admin\'s password', async () => {
            await request
                .put(`/api/admin/admins/${regularAdminId}/password`)
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send({ password: 'newsecurepassword' })
                .expect(200);

            // Verify by logging in with the new password
            await request
                .post('/api/auth/admin/login')
                .send({ username: 'regularadmin', password: 'newsecurepassword' })
                .expect(200);
        });
    });

    describe('PUT /users/:id/password', () => {
        it('✅ should allow a Superadmin to change a user\'s password', async () => {
            await request
                .put(`/api/admin/users/${testUserId}/password`)
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send({ password: 'newuserpassword' })
                .expect(200);

            // Verify by logging in with the new password
            await request
                .post('/api/auth/login')
                .send({ emailOrUsername: 'testuser', password: 'newuserpassword' })
                .expect(200);
        });
    });

    describe('GET /stats', () => {
        before(async () => {
            // Setup data for stats calculation
            await prisma.stuLink.deleteMany({});
            await prisma.stuLink.createMany({
                data: [
                    { token: 'token1', expiresAt: new Date(), used: true },
                    { token: 'token2', expiresAt: new Date(), used: false },
                    { token: 'token3', expiresAt: new Date(), used: false },
                ]
            });
        });

        it('✅ should allow a Superadmin to fetch dashboard statistics', async () => {
            const res = await request
                .get('/api/admin/stats')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .expect(200);

            expect(res.body.totalUsers).to.equal(3);
            expect(res.body.totalTokens).to.equal(3);
            expect(res.body.usedTokens).to.equal(1);
            expect(res.body.unusedTokens).to.equal(2);
        });

        it('✅ should allow an Admin to fetch dashboard statistics', async () => {
            await request
                .get('/api/admin/stats')
                .set('Authorization', `Bearer ${regularAdminToken}`)
                .expect(200);
        });
    });

    describe('GET /users/search', () => {
        it('✅ should find users by a partial username match', async () => {
            const res = await request
                .get('/api/admin/users/search?by=username&term=user')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .expect(200);
            
            expect(res.body).to.be.an('array').with.lengthOf(3);
        });

        it('✅ should find a single user by their full email', async () => {
            const res = await request
                .get('/api/admin/users/search?by=email&term=one@test.com')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .expect(200);
            
            expect(res.body).to.be.an('array').with.lengthOf(1);
            expect(res.body[0].username).to.equal('userone');
        });

        it('✅ should return an empty array for a search with no matches', async () => {
            const res = await request
                .get('/api/admin/users/search?by=username&term=nomatch')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .expect(200);
            
            expect(res.body).to.be.an('array').with.lengthOf(0);
        });

        it('❌ should return 400 if search parameters are missing', async () => {
            await request
                .get('/api/admin/users/search?by=username') // missing 'term'
                .set('Authorization', `Bearer ${superAdminToken}`)
                .expect(400);
        });
    });
});