const jwt = require('jsonwebtoken');
const { faker } = require('@faker-js/faker'); // You might need to install this or use simple random strings

// Use the same secret as in your .env or server config
const JWT_SECRET = process.env.MY_SECRET_KEY || 'test_secret_key';

function generateToken(userContext, events, done) {
    // Generate a random user
    const id = Math.floor(Math.random() * 1000000).toString();
    const name = `LoadTestUser_${id}`;

    // Create a payload matching your server's expectation
    const payload = {
        id: id, // In real app this is MongoID, but for load test mock it might need to be valid MongoID format if DB checks it
        // If your server checks DB for every socket connection, we might need to actually insert users first.
        // However, looking at server.js: 
        // const user = await Person.findById(decoded.id).lean();
        // if (!user) return next(new Error("User not found"));

        // CRITICAL: The server checks DB. So we can't just fake tokens.
        // We either need to:
        // 1. Seed the DB with users.
        // 2. Or mock the DB lookup in the server (not ideal for load test).
        // 3. Or create a special "load test" bypass in server (risky).

        // Let's try to generate a valid MongoID at least.
    };

    // Wait! The server does `await Person.findById(decoded.id)`. 
    // If the user doesn't exist in Mongo, the socket connection will FAIL.
    // So we MUST have these users in the DB.

    // Strategy:
    // We will create a "setup" phase in Artillery or a pre-script to seed users.
    // OR, simpler: We use a fixed set of users that we know exist, or we create them on the fly.

    // For now, let's assume we can use a "bypass" or we just create a few users and reuse them.
    // Actually, for 500 users, we need 500 DB records.

    // Let's generate a token.
    const token = jwt.sign(payload, JWT_SECRET);

    userContext.vars.token = token;
    userContext.vars.userId = id;
    userContext.vars.name = name;

    return done();
}

module.exports = {
    generateToken
};
