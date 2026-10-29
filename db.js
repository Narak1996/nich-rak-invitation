const { MongoClient, Binary } = require('mongodb');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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

let lastSyncTime = 0;
const SYNC_INTERVAL_MS = 2500; // 2.5 seconds cache TTL for near-instant DB sync

// Refresh in-memory cache directly from MongoDB (Detects manual DB deletes/edits)
async function refreshFromMongoDB(force = false) {
  if (!isConnected || !mongoDb) return;
  const now = Date.now();
  if (!force && (now - lastSyncTime < SYNC_INTERVAL_MS)) return;
  lastSyncTime = now;

  try {
    const metaCol = mongoDb.collection('system_meta');
    const isInitDone = await metaCol.findOne({ _key: 'initial_migration_completed' });

    // 1. GUESTS
    const guestsCol = mongoDb.collection('guests');
    if (!isInitDone) {
      const guestCount = await guestsCol.countDocuments();
      if (guestCount === 0 && cache.guests && cache.guests.length > 0) {
        console.log(`[DB] First-time migration: inserting ${cache.guests.length} local guests to MongoDB...`);
        const docs = cache.guests.map(g => ({ ...g }));
        await guestsCol.insertMany(docs);
      }
    } else {
      // User may have deleted guests in MongoDB: update cache with actual DB state (even if empty [])
      const dbGuests = await guestsCol.find({}, { projection: { _id: 0 } }).toArray();
      cache.guests = Array.isArray(dbGuests) ? dbGuests : [];
      writeLocalJSON(GUESTS_FILE, cache.guests);
    }

    // 2. WEDDING DATA
    const weddingCol = mongoDb.collection('wedding');
    const dbWedding = await weddingCol.findOne({ _key: 'main_settings' }, { projection: { _id: 0 } });
    if (!isInitDone && !dbWedding && cache.wedding && Object.keys(cache.wedding).length > 0) {
      console.log('[DB] First-time migration: inserting wedding settings to MongoDB...');
      await weddingCol.updateOne(
        { _key: 'main_settings' },
        { $set: { _key: 'main_settings', ...cache.wedding } },
        { upsert: true }
      );
    } else if (dbWedding) {
      const { _key, ...cleanWedding } = dbWedding;
      cache.wedding = cleanWedding;
      writeLocalJSON(WEDDING_FILE, cache.wedding);
    }

    // 3. WISHES
    const wishesCol = mongoDb.collection('wishes');
    if (!isInitDone) {
      const wishesCount = await wishesCol.countDocuments();
      if (wishesCount === 0 && cache.wishes && cache.wishes.length > 0) {
        console.log(`[DB] First-time migration: inserting ${cache.wishes.length} wishes to MongoDB...`);
        await wishesCol.insertMany(cache.wishes.map(w => ({ ...w })));
      }
    } else {
      // User may have deleted wishes in MongoDB: update cache with actual DB state (even if empty [])
      const dbWishes = await wishesCol.find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
      cache.wishes = Array.isArray(dbWishes) ? dbWishes : [];
      writeLocalJSON(WISHES_FILE, cache.wishes);
    }

    // 4. USERS
    const usersCol = mongoDb.collection('users');
    if (!isInitDone) {
      const userCount = await usersCol.countDocuments();
      if (userCount === 0 && cache.users && cache.users.length > 0) {
        console.log(`[DB] First-time migration: inserting ${cache.users.length} admin accounts to MongoDB...`);
        await usersCol.insertMany(cache.users.map(u => ({ ...u })));
      }
    } else {
      const dbUsers = await usersCol.find({}, { projection: { _id: 0 } }).toArray();
      if (dbUsers && dbUsers.length > 0) {
        cache.users = dbUsers;
        writeLocalJSON(USERS_FILE, cache.users);
      }
    }

    // Mark initial migration completed so future deletes in MongoDB are NEVER overwritten by local files
    if (!isInitDone) {
      await metaCol.updateOne(
        { _key: 'initial_migration_completed' },
        { $set: { _key: 'initial_migration_completed', completedAt: new Date() } },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error('[DB] Error syncing cache with MongoDB:', err.message);
  }
}

// Sync MongoDB with Local Data on startup
async function syncWithMongoDB() {
  if (!isConnected || !mongoDb) return;
  await refreshFromMongoDB(true);

  try {
    // 5. UPLOADED PHOTOS & MEDIA (Deploy-Proof Persistence)
    try {
      const uploadsCol = mongoDb.collection('uploads');
      await uploadsCol.createIndex({ filename: 1 }, { unique: true }).catch(() => {});

      // A. Restore photos from MongoDB to disk if missing (e.g. freshly deployed container!)
      const dbUploads = await uploadsCol.find({}).toArray();
      let restoredCount = 0;
      for (const doc of dbUploads) {
        const localPath = path.join(UPLOADS_DIR, doc.filename);
        if (!fs.existsSync(localPath) && doc.data) {
          try {
            const buf = doc.data.buffer || doc.data;
            fs.writeFileSync(localPath, buf);
            restoredCount++;
          } catch (writeErr) {
            console.warn(`[DB] Failed to restore ${doc.filename} to disk:`, writeErr.message);
          }
        }
      }
      if (restoredCount > 0) {
        console.log(`[DB] Successfully restored ${restoredCount} uploaded photos from MongoDB to local disk!`);
      }

      // B. Back up any existing local photos into MongoDB if not yet stored
      if (fs.existsSync(UPLOADS_DIR)) {
        const localFiles = fs.readdirSync(UPLOADS_DIR);
        const dbFilenames = new Set(dbUploads.map(d => d.filename));
        let backedUpCount = 0;
        const mimeMap = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.gif': 'image/gif',
          '.mp3': 'audio/mpeg'
        };

        for (const file of localFiles) {
          const filePath = path.join(UPLOADS_DIR, file);
          if (fs.statSync(filePath).isFile() && !dbFilenames.has(file)) {
            try {
              const fileBuffer = fs.readFileSync(filePath);
              const ext = path.extname(file).toLowerCase();
              await uploadsCol.updateOne(
                { filename: file },
                {
                  $set: {
                    filename: file,
                    contentType: mimeMap[ext] || 'image/jpeg',
                    data: new Binary(fileBuffer),
                    size: fileBuffer.length,
                    updatedAt: new Date()
                  }
                },
                { upsert: true }
              );
              backedUpCount++;
            } catch (err) {
              console.warn(`[DB] Failed to backup ${file} to MongoDB:`, err.message);
            }
          }
        }
        if (backedUpCount > 0) {
          console.log(`[DB] Successfully backed up ${backedUpCount} local photos into MongoDB Atlas!`);
        }
      }
    } catch (uploadSyncErr) {
      console.error('[DB] Error during uploads sync with MongoDB:', uploadSyncErr.message);
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

// ---------------- UPLOADED MEDIA API (Deploy-Proof MongoDB Storage) ----------------
async function saveUploadedFile({ filename, contentType, data, size }) {
  if (!isConnected || !mongoDb) return false;
  try {
    const uploadsCol = mongoDb.collection('uploads');
    const binaryData = Buffer.isBuffer(data) ? new Binary(data) : data;
    await uploadsCol.updateOne(
      { filename },
      {
        $set: {
          filename,
          contentType: contentType || 'image/jpeg',
          data: binaryData,
          size: size || (Buffer.isBuffer(data) ? data.length : 0),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    console.log(`[DB] Successfully stored uploaded file in MongoDB: ${filename}`);
    return true;
  } catch (err) {
    console.error(`[DB] Error saving uploaded file ${filename} to MongoDB:`, err.message);
    return false;
  }
}

async function getUploadedFile(filename) {
  if (!isConnected || !mongoDb) return null;
  try {
    const uploadsCol = mongoDb.collection('uploads');
    const doc = await uploadsCol.findOne({ filename });
    if (!doc) return null;
    const buffer = doc.data && doc.data.buffer ? doc.data.buffer : doc.data;
    return {
      filename: doc.filename,
      contentType: doc.contentType || 'image/jpeg',
      data: buffer,
      size: doc.size || (buffer ? buffer.length : 0)
    };
  } catch (err) {
    console.error(`[DB] Error fetching uploaded file ${filename} from MongoDB:`, err.message);
    return null;
  }
}

async function getAllUploadedFilenames() {
  if (!isConnected || !mongoDb) return [];
  try {
    const uploadsCol = mongoDb.collection('uploads');
    const docs = await uploadsCol.find({}, { projection: { filename: 1, _id: 0 } }).toArray();
    return docs.map(d => d.filename);
  } catch (err) {
    console.error('[DB] Error getting uploaded filenames from MongoDB:', err.message);
    return [];
  }
}

function isDBConnected() {
  return isConnected;
}

module.exports = {
  initDB,
  syncWithMongoDB,
  refreshFromMongoDB,
  isDBConnected,
  getGuests,
  saveGuests,
  getWedding,
  saveWedding,
  getWishes,
  saveWishes,
  getUsers,
  saveUsers,
  // Deploy-Proof Uploaded Files
  saveUploadedFile,
  getUploadedFile,
  getAllUploadedFilenames,
  // Direct file fallbacks for backward compatibility
  readLocalJSON,
  writeLocalJSON
};
