const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Setup Env Vars BEFORE requiring server to ensure they take precedence over .env
const JWT_SECRET = 'test_secret_key';
process.env.MY_SECRET_KEY = JWT_SECRET;

const { app, server } = require('../server'); // Import app and server from your server.js
const { connectDB } = require('../db');
const Person = require('../person');
const Member = require('../models/Member');
const Message = require('../models/Message');
const Community = require('../models/Community'); // Assuming you have a Community model

// Mock JSDOM and DOMPurify
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

// Test Configuration
const TEST_PORT = 4000 + Math.floor(Math.random() * 1000);
const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/communitytalk_test_multiuser';

process.env.PORT = TEST_PORT;

describe('Multi-User Socket.io Tests', () => {
    let ioServer;
    let clientSocket1, clientSocket2, clientSocket3;
    let user1, user2, user3;
    let community;
    let token1, token2, token3;

    beforeAll(async () => {
        console.log('Starting beforeAll...');
        // 1. Connect to Test DB
        console.log('Connecting to MongoDB via connectDB:', TEST_DB_URI);
        process.env.MONGODB_URI = TEST_DB_URI;
        await connectDB();
        console.log('Connected to MongoDB');

        // 2. Start Server
        // Note: server.js exports 'server' which is an http.Server instance. 
        // We need to listen on a port.
        console.log('Starting server on port:', TEST_PORT);
        await new Promise((resolve) => {
            server.listen(TEST_PORT, () => {
                console.log(`Test server running on port ${TEST_PORT}`);
                resolve();
            });
        });
        console.log('Server started');

        // 3. Create Test Data
        console.log('Creating test data...');
        // Create Users
        user1 = await Person.create({ name: 'User One', email: 'user1@test.com', password: 'password123' });
        user2 = await Person.create({ name: 'User Two', email: 'user2@test.com', password: 'password123' });
        user3 = await Person.create({ name: 'User Three', email: 'user3@test.com', password: 'password123' });
        console.log('Users created');

        // Generate Tokens
        token1 = jwt.sign({ id: user1._id }, JWT_SECRET);
        token2 = jwt.sign({ id: user2._id }, JWT_SECRET);
        token3 = jwt.sign({ id: user3._id }, JWT_SECRET);

        // Create Community (If Community model exists, otherwise mock or skip if not strictly needed for socket join logic but server.js checks membership)
        // Based on server.js: const memberships = await Member.find({ person: user._id, memberStatus: "active" }).select("community");
        // So we need Member records.
        const communityId = new mongoose.Types.ObjectId(); // Mock community ID

        // Create Memberships
        await Member.create([
            { person: user1._id, community: communityId, memberStatus: 'active', role: 'member' },
            { person: user2._id, community: communityId, memberStatus: 'active', role: 'member' },
            { person: user3._id, community: communityId, memberStatus: 'active', role: 'member' }
        ]);
        console.log('Memberships created');

        community = { _id: communityId };
    }, 30000); // 30s timeout for setup

    afterAll(async () => {
        // Cleanup
        if (clientSocket1) clientSocket1.disconnect();
        if (clientSocket2) clientSocket2.disconnect();
        if (clientSocket3) clientSocket3.disconnect();

        await Person.deleteMany({ email: { $in: ['user1@test.com', 'user2@test.com', 'user3@test.com'] } });
        await Member.deleteMany({ community: community._id });
        await Message.deleteMany({ communityId: community._id });

        await mongoose.connection.close();

        await new Promise((resolve) => server.close(resolve));
    }, 30000); // 30s timeout for cleanup

    test('should broadcast message to all users in the community', (done) => {
        const clientOptions = {
            transports: ['websocket'],
            forceNew: true,
            reconnectionDelay: 0,
            forceNew: true,
        };

        // Connect Client 1
        clientSocket1 = Client(`http://localhost:${TEST_PORT}`, {
            ...clientOptions,
            auth: { token: token1 }
        });

        // Connect Client 2
        clientSocket2 = Client(`http://localhost:${TEST_PORT}`, {
            ...clientOptions,
            auth: { token: token2 }
        });

        // Connect Client 3
        clientSocket3 = Client(`http://localhost:${TEST_PORT}`, {
            ...clientOptions,
            auth: { token: token3 }
        });

        let connectedCount = 0;
        const checkStart = () => {
            connectedCount++;
            if (connectedCount === 3) {
                startChat();
            }
        };

        clientSocket1.on('connect', checkStart);
        clientSocket2.on('connect', checkStart);
        clientSocket3.on('connect', checkStart);

        function startChat() {
            const messageContent = 'Hello everyone!';
            const clientMessageId = 'msg_' + Date.now();

            // Setup listeners for receivers
            let receivedCount = 0;

            const onMessage = (msg) => {
                try {
                    expect(msg.content).toBe(messageContent);
                    expect(msg.senderId).toBe(user1._id.toString());
                    receivedCount++;
                    if (receivedCount === 2) { // User 2 and User 3 received it
                        done();
                    }
                } catch (error) {
                    done(error);
                }
            };

            clientSocket2.on('receive_message', onMessage);
            clientSocket3.on('receive_message', onMessage);

            // User 1 sends message
            clientSocket1.emit('message:send', {
                communityId: community._id.toString(),
                content: messageContent,
                clientMessageId: clientMessageId
            });
        }
    }, 30000); // 30s timeout for test execution (increased for remote DB)
});
