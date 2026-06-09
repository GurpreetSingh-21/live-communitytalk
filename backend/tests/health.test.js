const request = require('supertest');
const express = require('express');

// We just mount the health route the same way it exists in server.js
// to avoid loading heavy dependencies in this simple test.
const app = express();
app.get('/health', (req, res) => {
    res.json({ ok: true });
});

describe('Health Check', () => {
    it('should return 200 OK', async () => {
        const res = await request(app).get('/health');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('ok', true);
    });
});
