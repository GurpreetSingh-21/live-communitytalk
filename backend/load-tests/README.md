# Load Testing Guide

## Setup

### 1. Install k6

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### 2. Run Tests

**Basic API Load Test (1000 users):**
```bash
cd backend/load-tests
k6 run auth-test.js
```

**Socket.IO Load Test (1000 concurrent connections):**
```bash
k6 run socket-test.js
```

**Test Against Production:**
```bash
API_URL=https://your-production-url.com k6 run auth-test.js
```

## Test Stages

### Stage 1: Ramp Up (30s)
- 0 → 100 users
- Tests basic functionality

### Stage 2: Medium Load (1m)
- 100 → 500 users
- Identifies initial bottlenecks

### Stage 3: Peak Load (2m)
- 500 → 1000 users
- Simulates high traffic

### Stage 4: Sustained Load (3m)
- 1000 users constant
- Tests stability and memory leaks

### Stage 5: Ramp Down (30s)
- 1000 → 0 users
- Graceful shutdown test

## Interpreting Results

### Good Performance ✅
```
checks.........................: 99.50% ✓ 5000  ✗ 50
http_req_duration..............: avg=150ms p(95)=350ms
message_latency................: avg=50ms  p(95)=120ms
errors.........................: 0.50%
```

### Poor Performance ❌
```
checks.........................: 85.00% ✓ 4250  ✗ 750
http_req_duration..............: avg=800ms p(95)=2.5s
message_latency................: avg=500ms p(95)=2s
errors.........................: 15.00%
```

## Monitoring During Tests

### Backend Monitoring
```bash
# Terminal 1: Run backend
npm run dev

# Terminal 2: Monitor logs
tail -f logs/app.log

# Terminal 3: Monitor system resources
htop
```

### Database Monitoring
- Check Supabase dashboard for query performance
- Monitor connection pool usage
- Watch for slow queries

### Redis Monitoring
```bash
redis-cli monitor
```

## Common Bottlenecks & Fixes

### 1. Database Connection Pool Exhausted
**Symptom:** `Error: Connection pool timeout`  
**Fix:** Increase Prisma connection pool size

### 2. Redis Connection Limit
**Symptom:** Socket.IO disconnections  
**Fix:** Increase Redis max clients

### 3. Memory Leak
**Symptom:** RAM usage grows continuously  
**Fix:** Check for unclosed connections, remove event listeners

### 4. CPU Bottleneck
**Symptom:** Response times increase linearly  
**Fix:** Add horizontal scaling, optimize heavy computations

## Advanced Tests

### Test with Realistic User Behavior
```javascript
export default function() {
  // Login
  // Browse communities (5-10s)
  // Read messages (10-20s)
  // Send 1-2 messages
  // Check DMs (5s)
  // Logout
}
```

### Test Specific Scenarios
- **Spike Test:** 0 → 1000 users in 10 seconds
- **Soak Test:** 500 users for 24 hours (memory leak detection)
- **Stress Test:** Gradually increase until system breaks

## Cloud Load Testing

For distributed load testing from multiple regions:

```bash
k6 cloud auth-test.js
```

This runs tests from k6's cloud infrastructure.

## Next Steps After Testing

1. ✅ Identify slow queries → Optimize with indexes
2. ✅ Add caching where needed → Redis for hot data
3. ✅ Enable Supabase connection pooling → Add `?pgbouncer=true`
4. ✅ Horizontal scaling → Multiple backend instances
5. ✅ CDN for static assets → CloudFlare/CloudFront
