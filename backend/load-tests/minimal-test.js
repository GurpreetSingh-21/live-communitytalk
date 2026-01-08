import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10, // 10 concurrent users
  duration: '30s',
};

const BASE_URL = 'http://localhost:3000';

export default function () {
  // Test health endpoint
  const healthRes = http.get(`${BASE_URL}/health`);
  
  check(healthRes, {
    'health check is 200': (r) => r.status === 200,
  });

  // Quick login test with your actual email
  const loginRes = http.post(`${BASE_URL}/api/login`, JSON.stringify({
    email: 'jascharan.singh21@qmail.cuny.edu',
    password: 'password123', // Update this to your actual password
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1);
}
