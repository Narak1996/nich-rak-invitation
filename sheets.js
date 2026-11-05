/**
 * Google Sheets Universal Cloud Database Adapter for E-Invitation System
 * Stores, edits, deletes, and syncs ALL application data with Google Sheets:
 * 1. Guests (guest list, RSVP statuses, pax, attendee counts)
 * 2. Wishes (guestbook wishes, relationships, approval statuses)
 * 3. Wedding (complete couple info, dates, venue, agenda, theme, gallery, digital gift KHQR)
 * 4. Users (admin credentials & user roles)
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const WEDDING_FILE = path.join(DATA_DIR, 'wedding-data.json');
const GUESTS_FILE = path.join(DATA_DIR, 'guests.json');
const WISHES_FILE = path.join(DATA_DIR, 'wishes.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Resilient Serverless Storage: On Vercel, /tmp is writable
const TMP_DIR = fs.existsSync('/tmp') ? '/tmp' : DATA_DIR;
const TMP_CONFIG_FILE = path.join(TMP_DIR, 'sheets-config.json');

// Default Deployed Google Apps Script Web App URL
const DEFAULT_SHEET_URL = 'https://script.google.com/macros/s/AKfycbxEoOYzIWcxVhZdlVtNmA4LEX9HKp_D7YGsaGPJuURmNABRpfuGVOEHQ1IUP6cKIkkv/exec';

let inMemoryConfig = null;

// Read JSON Helper
function readLocalJSON(file, fallback = {}) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (err) {
    console.error(`[Sheets] Error reading ${file}:`, err.message);
  }
  return fallback;
}

// Write JSON Helper
function writeLocalJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    // If local file is read-only (e.g. Vercel /var/task), write to /tmp as backup
    try {
      const baseName = path.basename(file);
      const tmpPath = path.join(TMP_DIR, baseName);
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (tmpErr) {
      console.warn(`[Sheets] Could not write ${file} or /tmp backup:`, tmpErr.message);
    }
  }
}

// Get Google Sheets Config
function getConfig() {
  if (inMemoryConfig && inMemoryConfig.sheetUrl) {
    return inMemoryConfig;
  }

  // 1. Check /tmp writable cache
  let tmpSaved = {};
  try {
    if (fs.existsSync(TMP_CONFIG_FILE)) {
      tmpSaved = JSON.parse(fs.readFileSync(TMP_CONFIG_FILE, 'utf8')) || {};
    }
  } catch (e) {}

  // 2. Check wedding-data.json
  const weddingData = readLocalJSON(WEDDING_FILE, {});
  const fileSaved = weddingData.googleSheets || {};

  const saved = { ...fileSaved, ...tmpSaved, ...(inMemoryConfig || {}) };

  const sheetUrl = (saved.sheetUrl || process.env.GOOGLE_SHEET_URL || DEFAULT_SHEET_URL).trim();
  const enabled = saved.enabled !== undefined ? Boolean(saved.enabled) : true;
  const spreadsheetUrl = (saved.spreadsheetUrl || process.env.SPREADSHEET_URL || '').trim();
  const lastSyncAt = saved.lastSyncAt || null;

  inMemoryConfig = {
    enabled,
    sheetUrl,
    spreadsheetUrl,
    lastSyncAt
  };

  return inMemoryConfig;
}

// Save Google Sheets Config
function saveConfig(updates = {}) {
  const current = getConfig();
  const merged = {
    ...current,
    ...updates
  };

  if (updates.sheetUrl !== undefined) {
    const trimmed = String(updates.sheetUrl || '').trim();
    merged.sheetUrl = trimmed || current.sheetUrl || DEFAULT_SHEET_URL;
  } else if (!merged.sheetUrl) {
    merged.sheetUrl = DEFAULT_SHEET_URL;
  }

  if (updates.spreadsheetUrl !== undefined) {
    merged.spreadsheetUrl = String(updates.spreadsheetUrl || '').trim();
  }

  if (updates.enabled !== undefined) {
    merged.enabled = Boolean(updates.enabled);
  } else {
    merged.enabled = true;
  }

  inMemoryConfig = merged;

  // 1. Write to /tmp cache (Always succeeds on Vercel & AWS Lambda)
  try {
    fs.writeFileSync(TMP_CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Sheets] Could not write to /tmp:', err.message);
  }

  // 2. Write to local file if writable
  try {
    const weddingData = readLocalJSON(WEDDING_FILE, {});
    weddingData.googleSheets = merged;
    fs.writeFileSync(WEDDING_FILE, JSON.stringify(weddingData, null, 2), 'utf8');
  } catch (err) {
    // Read-only serverless environment, silent ignore
  }

  return merged;
}

function isConfigured() {
  const cfg = getConfig();
  return Boolean(cfg.enabled && cfg.sheetUrl && cfg.sheetUrl.startsWith('http'));
}

// Test Connection to Google Sheet Web App
async function testConnection(customUrl = null) {
  const url = (customUrl || getConfig().sheetUrl || '').trim();
  if (!url || !url.startsWith('http')) {
    return { success: false, error: 'Google Sheet Web App URL មិនត្រឹមត្រូវឡើយ (Must start with https://)' };
  }

  try {
    const testUrl = url.includes('?') ? `${url}&action=ping` : `${url}?action=ping`;
    const res = await fetch(testUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      redirect: 'follow'
    });

    if (!res.ok) {
      return { success: false, error: `Google Sheet ឆ្លើយតបកំហុស HTTP ${res.status}` };
    }

    const data = await res.json();
    return {
      success: true,
      message: data.message || 'បានភ្ជាប់ជាមួយ Google Sheet ដោយជោគជ័យ!',
      sheetTitle: data.sheetTitle || 'Wedding Database',
      tabs: data.tabs || ['Guests', 'Wishes', 'Settings', 'Users'],
      counts: data.counts || {}
    };
  } catch (err) {
    console.error('[Sheets] Test connection error:', err.message);
    return { success: false, error: err.message };
  }
}

// Helper to POST to Google Sheet Web App
async function postToSheet(action, payload) {
  if (!isConfigured()) return { success: false, error: 'Google Sheets is not configured' };
  const cfg = getConfig();

  try {
    const res = await fetch(cfg.sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      body: JSON.stringify({ action, ...payload })
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error(`[Sheets] Error executing action "${action}":`, err.message);
    return { success: false, error: err.message };
  }
}

// ================= 1. FETCH OPERATIONS =================

// Fetch ALL Data from Google Sheet (Guests, Wishes, Wedding, Users)
async function fetchAllFromSheet() {
  if (!isConfigured()) return null;
  const cfg = getConfig();

  try {
    const fetchUrl = cfg.sheetUrl.includes('?') ? `${cfg.sheetUrl}&action=getAll` : `${cfg.sheetUrl}?action=getAll`;
    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      redirect: 'follow'
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data && data.success) {
      // 1. Rehydrate Guests
      if (Array.isArray(data.guests)) {
        writeLocalJSON(GUESTS_FILE, data.guests);
      }
      // 2. Rehydrate Wishes
      if (Array.isArray(data.wishes)) {
        writeLocalJSON(WISHES_FILE, data.wishes);
      }
      // 3. Rehydrate Wedding Settings
      if (data.wedding && typeof data.wedding === 'object' && Object.keys(data.wedding).length > 0) {
        const currentWedding = readLocalJSON(WEDDING_FILE, {});
        const mergedWedding = {
          ...currentWedding,
          ...data.wedding,
          googleSheets: { ...currentWedding.googleSheets, ...cfg }
        };
        writeLocalJSON(WEDDING_FILE, mergedWedding);
      }
      // 4. Rehydrate Users
      if (Array.isArray(data.users) && data.users.length > 0) {
        writeLocalJSON(USERS_FILE, data.users);
      }

      saveConfig({ lastSyncAt: new Date().toISOString() });
      return data;
    }
  } catch (err) {
    console.warn('[Sheets] fetchAll error:', err.message);
  }
  return null;
}

// Fetch All Guests from Google Sheet
async function fetchGuestsFromSheet() {
  if (!isConfigured()) return null;
  const cfg = getConfig();

  try {
    const fetchUrl = cfg.sheetUrl.includes('?') ? `${cfg.sheetUrl}&action=getGuests` : `${cfg.sheetUrl}?action=getGuests`;
    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      redirect: 'follow'
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data && Array.isArray(data.guests)) {
      writeLocalJSON(GUESTS_FILE, data.guests);
      saveConfig({ lastSyncAt: new Date().toISOString() });
      return data.guests;
    }
  } catch (err) {
    console.warn('[Sheets] fetchGuests error:', err.message);
  }
  return null;
}

// Fetch All Wishes from Google Sheet
async function fetchWishesFromSheet() {
  if (!isConfigured()) return null;
  const cfg = getConfig();

  try {
    const fetchUrl = cfg.sheetUrl.includes('?') ? `${cfg.sheetUrl}&action=getWishes` : `${cfg.sheetUrl}?action=getWishes`;
    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      redirect: 'follow'
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data && Array.isArray(data.wishes)) {
      writeLocalJSON(WISHES_FILE, data.wishes);
      return data.wishes;
    }
  } catch (err) {
    console.warn('[Sheets] fetchWishes error:', err.message);
  }
  return null;
}

// Fetch Wedding Settings from Google Sheet
async function fetchWeddingFromSheet() {
  if (!isConfigured()) return null;
  const cfg = getConfig();

  try {
    const fetchUrl = cfg.sheetUrl.includes('?') ? `${cfg.sheetUrl}&action=getWedding` : `${cfg.sheetUrl}?action=getWedding`;
    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      redirect: 'follow'
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data && data.wedding && typeof data.wedding === 'object') {
      const current = readLocalJSON(WEDDING_FILE, {});
      const merged = { ...current, ...data.wedding, googleSheets: { ...current.googleSheets, ...cfg } };
      writeLocalJSON(WEDDING_FILE, merged);
      return merged;
    }
  } catch (err) {
    console.warn('[Sheets] fetchWedding error:', err.message);
  }
  return null;
}

// ================= 2. MUTATION OPERATIONS =================

// Sync ALL Data to Google Sheet
async function syncAllToSheet(payload = null) {
  if (!isConfigured()) return { success: false, error: 'Google Sheets is not configured' };

  const guests = (payload && payload.guests) || readLocalJSON(GUESTS_FILE, []);
  const wishes = (payload && payload.wishes) || readLocalJSON(WISHES_FILE, []);
  const wedding = (payload && payload.wedding) || readLocalJSON(WEDDING_FILE, {});
  const users = (payload && payload.users) || readLocalJSON(USERS_FILE, []);

  // Filter out sensitive credentials from wedding object (stored cleanly in Users tab)
  const safeWedding = { ...wedding };
  delete safeWedding.admin;

  try {
    const res = await postToSheet('syncAll', { guests, wishes, wedding: safeWedding, users });
    saveConfig({ lastSyncAt: new Date().toISOString() });
    return res;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Sync All Guests
async function saveGuestsToSheet(guests) {
  if (!isConfigured()) return;
  try {
    await postToSheet('syncGuests', { guests });
  } catch (e) {
    console.warn('[Sheets] saveGuestsToSheet error:', e.message);
  }
}

// Add Single Guest
async function addGuest(guest) {
  const guests = readLocalJSON(GUESTS_FILE, []);
  guests.push(guest);
  writeLocalJSON(GUESTS_FILE, guests);

  if (isConfigured()) {
    try {
      await postToSheet('addGuest', { guest });
    } catch (e) {
      console.warn('[Sheets] addGuest error:', e.message);
    }
  }
  return guest;
}

// Update Single Guest
async function updateGuest(guest) {
  const guests = readLocalJSON(GUESTS_FILE, []);
  const index = guests.findIndex(g => g.id === guest.id || (g.slug && g.slug === guest.slug));
  if (index !== -1) {
    guests[index] = { ...guests[index], ...guest };
    writeLocalJSON(GUESTS_FILE, guests);
  }

  if (isConfigured()) {
    try {
      await postToSheet('updateGuest', { guest });
    } catch (e) {
      console.warn('[Sheets] updateGuest error:', e.message);
    }
  }
  return guest;
}

// Delete Single Guest
async function deleteGuest(id) {
  const guests = readLocalJSON(GUESTS_FILE, []);
  const filtered = guests.filter(g => g.id !== id);
  writeLocalJSON(GUESTS_FILE, filtered);

  if (isConfigured()) {
    try {
      await postToSheet('deleteGuest', { id });
    } catch (e) {
      console.warn('[Sheets] deleteGuest error:', e.message);
    }
  }
  return true;
}

// Bulk Sync Guests
async function syncAllGuestsToSheet(allGuests = null) {
  const guests = allGuests !== null ? allGuests : readLocalJSON(GUESTS_FILE, []);
  return saveGuestsToSheet(guests);
}

// Sync All Wishes
async function saveWishesToSheet(wishes) {
  if (!isConfigured()) return;
  try {
    await postToSheet('syncWishes', { wishes });
  } catch (e) {
    console.warn('[Sheets] saveWishesToSheet error:', e.message);
  }
}

// Add Single Wish
async function addWish(wish) {
  const wishes = readLocalJSON(WISHES_FILE, []);
  wishes.unshift(wish);
  writeLocalJSON(WISHES_FILE, wishes);

  if (isConfigured()) {
    try {
      await postToSheet('addWish', { wish });
    } catch (e) {
      console.warn('[Sheets] addWish error:', e.message);
    }
  }
  return wish;
}

// Delete Single Wish
async function deleteWish(id) {
  const wishes = readLocalJSON(WISHES_FILE, []);
  const filtered = wishes.filter(w => w.id !== id);
  writeLocalJSON(WISHES_FILE, filtered);

  if (isConfigured()) {
    try {
      await postToSheet('deleteWish', { id });
    } catch (e) {
      console.warn('[Sheets] deleteWish error:', e.message);
    }
  }
  return true;
}

// Save Wedding Settings
async function saveWeddingToSheet(wedding) {
  if (!isConfigured()) return;
  const safeWedding = { ...wedding };
  delete safeWedding.admin;
  try {
    await postToSheet('saveWedding', { wedding: safeWedding });
  } catch (e) {
    console.warn('[Sheets] saveWeddingToSheet error:', e.message);
  }
}

// Save Users
async function saveUsersToSheet(users) {
  if (!isConfigured()) return;
  try {
    await postToSheet('saveUsers', { users });
  } catch (e) {
    console.warn('[Sheets] saveUsersToSheet error:', e.message);
  }
}

// ================= 3. COMPLETE GOOGLE APPS SCRIPT TEMPLATE =================
const APPS_SCRIPT_TEMPLATE = `/**
 * Google Apps Script for Rak & Nich Wedding Invitation System (Full Database)
 * Stores ALL application data in Google Sheets: Guests, Wishes, Wedding Settings, and Users.
 * 
 * Paste this into Google Sheets: Extensions > Apps Script
 * Then Deploy as Web App:
 *   - Execute as: Me
 *   - Who has access: Anyone
 */

const SHEET_NAMES = {
  GUESTS: 'Guests',
  WISHES: 'Wishes',
  SETTINGS: 'Settings',
  USERS: 'Users'
};

const HEADERS = {
  GUESTS: ['ID', 'Name (KH)', 'Name (EN)', 'Slug', 'Side', 'Category', 'Phone', 'Pax Allowed', 'Status', 'Attendees', 'Wishes', 'Updated At'],
  WISHES: ['ID', 'Guest Name', 'Relationship', 'Message', 'Status', 'Created At'],
  SETTINGS: ['Section', 'JSON Value', 'Updated At'],
  USERS: ['ID', 'Username', 'Display Name', 'Role', 'Password Hash', 'Salt', 'Created At', 'Last Login']
};

const COLORS = {
  GUESTS: '#1E4833',    // Dark Emerald Green
  WISHES: '#A63D40',    // Rose Crimson
  SETTINGS: '#4E3227',  // Bronze & Gold
  USERS: '#1F2937'      // Slate Dark
};

function getOrCreateSheet(name, headers, color) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground(color || '#1E4833');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

// ---------- GUESTS HELPERS ----------
function rowToGuest(row) {
  return {
    id: String(row[0] || ''),
    name: String(row[1] || ''),
    name_en: String(row[2] || ''),
    slug: String(row[3] || ''),
    side: String(row[4] || 'groom'),
    category: String(row[5] || 'General'),
    phone: String(row[6] || ''),
    pax_allowed: parseInt(row[7], 10) || 1,
    status: String(row[8] || 'pending'),
    attendees: parseInt(row[9], 10) || 0,
    wishes: String(row[10] || ''),
    updatedAt: String(row[11] || '')
  };
}

function guestToRow(g) {
  return [
    g.id || ('g-' + Date.now()),
    g.name || '',
    g.name_en || '',
    g.slug || '',
    g.side || 'groom',
    g.category || 'General',
    g.phone || '',
    parseInt(g.pax_allowed, 10) || 1,
    g.status || 'pending',
    parseInt(g.attendees, 10) || 0,
    g.wishes || '',
    g.updatedAt || new Date().toISOString()
  ];
}

function getAllGuests() {
  const sheet = getOrCreateSheet(SHEET_NAMES.GUESTS, HEADERS.GUESTS, COLORS.GUESTS);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.GUESTS.length).getValues();
  return values.map(rowToGuest).filter(g => g.name || g.slug || g.id);
}

function syncGuests(guests) {
  const sheet = getOrCreateSheet(SHEET_NAMES.GUESTS, HEADERS.GUESTS, COLORS.GUESTS);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  if (Array.isArray(guests) && guests.length > 0) {
    const rows = guests.map(guestToRow);
    sheet.getRange(2, 1, rows.length, HEADERS.GUESTS.length).setValues(rows);
  }
}

// ---------- WISHES HELPERS ----------
function rowToWish(row) {
  return {
    id: String(row[0] || ''),
    guestName: String(row[1] || ''),
    relationship: String(row[2] || ''),
    message: String(row[3] || ''),
    status: String(row[4] || 'approved'),
    createdAt: String(row[5] || '')
  };
}

function wishToRow(w) {
  return [
    w.id || ('w-' + Date.now()),
    w.guestName || '',
    w.relationship || '',
    w.message || '',
    w.status || 'approved',
    w.createdAt || new Date().toISOString()
  ];
}

function getAllWishes() {
  const sheet = getOrCreateSheet(SHEET_NAMES.WISHES, HEADERS.WISHES, COLORS.WISHES);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.WISHES.length).getValues();
  return values.map(rowToWish).filter(w => w.message || w.guestName || w.id);
}

function syncWishes(wishes) {
  const sheet = getOrCreateSheet(SHEET_NAMES.WISHES, HEADERS.WISHES, COLORS.WISHES);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  if (Array.isArray(wishes) && wishes.length > 0) {
    const rows = wishes.map(wishToRow);
    sheet.getRange(2, 1, rows.length, HEADERS.WISHES.length).setValues(rows);
  }
}

// ---------- SETTINGS HELPERS ----------
function getWeddingSettings() {
  const sheet = getOrCreateSheet(SHEET_NAMES.SETTINGS, HEADERS.SETTINGS, COLORS.SETTINGS);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === 'wedding_full') {
      try {
        return JSON.parse(values[i][1]);
      } catch (e) {}
    }
  }
  let result = {};
  for (let i = 0; i < values.length; i++) {
    const key = String(values[i][0]);
    try {
      result[key] = JSON.parse(values[i][1]);
    } catch (e) {
      result[key] = values[i][1];
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

function saveWeddingSettings(wedding) {
  const sheet = getOrCreateSheet(SHEET_NAMES.SETTINGS, HEADERS.SETTINGS, COLORS.SETTINGS);
  const now = new Date().toISOString();
  const rows = [
    ['wedding_full', JSON.stringify(wedding), now]
  ];
  // Break down major sections for readability
  if (wedding.wedding) rows.push(['wedding', JSON.stringify(wedding.wedding), now]);
  if (wedding.theme) rows.push(['theme', JSON.stringify(wedding.theme), now]);
  if (wedding.agenda) rows.push(['agenda', JSON.stringify(wedding.agenda), now]);
  if (wedding.gallery) rows.push(['gallery', JSON.stringify(wedding.gallery), now]);
  if (wedding.digital_gift) rows.push(['digital_gift', JSON.stringify(wedding.digital_gift), now]);

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
}

// ---------- USERS HELPERS ----------
function rowToUser(row) {
  return {
    id: String(row[0] || ''),
    username: String(row[1] || ''),
    displayName: String(row[2] || ''),
    role: String(row[3] || 'admin'),
    passwordHash: String(row[4] || ''),
    salt: String(row[5] || ''),
    createdAt: String(row[6] || ''),
    lastLogin: String(row[7] || '')
  };
}

function userToRow(u) {
  return [
    u.id || ('usr_' + Date.now()),
    u.username || '',
    u.displayName || '',
    u.role || 'admin',
    u.passwordHash || '',
    u.salt || '',
    u.createdAt || new Date().toISOString(),
    u.lastLogin || ''
  ];
}

function getAllUsers() {
  const sheet = getOrCreateSheet(SHEET_NAMES.USERS, HEADERS.USERS, COLORS.USERS);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.USERS.length).getValues();
  return values.map(rowToUser).filter(u => u.username || u.id);
}

function syncUsers(users) {
  const sheet = getOrCreateSheet(SHEET_NAMES.USERS, HEADERS.USERS, COLORS.USERS);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  if (Array.isArray(users) && users.length > 0) {
    const rows = users.map(userToRow);
    sheet.getRange(2, 1, rows.length, HEADERS.USERS.length).setValues(rows);
  }
}

// ---------- JSON HELPER ----------
function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ================= GET HANDLER =================
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'ping';
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Ping / Test Connection
  if (action === 'ping') {
    return jsonOutput({
      success: true,
      message: 'Google Sheet connected successfully!',
      sheetTitle: ss.getName(),
      tabs: [SHEET_NAMES.GUESTS, SHEET_NAMES.WISHES, SHEET_NAMES.SETTINGS, SHEET_NAMES.USERS],
      counts: {
        guests: getAllGuests().length,
        wishes: getAllWishes().length,
        hasSettings: Boolean(getWeddingSettings()),
        users: getAllUsers().length
      }
    });
  }

  // 2. Get ALL Data
  if (action === 'getAll') {
    return jsonOutput({
      success: true,
      guests: getAllGuests(),
      wishes: getAllWishes(),
      wedding: getWeddingSettings(),
      users: getAllUsers()
    });
  }

  // 3. Get Guests
  if (action === 'getGuests') {
    const guests = getAllGuests();
    return jsonOutput({ success: true, total: guests.length, guests });
  }

  // 4. Get Wishes
  if (action === 'getWishes') {
    const wishes = getAllWishes();
    return jsonOutput({ success: true, total: wishes.length, wishes });
  }

  // 5. Get Wedding Settings
  if (action === 'getWedding') {
    return jsonOutput({ success: true, wedding: getWeddingSettings() });
  }

  // 6. Get Users
  if (action === 'getUsers') {
    const users = getAllUsers();
    return jsonOutput({ success: true, total: users.length, users });
  }

  return jsonOutput({ success: false, error: 'Unknown action: ' + action });
}

// ================= POST HANDLER =================
function doPost(e) {
  let data = {};
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOutput({ success: false, error: 'Invalid JSON' });
  }

  const action = data.action || '';

  // 1. SYNC ALL
  if (action === 'syncAll') {
    if (Array.isArray(data.guests)) syncGuests(data.guests);
    if (Array.isArray(data.wishes)) syncWishes(data.wishes);
    if (data.wedding) saveWeddingSettings(data.wedding);
    if (Array.isArray(data.users)) syncUsers(data.users);
    return jsonOutput({ success: true, message: 'All data synchronized successfully' });
  }

  // 2. GUESTS
  if (action === 'syncGuests' && Array.isArray(data.guests)) {
    syncGuests(data.guests);
    return jsonOutput({ success: true, count: data.guests.length });
  }
  if (action === 'addGuest' && data.guest) {
    const sheet = getOrCreateSheet(SHEET_NAMES.GUESTS, HEADERS.GUESTS, COLORS.GUESTS);
    sheet.appendRow(guestToRow(data.guest));
    return jsonOutput({ success: true, guest: data.guest });
  }
  if (action === 'updateGuest' && data.guest) {
    const target = data.guest;
    const sheet = getOrCreateSheet(SHEET_NAMES.GUESTS, HEADERS.GUESTS, COLORS.GUESTS);
    const lastRow = sheet.getLastRow();
    let foundRow = -1;
    if (lastRow > 1) {
      const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.GUESTS.length).getValues();
      for (let i = 0; i < values.length; i++) {
        const rowId = String(values[i][0]);
        const rowSlug = String(values[i][3]);
        if ((target.id && rowId === target.id) || (target.slug && rowSlug === target.slug)) {
          foundRow = i + 2;
          break;
        }
      }
    }
    if (foundRow !== -1) {
      sheet.getRange(foundRow, 1, 1, HEADERS.GUESTS.length).setValues([guestToRow(target)]);
    } else {
      sheet.appendRow(guestToRow(target));
    }
    return jsonOutput({ success: true, updated: true });
  }
  if (action === 'deleteGuest' && data.id) {
    const sheet = getOrCreateSheet(SHEET_NAMES.GUESTS, HEADERS.GUESTS, COLORS.GUESTS);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(data.id)) {
          sheet.deleteRow(i + 2);
          return jsonOutput({ success: true, deleted: true });
        }
      }
    }
    return jsonOutput({ success: false, error: 'Guest not found' });
  }

  // 3. WISHES
  if (action === 'syncWishes' && Array.isArray(data.wishes)) {
    syncWishes(data.wishes);
    return jsonOutput({ success: true, count: data.wishes.length });
  }
  if (action === 'addWish' && data.wish) {
    const sheet = getOrCreateSheet(SHEET_NAMES.WISHES, HEADERS.WISHES, COLORS.WISHES);
    sheet.appendRow(wishToRow(data.wish));
    return jsonOutput({ success: true, wish: data.wish });
  }
  if (action === 'deleteWish' && data.id) {
    const sheet = getOrCreateSheet(SHEET_NAMES.WISHES, HEADERS.WISHES, COLORS.WISHES);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(data.id)) {
          sheet.deleteRow(i + 2);
          return jsonOutput({ success: true, deleted: true });
        }
      }
    }
    return jsonOutput({ success: false, error: 'Wish not found' });
  }

  // 4. WEDDING SETTINGS
  if (action === 'saveWedding' && data.wedding) {
    saveWeddingSettings(data.wedding);
    return jsonOutput({ success: true, saved: true });
  }

  // 5. USERS
  if (action === 'saveUsers' && Array.isArray(data.users)) {
    syncUsers(data.users);
    return jsonOutput({ success: true, saved: true });
  }

  return jsonOutput({ success: false, error: 'Unknown action: ' + action });
}
`;

module.exports = {
  getConfig,
  saveConfig,
  isConfigured,
  testConnection,
  fetchAllFromSheet,
  fetchGuestsFromSheet,
  fetchWishesFromSheet,
  fetchWeddingFromSheet,
  syncAllToSheet,
  saveGuestsToSheet,
  addGuest,
  updateGuest,
  deleteGuest,
  syncAllGuestsToSheet,
  saveWishesToSheet,
  addWish,
  deleteWish,
  saveWeddingToSheet,
  saveUsersToSheet,
  APPS_SCRIPT_TEMPLATE
};
