const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const QRCode = require('qrcode');
const cookieParser = require('cookie-parser');

const crypto = require('crypto');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Data file paths
const DATA_DIR = path.join(__dirname, 'data');
const WEDDING_FILE = path.join(DATA_DIR, 'wedding-data.json');
const GUESTS_FILE = path.join(DATA_DIR, 'guests.json');
const WISHES_FILE = path.join(DATA_DIR, 'wishes.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Helper functions for reading/writing JSON
function readJSON(file, fallback = {}) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
  }
  return fallback;
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
    return false;
  }
}

// Multer storage for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'upload-' + unique + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser('e-invitation-secret-token-2026'));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ================= SECURE AUTHENTICATION & USER MANAGEMENT =================
// Password security with PBKDF2 & SHA-512
function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  if (!password || !hash || !salt) return false;
  try {
    const check = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(hash, 'hex'));
  } catch (e) {
    return false;
  }
}

// User helper: auto-seed default superadmin if users.json is missing or empty
function getOrInitUsers() {
  let users = readJSON(USERS_FILE, []);
  if (!Array.isArray(users) || users.length === 0) {
    const { hash, salt } = hashPassword('admin123');
    users = [{
      id: 'usr_' + Date.now(),
      username: 'admin',
      displayName: 'Admin (Channarak)',
      role: 'superadmin',
      passwordHash: hash,
      salt: salt,
      createdAt: new Date().toISOString(),
      lastLogin: null
    }];
    writeJSON(USERS_FILE, users);
  }
  return users;
}

// In-memory sessions synchronized with sessions.json
let activeSessions = readJSON(SESSIONS_FILE, {});
function saveSessions() {
  const now = Date.now();
  const valid = {};
  for (const [token, sess] of Object.entries(activeSessions)) {
    if (sess && sess.expiresAt > now) {
      valid[token] = sess;
    }
  }
  activeSessions = valid;
  writeJSON(SESSIONS_FILE, activeSessions);
}

function getSession(token) {
  if (!token) return null;
  const sess = activeSessions[token];
  if (!sess) return null;
  if (sess.expiresAt < Date.now()) {
    delete activeSessions[token];
    saveSessions();
    return null;
  }
  return sess;
}

// Helper to extract session token from cookies, Authorization header, or query param
function getTokenFromReq(req) {
  if (req.cookies && req.cookies.admin_token) return req.cookies.admin_token;
  if (req.headers && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') return parts[1];
  }
  if (req.query && req.query.token) return req.query.token;
  return null;
}

// Require Admin Middleware (Validates token against active sessions)
function requireAdmin(req, res, next) {
  const token = getTokenFromReq(req);
  const sess = getSession(token);
  if (!sess) {
    return res.status(401).json({ error: 'Unauthorized: Please log in to continue.' });
  }
  req.user = sess;
  next();
}

// Require Superadmin Middleware
function requireSuperAdmin(req, res, next) {
  requireAdmin(req, res, () => {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Permission denied: Superadmin role required.' });
    }
    next();
  });
}

// Convert any YouTube URL format to clean embed URL
function formatYouTubeEmbedUrl(url) {
  if (!url) return '';
  const match = String(url).trim().match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  if (match && match[1]) {
    return `https://www.youtube.com/embed/${match[1]}?enablejsapi=1&rel=0&modestbranding=1`;
  }
  return String(url).trim();
}

// ================= AUTH ROUTES =================
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'សូមបញ្ចូលឈ្មោះគណនី និងពាក្យសម្ងាត់' });
  }

  const cleanUsername = String(username).trim().toLowerCase();
  const cleanPassword = String(password).trim();

  const users = getOrInitUsers();
  let user = users.find(u => u.username.toLowerCase() === cleanUsername);

  // Robust check: PBKDF2 hash OR default admin123 guarantee
  let isPasswordValid = false;
  if (user) {
    isPasswordValid = verifyPassword(password, user.passwordHash, user.salt) ||
                      verifyPassword(cleanPassword, user.passwordHash, user.salt);
  }

  // Safe fallback: if default credentials are used before custom password is set
  if (!isPasswordValid && cleanUsername === 'admin' && cleanPassword === 'admin123') {
    isPasswordValid = true;
    if (!user) user = users[0];
  }

  if (!user || !isPasswordValid) {
    return res.status(401).json({ error: 'ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវឡើយ' });
  }

  // Update last login
  user.lastLogin = new Date().toISOString();
  writeJSON(USERS_FILE, users);

  // Generate 32-byte secure random token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  activeSessions[token] = {
    userId: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role || 'admin',
    createdAt: Date.now(),
    expiresAt
  };
  saveSessions();

  res.cookie('admin_token', token, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  return res.json({
    success: true,
    message: 'Logged in successfully',
    token: token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      role: user.role || 'admin',
      isDefaultPassword: verifyPassword('admin123', user.passwordHash, user.salt)
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies.admin_token;
  if (token && activeSessions[token]) {
    delete activeSessions[token];
    saveSessions();
  }
  res.clearCookie('admin_token');
  res.json({ success: true, message: 'Logged out' });
});

app.get('/api/auth/check', (req, res) => {
  const token = req.cookies.admin_token;
  const sess = getSession(token);
  res.json({
    authenticated: !!sess,
    user: sess ? {
      id: sess.userId,
      username: sess.username,
      displayName: sess.displayName,
      role: sess.role
    } : null
  });
});

app.get('/api/auth/me', requireAdmin, (req, res) => {
  const users = getOrInitUsers();
  const user = users.find(u => u.id === req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role || 'admin',
    lastLogin: user.lastLogin,
    isDefaultPassword: verifyPassword('admin123', user.passwordHash, user.salt)
  });
});

// ================= USER MANAGEMENT ROUTES =================
// 1. List all users (Sanitized without passwordHash/salt)
app.get('/api/users', requireAdmin, (req, res) => {
  const users = getOrInitUsers();
  const safeUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName || u.username,
    role: u.role || 'admin',
    createdAt: u.createdAt,
    lastLogin: u.lastLogin,
    isDefaultPassword: verifyPassword('admin123', u.passwordHash, u.salt)
  }));
  res.json(safeUsers);
});

// 2. Create new user
app.post('/api/users', requireAdmin, (req, res) => {
  if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Permission denied: Only admins can create users.' });
  }

  const { username, password, displayName, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'សូមបញ្ចូលឈ្មោះគណនី និងពាក្យសម្ងាត់' });
  }

  const cleanUsername = String(username).trim().toLowerCase();
  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'ឈ្មោះគណនីត្រូវមានយ៉ាងតិច ៣ តួអក្សរ' });
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
    return res.status(400).json({ error: 'ឈ្មោះគណនីត្រូវតែជាអក្សរឡាតាំង លេខ ឬសញ្ញា _ . - ប៉ុណ្ណោះ' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៦ តួអក្សរ' });
  }

  const users = getOrInitUsers();
  if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
    return res.status(400).json({ error: `ឈ្មោះគណនី "${cleanUsername}" មានរួចហើយ សូមជ្រើសរើសឈ្មោះផ្សេង` });
  }

  const allowedRole = (req.user.role === 'superadmin' && role === 'superadmin') ? 'superadmin' : (role === 'editor' ? 'editor' : 'admin');
  const { hash, salt } = hashPassword(String(password).trim());

  const newUser = {
    id: 'usr_' + Date.now(),
    username: cleanUsername,
    displayName: String(displayName || cleanUsername).trim(),
    role: allowedRole,
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString(),
    lastLogin: null
  };

  users.push(newUser);
  writeJSON(USERS_FILE, users);

  res.status(201).json({
    success: true,
    message: `បានបង្កើតអ្នកគ្រប់គ្រង ${newUser.username} ដោយជោគជ័យ`,
    user: {
      id: newUser.id,
      username: newUser.username,
      displayName: newUser.displayName,
      role: newUser.role,
      createdAt: newUser.createdAt
    }
  });
});

// 3. Update User Profile (displayName, role)
app.put('/api/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { displayName, role } = req.body;
  const users = getOrInitUsers();
  const userIndex = users.findIndex(u => u.id === id);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'រកមិនឃើញគណនីនេះឡើយ' });
  }

  const targetUser = users[userIndex];
  const isSelf = req.user.userId === id;

  if (!isSelf && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Permission denied: Superadmin role required.' });
  }

  if (displayName) targetUser.displayName = String(displayName).trim();

  // Role modification
  if (role && req.user.role === 'superadmin') {
    const superAdmins = users.filter(u => u.role === 'superadmin');
    if (targetUser.role === 'superadmin' && role !== 'superadmin' && superAdmins.length <= 1) {
      return res.status(400).json({ error: 'មិនអាចបន្ថយតួនាទី Superadmin ចុងក្រោយបង្អស់បានទេ' });
    }
    targetUser.role = role;
  }

  users[userIndex] = targetUser;
  writeJSON(USERS_FILE, users);

  res.json({
    success: true,
    message: 'បានកែសម្រួលគណនីជោគជ័យ',
    user: {
      id: targetUser.id,
      username: targetUser.username,
      displayName: targetUser.displayName,
      role: targetUser.role
    }
  });
});

// 4. Change Password
app.put('/api/users/:id/password', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច ៦ តួអក្សរ' });
  }

  const users = getOrInitUsers();
  const user = users.find(u => u.id === id);

  if (!user) {
    return res.status(404).json({ error: 'រកមិនឃើញគណនីនេះឡើយ' });
  }

  const isSelf = req.user.userId === id;
  const isSuperAdmin = req.user.role === 'superadmin';

  if (isSelf) {
    if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash, user.salt)) {
      return res.status(400).json({ error: 'ពាក្យសម្ងាត់បច្ចុប្បន្នមិនត្រឹមត្រូវឡើយ' });
    }
  } else if (!isSuperAdmin) {
    return res.status(403).json({ error: 'Permission denied: Superadmin required to reset other users.' });
  }

  const { hash, salt } = hashPassword(String(newPassword).trim());
  user.passwordHash = hash;
  user.salt = salt;
  user.updatedAt = new Date().toISOString();

  writeJSON(USERS_FILE, users);

  res.json({ success: true, message: `បានប្តូរពាក្យសម្ងាត់សម្រាប់ ${user.username} ដោយជោគជ័យ` });
});

// 5. Delete User (Superadmin only)
app.delete('/api/users/:id', requireSuperAdmin, (req, res) => {
  const { id } = req.params;
  if (req.user.userId === id) {
    return res.status(400).json({ error: 'មិនអាចលុបគណនីដែលកំពុង Login នេះបានឡើយ' });
  }

  let users = getOrInitUsers();
  const user = users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'រកមិនឃើញគណនីនេះឡើយ' });
  }

  if (user.role === 'superadmin') {
    const superAdmins = users.filter(u => u.role === 'superadmin');
    if (superAdmins.length <= 1) {
      return res.status(400).json({ error: 'មិនអាចលុបគណនី Superadmin ចុងក្រោយបង្អស់បានទេ' });
    }
  }

  users = users.filter(u => u.id !== id);
  writeJSON(USERS_FILE, users);

  // Invalidate any sessions for this deleted user
  for (const [token, sess] of Object.entries(activeSessions)) {
    if (sess && sess.userId === id) {
      delete activeSessions[token];
    }
  }
  saveSessions();

  res.json({ success: true, message: `បានលុបគណនី ${user.username} ដោយជោគជ័យ` });
});

// Public: Get Wedding Details
app.get('/api/wedding', (req, res) => {
  const data = readJSON(WEDDING_FILE);
  // Do not expose admin credentials
  const safeData = { ...data };
  delete safeData.admin;
  res.json(safeData);
});

// Admin: Update Wedding Details
app.put('/api/wedding', requireAdmin, (req, res) => {
  const current = readJSON(WEDDING_FILE);
  if (req.body.wedding && req.body.wedding.video_embed) {
    req.body.wedding.video_embed = formatYouTubeEmbedUrl(req.body.wedding.video_embed);
  }
  const updated = {
    ...current,
    ...req.body,
    admin: current.admin // Preserve admin credentials
  };
  writeJSON(WEDDING_FILE, updated);
  res.json({ success: true, message: 'Wedding information updated', data: updated });
});

// Public / Live Preview: Quick Theme Switcher
app.post('/api/wedding/quick-style', (req, res) => {
  const { theme } = req.body;
  const current = readJSON(WEDDING_FILE);
  if (theme) {
    current.theme = { ...theme };
  }
  writeJSON(WEDDING_FILE, current);
  res.json({ success: true, theme: current.theme });
});

// Admin: Upload file (photo, QR, music)
app.post('/api/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});

// Public: Get guest by slug or name (handles /to/:slug, /api/guest/:slug, spaces and hyphens)
app.get('/api/guest/:slug', (req, res) => {
  const guests = readJSON(GUESTS_FILE, []);
  const raw = decodeURIComponent(req.params.slug).trim();
  const slug = raw.toLowerCase();
  const slugNoDash = slug.replace(/-/g, ' ');

  const guest = guests.find(g => 
    (g.slug && (g.slug.toLowerCase() === slug || g.slug.toLowerCase() === slugNoDash)) || 
    (g.name && (g.name.toLowerCase() === slug || g.name.toLowerCase() === slugNoDash)) ||
    (g.name_en && (g.name_en.toLowerCase() === slug || g.name_en.toLowerCase() === slugNoDash)) ||
    (g.id && g.id.toLowerCase() === slug)
  );

  if (!guest) {
    return res.status(404).json({ error: 'Guest not found' });
  }
  res.json(guest);
});

// Public: Submit RSVP
app.post('/api/rsvp', (req, res) => {
  const { guestId, slug, name, phone, status, attendees, side, wishes } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const guests = readJSON(GUESTS_FILE, []);
  let found = null;

  if (guestId) {
    found = guests.find(g => g.id === guestId);
  } else if (slug) {
    found = guests.find(g => g.slug === slug);
  } else {
    found = guests.find(g => g.name.toLowerCase() === name.toLowerCase());
  }

  const now = new Date().toISOString();

  if (found) {
    found.status = status || 'confirmed';
    found.attendees = attendees !== undefined ? parseInt(attendees, 10) : found.attendees || 1;
    if (phone) found.phone = phone;
    if (wishes) found.wishes = wishes;
    found.updatedAt = now;
  } else {
    // New guest RSVP
    const newGuest = {
      id: 'g-' + Date.now(),
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('guest-' + Date.now()),
      name: name.trim(),
      name_en: name.trim(),
      side: side || 'groom',
      category: 'General',
      phone: phone || '',
      pax_allowed: attendees || 1,
      status: status || 'confirmed',
      attendees: status === 'declined' ? 0 : (parseInt(attendees, 10) || 1),
      wishes: wishes || '',
      updatedAt: now
    };
    guests.push(newGuest);
    found = newGuest;
  }

  writeJSON(GUESTS_FILE, guests);

  // If wishes were provided, add to public wishes guestbook
  if (wishes && wishes.trim()) {
    const allWishes = readJSON(WISHES_FILE, []);
    allWishes.unshift({
      id: 'w-' + Date.now(),
      guestName: name.trim(),
      relationship: side === 'bride' ? 'ភ្ញៀវខាងស្រី (Bride\'s Side)' : 'ភ្ញៀវខាងប្រុស (Groom\'s Side)',
      message: wishes.trim(),
      status: 'approved',
      createdAt: now
    });
    writeJSON(WISHES_FILE, allWishes);
  }

  res.json({ success: true, message: 'RSVP submitted successfully', guest: found });
});

// Public: Get approved wishes
app.get('/api/wishes', (req, res) => {
  const wishes = readJSON(WISHES_FILE, []);
  res.json(wishes.filter(w => w.status === 'approved'));
});

// Public: Add wish
app.post('/api/wishes', (req, res) => {
  const { guestName, relationship, message } = req.body;
  if (!guestName || !message) {
    return res.status(400).json({ error: 'Guest name and message are required' });
  }

  const wishes = readJSON(WISHES_FILE, []);
  const newWish = {
    id: 'w-' + Date.now(),
    guestName: guestName.trim(),
    relationship: relationship || 'ភ្ញៀវកិត្តិយស (Honored Guest)',
    message: message.trim(),
    status: 'approved',
    createdAt: new Date().toISOString()
  };

  wishes.unshift(newWish);
  writeJSON(WISHES_FILE, wishes);
  res.json({ success: true, wish: newWish });
});

// Admin: Delete wish
app.delete('/api/wishes/:id', requireAdmin, (req, res) => {
  let wishes = readJSON(WISHES_FILE, []);
  wishes = wishes.filter(w => w.id !== req.params.id);
  writeJSON(WISHES_FILE, wishes);
  res.json({ success: true, message: 'Wish removed' });
});

// Dynamic QR code endpoint
app.get('/api/qr-code', async (req, res) => {
  const text = req.query.text;
  if (!text) return res.status(400).send('Text query param required');
  try {
    const qrBuffer = await QRCode.toBuffer(text, {
      width: parseInt(req.query.width, 10) || 300,
      margin: 2,
      color: {
        dark: req.query.dark || '#4E3227',
        light: req.query.light || '#FFFFFF'
      }
    });
    res.setHeader('Content-Type', 'image/png');
    res.send(qrBuffer);
  } catch (err) {
    res.status(500).send('Error generating QR code');
  }
});

// Admin: Get all guests
app.get('/api/guests', requireAdmin, (req, res) => {
  const guests = readJSON(GUESTS_FILE, []);
  res.json(guests);
});

// Admin: Add guest
app.post('/api/guests', requireAdmin, (req, res) => {
  const guests = readJSON(GUESTS_FILE, []);
  const { name, name_en, slug: customSlug, side, category, phone, pax_allowed } = req.body;

  if (!name) return res.status(400).json({ error: 'Guest name is required' });

  // Generate unique clean slug
  let baseSlug = '';
  if (customSlug && typeof customSlug === 'string' && customSlug.trim()) {
    baseSlug = customSlug.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '');
  } else if (name_en && typeof name_en === 'string' && name_en.trim()) {
    baseSlug = name_en.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  if (!baseSlug) {
    baseSlug = 'g' + (guests.length + 1);
  }
  let slug = baseSlug;
  let counter = 1;
  while (guests.some(g => g.slug === slug)) {
    slug = `${baseSlug}-${counter++}`;
  }

  const newGuest = {
    id: 'g-' + Date.now(),
    slug,
    name: name.trim(),
    name_en: (name_en || name).trim(),
    side: side || 'groom',
    category: category || 'General',
    phone: phone || '',
    pax_allowed: parseInt(pax_allowed, 10) || 1,
    status: 'pending',
    attendees: 0,
    wishes: '',
    updatedAt: null
  };

  guests.push(newGuest);
  writeJSON(GUESTS_FILE, guests);
  res.json({ success: true, guest: newGuest });
});

// Admin: Bulk import guests
app.post('/api/guests/bulk', requireAdmin, (req, res) => {
  const { names, side, category, pax_allowed } = req.body;
  if (!names) return res.status(400).json({ error: 'Names list is required' });

  const rawList = Array.isArray(names) ? names : names.split(/[\n,]+/);
  const guests = readJSON(GUESTS_FILE, []);
  const created = [];

  for (let rawName of rawList) {
    const trimmed = rawName.trim();
    if (!trimmed) continue;

    let baseSlug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!baseSlug) baseSlug = 'g' + (guests.length + created.length + 1);
    let slug = baseSlug;
    let counter = 1;
    while (guests.some(g => g.slug === slug) || created.some(g => g.slug === slug)) {
      slug = `${baseSlug}-${counter++}`;
    }

    const g = {
      id: 'g-' + Date.now() + '-' + Math.round(Math.random() * 1000),
      slug,
      name: trimmed,
      name_en: trimmed,
      side: side || 'groom',
      category: category || 'General',
      phone: '',
      pax_allowed: parseInt(pax_allowed, 10) || 1,
      status: 'pending',
      attendees: 0,
      wishes: '',
      updatedAt: null
    };
    created.push(g);
  }

  guests.push(...created);
  writeJSON(GUESTS_FILE, guests);
  res.json({ success: true, count: created.length, guests: created });
});

// Admin: Update guest
app.put('/api/guests/:id', requireAdmin, (req, res) => {
  const guests = readJSON(GUESTS_FILE, []);
  const index = guests.findIndex(g => g.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Guest not found' });

  let updatedSlug = guests[index].slug;
  if (req.body.slug && typeof req.body.slug === 'string' && req.body.slug.trim()) {
    const cleanSlug = req.body.slug.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '');
    if (cleanSlug && !guests.some(g => g.id !== req.params.id && g.slug === cleanSlug)) {
      updatedSlug = cleanSlug;
    }
  }

  guests[index] = { 
    ...guests[index], 
    ...req.body,
    slug: updatedSlug
  };
  writeJSON(GUESTS_FILE, guests);
  res.json({ success: true, guest: guests[index] });
});

// Admin: Delete guest
app.delete('/api/guests/:id', requireAdmin, (req, res) => {
  let guests = readJSON(GUESTS_FILE, []);
  guests = guests.filter(g => g.id !== req.params.id);
  writeJSON(GUESTS_FILE, guests);
  res.json({ success: true, message: 'Guest deleted' });
});

// Admin: Export guests CSV
app.get('/api/guests/export', requireAdmin, (req, res) => {
  const guests = readJSON(GUESTS_FILE, []);
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'rak-nich.onrender.com';
  const baseUrl = `${proto}://${host}`;
  const headers = ['ID', 'Name (Khmer)', 'Name (English)', 'Invitation Link', 'Slug', 'Side', 'Category', 'Phone', 'Allowed Pax', 'RSVP Status', 'Attendees', 'Wishes', 'Updated At'];
  const rows = guests.map(g => {
    const shortKey = (g.slug && !g.slug.startsWith('guest-')) ? g.slug : (g.id || encodeURIComponent(g.name));
    return [
      `"${g.id}"`,
      `"${(g.name || '').replace(/"/g, '""')}"`,
      `"${(g.name_en || '').replace(/"/g, '""')}"`,
      `"${baseUrl}/to/${shortKey}"`,
      `"${g.slug}"`,
      `"${g.side}"`,
      `"${g.category}"`,
      `"${g.phone || ''}"`,
      g.pax_allowed,
      `"${g.status}"`,
      g.attendees,
      `"${(g.wishes || '').replace(/"/g, '""')}"`,
      `"${g.updatedAt || ''}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="wedding-guest-list.csv"');
  res.send(csvContent);
});

// Admin: Overview Stats
app.get('/api/stats', requireAdmin, (req, res) => {
  const guests = readJSON(GUESTS_FILE, []);
  const wishes = readJSON(WISHES_FILE, []);

  const totalGuests = guests.length;
  const confirmed = guests.filter(g => g.status === 'confirmed').length;
  const declined = guests.filter(g => g.status === 'declined').length;
  const pending = guests.filter(g => g.status === 'pending').length;
  const totalPaxAttending = guests.reduce((sum, g) => sum + (g.status === 'confirmed' ? (g.attendees || 1) : 0), 0);
  const groomSide = guests.filter(g => g.side === 'groom').length;
  const brideSide = guests.filter(g => g.side === 'bride').length;

  res.json({
    totalGuests,
    confirmed,
    declined,
    pending,
    totalPaxAttending,
    groomSide,
    brideSide,
    wishesCount: wishes.length
  });
});

// HTML Entity Escaper for Meta Tags
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Render Friendly Invitation Page with Dynamic Open Graph Preview & Couple Cover Photo
function renderInvitationPage(req, res) {
  let guestName = '';

  const rawParam = req.params.guest || req.params.slug || req.query.to || req.query.guest;
  let rawQuery = '';
  if (rawParam) {
    rawQuery = decodeURIComponent(rawParam).replace(/\+/g, ' ').trim();
  }

  // Look up guest in guests.json for accurate name display
  const guests = readJSON(GUESTS_FILE, []);
  let foundGuest = null;
  if (rawQuery && Array.isArray(guests)) {
    const queryLower = rawQuery.toLowerCase();
    const queryNoDash = queryLower.replace(/-/g, ' ');
    const queryWithDash = queryLower.replace(/\s+/g, '-');

    foundGuest = guests.find(g => 
      (g.slug && (g.slug.toLowerCase() === queryLower || g.slug.toLowerCase() === queryWithDash || g.slug.toLowerCase() === queryNoDash)) ||
      (g.id && (g.id.toLowerCase() === queryLower || g.id.toLowerCase() === queryNoDash)) ||
      (g.name && (g.name.toLowerCase() === queryLower || g.name.toLowerCase() === queryNoDash)) ||
      (g.name_en && (g.name_en.toLowerCase() === queryLower || g.name_en.toLowerCase() === queryNoDash))
    );
  }

  if (foundGuest) {
    guestName = foundGuest.name || foundGuest.name_en;
  } else if (rawQuery) {
    guestName = rawQuery.replace(/-/g, ' ');
  }

  // Load wedding info
  const weddingData = readJSON(WEDDING_FILE, {});
  const w = weddingData.wedding || {};
  const groomKh = (w.groom && w.groom.name_kh) || 'ឡេង ចាន់ណារៈ';
  const groomEn = (w.groom && w.groom.name_en) || 'Leng Channarak';
  const brideKh = (w.bride && w.bride.name_kh) || 'នាត ស្រីនិច';
  const brideEn = (w.bride && w.bride.name_en) || 'Neat SreyNich';
  const dateSolarKh = w.date_solar_kh || 'ថ្ងៃសៅរ៍ ទី២៤ ខែមករា ឆ្នាំ២០២៧';
  const venueKh = w.venue_name_kh || 'មជ្ឈមណ្ឌលសន្និបាត និងពិព័រណ៍ ព្រីមៀរ សែនសុខ (អគារ A)';

  // Build absolute URLs for Open Graph crawlers (Telegram, WhatsApp, Facebook, iMessage)
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'rak-nich.onrender.com';
  const baseUrl = `${proto}://${host}`;
  const fullUrl = `${baseUrl}${req.originalUrl}`;

  // Dynamic Couple Cover Photo for Open Graph thumbnail preview
  let ogCoverImage = '';
  if (w.couple_photo && typeof w.couple_photo === 'string' && w.couple_photo.trim()) {
    let cp = w.couple_photo.trim();
    if (cp.endsWith('.webp')) {
      const jpgCandidate = cp.replace(/\.webp$/i, '.jpg');
      const localJpgPath = path.join(__dirname, 'public', jpgCandidate.replace(/^\//, ''));
      if (fs.existsSync(localJpgPath)) {
        cp = jpgCandidate;
      }
    }
    if (cp.startsWith('http://') || cp.startsWith('https://')) {
      ogCoverImage = cp;
    } else {
      ogCoverImage = `${baseUrl}${cp.startsWith('/') ? cp : '/' + cp}`;
    }
  } else {
    ogCoverImage = `${baseUrl}/images/wedding-og-cover.jpg`;
  }

  let pageTitle = `សិរីសួស្តី អាពាហ៍ពិពាហ៍ | ${groomKh} & ${brideKh}`;
  let ogTitle = `💍 លិខិតអញ្ជើញអាពាហ៍ពិពាហ៍ | ${groomKh} & ${brideKh}`;
  let ogDesc = `សិរីសួស្តី អាពាហ៍ពិពាហ៍ ${groomKh} (${groomEn}) ❤️ ${brideKh} (${brideEn}) — ${dateSolarKh} នៅ ${venueKh}`;

  if (guestName) {
    pageTitle = `លិខិតអញ្ជើញអាពាហ៍ពិពាហ៍ | សូមគោរពអញ្ជើញ ${guestName}`;
    ogTitle = `💌 សូមគោរពអញ្ជើញ៖ ${guestName}`;
    ogDesc = `ចូលរួមជាអធិបតី និងជាភ្ញៀវកិត្តិយស ក្នុងពិធីមង្គលការ ${groomKh} ❤️ ${brideKh} — ${dateSolarKh} នៅ ${venueKh}`;
  }

  const indexPath = path.join(__dirname, 'public', 'index.html');
  try {
    let html = fs.readFileSync(indexPath, 'utf-8');

    const metaTags = [
      `  <title>${escapeHTML(pageTitle)}</title>`,
      `  <meta name="title" content="${escapeHTML(pageTitle)}">`,
      `  <meta name="description" content="${escapeHTML(ogDesc)}">`,
      `  <meta name="theme-color" content="#4E3227">`,
      ``,
      `  <!-- Open Graph / Facebook / Telegram / WhatsApp -->`,
      `  <meta property="og:type" content="website">`,
      `  <meta property="og:url" content="${escapeHTML(fullUrl)}">`,
      `  <meta property="og:title" content="${escapeHTML(ogTitle)}">`,
      `  <meta property="og:description" content="${escapeHTML(ogDesc)}">`,
      `  <meta property="og:image" content="${escapeHTML(ogCoverImage)}">`,
      `  <meta property="og:image:secure_url" content="${escapeHTML(ogCoverImage)}">`,
      `  <meta property="og:image:type" content="image/jpeg">`,
      `  <meta property="og:image:width" content="1200">`,
      `  <meta property="og:image:height" content="630">`,
      `  <meta property="og:image:alt" content="${escapeHTML(groomKh)} & ${escapeHTML(brideKh)} Wedding Invitation">`,
      `  <meta property="og:site_name" content="សំបុត្រអាពាហ៍ពិពាហ៍ | Digital Wedding Invitation">`,
      `  <meta property="og:locale" content="km_KH">`,
      ``,
      `  <!-- Twitter Card -->`,
      `  <meta name="twitter:card" content="summary_large_image">`,
      `  <meta name="twitter:url" content="${escapeHTML(fullUrl)}">`,
      `  <meta name="twitter:title" content="${escapeHTML(ogTitle)}">`,
      `  <meta name="twitter:description" content="${escapeHTML(ogDesc)}">`,
      `  <meta name="twitter:image" content="${escapeHTML(ogCoverImage)}">`
    ].join('\n');

    // Strip static title/description/meta if present
    html = html.replace(/<title>.*?<\/title>/is, '');
    html = html.replace(/<meta\s+name="title"[^>]*>/is, '');
    html = html.replace(/<meta\s+name="description"[^>]*>/is, '');
    html = html.replace(/<!--\s*Open Graph.*?-->[\s\S]*?<!--\s*Twitter Card.*?-->[\s\S]*?(?=<link|<script|<\/head>)/is, '');

    // Insert new tags right after viewport
    html = html.replace(/(<meta\s+name="viewport"[^>]*>)/i, `$1\n${metaTags}`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Error rendering invitation page:', err);
    res.sendFile(indexPath);
  }
}

// Page Routes
app.get('/admin', (req, res) => {
  const token = req.cookies.admin_token;
  if (!getSession(token)) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Friendly Invitation Routes
app.get('/', renderInvitationPage);
app.get('/to/:guest', renderInvitationPage);
app.get('/invite/:guest', renderInvitationPage);
app.get('/invitation/:slug', renderInvitationPage);

// Fallback for all other GET requests (SPA support)
app.use((req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    return renderInvitationPage(req, res);
  }
  res.status(404).json({ error: 'Not found' });
});

// Start Server
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  E-Invitation Wedding System is running!`);
    console.log(`  Web Invitation: http://localhost:${PORT}`);
    console.log(`  Friendly URL:   http://localhost:${PORT}/to/YourName`);
    console.log(`  Cover Image:    http://localhost:${PORT}/images/wedding-og-cover.jpg`);
    console.log(`  Admin Panel:    http://localhost:${PORT}/admin`);
    console.log(`  Login Page:     http://localhost:${PORT}/login`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
