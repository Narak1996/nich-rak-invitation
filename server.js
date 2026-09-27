const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const QRCode = require('qrcode');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Data file paths
const DATA_DIR = path.join(__dirname, 'data');
const WEDDING_FILE = path.join(DATA_DIR, 'wedding-data.json');
const GUESTS_FILE = path.join(DATA_DIR, 'guests.json');
const WISHES_FILE = path.join(DATA_DIR, 'wishes.json');

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
app.use(express.static(path.join(__dirname, 'public')));

// Simple Auth middleware
function requireAdmin(req, res, next) {
  const token = req.cookies.admin_token;
  if (token === 'logged-in-admin-token') {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Please login.' });
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

// Auth routes
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const weddingData = readJSON(WEDDING_FILE);
  const admin = weddingData.admin || { username: 'admin', passwordHash: 'admin123' };

  if (username === admin.username && password === admin.passwordHash) {
    res.cookie('admin_token', 'logged-in-admin-token', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    return res.json({ success: true, message: 'Logged in successfully' });
  }
  return res.status(401).json({ error: 'Invalid username or password' });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true, message: 'Logged out' });
});

app.get('/api/auth/check', (req, res) => {
  const token = req.cookies.admin_token;
  res.json({ authenticated: token === 'logged-in-admin-token' });
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

// Public: Get guest by slug or name
app.get('/api/guest/:slug', (req, res) => {
  const guests = readJSON(GUESTS_FILE, []);
  const slug = decodeURIComponent(req.params.slug).toLowerCase().trim();
  const guest = guests.find(g => 
    (g.slug && g.slug.toLowerCase() === slug) || 
    (g.name && g.name.toLowerCase() === slug) ||
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
  const { name, name_en, side, category, phone, pax_allowed } = req.body;

  if (!name) return res.status(400).json({ error: 'Guest name is required' });

  // Generate unique slug
  let baseSlug = (name_en || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!baseSlug) baseSlug = 'guest';
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
    if (!baseSlug) baseSlug = 'guest';
    let slug = baseSlug;
    let counter = 1;
    while (guests.some(g => g.slug === slug)) {
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
    guests.push(g);
    created.push(g);
  }

  writeJSON(GUESTS_FILE, guests);
  res.json({ success: true, count: created.length, guests: created });
});

// Admin: Update guest
app.put('/api/guests/:id', requireAdmin, (req, res) => {
  const guests = readJSON(GUESTS_FILE, []);
  const index = guests.findIndex(g => g.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Guest not found' });

  guests[index] = { ...guests[index], ...req.body };
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
  const headers = ['ID', 'Name (Khmer)', 'Name (English)', 'Slug', 'Side', 'Category', 'Phone', 'Allowed Pax', 'RSVP Status', 'Attendees', 'Wishes', 'Updated At'];
  const rows = guests.map(g => [
    `"${g.id}"`,
    `"${(g.name || '').replace(/"/g, '""')}"`,
    `"${(g.name_en || '').replace(/"/g, '""')}"`,
    `"${g.slug}"`,
    `"${g.side}"`,
    `"${g.category}"`,
    `"${g.phone || ''}"`,
    g.pax_allowed,
    `"${g.status}"`,
    g.attendees,
    `"${(g.wishes || '').replace(/"/g, '""')}"`,
    `"${g.updatedAt || ''}"`
  ]);

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

// Page Routes
app.get('/admin', (req, res) => {
  const token = req.cookies.admin_token;
  if (token !== 'logged-in-admin-token') {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/invitation/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  E-Invitation Wedding System is running!`);
    console.log(`  Web Invitation: http://localhost:${PORT}`);
    console.log(`  Admin Panel:    http://localhost:${PORT}/admin`);
    console.log(`  Login Page:     http://localhost:${PORT}/login`);
    console.log(`  Admin Default:  username: admin | password: admin123`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
