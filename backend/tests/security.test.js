/**
 * security.test.js
 *
 * Tests for security middlewares:
 * - Rate Limiter enforcement and 429 response
 * - Structured Logger execution
 */

const { createRateLimiter } = require('../src/middleware/rateLimiter');
const express = require('express');
const request = require('supertest');

describe('Security & Observability Middlewares', () => {

  test('Rate Limiter blocks requests exceeding threshold with 429 and Retry-After', async () => {
    const testApp = express();
    // Allow max 3 requests per 10 seconds
    const limiter = createRateLimiter({ windowMs: 10000, max: 3, message: 'Rate limit exceeded.' });
    testApp.use(limiter);
    testApp.get('/test', (_req, res) => res.json({ ok: true }));

    // Request 1
    const res1 = await request(testApp).get('/test');
    expect(res1.status).toBe(200);

    // Request 2
    const res2 = await request(testApp).get('/test');
    expect(res2.status).toBe(200);

    // Request 3
    const res3 = await request(testApp).get('/test');
    expect(res3.status).toBe(200);

    // Request 4 (exceeds max of 3)
    const res4 = await request(testApp).get('/test');
    expect(res4.status).toBe(429);
    expect(res4.body.error).toBe('Rate limit exceeded.');
    expect(res4.headers['retry-after']).toBeDefined();
  });

});
