const http = require('http');

const limit = 105;
let responses = 0;
let blocked = false;

console.log(`Sending ${limit} requests to test rate limiting...`);

for (let i = 0; i < limit; i++) {
    http.get('http://localhost:3000/health', (res) => {
        responses++;
        if (res.statusCode === 429) {
            blocked = true;
            console.log(`✅ Request ${i + 1} blocked with 429!`);
        }

        if (responses === limit) {
            if (blocked) {
                console.log('✅ Rate limiting verification PASSED.');
                process.exit(0);
            } else {
                console.error('❌ Rate limiting verification FAILED. No 429 responses received.');
                process.exit(1);
            }
        }
    }).on('error', (e) => {
        console.error(`Got error: ${e.message}`);
    });
}
