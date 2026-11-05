/**
 * Google Sheets Database Adapter for E-Invitation System
 * Seamlessly stores, edits, deletes, and syncs wedding guests with Google Sheets
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const WEDDING_FILE = path.join(DATA_DIR, 'wedding-data.json');
const GUESTS_FILE = path.join(DATA_DIR, 'guests.json');

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
    console.error(`[Sheets] Error writing ${file}:`, err.message);
  }
}

// Get Google Sheets Config
function getConfig() {
  const weddingData = readLocalJSON(WEDDING_FILE, {});
  const saved = weddingData.googleSheets || {};

  const sheetUrl = (saved.sheetUrl || process.env.GOOGLE_SHEET_URL || '').trim();
  const enabled = saved.enabled !== undefined ? Boolean(saved.enabled) : Boolean(sheetUrl);
  const spreadsheetUrl = (saved.spreadsheetUrl || process.env.SPREADSHEET_URL || '').trim();
  const lastSyncAt = saved.lastSyncAt || null;

  return {
    enabled,
    sheetUrl,
    spreadsheetUrl,
    lastSyncAt
  };
}

// Save Google Sheets Config
function saveConfig(updates) {
  const weddingData = readLocalJSON(WEDDING_FILE, {});
  weddingData.googleSheets = {
    ...getConfig(),
    ...updates
  };

  try {
    fs.writeFileSync(WEDDING_FILE, JSON.stringify(weddingData, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Sheets] Could not persist wedding-data.json (read-only environment):', err.message);
  }
  return weddingData.googleSheets;
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
      sheetTitle: data.sheetTitle || 'Wedding Guests',
      totalRows: data.totalGuests !== undefined ? data.totalGuests : null
    };
  } catch (err) {
    console.error('[Sheets] Test connection error:', err.message);
    return { success: false, error: err.message };
  }
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

    if (!res.ok) {
      console.warn(`[Sheets] Failed to fetch guests: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (data && Array.isArray(data.guests)) {
      // Sync into local cache file
      writeLocalJSON(GUESTS_FILE, data.guests);
      saveConfig({ lastSyncAt: new Date().toISOString() });
      return data.guests;
    }
  } catch (err) {
    console.warn('[Sheets] Fetch guests error:', err.message);
  }
  return null;
}

// Post Action to Google Sheet
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
    console.error(`[Sheets] Error executing ${action}:`, err.message);
    return { success: false, error: err.message };
  }
}

// Add a Single Guest
async function addGuest(guest) {
  // Update local file first
  const guests = readLocalJSON(GUESTS_FILE, []);
  guests.push(guest);
  writeLocalJSON(GUESTS_FILE, guests);

  // Sync to Google Sheet
  if (isConfigured()) {
    try {
      await postToSheet('addGuest', { guest });
    } catch (e) {
      console.warn('[Sheets] Failed to add guest to Google Sheet:', e.message);
    }
  }
  return guest;
}

// Update a Single Guest
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
      console.warn('[Sheets] Failed to update guest in Google Sheet:', e.message);
    }
  }
  return guest;
}

// Delete a Single Guest
async function deleteGuest(id) {
  const guests = readLocalJSON(GUESTS_FILE, []);
  const filtered = guests.filter(g => g.id !== id);
  writeLocalJSON(GUESTS_FILE, filtered);

  if (isConfigured()) {
    try {
      await postToSheet('deleteGuest', { id });
    } catch (e) {
      console.warn('[Sheets] Failed to delete guest from Google Sheet:', e.message);
    }
  }
  return true;
}

// Bulk Sync All Guests to Google Sheet
async function syncAllGuestsToSheet(allGuests = null) {
  const guests = allGuests || readLocalJSON(GUESTS_FILE, []);
  if (!isConfigured()) return { success: false, error: 'Google Sheets not configured' };

  try {
    const res = await postToSheet('syncAllGuests', { guests });
    saveConfig({ lastSyncAt: new Date().toISOString() });
    return res;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Google Apps Script source code template (to provide to user)
const APPS_SCRIPT_TEMPLATE = `/**
 * Google Apps Script for Rak & Nich Wedding Invitation System
 * Paste this into Google Sheets: Extensions > Apps Script
 * Then Deploy as Web App (Execute as: Me | Who has access: Anyone)
 */

const SHEET_NAME = 'Guests';
const HEADERS = [
  'ID',
  'Name (KH)',
  'Name (EN)',
  'Slug',
  'Side',
  'Category',
  'Phone',
  'Pax Allowed',
  'Status',
  'Attendees',
  'Wishes',
  'Updated At'
];

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  
  // Initialize Header Row if empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setBackground('#1E4833');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS.length);
  }
  return sheet;
}

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
  const sheet = getOrCreateSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  return values.map(rowToGuest).filter(g => g.name || g.slug || g.id);
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'getGuests';
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === 'ping') {
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Google Sheet connected successfully!',
      sheetTitle: ss.getName(),
      totalGuests: getAllGuests().length
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Return All Guests
  const guests = getAllGuests();
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    total: guests.length,
    guests: guests
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const sheet = getOrCreateSheet();
  let data = {};
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Invalid JSON' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const action = data.action || '';

  // 1. Add Single Guest
  if (action === 'addGuest' && data.guest) {
    const row = guestToRow(data.guest);
    sheet.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({ success: true, guest: data.guest }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Update Single Guest (by ID or Slug)
  if (action === 'updateGuest' && data.guest) {
    const target = data.guest;
    const lastRow = sheet.getLastRow();
    let foundRow = -1;

    if (lastRow > 1) {
      const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
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
      sheet.getRange(foundRow, 1, 1, HEADERS.length).setValues([guestToRow(target)]);
      return ContentService.createTextOutput(JSON.stringify({ success: true, updated: true }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      // Append if not found
      sheet.appendRow(guestToRow(target));
      return ContentService.createTextOutput(JSON.stringify({ success: true, appended: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // 3. Delete Single Guest
  if (action === 'deleteGuest' && data.id) {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(data.id)) {
          sheet.deleteRow(i + 2);
          return ContentService.createTextOutput(JSON.stringify({ success: true, deleted: true }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Guest not found' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 4. Sync / Overwrite All Guests
  if (action === 'syncAllGuests' && Array.isArray(data.guests)) {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
    if (data.guests.length > 0) {
      const rows = data.guests.map(guestToRow);
      sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, total: data.guests.length }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Unknown action' }))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

module.exports = {
  getConfig,
  saveConfig,
  isConfigured,
  testConnection,
  fetchGuestsFromSheet,
  addGuest,
  updateGuest,
  deleteGuest,
  syncAllGuestsToSheet,
  APPS_SCRIPT_TEMPLATE
};
