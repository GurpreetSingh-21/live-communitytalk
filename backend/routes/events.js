// backend/routes/events.js
const express = require('express');
const router = express.Router();
// const prisma = require('../prisma/client'); 

// STUB: Event model not yet in Prima Schema. 
// Returning empty lists to prevent server crash during migration.

router.get('/', async (req, res) => {
  console.log('📥 [GET /api/events] Stub request received');
  res.json({ items: [], nextCursor: null, hasMore: false });
});

router.get('/:id', async (req, res) => {
  console.log('📥 [GET /api/events/:id] Stub request received');
  res.status(404).json({ error: 'Event NOT_IMPLEMENTED_IN_MIGRATION' });
});

module.exports = router;