/**
 * Telegram Auto-Backup & Real-time Notification System
 * Automatically backs up JSON database files to Telegram and notifies on new RSVPs & Wishes
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const WEDDING_FILE = path.join(DATA_DIR, 'wedding-data.json');
const GUESTS_FILE = path.join(DATA_DIR, 'guests.json');
const WISHES_FILE = path.join(DATA_DIR, 'wishes.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Default Credentials (baked into application for zero-configuration access)
const DEFAULT_BOT_TOKEN = '9292129320:AAEpGzhycWqkiVykIU5xpJKZcUQUWu7R3Ow';
const DEFAULT_CHAT_ID = '-1004375071898';

// Sanitization helpers for Token & Chat ID
function cleanToken(raw) {
  if (!raw) return '';
  let token = String(raw).trim();
  token = token.replace(/^["'\s]+|["'\s]+$/g, '');
  token = token.replace(/^bot:?/i, '');
  token = token.replace(/[\u200B-\u200D\uFEFF]/g, '');
  return token.trim();
}

function cleanChatId(raw) {
  if (!raw) return '';
  let id = String(raw).trim();
  id = id.replace(/^["'\s]+|["'\s]+$/g, '');
  id = id.replace(/[\u200B-\u200D\uFEFF]/g, '');
  return id.trim();
}

// Read JSON helper
function readJSON(file, fallback = {}) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {
    console.error(`[Telegram] Error reading ${file}:`, e.message);
  }
  return fallback;
}

// Get Telegram configuration (from wedding-data.json or environment variables)
function getConfig() {
  const weddingData = readJSON(WEDDING_FILE, {});
  const saved = weddingData.telegram || {};

  const botToken = cleanToken(saved.botToken || process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN);
  const chatId = cleanChatId(saved.chatId || process.env.TELEGRAM_CHAT_ID || DEFAULT_CHAT_ID);
  const enabled = saved.enabled !== undefined ? Boolean(saved.enabled) : true;
  const notifyOnRSVP = saved.notifyOnRSVP !== undefined ? Boolean(saved.notifyOnRSVP) : true;
  const notifyOnWish = saved.notifyOnWish !== undefined ? Boolean(saved.notifyOnWish) : true;

  return {
    enabled,
    botToken,
    chatId,
    notifyOnRSVP,
    notifyOnWish
  };
}

// Save Telegram configuration into wedding-data.json
function saveConfig(updates) {
  const weddingData = readJSON(WEDDING_FILE, {});
  weddingData.telegram = {
    ...getConfig(),
    ...updates
  };

  try {
    fs.writeFileSync(WEDDING_FILE, JSON.stringify(weddingData, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Telegram] Could not write config file (e.g. read-only serverless environment):', err.message);
  }
  return weddingData.telegram;
}

// Send simple HTML message to Telegram
async function sendMessage(text, customToken = null, customChatId = null) {
  const config = getConfig();
  let token = cleanToken(customToken);
  let chatId = cleanChatId(customChatId);

  // If passed token is masked or empty, fall back to configured token
  if (!token || token.includes('••') || token.includes('*')) {
    token = config.botToken;
  }
  if (!chatId) {
    chatId = config.chatId;
  }

  if (!token || !chatId) {
    return { success: false, error: 'Telegram Bot Token or Chat ID is missing' };
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML'
        })
      });

      const data = await res.json();
      if (!data.ok) {
        // Auto-handle group migration to supergroup
        if (data.parameters && data.parameters.migrate_to_chat_id) {
          const migratedChatId = String(data.parameters.migrate_to_chat_id);
          console.log(`[Telegram] Group migrated to ${migratedChatId}. Automatically retrying...`);
          try { saveConfig({ chatId: migratedChatId }); } catch (e) {}
          return await sendMessage(text, token, migratedChatId);
        }

        if (data.description === 'Not Found') {
          return {
            success: false,
            error: 'Bot Token មិនត្រឹមត្រូវ (404 Not Found)។ សូមប្រាកដថាបាន Copy តែលេខកូដ Token ពី @BotFather ដោយគ្មានដកឃ្លា ឬពាក្យថា "bot token" នៅខាងមុខឡើយ។'
          };
        }

        return { success: false, error: data.description || 'Failed to send message' };
      }
      return { success: true, result: data.result, chatId };
    } catch (err) {
      if (attempt === 1) {
        await new Promise(r => setTimeout(r, 600));
        continue;
      }
      console.error('[Telegram] Send message error:', err.message);
      return { success: false, error: err.message };
    }
  }
}

// Send backup document file to Telegram (Disabled per request)
async function sendBackup(reason = 'Manual Backup') {
  console.log(`[Telegram] Backup to Telegram is completely disabled (${reason}). Skipping upload.`);
  return { success: false, disabled: true, message: 'Telegram backup is disabled.' };
}

// Real-time Notification when Guest submits RSVP
async function notifyRSVP(guest) {
  const config = getConfig();
  if (!config.enabled || !config.notifyOnRSVP || !config.botToken || !config.chatId) {
    return;
  }

  const statusEmoji = guest.status === 'confirmed' ? '✅' : (guest.status === 'declined' ? '❌' : '⏳');
  const statusTextKh = guest.status === 'confirmed' ? 'បានបញ្ជាក់ចូលរួម (Confirmed)' : (guest.status === 'declined' ? 'មិនអាចចូលរួមបាន (Declined)' : 'រង់ចាំឆ្លើយតប (Pending)');

  const lines = [
    `💌 <b>មានភ្ញៀវឆ្លើយតប RSVP ថ្មី! (New RSVP)</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👤 <b>ឈ្មោះភ្ញៀវ:</b> ${guest.name || 'មិនស្គាល់'}` + (guest.name_en ? ` (${guest.name_en})` : ''),
    `📋 <b>ស្ថានភាព:</b> ${statusEmoji} <b>${statusTextKh}</b>`,
    `👥 <b>ចំនួនចូលរួម:</b> <b>${guest.attendees || 1} នាក់</b> (អនុញ្ញាត: ${guest.pax_allowed || 1})`,
    `📞 <b>លេខទូរស័ព្ទ:</b> <code>${guest.phone || 'មិនមាន'}</code>`,
    `🏷️ <b>ប្រភេទ/ខាង:</b> ${guest.side === 'groom' ? 'ខាងប្រុស' : 'ខាងស្រី'} (${guest.category || 'General'})`
  ];

  if (guest.wishes && guest.wishes.trim()) {
    lines.push(`💬 <b>ពាក្យជូនពរ:</b> <i>"${guest.wishes.trim()}"</i>`);
  }

  lines.push(`⏰ <code>${new Date().toLocaleString('km-KH')}</code>`);

  await sendMessage(lines.join('\n'));
}

// Real-time Notification when Guest sends a Wish in Guestbook
async function notifyWish(wish) {
  const config = getConfig();
  if (!config.enabled || !config.notifyOnWish || !config.botToken || !config.chatId) {
    return;
  }

  const lines = [
    `🎉 <b>មានពាក្យជូនពរថ្មីក្នុង Guestbook!</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👤 <b>ពី:</b> <b>${wish.guestName || 'ភ្ញៀវកិត្តិយស'}</b>`,
    `💞 <b>ទំនាក់ទំនង:</b> ${wish.relationship || 'ភ្ញៀវទូទៅ'}`,
    `💬 <b>សារជូនពរ:</b> <i>"${wish.message || ''}"</i>`,
    `⏰ <code>${new Date().toLocaleString('km-KH')}</code>`
  ];

  await sendMessage(lines.join('\n'));
}

// Test Telegram Bot Connection
async function testConnection(botToken, chatId) {
  const config = getConfig();
  let token = cleanToken(botToken);
  let chat = cleanChatId(chatId);

  // Fallback to configured or default credentials if masked or empty
  if (!token || token.includes('••') || token.includes('*')) {
    token = config.botToken;
  }
  if (!chat) {
    chat = config.chatId;
  }

  const text = [
    `🔔 <b>E-INVITATION TELEGRAM BOT TEST</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `✅ ការតភ្ជាប់បានជោគជ័យ! (Connection Successful)`,
    `🤖 Bot របស់អ្នកត្រូវបានភ្ជាប់ជាមួយប្រព័ន្ធសំបុត្រអាពាហ៍ពិពាហ៍ឌីជីថលរួចរាល់។`,
    `🔔 ប្រព័ន្ធនឹងផ្ញើសារជូនដំណឹង Live រាល់ពេលមានភ្ញៀវ RSVP ឬផ្ញើសារជូនពរថ្មី!`,
    `⏰ <code>${new Date().toLocaleString('km-KH')}</code>`
  ].join('\n');

  return await sendMessage(text, token, chat);
}

// Debounced auto-backup helper (Disabled)
let debouncedTimer = null;
function scheduleDebouncedBackup() {
  if (debouncedTimer) clearTimeout(debouncedTimer);
  debouncedTimer = null;
}

// Background Cron-style Interval Checker (Disabled)
let intervalTimer = null;
function startAutoBackupScheduler() {
  if (intervalTimer) clearInterval(intervalTimer);
  intervalTimer = null;
}

module.exports = {
  getConfig,
  saveConfig,
  sendMessage,
  sendBackup,
  notifyRSVP,
  notifyWish,
  testConnection,
  startAutoBackupScheduler
};
