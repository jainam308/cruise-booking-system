/**
 * auth.test.js
 *
 * Tests for authentication and authorization:
 * - Registration with password hashing
 * - Login validation & JWT generation
 * - Role enforcement (admin, agent, customer)
 * - Protected profile retrieval
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const User = require('../src/models/User');

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = 'test-jwt-secret-123';

  await mongoose.connect(uri);
  app = require('../src/index');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('Authentication & Authorization Flow', () => {

  test('POST /api/auth/register — registers customer with hashed password and returns token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice Johnson',
      email: 'alice@example.com',
      password: 'SecurePassword123',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.role).toBe('customer');

    // Verify password is not plaintext in DB
    const savedUser = await User.findOne({ email: 'alice@example.com' });
    expect(savedUser.password).not.toBe('SecurePassword123');
    expect(savedUser.password.startsWith('$2')).toBe(true);
  });

  test('POST /api/auth/register — prevents self-escalation to admin role (forces customer)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Hacker Attempt',
      email: 'hacker@example.com',
      password: 'Password123',
      role: 'admin',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('customer');
  });

  test('POST /api/auth/register — rejects invalid email or short password', async () => {
    const invalidEmailRes = await request(app).post('/api/auth/register').send({
      name: 'Test',
      email: 'invalid-email',
      password: 'Password123',
    });
    expect(invalidEmailRes.status).toBe(400);

    const shortPassRes = await request(app).post('/api/auth/register').send({
      name: 'Test',
      email: 'test@example.com',
      password: '123',
    });
    expect(shortPassRes.status).toBe(400);
  });

  test('POST /api/auth/login — authenticates valid credentials and returns JWT', async () => {
    await User.create({
      name: 'Bob Agent',
      email: 'agent@odysseus.com',
      password: 'AgentPassword123',
      role: 'agent',
      agencyName: 'Top Cruises Agency'
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'agent@odysseus.com',
      password: 'AgentPassword123',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('agent');
    expect(res.body.user.agencyName).toBe('Top Cruises Agency');
  });

  test('POST /api/auth/login — rejects invalid password or non-existent user with 401', async () => {
    await User.create({
      name: 'Test User',
      email: 'user@example.com',
      password: 'ValidPassword123',
    });

    const wrongPassRes = await request(app).post('/api/auth/login').send({
      email: 'user@example.com',
      password: 'WrongPassword',
    });
    expect(wrongPassRes.status).toBe(401);

    const noUserRes = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'AnyPassword',
    });
    expect(noUserRes.status).toBe(401);
  });

  test('GET /api/auth/me — returns user profile when authenticated', async () => {
    const user = await User.create({
      name: 'Admin User',
      email: 'admin@odysseus.com',
      password: 'AdminPassword123',
      role: 'admin',
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'admin@odysseus.com',
      password: 'AdminPassword123',
    });
    const token = loginRes.body.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('admin@odysseus.com');
    expect(meRes.body.user.role).toBe('admin');
    expect(meRes.body.user.password).toBeUndefined();
  });

  test('GET /api/auth/me — rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/roles — returns roles list for admin, agent, customer', async () => {
    const res = await request(app).get('/api/auth/roles');
    expect(res.status).toBe(200);
    expect(res.body.roles).toHaveLength(3);
    const roleNames = res.body.roles.map(r => r.role);
    expect(roleNames).toContain('admin');
    expect(roleNames).toContain('agent');
    expect(roleNames).toContain('customer');
  });

});
