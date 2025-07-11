const {
  request,
  expect,
  bcrypt,
  PrismaClient,
} = require('./testHelper.js');

const prisma = new PrismaClient();

describe('User API - /api/users', () => {
    let token;

    // Before all tests in this suite, create a user and get a token
    before(async () => {
        // Clean up first
        await prisma.user.deleteMany({});
        // Create a user to log in
        await prisma.user.create({
        data: {
            name: 'Profile User',
            username: 'profileuser',
            email: 'profile@test.com',
            password: 'password123',
            referralCode: 'profile123',
        },
        });
        // Log in to get a token
        const res = await request.post('/api/auth/login').send({
        emailOrUsername: 'profileuser',
        password: 'password123',
        });
        token = res.body.token;
    });

    describe('GET /me', () => {
        it('✅ should fetch the user profile with a valid token', async () => {
        const res = await request
            .get('/api/users/me')
            .set('Authorization', `Bearer ${token}`) // Set the auth header
            .expect(200);

        expect(res.body).to.be.an('object');
        expect(res.body.username).to.equal('profileuser');
        expect(res.body).to.not.have.property('password'); // Ensure password is not sent
        });

        it('❌ should return 401 if no token is provided', async () => {
        await request.get('/api/users/me').expect(401);
        });

        it('❌ should return 401 if the token is invalid', async () => {
        await request
            .get('/api/users/me')
            .set('Authorization', 'Bearer thisisafaketoken')
            .expect(401);
        });
    });
});