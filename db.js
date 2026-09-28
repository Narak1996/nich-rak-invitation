const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const WEDDING_FILE = path.join(DATA_DIR, 'wedding-data.json');
const GUESTS_FILE = path.join(DATA_DIR, 'guests.json');
const WISHES_FILE = path.join(DATA_DIR, 'wishes.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// File I/O Helpers
function readLocalJSON(file, fallback = {}) {
  try {
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err.message);
  }
  return fallback;
}

function writeLocalJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing ${file}:`, err.message);
  }
}

// In-memory cache for synchronous reads and zero-latency lookups
const cache = {
  guests: readLocalJSON(GUESTS_FILE, []),
  wedding: readLocalJSON(WEDDING_FILE, {}),
  wishes: readLocalJSON(WISHES_FILE, []),
  users: readLocalJSON(USERS_FILE, [])
};

let mongoClient = null;
let mongoDb = null;
let isConnected = false;

// Initialize Database connection and auto-migration
async function initDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri || !uri.trim()) {
    console.log('[DB] No MONGODB_URI provided. Running in file-based mode (data/*.json).');
    return false;
  }

  try {
    console.log('[DB] Connecting to MongoDB Atlas...');
    mongoClient = new MongoClient(uri.trim(), {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000
    });

    await mongoClient.connect();
    mongoDb = mongoClient.db();
    isConnected = true;
    console.log(`[DB] Successfully connected to MongoDB database: "${mongoDb.databaseName}"`);

    // Auto-migrate or sync existing collections
    await syncWithMongoDB();
    return true;
  } catch (err) {
    console.error('[DB] Failed to connect to MongoDB:', err.message);
    console.log('[DB] Falling back to file-based mode (data/*.json).');
    isConnected = false;
    return false;
  }
}

// Sync MongoDB with Local Data
async function syncWithMongoDB() {
  if (!isConnected || !mongoDb) return;

  try {
    // 1. GUESTS
    const guestsCol = mongoDb.collection('guests');
    const guestCount = await guestsCol.countDocuments();
    if (guestCount === 0 && cache.guests && cache.guests.length > 0) {
      console.log(`[DB] Migrating ${cache.guests.length} local guests to MongoDB...`);
      const docs = cache.guests.map(g => ({ ...g }));
      await guestsCol.insertMany(docs);
    } else {
      const dbGuests = await guestsCol.find({}, { projection: { _id: 0 } }).toArray();
      if (dbGuests && dbGuests.length > 0) {
        cache.guests = dbGuests;
        writeLocalJSON(GUESTS_FILE, cache.guests);
        console.log(`[DB] Loaded ${dbGuests.length} guests from MongoDB into memory.`);
      }
    }

    // 2. WEDDING DATA
    const weddingCol = mongoDb.collection('wedding');
    const dbWedding = await weddingCol.findOne({ _key: 'main_settings' }, { projection: { _id: 0 } });
    if (!dbWedding && cache.wedding && Object.keys(cache.wedding).length > 0) {
      console.log('[DB] Migrating wedding settings to MongoDB...');
      await weddingCol.updateOne(
        { _key: 'main_settings' },
        { $set: { _key: 'main_settings', ...cache.wedding } },
        { upsert: true }
      );
    } else if (dbWedding) {
      const { _key, ...cleanWedding } = dbWedding;
      cache.wedding = cleanWedding;
      writeLocalJSON(WEDDING_FILE, cache.wedding);
      console.log('[DB] Loaded wedding settings from MongoDB.');
    }

    // 3. WISHES
    const wishesCol = mongoDb.collection('wishes');
    const wishesCount = await wishesCol.countDocuments();
    if (wishesCount === 0 && cache.wishes && cache.wishes.length > 0) {
      console.log(`[DB] Migrating ${cache.wishes.length} wishes to MongoDB...`);
      await wishesCol.insertMany(cache.wishes.map(w => ({ ...w })));
    } else {
      const dbWishes = await wishesCol.find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
      if (dbWishes && dbWishes.length > 0) {
        cache.wishes = dbWishes;
        writeLocalJSON(WISHES_FILE, cache.wishes);
        console.log(`[DB] Loaded ${dbWishes.length} wishes from MongoDB.`);
      }
    }

    // 4. USERS
    const usersCol = mongoDb.collection('users');
    const userCount = await usersCol.countDocuments();
    if (userCount === 0 && cache.users && cache.users.length > 0) {
      console.log(`[DB] Migrating ${cache.users.length} admin accounts to MongoDB...`);
      await usersCol.insertMany(cache.users.map(u => ({ ...u })));
    } else {
      const dbUsers = await usersCol.find({}, { projection: { _id: 0 } }).toArray();
      if (dbUsers && dbUsers.length > 0) {
        cache.users = dbUsers;
        writeLocalJSON(USERS_FILE, cache.users);
        console.log(`[DB] Loaded ${dbUsers.length} admin accounts from MongoDB.`);
      }
    }
  } catch (err) {
    console.error('[DB] Error during MongoDB synchronization:', err);
  }
}

// ---------------- GUESTS API ----------------
function getGuests() {
  return cache.guests;
}

async function saveGuests(newGuests) {
  cache.guests = Array.isArray(newGuests) ? newGuests : [];
  writeLocalJSON(GUESTS_FILE, cache.guests);

  if (isConnected && mongoDb) {
    try {
      const col = mongoDb.collection('guests');
      await col.deleteMany({});
      if (cache.guests.length > 0) {
        await col.insertMany(cache.guests.map(g => ({ ...g })));
      }
    } catch (err) {
      console.error('[DB] Error saving guests to MongoDB:', err.message);
    }
  }
}

// ---------------- WEDDING DATA API ----------------
function getWedding() {
  return cache.wedding;
}

async function saveWedding(newWedding) {
  cache.wedding = newWedding || {};
  writeLocalJSON(WEDDING_FILE, cache.wedding);

  if (isConnected && mongoDb) {
    try {
      const col = mongoDb.collection('wedding');
      await col.updateOne(
        { _key: 'main_settings' },
        { $set: { _key: 'main_settings', ...cache.wedding } },
        { upsert: true }
      );
    } catch (err) {
      console.error('[DB] Error saving wedding settings to MongoDB:', err.message);
    }
  }
}

// ---------------- WISHES API ----------------
function getWishes() {
  return cache.wishes;
}

async function saveWishes(newWishes) {
  cache.wishes = Array.isArray(newWishes) ? newWishes : [];
  writeLocalJSON(WISHES_FILE, cache.wishes);

  if (isConnected && mongoDb) {
    try {
      const col = mongoDb.collection('wishes');
      await col.deleteMany({});
      if (cache.wishes.length > 0) {
        await col.insertMany(cache.wishes.map(w => ({ ...w })));
      }
    } catch (err) {
      console.error('[DB] Error saving wishes to MongoDB:', err.message);
    }
  }
}

// ---------------- USERS API ----------------
function getUsers() {
  return cache.users;
}

async function saveUsers(newUsers) {
  cache.users = Array.isArray(newUsers) ? newUsers : [];
  writeLocalJSON(USERS_FILE, cache.users);

  if (isConnected && mongoDb) {
    try {
      const col = mongoDb.collection('users');
      await col.deleteMany({});
      if (cache.users.length > 0) {
        await col.insertMany(cache.users.map(u => ({ ...u })));
      }
    } catch (err) {
      console.error('[DB] Error saving users to MongoDB:', err.message);
    }
  }
}

function isDBConnected() {
  return isConnected;
}

module.exports = {
  initDB,
  syncWithMongoDB,
  isDBConnected,
  getGuests,
  saveGuests,
  getWedding,
  saveWedding,
  getWishes,
  saveWishes,
  getUsers,
  saveUsers,
  // Direct file fallbacks for backward compatibility
  readLocalJSON,
  writeLocalJSON
};
