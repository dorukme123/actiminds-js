const supertest = require('supertest');
const { expect } = require('chai');
const { app, limiter } = require('../server.js');

const request = supertest(app);

describe('Security Features', () => {
    // This hook runs after all tests in this file are done
    after(() => {
        // Reset the rate limit counter for our test key to not affect other tests
        if (limiter && limiter.store && typeof limiter.store.resetKey === 'function') {
        limiter.store.resetKey('test-key');
        }
    });

    describe('Rate Limiting', () => {
        it('should return 429 Too Many Requests after exceeding the limit', async () => {
        const requests = [];
        // Send 50 requests that should be allowed
        for (let i = 0; i < 50; i++) {
            requests.push(request.get('/api/ratelimit-test'));
        }
        await Promise.all(requests);

        // This 51st request should be blocked
        const res = await request.get('/api/ratelimit-test').expect(429);
        
        expect(res.body.message).to.include('Too many requests');

        }).timeout(10000);
    });
});