// load-balancer.js
// VERSION 3: Adds explicit 'upgrade' handling for WebSockets

const express = require("express");
const http = require("http");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const server = http.createServer(app); // We need the http server
const PORT = 3000;

const servers = [
  "http://localhost:3001",
  "http://localhost:3002",
];

let currentServer = 0;

// Simplified router function
const router = (req) => {
  const target = servers[currentServer];
  currentServer = (currentServer + 1) % servers.length;
  console.log(`[LB] Routing to: ${target}`);
  return target;
};

const proxy = createProxyMiddleware({
  router: router, // The router handles all the logic
  ws: true,       // Tell the proxy we want to support WebSockets
  changeOrigin: true,
  logLevel: "info",
});

// Use the proxy for all http routes
app.use("/", proxy);

// ----------------------------------------------------
// ✅ THIS IS THE CRITICAL FIX
// We must manually attach the proxy to the server's 'upgrade' event
// to make WebSocket proxying work.
// ----------------------------------------------------
server.on('upgrade', proxy.upgrade);

// Start the HTTP server (not the Express app)
server.listen(PORT, () => {
  console.log(`🚀 Local Load Balancer listening on http://localhost:${PORT}`);
  console.log(`    Routing to: ${servers.join(", ")}`);
});