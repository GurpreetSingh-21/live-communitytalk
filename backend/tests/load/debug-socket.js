const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'users.csv');
const users = fs.readFileSync(csvPath, 'utf8').split('\n').slice(1, 2); // Get first user

if (users.length === 0 || !users[0]) {
    console.error('No users found in CSV');
    process.exit(1);
}

const [token, userId, communityId] = users[0].split(',');

console.log('Testing connection for user:', userId);
console.log('Token:', token);

const socket = io('http://localhost:3000', {
    transports: ['websocket'],
    auth: { token: token.trim() }
});

socket.on('connect', () => {
    console.log('✅ Connected successfully!');
    socket.emit('message:send', {
        communityId: communityId.trim(),
        content: 'Test message from debug script',
        clientMessageId: 'debug_' + Date.now()
    });
});

socket.on('connect_error', (err) => {
    console.error('❌ Connection Error:', err.message);
    process.exit(1);
});

socket.on('message:ack', (data) => {
    console.log('✅ Message Ack received:', data);
    socket.disconnect();
    process.exit(0);
});

socket.on('disconnect', (reason) => {
    console.log('❌ Disconnected:', reason);
});
