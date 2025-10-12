// backend/scripts/seedEvent.js
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../db');
const Event = require('../models/event');

(async () => {
  try {
    await connectDB();

    const events = [
      {
        title: 'CSDCAS Graduate School Application',
        description:
          'Information session with Professor McCaul about graduate school applications and academic preparation.',
        startsAt: new Date('2025-10-14T16:15:00-04:00'),
        endsAt: new Date('2025-10-14T17:30:00-04:00'),
        cover:
          'https://images.unsplash.com/photo-1581091870621-2f8c48e3f7a3?auto=format&fit=crop&w=1000&q=60',
        tags: ['academic', 'educational', 'advisory'],
        location: { kind: 'in-person', address: 'Queens Hall Room 340' },
        collegeId: 'queens-college',
        faithId: 'sikh',
        createdBy: new mongoose.Types.ObjectId(),
      },
      {
        title: 'FALL 2025 Dance Workshops',
        description:
          'Open-level choreography and contemporary sessions for all Queens College students. Hosted by Dance Union.',
        startsAt: new Date('2025-10-14T16:15:00-04:00'),
        endsAt: new Date('2025-10-14T17:30:00-04:00'),
        cover:
          'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=1000&q=60',
        tags: ['social', 'free hour', 'dance', 'performing arts', 'fitness'],
        location: { kind: 'in-person', address: 'Rathaus Hall Studio 101B' },
        collegeId: 'queens-college',
        faithId: 'sikh',
        createdBy: new mongoose.Types.ObjectId(),
      },
    ];

    const result = await Event.insertMany(events);
    console.log(`✅ Seeded ${result.length} events`);
    result.forEach(e => console.log(`→ ${e.title} (${e._id})`));

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();