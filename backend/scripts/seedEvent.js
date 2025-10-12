// backend/scripts/seedEvent.js
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../db');
const Event = require('../models/event');

(async () => {
  try {
    await connectDB();

    const ev = await Event.create({
      title: 'Welcome Mixer',
      description: 'Meet & greet for newcomers.',
      startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // +2h
      endsAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      cover: '',
      tags: ['social', 'meetup'],
      collegeId: 'queens-college',     // <-- must match your scope
      faithId: 'sikh',                 // <-- must match your scope
      createdBy: new mongoose.Types.ObjectId(), // temp
    });

    console.log('Seeded event:', ev._id);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();