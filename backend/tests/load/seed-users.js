const mongoose = require('mongoose');
const Person = require('../../person');
const Member = require('../../models/Member');
const Community = require('../../models/Community'); // Ensure this path is correct
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const JWT_SECRET = process.env.MY_SECRET_KEY;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/communitytalk';

const NUM_USERS = 500;
const OUTPUT_FILE = path.join(__dirname, 'users.csv');

async function seed() {
    if (!JWT_SECRET) {
        console.error('❌ Missing MY_SECRET_KEY');
        process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);

    console.log(`Creating ${NUM_USERS} users...`);

    // Create a target community
    let community = await Community.findOne({ name: 'Load Test Community' });
    if (!community) {
        community = await Community.create({
            name: 'Load Test Community',
            description: 'Community for load testing',
            privacy: 'public',
            creator: new mongoose.Types.ObjectId(), // Random creator
        });
        console.log('Created Load Test Community:', community._id);
    } else {
        console.log('Using existing Load Test Community:', community._id);
    }

    const users = [];
    const members = [];
    const csvLines = ['token,userId,communityId']; // Header for Artillery CSV

    for (let i = 0; i < NUM_USERS; i++) {
        const id = new mongoose.Types.ObjectId();
        users.push({
            _id: id,
            name: `LoadUser ${i}`,
            email: `loaduser${i}@test.com`,
            password: 'password123',
        });

        members.push({
            person: id,
            community: community._id,
            memberStatus: 'active',
            role: 'member'
        });

        const token = jwt.sign({ id: id }, JWT_SECRET, { algorithm: 'HS256' });
        csvLines.push(`${token},${id},${community._id}`);
    }

    // Bulk insert for speed
    try {
        // Optional: Clean up old load users first? 
        // Optional: Clean up old load users first? 
        await Person.deleteMany({ email: /@test\.com$/ });
        await Member.deleteMany({ community: community._id });
        await Member.deleteMany({ community: community._id });

        await Person.insertMany(users, { ordered: false }).catch(e => console.warn('Some users might already exist'));
        await Member.insertMany(members, { ordered: false }).catch(e => console.warn('Some members might already exist'));

        fs.writeFileSync(OUTPUT_FILE, csvLines.join('\n'));
        console.log(`✅ Generated ${users.length} users and saved to ${OUTPUT_FILE}`);
    } catch (err) {
        console.error('Error seeding:', err);
    } finally {
        await mongoose.connection.close();
    }
}

seed();
