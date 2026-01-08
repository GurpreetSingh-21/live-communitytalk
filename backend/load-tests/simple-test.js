import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const bootstrapDuration = new Trend('bootstrap_duration');

export const options = {
  scenarios: {
    // Scenario 1: Gradual ramp-up
    gradual_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 },   // Warm up: 10 users
        { duration: '20s', target: 50 },   // Ramp to 50 users
        { duration: '20s', target: 100 },  // Ramp to 100 users
        { duration: '30s', target: 100 },  // Hold at 100 users
        { duration: '10s', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // 95% under 1s
    'errors': ['rate<0.05'],             // <5% error rate
    'login_duration': ['p(95)<500'],     // Login under 500ms
    'bootstrap_duration': ['p(95)<800'], // Bootstrap under 800ms
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

// Use a single test account that should already exist
const TEST_USER = {
  email: 'jascharan.singh21@qmail.cuny.edu', // User that exists
  password: 'Test1234!',
};

export default function () {
  // 1. Login
  const loginStart = Date.now();
  const loginRes = http.post(`${BASE_URL}/api/login`, JSON.stringify({
    email: TEST_USER.email,
    password: TEST_USER.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'login' },
  });

  const loginSuccess = check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login response under 1s': (r) => r.timings.duration < 1000,
  });

  loginDuration.add(Date.now() - loginStart);

  if (!loginSuccess) {
    errorRate.add(1);
    console.log(`❌ Login failed: ${loginRes.status} - ${loginRes.body}`);
    sleep(1);
    return;
  }

  const token = loginRes.json('token');

  // 2. Bootstrap (simulates app launch)
  const bootstrapStart = Date.now();
  const bootstrapRes = http.get(`${BASE_URL}/api/bootstrap`, {
    headers: { 'Authorization': `Bearer ${token}` },
    tags: { endpoint: 'bootstrap' },
  });

  bootstrapDuration.add(Date.now() - bootstrapStart);

  check(bootstrapRes, {
    'bootstrap status is 200': (r) => r.status === 200,
    'bootstrap response under 1s': (r) => r.timings.duration < 1000,
  });

  // 3. Fetch my communities
  const communitiesRes = http.get(`${BASE_URL}/api/communities/my-threads`, {
    headers: { 'Authorization': `Bearer ${token}` },
    tags: { endpoint: 'communities' },
  });

  check(communitiesRes, {
    'communities status is 200': (r) => r.status === 200,
  });

  // 4. Fetch DM inbox
  const dmRes = http.get(`${BASE_URL}/api/direct-messages`, {
    headers: { 'Authorization': `Bearer ${token}` },
    tags: { endpoint: 'dm_inbox' },
  });

  check(dmRes, {
    'dm inbox status is 200': (r) => r.status === 200,
    'dm inbox under 2s': (r) => r.timings.duration < 2000,
  });

  // 5. Fetch user's public key (E2EE)
  const publicKeyRes = http.get(`${BASE_URL}/api/user/cmjro5mll000712itrfdurmgp/publicKey`, {
    headers: { 'Authorization': `Bearer ${token}` },
    tags: { endpoint: 'public_key' },
  });

  check(publicKeyRes, {
    'public key status is 200': (r) => r.status === 200,
  });

  // Simulate user reading/browsing (1-3 seconds)
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  
  let summary = '\n\n';
  summary += '╔═══════════════════════════════════════════════════════╗\n';
  summary += '║          LOAD TEST RESULTS - 100 CONCURRENT USERS     ║\n';
  summary += '╚═══════════════════════════════════════════════════════╝\n\n';
  
  const metrics = data.metrics;
  
  // HTTP Requests
  summary += '📊 HTTP METRICS:\n';
  summary += `${indent}Total Requests: ${metrics.http_reqs?.values?.count || 0}\n`;
  summary += `${indent}Failed Requests: ${metrics.http_req_failed?.values?.passes || 0} (${((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%)\n`;
  summary += `${indent}Requests/sec: ${(metrics.http_reqs?.values?.rate || 0).toFixed(2)}\n\n`;
  
  // Response Times
  summary += '⏱️  RESPONSE TIMES:\n';
  summary += `${indent}Average: ${(metrics.http_req_duration?.values?.avg || 0).toFixed(0)}ms\n`;
  summary += `${indent}p50 (median): ${(metrics.http_req_duration?.values?.med || 0).toFixed(0)}ms\n`;
  summary += `${indent}p95: ${(metrics.http_req_duration?.values['p(95)'] || 0).toFixed(0)}ms\n`;
  summary += `${indent}p99: ${(metrics.http_req_duration?.values['p(99)'] || 0).toFixed(0)}ms\n`;
  summary += `${indent}Max: ${(metrics.http_req_duration?.values?.max || 0).toFixed(0)}ms\n\n`;
  
  // Custom Metrics
  summary += '🔑 LOGIN PERFORMANCE:\n';
  summary += `${indent}Average: ${(metrics.login_duration?.values?.avg || 0).toFixed(0)}ms\n`;
  summary += `${indent}p95: ${(metrics.login_duration?.values['p(95)'] || 0).toFixed(0)}ms\n\n`;
  
  summary += '🚀 BOOTSTRAP PERFORMANCE:\n';
  summary += `${indent}Average: ${(metrics.bootstrap_duration?.values?.avg || 0).toFixed(0)}ms\n`;
  summary += `${indent}p95: ${(metrics.bootstrap_duration?.values['p(95)'] || 0).toFixed(0)}ms\n\n`;
  
  // Checks
  summary += '✅ CHECKS:\n';
  summary += `${indent}Passed: ${metrics.checks?.values?.passes || 0}\n`;
  summary += `${indent}Failed: ${metrics.checks?.values?.fails || 0}\n`;
  summary += `${indent}Success Rate: ${((metrics.checks?.values?.rate || 0) * 100).toFixed(2)}%\n\n`;
  
  // Data Transfer
  summary += '📡 DATA TRANSFER:\n';
  summary += `${indent}Received: ${((metrics.data_received?.values?.count || 0) / 1024 / 1024).toFixed(2)} MB\n`;
  summary += `${indent}Sent: ${((metrics.data_sent?.values?.count || 0) / 1024 / 1024).toFixed(2)} MB\n\n`;
  
  // Thresholds
  const thresholds = data.thresholds;
  summary += '🎯 THRESHOLDS:\n';
  for (const [metric, result] of Object.entries(thresholds || {})) {
    const status = result.ok ? '✅ PASSED' : '❌ FAILED';
    summary += `${indent}${metric}: ${status}\n`;
  }
  
  summary += '\n';
  
  return summary;
}
