import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');
const crashCounter = new Counter('crashes');

export const options = {
  scenarios: {
    // 🔥 EXTREME STRESS TEST 🔥
    extreme_spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 },    // Warm up
        { duration: '20s', target: 200 },   // Ramp to 200
        { duration: '20s', target: 500 },   // PUSH TO 500
        { duration: '30s', target: 1000 },  // 🚀 EXTREME: 1000 USERS
        { duration: '1m', target: 1000 },   // HOLD AT 1000
        { duration: '20s', target: 1500 },  // 💥 BREAKING POINT: 1500!
        { duration: '30s', target: 1500 },  // Hold at breaking point
        { duration: '10s', target: 0 },     // Shutdown
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    // More lenient thresholds for extreme test
    'http_req_duration': ['p(95)<5000'], // 95% under 5s (very lenient)
    'errors': ['rate<0.50'],             // Allow up to 50% errors
  },
};

const BASE_URL = 'http://localhost:3000';

let connectionsFailed = 0;
let slowRequests = 0;

export default function () {
  const startTime = Date.now();
  
  try {
    // Hammer the health endpoint
    const healthRes = http.get(`${BASE_URL}/health`, {
      timeout: '10s',
    });

    const duration = Date.now() - startTime;
    requestDuration.add(duration);

    const success = check(healthRes, {
      'status is 200': (r) => r.status === 200,
      'response under 5s': (r) => duration < 5000,
    });

    if (!success) {
      errorRate.add(1);
      if (duration > 5000) {
        slowRequests++;
      }
    }

    if (healthRes.status === 0 || healthRes.error) {
      crashCounter.add(1);
      connectionsFailed++;
      console.log(`💥 CONNECTION FAILED! Total failures: ${connectionsFailed}`);
    }

  } catch (e) {
    errorRate.add(1);
    crashCounter.add(1);
    console.log(`❌ EXCEPTION: ${e.message}`);
  }

  // Minimal sleep to maximize pressure
  sleep(0.1);
}

export function handleSummary(data) {
  const metrics = data.metrics;
  
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              🔥 EXTREME LOAD TEST RESULTS 🔥               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('📊 TOTAL STATS:');
  console.log(`   Requests: ${metrics.http_reqs?.values?.count || 0}`);
  console.log(`   Failed: ${metrics.http_req_failed?.values?.passes || 0} (${((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%)`);
  console.log(`   RPS: ${(metrics.http_reqs?.values?.rate || 0).toFixed(2)}`);
  console.log('');
  console.log('⏱️  RESPONSE TIMES:');
  console.log(`   Min: ${(metrics.http_req_duration?.values?.min || 0).toFixed(0)}ms`);
  console.log(`   Avg: ${(metrics.http_req_duration?.values?.avg || 0).toFixed(0)}ms`);
  console.log(`   p50: ${(metrics.http_req_duration?.values?.med || 0).toFixed(0)}ms`);
  console.log(`   p95: ${(metrics.http_req_duration?.values['p(95)'] || 0).toFixed(0)}ms`);
  console.log(`   p99: ${(metrics.http_req_duration?.values['p(99)'] || 0).toFixed(0)}ms`);
  console.log(`   Max: ${(metrics.http_req_duration?.values?.max || 0).toFixed(0)}ms`);
  console.log('');
  console.log('💥 CRASH STATS:');
  console.log(`   Crashes: ${metrics.crashes?.values?.count || 0}`);
  console.log(`   Slow requests (>5s): ${slowRequests}`);
  console.log(`   Connection failures: ${connectionsFailed}`);
  console.log('');
  console.log('🎯 VERDICT:');
  
  const avgDuration = metrics.http_req_duration?.values?.avg || 0;
  const errorRateVal = (metrics.errors?.values?.rate || 0) * 100;
  
  if (avgDuration < 500 && errorRateVal < 5) {
    console.log('   ✅ INCREDIBLE! Your backend is a BEAST! 🚀');
  } else if (avgDuration < 1000 && errorRateVal < 20) {
    console.log('   ✅ SOLID! Backend handled extreme load well! 💪');
  } else if (avgDuration < 3000 && errorRateVal < 50) {
    console.log('   ⚠️  STRUGGLING but survived! Needs optimization. 🔧');
  } else {
    console.log('   ❌ OVERWHELMED! Backend couldn\'t handle it. Time to scale! 📈');
  }
  console.log('');
  
  return {
    'stdout': textSummary(data),
  };
}

function textSummary(data) {
  return '';  // Summary already printed in handleSummary
}
