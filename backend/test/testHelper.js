// backend/test/testHelper.js
const supertest = require('supertest');
const app = require('../server.js');

// This object will count every request made during the entire test run.
const requestCounter = {
  count: 0,
  increment() { this.count++; },
  getCount() { return this.count; },
};

// We create a single agent to make all our requests.
const agent = supertest.agent(app);

// We then "patch" the agent's methods (get, post, etc.) to automatically
// increment our counter every time a request is made.
const originalGet = agent.get;
agent.get = function(...args) {
  requestCounter.increment();
  return originalGet.apply(this, args);
};

const originalPost = agent.post;
agent.post = function(...args) {
  requestCounter.increment();
  return originalPost.apply(this, args);
};

const originalPut = agent.put;
agent.put = function(...args) {
  requestCounter.increment();
  return originalPut.apply(this, args);
};

const originalDelete = agent.delete;
agent.delete = function(...args) {
  requestCounter.increment();
  return originalDelete.apply(this, args);
};

// Finally, we export everything our tests will need from this one file.
module.exports = {
  request: agent,
  requestCounter,
  expect: require('chai').expect,
  bcrypt: require('bcryptjs'),
  PrismaClient: require('@prisma/client').PrismaClient,
};