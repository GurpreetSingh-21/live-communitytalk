import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 100 },   // Ramp up to 100 users
    { duration: '1m', target: 500 },    // Ramp up to 500 users
    { duration: '2m', target: 1000 },   // Ramp up to 1000 users
    { duration: '3m', target: 1000 },   // Stay at 1000 users
    { duration: '30s', target: 0 },     // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    errors: ['rate<0.01'],             // Error rate must be below 1%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

// Test data
const testUsers = [];
for (let i = 0; i < 1000; i++) {
  testUsers.push({
    email: `loadtest${i}@test.com`,
    password: 'Test1234!',
    fullName: `Load Test User ${i}`,
  });
}

export function setup() {
  console.log('🚀 Starting load test setup...');
  console.log(`Target: ${BASE_URL}`);
  return { baseUrl: BASE_URL };
}

export default function (data) {
  const userId = __VU; // Virtual User ID (1-1000)
  const user = testUsers[userId % testUsers.length];

  // 1. Register user (if needed)
  const registerRes = http.post(`${data.baseUrl}/api/register`, JSON.stringify({
    email: user.email,
    password: user.password,
    fullName: user.fullName,
    collegeName: 'Test College',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  // 2. Login
  const loginRes = http.post(`${data.baseUrl}/api/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const loginSuccess = check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login has token': (r) => r.json('token') !== undefined,
  });

  errorRate.add(!loginSuccess);

  if (!loginSuccess) {
    console.error(`❌ User ${userId} login failed: ${loginRes.status}`);
    return;
  }

  const token = loginRes.json('token');

  // 3. Bootstrap (app initialization)
  const bootstrapRes = http.get(`${data.baseUrl}/api/bootstrap`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  check(bootstrapRes, {
    'bootstrap status is 200': (r) => r.status === 200,
    'bootstrap under 500ms': (r) => r.timings.duration < 500,
  });

  // 4. Fetch communities
  const communitiesRes = http.get(`${data.baseUrl}/api/communities/my-threads`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  check(communitiesRes, {
    'communities status is 200': (r) => r.status === 200,
  });

  // 5. Fetch DM inbox
  const dmRes = http.get(`${data.baseUrl}/api/direct-messages`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  check(dmRes, {
    'dm inbox status is 200': (r) => r.status === 200,
    'dm inbox under 1s': (r) => r.timings.duration < 1000,
  });

  // Simulate user reading for 1-5 seconds
  sleep(Math.random() * 4 + 1);
}

export function teardown(data) {
  console.log('✅ Load test completed!');
}
