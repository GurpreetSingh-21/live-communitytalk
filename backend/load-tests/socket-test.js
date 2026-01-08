import http from 'k6/http';
import { check, sleep } from 'k6';
import ws from 'k6/ws';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const messageLatency = new Trend('message_latency');

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 500 },
    { duration: '2m', target: 1000 },
    { duration: '3m', target: 1000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    message_latency: ['p(95)<200'], // 95% of messages delivered in <200ms
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const WS_URL = BASE_URL.replace('http', 'ws');

export default function () {
  const userId = __VU;
  
  // 1. Login first
  const loginRes = http.post(`${BASE_URL}/api/login`, JSON.stringify({
    email: `loadtest${userId}@test.com`,
    password: 'Test1234!',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status !== 200) {
    errorRate.add(1);
    return;
  }

  const token = loginRes.json('token');

  // 2. Connect to Socket.IO
  const url = `${WS_URL}/socket.io/?EIO=4&transport=websocket&token=${token}`;
  
  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', () => {
      console.log(`✅ User ${userId} connected to Socket.IO`);

      // Join a community room
      socket.send(JSON.stringify({
        type: 'room:join',
        data: { room: 'community:test-community' }
      }));

      // Send messages every 2-5 seconds
      const intervalId = setInterval(() => {
        const messageStartTime = Date.now();
        
        socket.send(JSON.stringify({
          type: 'message:send',
          data: {
            communityId: 'test-community',
            content: `Test message from user ${userId} at ${Date.now()}`,
          }
        }));

        socket.on('message', (data) => {
          const latency = Date.now() - messageStartTime;
          messageLatency.add(latency);
        });
      }, Math.random() * 3000 + 2000);

      // Keep connection alive for test duration
      sleep(180); // 3 minutes

      clearInterval(intervalId);
    });

    socket.on('error', (e) => {
      console.error(`❌ Socket error for user ${userId}:`, e);
      errorRate.add(1);
    });

    socket.on('close', () => {
      console.log(`🔌 User ${userId} disconnected`);
    });
  });

  check(res, {
    'socket connected': (r) => r && r.status === 101,
  });
}
