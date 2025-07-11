const { request, expect, requestCounter } = require('./testHelper.js');
const config = require('../config');

describe('Security Features (Final Test)', () => {
  describe('Rate Limiting', () => {
    it('should use up the remaining requests and then fail with 429', async () => {
        // This should match the 'max' setting in your server.js
        const maxRequests = config.rateLimit.max;
        const currentRequestCount = requestCounter.getCount();
        
        console.log(`\n--- Rate Limit Test ---`);
        console.log(`Rate limit is set to ${maxRequests}.`);
        console.log(`Previous tests have made ${currentRequestCount} requests.`);

        const requestsToReachLimit = maxRequests - currentRequestCount;
        
        if (requestsToReachLimit >= 0) {
          console.log(`Making ${requestsToReachLimit} more requests to reach the limit...`);
          for (let i = 0; i < requestsToReachLimit; i++) {
            // We hit a non-existent endpoint; a 404 response is fine.
            await request.get('/api/filler-request');
          }
        }
        
        console.log(`Limit reached. Making one final request, which should be blocked...`);
        // This final request should be the one that gets the 429 error.
        const res = await request.get('/api/final-request').expect(429);
        
        expect(res.body.message).to.include('Too many requests');
        console.log(`Successfully received 429. Test passed.`);
        console.log(`--- End Rate Limit Test ---\n`);

      }).timeout(20000); // Give this test a long timeout
    });
});