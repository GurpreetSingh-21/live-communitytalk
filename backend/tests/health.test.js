const request = require('supertest');
const express = require('express');

// Mock JSDOM and DOMPurify to avoid ESM issues in Jest
jest.mock('jsdom', () => ({
    JSDOM: class {
        constructor() {
            this.window = {};
        }
    }
}));

jest.mock('dompurify', () => {
    return () => ({
        sanitize: (val) => val,
    });
});


// We need to import the app, but server.js starts the server immediately.
// For testing, it's better to separate app definition from server startup.
// For now, I'll mock the app or require it if it exports 'app'.
// Looking at server.js, it doesn't export 'app' at the end, it just runs.
// I will need to refactor server.js slightly to export 'app' for testing.

// REFACTOR PLAN (Inline):
// 1. I will modify server.js to export 'app' and 'server'.
// 2. I will wrap the startup logic in a check: if (require.main === module) { ... }

describe('Health Check', () => {
    let app;
    let server;

    beforeAll(() => {
        // We will require the server file. 
        // Since I'm about to refactor server.js to export app, this will work.
        const mod = require('../server');
        app = mod.app;
        server = mod.server;
    });

    // afterAll removed since we don't start the server

    it('should return 200 OK', async () => {
        const res = await request(app).get('/health');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('ok', true);
    });
});
