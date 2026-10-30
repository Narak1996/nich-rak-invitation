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

  const botToken = (saved.botToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (saved.chatId || process.env.TELEGRAM_CHAT_ID || '').trim();
  const enabled = saved.enabled !== undefined ? Boolean(saved.enabled) : Boolean(botToken && chatId);
  const notifyOnRSVP = saved.notifyOnRSVP !== undefined ? Boolean(saved.notifyOnRSVP) : true;
  const notifyOnWish = saved.notifyOnWish !== undefined ? Boolean(saved.notifyOnWish) : true;
  const autoBackupHours = parseInt(saved.autoBackupHours || 12, 10);
  const lastBackupAt = saved.lastBackupAt || null;

  return {
    enabled,
    botToken,
    chatId,
    notifyOnRSVP,
    notifyOnWish,
    autoBackupHours,
    lastBackupAt
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
    return weddingData.telegram;
  } catch (err) {
    console.error('[Telegram] Failed to save config:', err.message);
    throw err;
  }
}

// Send simple HTML message to Telegram
async function sendMessage(text, customToken = null, customChatId = null) {
  const config = getConfig();
  const token = customToken || config.botToken;
  const chatId = customChatId || config.chatId;

  if (!token || !chatId) {
    return { success: false, error: 'Telegram Bot Token or Chat ID is missing' };
  }

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
      return { success: false, error: data.description || 'Failed to send message' };
    }
    return { success: true, result: data.result };
  } catch (err) {
    console.error('[Telegram] Send message error:', err.message);
    return { success: false, error: err.message };
  }
}

// Send backup document file to Telegram
async function sendBackup(reason = 'Manual Backup') {
  const config = getConfig();
  if (!config.botToken || !config.chatId) {
    return { success: false, error: 'Telegram Bot Token or Chat ID is not configured' };
  }

  try {
    const wedding = readJSON(WEDDING_FILE, {});
    const guests = readJSON(GUESTS_FILE, []);
    const wishes = readJSON(WISHES_FILE, []);
    const users = readJSON(USERS_FILE, []);

    const safeWedding = { ...wedding };
    delete safeWedding.admin;

    const totalGuests = Array.isArray(guests) ? guests.length : 0;
    const confirmed = Array.isArray(guests) ? guests.filter(g => g.status === 'confirmed').length : 0;
    const declined = Array.isArray(guests) ? guests.filter(g => g.status === 'declined').length : 0;
    const pending = Array.isArray(guests) ? guests.filter(g => g.status === 'pending').length : 0;
    const totalPax = Array.isArray(guests)
      ? guests.reduce((sum, g) => sum + (g.status === 'confirmed' ? (parseInt(g.attendees, 10) || 1) : 0), 0)
      : 0;

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8);

    const bundle = {
      backupSource: 'E-Invitation Wedding System',
      storageType: 'File-Based Atomic Storage (data/*.json)',
      exportedAt: now.toISOString(),
      reason,
      summary: {
        totalGuests,
        confirmed,
        declined,
        pending,
        totalPaxAttending: totalPax,
        totalWishes: wishes.length
      },
      wedding: safeWedding,
      guests,
      wishes,
      usersCount: users.length
    };

    const fileName = `wedding-backup-${dateStr}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}.json`;
    const jsonString = JSON.stringify(bundle, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    const groomName = (wedding.wedding && wedding.wedding.groom && wedding.wedding.groom.name_kh) || 'កូនកំលោះ';
    const brideName = (wedding.wedding && wedding.wedding.bride && wedding.wedding.bride.name_kh) || 'កូនក្រមុំ';

    const caption = [
      `💍 <b>E-INVITATION SYSTEM BACKUP</b>`,
      `👰🤵 <b>${groomName} & ${brideName}</b>`,
      `📅 កាលបរិច្ឆេទ: <code>${dateStr} ${timeStr}</code>`,
      `📌 មូលហេតុ: <b>${reason}</b>`,
      ``,
      `📊 <b>ស្ថិតិទិន្នន័យបច្ចុប្បន្ន (Current Data):</b>`,
      `• ភ្ញៀវសរុប: <b>${totalGuests} នាក់</b>`,
      `• បានបញ្ជាក់ចូលរួម: <b>${confirmed} នាក់</b> (${totalPax} Pax)`,
      `• មិនអាចចូលរួម: <b>${declined} នាក់</b>`,
      `• រង់ចាំឆ្លើយតប: <b>${pending} នាក់</b>`,
      `• សារជូនពរ: <b>${wishes.length} សារ</b>`,
      ``,
      `📁 <i>ឯកសារ JSON Backup ត្រូវបានភ្ជាប់ជាមួយសារនេះ។ អ្នកអាចទាញយកទៅ Restore វិញបានគ្រប់ពេល។</i>`
    ].join('\n');

    const formData = new FormData();
    formData.append('chat_id', config.chatId);
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    formData.append('document', blob, fileName);

    console.log(`[Telegram] Uploading backup document ${fileName} to chat ${config.chatId}...`);
    const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendDocument`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('[Telegram] Backup upload failed:', data.description);
      return { success: false, error: data.description || 'Failed to send backup document' };
    }

    // Save last backup timestamp
    saveConfig({ lastBackupAt: now.toISOString() });
    console.log(`[Telegram] Backup successfully delivered to Telegram! Message ID: ${data.result.message_id}`);

    return {
      success: true,
      fileName,
      messageId: data.result.message_id,
      timestamp: now.toISOString()
    };
  } catch (err) {
    console.error('[Telegram] Backup error:', err.message);
    return { success: false, error: err.message };
  }
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

  // Trigger a debounced backup 3 minutes after an RSVP
  scheduleDebouncedBackup('New RSVP Received');
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
  const text = [
    `🔔 <b>E-INVITATION TELEGRAM BOT TEST</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `✅ ការតភ្ជាប់បានជោគជ័យ! (Connection Successful)`,
    `🤖 Bot របស់អ្នកត្រូវបានភ្ជាប់ជាមួយប្រព័ន្ធសំបុត្រអាពាហ៍ពិពាហ៍ឌីជីថលរួចរាល់។`,
    `📦 ប្រព័ន្ធនឹងផ្ញើឯកសារ Backup ដោយស្វ័យប្រវត្តិមកកាន់ Chat នេះ!`,
    `⏰ <code>${new Date().toLocaleString('km-KH')}</code>`
  ].join('\n');

  return await sendMessage(text, botToken, chatId);
}

// Debounced auto-backup helper
let debouncedTimer = null;
function scheduleDebouncedBackup(reason) {
  const config = getConfig();
  if (!config.enabled) return;

  if (debouncedTimer) clearTimeout(debouncedTimer);
  debouncedTimer = setTimeout(async () => {
    try {
      console.log(`[Telegram] Running debounced backup: ${reason}...`);
      await sendBackup(reason);
    } catch (e) {
      console.warn('[Telegram] Debounced backup failed:', e.message);
    }
  }, 3 * 60 * 1000); // 3 minutes debounce
}

// Background Cron-style Interval Checker
let intervalTimer = null;
function startAutoBackupScheduler() {
  if (intervalTimer) clearInterval(intervalTimer);

  // Check every 30 minutes
  intervalTimer = setInterval(async () => {
    const config = getConfig();
    if (!config.enabled || !config.botToken || !config.chatId) return;

    const hours = Math.max(1, config.autoBackupHours || 12);
    const intervalMs = hours * 60 * 60 * 1000;

    const lastTime = config.lastBackupAt ? new Date(config.lastBackupAt).getTime() : 0;
    const now = Date.now();

    if (now - lastTime >= intervalMs) {
      console.log(`[Telegram] Triggering scheduled auto-backup (every ${hours}h)...`);
      await sendBackup(`Auto Scheduled Backup (${hours}h interval)`);
    }
  }, 30 * 60 * 1000);

  console.log('[Telegram] Auto-backup scheduler initialized.');
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
