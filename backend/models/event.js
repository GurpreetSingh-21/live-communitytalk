//backend/models/event.js

const { Schema, model, Types } = require('mongoose');

const EventSchema = new Schema(
  {
    title: { type: String, required: true },
    description: String,
    startsAt: { type: Date, required: true, index: true },
    endsAt: Date,
    venue: String,
    cover: String, // image url
    tags: [String],

    // visibility scoping
    collegeId: { type: String, required: true, index: true },
    faithId: { type: String, required: true, index: true },

    createdBy: { type: Types.ObjectId, ref: 'Admin', required: true },
  },
  { timestamps: true }
);

module.exports = model('Event', EventSchema);