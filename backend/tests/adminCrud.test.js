/**
 * adminCrud.test.js
 *
 * Tests for Admin & Agent capabilities:
 * - Role-based authorization on admin routes
 * - Cruise CRUD (create, update fare/capacity, delete)
 * - Promo code CRUD (create, update limits, delete)
 * - Dynamic Tax rate configuration
 * - Metrics calculation
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const User = require('../src/models/User');
const Cruise = require('../src/models/Cruise');
const PromoCode = require('../src/models/PromoCode');
const Settings = require('../src/models/Settings');
const { generateToken } = require('../src/middleware/auth');

let mongod;
let app;
let adminToken;
let agentToken;
let customerToken;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = 'admin-test-secret';

  await mongoose.connect(uri);
  app = require('../src/index');

  const admin = await User.create({ name: 'Admin', email: 'admin@test.com', password: 'Pass', role: 'admin' });
  const agent = await User.create({ name: 'Agent', email: 'agent@test.com', password: 'Pass', role: 'agent' });
  const customer = await User.create({ name: 'Customer', email: 'customer@test.com', password: 'Pass', role: 'customer' });

  adminToken = generateToken(admin);
  agentToken = generateToken(agent);
  customerToken = generateToken(customer);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([
    Cruise.deleteMany({}),
    PromoCode.deleteMany({}),
    Settings.deleteMany({})
  ]);
});

describe('Admin & Agent Capabilities & CRUD', () => {

  // ── Role Security ───────────────────────────────────────────────────────────
  test('Customer cannot access admin cruise CRUD (returns 403)', async () => {
    const res = await request(app)
      .post('/api/admin/cruises')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ cruiseLine: 'Test', ship: 'Ship', destination: 'Dest', nights: 5, adultFare: 1000, capacityLeft: 10 });

    expect(res.status).toBe(403);
  });

  test('Agent cannot delete cruises (returns 403)', async () => {
    const cruise = await Cruise.create({ cruiseLine: 'Test', ship: 'Ship', destination: 'Dest', nights: 5, adultFare: 1000, capacityLeft: 10 });
    const res = await request(app)
      .delete(`/api/admin/cruises/${cruise._id}`)
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(403);
  });

  // ── Cruise CRUD ─────────────────────────────────────────────────────────────
  test('Admin can create a new cruise', async () => {
    const res = await request(app)
      .post('/api/admin/cruises')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cruiseLine: 'Oceania Cruises',
        ship: 'Marina Explorer',
        destination: 'Greek Isles',
        nights: 8,
        adultFare: 1600,
        capacityLeft: 15
      });

    expect(res.status).toBe(201);
    expect(res.body.cruise.ship).toBe('Marina Explorer');

    const inDb = await Cruise.findOne({ ship: 'Marina Explorer' });
    expect(inDb).not.toBeNull();
    expect(inDb.adultFare).toBe(1600);
  });

  test('Admin can update cruise fare and capacity', async () => {
    const cruise = await Cruise.create({
      cruiseLine: 'Silversea',
      ship: 'Silver Moon',
      destination: 'Japan',
      nights: 10,
      adultFare: 2500,
      capacityLeft: 6
    });

    const res = await request(app)
      .put(`/api/admin/cruises/${cruise._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ adultFare: 2800, capacityLeft: 8 });

    expect(res.status).toBe(200);
    expect(res.body.cruise.adultFare).toBe(2800);
    expect(res.body.cruise.capacityLeft).toBe(8);
  });

  test('Admin can delete a cruise', async () => {
    const cruise = await Cruise.create({
      cruiseLine: 'Delete Cruise',
      ship: 'Old Ship',
      destination: 'Nowhere',
      nights: 3,
      adultFare: 400,
      capacityLeft: 1
    });

    const res = await request(app)
      .delete(`/api/admin/cruises/${cruise._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const inDb = await Cruise.findById(cruise._id);
    expect(inDb).toBeNull();
  });

  // ── Promo CRUD ──────────────────────────────────────────────────────────────
  test('Admin can create and update promo code', async () => {
    const createRes = await request(app)
      .post('/api/admin/promos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'VIP50',
        type: 'percentage',
        value: 50,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
        maxTotalUses: 20,
        maxUsesPerCustomer: 1,
        minimumSpend: 500
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.promo.code).toBe('VIP50');

    const updateRes = await request(app)
      .put(`/api/admin/promos/${createRes.body.promo._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 40, maxTotalUses: 30 });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.promo.value).toBe(40);
    expect(updateRes.body.promo.maxTotalUses).toBe(30);
  });

  // ── Dynamic Settings ────────────────────────────────────────────────────────
  test('Admin can update tax rate dynamically without code redeployment', async () => {
    const res = await request(app)
      .put('/api/admin/settings/tax')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ taxRate: 0.15 });

    expect(res.status).toBe(200);
    const updatedSetting = await Settings.findOne({ key: 'taxRate' });
    expect(updatedSetting.value).toBe(0.15);
  });

  // ── Metrics ─────────────────────────────────────────────────────────────────
  test('Admin & Agent can fetch business metrics', async () => {
    await Cruise.create({ cruiseLine: 'C1', ship: 'S1', destination: 'D1', nights: 5, adultFare: 1000, capacityLeft: 5 });
    const res = await request(app)
      .get('/api/admin/metrics')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalFleetCapacityLeft).toBe(5);
  });

});
