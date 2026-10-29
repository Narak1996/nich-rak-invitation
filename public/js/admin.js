// Admin State
let weddingData = null;
let guestList = [];
let wishesList = [];
let currentUser = null;
let usersList = [];
let isSlugManuallyEdited = false;

// Helper to convert English names into clean URL slugs with hyphens (-)
function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('admin_token');
  const authHeaders = token ? { 'Authorization': 'Bearer ' + token } : {};

  // Check auth
  try {
    const authRes = await fetch('/api/auth/check', { headers: authHeaders });
    const auth = await authRes.json();
    if (!auth || !auth.authenticated) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
      return;
    }
  } catch (err) {
    console.error('Auth check error:', err);
    window.location.href = '/login';
    return;
  }

  // Fetch current user profile
  try {
    const meRes = await fetch('/api/auth/me', { headers: authHeaders });
    if (meRes.ok) {
      currentUser = await meRes.json();
      renderCurrentUserInfo();
    }
  } catch (err) {
    console.error('Failed to load user profile:', err);
  }

  initTabs();
  initModals();
  await loadAllData();
  initFormListeners();
});

// Load all initial data
async function loadAllData() {
  await Promise.all([
    checkDBStatus(),
    loadDBDiagnostics(),
    loadStats(),
    loadWeddingData(),
    loadGuests(),
    loadWishes(),
    loadUsers()
  ]);
}

// Check Database Connection Status (MongoDB Atlas vs Local Files)
async function checkDBStatus() {
  try {
    const res = await fetch('/api/db-status');
    if (res.ok) {
      const data = await res.json();
      const dot = document.getElementById('db-status-dot');
      const text = document.getElementById('db-status-text');
      const badge = document.getElementById('db-status-badge');
      if (dot && text && badge) {
        badge.classList.remove('hidden');
        if (data.connected) {
          dot.className = 'w-2 h-2 rounded-full bg-green-500 animate-pulse';
          text.textContent = '🟢 MongoDB: ' + (data.databaseName || 'Connected');
          badge.className = 'hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 border border-green-200 rounded-xl text-[11px] font-semibold text-green-700';
          badge.title = 'ទិន្នន័យត្រូវបានភ្ជាប់ផ្ទាល់ជាមួយ MongoDB Atlas Database: ' + (data.databaseName || '');
          badge.onclick = null;
        } else if (data.hasEnv) {
          dot.className = 'w-2 h-2 rounded-full bg-red-500';
          text.textContent = '🔴 MongoDB Error';
          badge.className = 'hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-xl text-[11px] font-semibold text-red-700 cursor-pointer';
          badge.title = 'DB Error: ' + (data.error || 'Connection Failed') + ' (ចុចដើម្បីមើល)';
          badge.onclick = () => alert('MongoDB Connection Error:\n\n' + (data.error || 'Failed to connect') + '\n\nសូមពិនិត្យ IP Whitelist (0.0.0.0/0) លើ MongoDB Atlas Network Access និង Username/Password ក្នុង MONGODB_URI។');
        } else {
          dot.className = 'w-2 h-2 rounded-full bg-amber-500';
          text.textContent = '🟡 Local File Storage';
          badge.className = 'hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-semibold text-amber-800 cursor-pointer';
          badge.title = 'មិនទាន់មាន MONGODB_URI! ចុចដើម្បីមើលការណែនាំ';
          badge.onclick = () => alert('ប្រព័ន្ធកំពុងដំណើរការលើ Local JSON Files ព្រោះពុំទាន់មាន MONGODB_URI។\n\nដើម្បីភ្ជាប់ Cloud Database:\n1. បង្កើត file .env រួចដាក់ MONGODB_URI="mongodb+srv://..."\n2. ឬប្រសិនបើបង្ហោះលើ Render សូមចូលទៅ Environment Variables រួចបន្ថែម MONGODB_URI។');
        }
      }
    }
  } catch (e) {
    console.error('Failed to check DB status:', e);
  }
}

// Switch to Database tab from anywhere (e.g. Header badge)
window.switchToDatabaseTab = function() {
  const dbTabBtn = document.querySelector('[data-target="tab-database"]');
  if (dbTabBtn) {
    dbTabBtn.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof loadDBDiagnostics === 'function') loadDBDiagnostics();
  }
};

// Copy masked URI
window.copyMaskedUri = function() {
  const input = document.getElementById('diag-masked-uri');
  if (input) {
    input.select();
    navigator.clipboard.writeText(input.value).then(() => {
      showToast('បានចម្លង URI Connection String!');
    }).catch(() => {
      document.execCommand('copy');
      showToast('បានចម្លង URI Connection String!');
    });
  }
};

// Load detailed DB diagnostics
window.loadDBDiagnostics = async function() {
  try {
    const res = await fetch('/api/db/diagnostics');
    if (!res.ok) return;
    const d = await res.json();

    // 1. Screen Status Badge & Tab Indicator
    const badge = document.getElementById('db-screen-status-badge');
    const tabDot = document.getElementById('tab-db-indicator');
    if (d.connected) {
      if (badge) {
        badge.textContent = '🟢 Connected: MongoDB Atlas';
        badge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800';
      }
      if (tabDot) tabDot.className = 'w-2 h-2 rounded-full bg-green-500 animate-pulse';
    } else if (d.hasEnv) {
      if (badge) {
        badge.textContent = '🔴 Connection Error';
        badge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800';
      }
      if (tabDot) tabDot.className = 'w-2 h-2 rounded-full bg-red-500';
    } else {
      if (badge) {
        badge.textContent = '🟡 Local File Storage';
        badge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800';
      }
      if (tabDot) tabDot.className = 'w-2 h-2 rounded-full bg-amber-400';
    }

    // 2. Banner Card
    const bannerCard = document.getElementById('db-banner-card');
    const bannerIconBg = document.getElementById('db-banner-icon-bg');
    const bannerIcon = document.getElementById('db-banner-icon');
    const bannerTitle = document.getElementById('db-banner-title');
    const bannerDesc = document.getElementById('db-banner-desc');
    const bannerPing = document.getElementById('db-banner-ping');
    const bannerLastSync = document.getElementById('db-banner-last-sync');

    if (bannerLastSync) {
      bannerLastSync.textContent = d.lastSyncTime ? new Date(d.lastSyncTime).toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'ឥឡូវនេះ (Just now)';
    }

    if (d.connected) {
      if (bannerCard) bannerCard.className = 'p-5 rounded-2xl border transition-all mb-6 bg-green-50/70 border-green-200';
      if (bannerIconBg) bannerIconBg.className = 'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-green-500 text-white text-xl shadow-xs';
      if (bannerIcon) bannerIcon.textContent = '🟢';
      if (bannerTitle) bannerTitle.textContent = `ភ្ជាប់ជោគជ័យជាមួយ MongoDB Atlas (Database: "${d.databaseName || 'wedding'}")`;
      if (bannerDesc) bannerDesc.textContent = 'ទិន្នន័យទាំងអស់ (ភ្ញៀវ, ពាក្យជូនពរ, រូបថត) ត្រូវបាន Sync ផ្ទាល់លើ Cloud ឥតបាត់បង់ពេល Deploy ឡើងវិញឡើយ។';
      if (bannerPing) {
        bannerPing.classList.remove('hidden');
        bannerPing.textContent = (d.pingMs !== null ? `${d.pingMs} ms` : 'Active');
        bannerPing.className = 'text-[10px] font-mono px-2 py-0.5 rounded-md bg-green-100 border border-green-300 text-green-800 font-bold';
      }
    } else if (d.hasEnv) {
      if (bannerCard) bannerCard.className = 'p-5 rounded-2xl border transition-all mb-6 bg-red-50/70 border-red-200';
      if (bannerIconBg) bannerIconBg.className = 'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-red-500 text-white text-xl shadow-xs';
      if (bannerIcon) bannerIcon.textContent = '🔴';
      if (bannerTitle) bannerTitle.textContent = 'មិនអាចភ្ជាប់ទៅកាន់ MongoDB Atlas (Connection Failed)';
      if (bannerDesc) bannerDesc.textContent = 'ប្រព័ន្ធកំពុងដំណើរការជាបណ្ដោះអាសន្នលើ Local File Storage (data/*.json) ដោយសារកំហុសខាងក្រោម៖';
      if (bannerPing) bannerPing.classList.add('hidden');
    } else {
      if (bannerCard) bannerCard.className = 'p-5 rounded-2xl border transition-all mb-6 bg-amber-50/70 border-amber-200';
      if (bannerIconBg) bannerIconBg.className = 'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-amber-400 text-amber-900 text-xl shadow-xs';
      if (bannerIcon) bannerIcon.textContent = '🟡';
      if (bannerTitle) bannerTitle.textContent = 'ដំណើរការលើ Local File Storage (មិនទាន់ភ្ជាប់ Cloud Database)';
      if (bannerDesc) bannerDesc.textContent = 'ពុំទាន់មាន MONGODB_URI ក្នុង Environment។ ទិន្នន័យកំពុងរក្សាទុកក្នុង file JSON លើកុំព្យូទ័រមូលដ្ឋាន។';
      if (bannerPing) bannerPing.classList.add('hidden');
    }

    // Global Dashboard Banner (Always Visible on Main Dashboard)
    const gBanner = document.getElementById('global-db-banner');
    const gIconBg = document.getElementById('global-db-icon-bg');
    const gIcon = document.getElementById('global-db-icon');
    const gTitle = document.getElementById('global-db-title');
    const gDesc = document.getElementById('global-db-desc');
    const gPing = document.getElementById('global-db-ping');

    if (d.connected) {
      if (gBanner) gBanner.className = 'mb-6 p-4 rounded-2xl border transition-all bg-green-50/80 border-green-200 shadow-2xs';
      if (gIconBg) gIconBg.className = 'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-green-500 text-white text-base shadow-xs';
      if (gIcon) gIcon.textContent = '🟢';
      if (gTitle) gTitle.textContent = `MongoDB Atlas Connected: "${d.databaseName || 'wedding'}"`;
      if (gDesc) gDesc.textContent = `Cloud Database ដំណើរការរលូន | Host: ${d.host || 'Cluster'} | Collections In Sync`;
      if (gPing) {
        gPing.classList.remove('hidden');
        gPing.textContent = (d.pingMs !== null ? `${d.pingMs} ms` : 'Active');
        gPing.className = 'text-[10px] font-mono px-2 py-0.5 rounded-md bg-green-100 border border-green-300 text-green-800 font-bold';
      }
    } else if (d.hasEnv) {
      if (gBanner) gBanner.className = 'mb-6 p-4 rounded-2xl border transition-all bg-red-50/90 border-red-200 shadow-2xs';
      if (gIconBg) gIconBg.className = 'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-red-500 text-white text-base shadow-xs';
      if (gIcon) gIcon.textContent = '🔴';
      if (gTitle) gTitle.textContent = 'កំហុសតភ្ជាប់ MongoDB (Connection Error)';
      if (gDesc) gDesc.textContent = d.error ? (d.error.slice(0, 110) + '... [ចុច មើលលម្អិត ដើម្បីពិនិត្យវិធីដោះស្រាយ]') : 'មិនអាចភ្ជាប់ទៅកាន់ MongoDB Atlas បានឡើយ';
      if (gPing) gPing.classList.add('hidden');
    } else {
      if (gBanner) gBanner.className = 'mb-6 p-4 rounded-2xl border transition-all bg-amber-50/90 border-amber-200 shadow-2xs';
      if (gIconBg) gIconBg.className = 'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-400 text-amber-900 text-base shadow-xs';
      if (gIcon) gIcon.textContent = '🟡';
      if (gTitle) gTitle.textContent = 'ដំណើរការលើ Local File Storage (data/*.json)';
      if (gDesc) gDesc.textContent = 'មិនទាន់មាន MONGODB_URI ក្នុង Environment។ ចុច "មើលលម្អិត" ដើម្បីមើលការណែនាំភ្ជាប់ Cloud Database។';
      if (gPing) gPing.classList.add('hidden');
    }

    // 3. Error Box
    const errorBox = document.getElementById('db-error-box');
    const errorMsg = document.getElementById('db-error-message');
    if (d.error && !d.connected) {
      if (errorBox) errorBox.classList.remove('hidden');
      if (errorMsg) errorMsg.textContent = d.error;
    } else {
      if (errorBox) errorBox.classList.add('hidden');
    }

    // 4. Metrics Cards
    const diagModeText = document.getElementById('diag-mode-text');
    const diagModeDot = document.getElementById('diag-mode-dot');
    const diagModeSub = document.getElementById('diag-mode-sub');
    if (diagModeText) diagModeText.textContent = d.connected ? 'MongoDB Atlas' : 'Local File Storage';
    if (diagModeDot) diagModeDot.className = `w-2.5 h-2.5 rounded-full ${d.connected ? 'bg-green-500' : 'bg-amber-400'}`;
    if (diagModeSub) diagModeSub.textContent = d.connected ? 'Cloud Distributed MongoDB' : 'data/*.json Files';

    const diagDbName = document.getElementById('diag-dbname');
    if (diagDbName) diagDbName.textContent = d.databaseName || (d.hasEnv ? 'Pending' : 'None');

    const diagHost = document.getElementById('diag-host');
    if (diagHost) {
      diagHost.textContent = d.host || 'None (Local)';
      diagHost.title = d.host || 'Local Storage';
    }

    const diagPing = document.getElementById('diag-ping');
    const diagPingSub = document.getElementById('diag-ping-sub');
    if (diagPing) diagPing.textContent = d.pingMs !== null ? `${d.pingMs} ms` : (d.connected ? 'Active' : '--');
    if (diagPingSub) diagPingSub.textContent = d.connected ? 'Direct Latency' : 'No Connection';

    // 5. Collections Table Numbers
    const c = d.collections || {};
    const setCol = (name, dbCount, localCount) => {
      const elDb = document.getElementById(`stat-col-${name}-db`);
      const elLocal = document.getElementById(`stat-col-${name}-local`);
      const elStatus = document.getElementById(`stat-col-${name}-status`);
      if (elDb) elDb.textContent = dbCount;
      if (elLocal) elLocal.textContent = localCount;
      if (elStatus) {
        if (d.connected) {
          elStatus.innerHTML = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">🟢 In Sync</span>';
        } else {
          elStatus.innerHTML = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">🟡 Local Fallback</span>';
        }
      }
    };

    setCol('guests', c.guests ? c.guests.count : 0, c.guests ? c.guests.localCount : 0);
    setCol('wishes', c.wishes ? c.wishes.count : 0, c.wishes ? c.wishes.localCount : 0);
    setCol('users', c.users ? c.users.count : 0, c.users ? c.users.localCount : 0);

    const elWeddingDb = document.getElementById('stat-col-wedding-db');
    const elWeddingLocal = document.getElementById('stat-col-wedding-local');
    if (elWeddingDb) elWeddingDb.textContent = (c.wedding && c.wedding.exists) ? 'Active' : 'Unset';
    if (elWeddingLocal) elWeddingLocal.textContent = (c.wedding && c.wedding.localCount > 0) ? 'Active' : 'Unset';

    const elUploadsDb = document.getElementById('stat-col-uploads-db');
    if (elUploadsDb) elUploadsDb.textContent = `${c.uploads ? c.uploads.count : 0} files`;

    // 6. Masked URI
    const inputUri = document.getElementById('diag-masked-uri');
    if (inputUri) inputUri.value = d.maskedUri || 'Not Configured';

    const uriSource = document.getElementById('diag-uri-source');
    if (uriSource) uriSource.textContent = d.hasEnv ? 'process.env.MONGODB_URI' : 'Not Found';

  } catch (err) {
    console.error('Failed to load DB diagnostics:', err);
  }
};

// Reconnect to DB button handler
window.reconnectDB = async function() {
  const spin = document.getElementById('icon-reconnect-spin');
  if (spin) spin.classList.add('animate-spin');
  showToast('កំពុងតេស្ត និងភ្ជាប់ទៅកាន់ MongoDB Atlas ឡើងវិញ...');

  try {
    const res = await fetch('/api/db/reconnect', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('🟢 ភ្ជាប់ជោគជ័យជាមួយ MongoDB Atlas!');
    } else {
      showToast('🔴 មិនអាចភ្ជាប់បាន៖ ' + (data.diagnostics ? data.diagnostics.error : 'Failed'));
    }
    await checkDBStatus();
    await loadDBDiagnostics();
    await loadGuests();
    await loadStats();
  } catch (err) {
    showToast('កំហុសពេលភ្ជាប់ DB៖ ' + err.message);
  } finally {
    if (spin) spin.classList.remove('animate-spin');
    if (gSpin) gSpin.classList.remove('animate-spin');
  }
};

// Force Sync cache button handler
window.syncDB = async function() {
  const spin = document.getElementById('icon-sync-spin');
  if (spin) spin.classList.add('animate-spin');
  showToast('កំពុងទាញទិន្នន័យថ្មីពី Database...');

  try {
    const res = await fetch('/api/db/sync', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('⚡ បានទាញទិន្នន័យពី DB ជោគជ័យ!');
    }
    await checkDBStatus();
    await loadDBDiagnostics();
    await loadGuests();
    await loadStats();
    await loadWishes();
  } catch (err) {
    showToast('កំហុសពេល Sync៖ ' + err.message);
  } finally {
    if (spin) spin.classList.remove('animate-spin');
  }
};


// Load stats
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const stats = await res.json();
    document.getElementById('stat-total').textContent = stats.totalGuests;
    document.getElementById('stat-confirmed').textContent = stats.confirmed;
    document.getElementById('stat-declined').textContent = stats.declined;
    document.getElementById('stat-pax').textContent = stats.totalPaxAttending;
    document.getElementById('stat-wishes').textContent = stats.wishesCount;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
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

const THEME_PRESETS = {
  'khmer-traditional': {
    id: 'khmer-traditional',
    name: 'ខ្មែរប្រពៃណី',
    primaryColor: '#1E4833',
    accentColor: '#C5A059',
    secondaryColor: '#2D5A43',
    bgColor: '#FAF6ED',
    emblem: 'romduol',
    sealEmblem: 'romduol'
  }
};

// Load wedding details & populate form
async function loadWeddingData() {
  try {
    const res = await fetch('/api/wedding');
    weddingData = await res.json();
    const w = weddingData.wedding;

    // Header couple
    document.getElementById('header-couple-sub').textContent = `${w.groom.name_en} & ${w.bride.name_en}`;

    // Theme preset
    const currentThemeId = (weddingData.theme && weddingData.theme.id) || 'khmer-traditional';
    document.getElementById('selected-theme-id').value = currentThemeId;
    updateThemeSelectionUI(currentThemeId);

    // Groom
    document.getElementById('groom-name-kh').value = w.groom.name_kh || '';
    document.getElementById('groom-name-en').value = w.groom.name_en || '';
    document.getElementById('groom-father-kh').value = w.groom.father_kh || '';
    document.getElementById('groom-mother-kh').value = w.groom.mother_kh || '';
    document.getElementById('groom-photo').value = w.groom.photo || '';

    // Bride
    document.getElementById('bride-name-kh').value = w.bride.name_kh || '';
    document.getElementById('bride-name-en').value = w.bride.name_en || '';
    document.getElementById('bride-father-kh').value = w.bride.father_kh || '';
    document.getElementById('bride-mother-kh').value = w.bride.mother_kh || '';
    document.getElementById('bride-photo').value = w.bride.photo || '';

    // Couple photo & quotes
    document.getElementById('couple-photo-url').value = w.couple_photo || '';
    document.getElementById('quote-kh').value = w.quote_kh || '';
    document.getElementById('quote-en').value = w.quote_en || '';

    // Date & Venue
    if (w.event_date) {
      document.getElementById('event-datetime').value = w.event_date.slice(0, 16);
    }
    document.getElementById('date-solar-kh').value = w.date_solar_kh || '';
    document.getElementById('date-lunar-kh').value = w.date_lunar_kh || '';
    document.getElementById('venue-name-kh').value = w.venue_name_kh || '';
    document.getElementById('venue-address-kh').value = w.venue_address_kh || '';
    document.getElementById('map-url').value = w.map_url || '';
    document.getElementById('map-embed-url').value = w.map_embed || '';

    // Music & Video
    document.getElementById('music-url').value = w.music_url || '';
    document.getElementById('video-url').value = w.video_embed || '';

    // Digital Gift
    if (weddingData.digital_gift) {
      const dg = weddingData.digital_gift;
      document.getElementById('dg-groom-bank').value = dg.groom_account.bank_name || '';
      document.getElementById('dg-groom-name').value = dg.groom_account.account_name || '';
      document.getElementById('dg-groom-acc').value = dg.groom_account.account_number || '';
      document.getElementById('dg-groom-qr').value = dg.groom_account.qr_image || '';

      document.getElementById('dg-bride-bank').value = dg.bride_account.bank_name || '';
      document.getElementById('dg-bride-name').value = dg.bride_account.account_name || '';
      document.getElementById('dg-bride-acc').value = dg.bride_account.account_number || '';
      document.getElementById('dg-bride-qr').value = dg.bride_account.qr_image || '';
    }

    
    // Populate Image Previews
    const setPrev = (id, url) => {
      const el = document.getElementById(id);
      if (el) {
        if (url) { el.src = url; el.classList.remove('hidden'); }
        else { el.classList.add('hidden'); }
      }
    };
    setPrev('groom-photo-preview', w.groom.photo);
    setPrev('bride-photo-preview', w.bride.photo);
    setPrev('couple-photo-preview', w.couple_photo);
    if (weddingData.digital_gift) {
      setPrev('dg-groom-qr-preview', weddingData.digital_gift.groom_account?.qr_image);
      setPrev('dg-bride-qr-preview', weddingData.digital_gift.bride_account?.qr_image);
    }

    renderAdminAgenda();
    renderAdminGallery();
  } catch (err) {
    console.error('Failed to load wedding data:', err);
  }
}

// Load guests
async function loadGuests() {
  try {
    const res = await fetch('/api/guests');
    if (!res.ok) return;
    guestList = await res.json();
    renderGuestsTable();
  } catch (err) {
    console.error('Failed to load guests:', err);
  }
}

// Render guests table
function renderGuestsTable() {
  const tbody = document.getElementById('guests-table-body');
  tbody.innerHTML = '';

  const search = document.getElementById('guest-search').value.toLowerCase().trim();
  const filterStatus = document.getElementById('guest-filter-status').value;
  const filterSide = document.getElementById('guest-filter-side').value;

  const filtered = guestList.filter(g => {
    if (search && !((g.name && g.name.toLowerCase().includes(search)) || (g.name_en && g.name_en.toLowerCase().includes(search)))) return false;
    if (filterStatus && g.status !== filterStatus) return false;
    if (filterSide && g.side !== filterSide) return false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-[#7A6F68]">មិនមានទិន្នន័យភ្ញៀវត្រូវតាមការស្វែងរកឡើយ</td></tr>`;
    return;
  }

  filtered.forEach(g => {
    // Generate personalized friendly short invitation URL
    const shortKey = (g.slug && !g.slug.startsWith('guest-')) ? g.slug : (g.id || encodeURIComponent(g.name));
    const guestUrl = `${window.location.origin}/to/${shortKey}`;
    const statusBadges = {
      'confirmed': '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800">✓ ចូលរួម (Confirmed)</span>',
      'declined': '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">✕ មិនចូលរួម (Declined)</span>',
      'pending': '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">⏳ រង់ចាំ (Pending)</span>'
    };

    // Pre-composed invitation text in Khmer
    // Telegram share API already attaches ?url=, so we do NOT duplicate the URL inside &text=
    const tgText = encodeURIComponent(`សូមគោរពអញ្ជើញ ${g.name} ចូលរួមជាអធិបតី និងជាភ្ញៀវកិត្តិយស ក្នុងពិធីមង្គលការរបស់យើងខ្ញុំ ឡេង ចាន់ណារៈ & នាត ស្រីនិច។\n\n💌 សូមចុចតំណភ្ជាប់ខាងលើដើម្បីបើកសំបុត្រអញ្ជើញ`);
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(guestUrl)}&text=${tgText}`;
    
    // WhatsApp does not have a separate url parameter, so include link at bottom
    const waText = encodeURIComponent(`សូមគោរពអញ្ជើញ ${g.name} ចូលរួមជាអធិបតី និងជាភ្ញៀវកិត្តិយស ក្នុងពិធីមង្គលការរបស់យើងខ្ញុំ ឡេង ចាន់ណារៈ & នាត ស្រីនិច។\n\n💌 សូមចុចតំណភ្ជាប់ខាងក្រោមដើម្បីបើកសំបុត្រអញ្ជើញ៖\n${guestUrl}`);
    const waUrl = `https://api.whatsapp.com/send?text=${waText}`;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50/80 transition';
    tr.innerHTML = `
      <td class="p-3">
        <span class="font-bold text-[#4E3227] text-xs block">${escapeHTML(g.name)}</span>
        <span class="text-[11px] text-[#7A6F68] block">${escapeHTML(g.name_en || '')}</span>
        <a href="${guestUrl}" target="_blank" class="text-[10px] text-[#C5A059] hover:underline font-mono inline-flex items-center gap-1 mt-0.5" title="ចុចដើម្បីបើកតំណភ្ជាប់">
          <span>🔗 /to/${escapeHTML(shortKey)}</span>
        </a>
      </td>
      <td class="p-3">
        <span class="px-2 py-0.5 rounded-md text-[11px] ${g.side === 'groom' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'} font-medium">
          ${g.side === 'groom' ? 'ខាងប្រុស' : 'ខាងស្រី'}
        </span>
      </td>
      <td class="p-3">
        <span class="text-xs text-[#7A6F68]">${escapeHTML(g.category || 'General')}</span>
      </td>
      <td class="p-3">
        <span class="text-xs font-bold text-[#4E3227]">${g.attendees || 0} / ${g.pax_allowed || 1}</span>
      </td>
      <td class="p-3">
        ${statusBadges[g.status] || statusBadges['pending']}
      </td>
      <td class="p-3 text-center">
        <div class="flex items-center justify-center gap-1.5">
          <!-- Copy link -->
          <button onclick="copyToClipboard('${guestUrl}')" class="p-1.5 rounded-lg bg-gray-100 hover:bg-[#FAF7F2] text-[#4E3227] border border-[#E5D5BC]" title="Copy Invitation Link">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
          </button>
          <!-- Telegram -->
          <a href="${tgUrl}" target="_blank" class="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-600 border border-sky-200" title="Share via Telegram">
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
          </a>
          <!-- WhatsApp -->
          <a href="${waUrl}" target="_blank" class="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200" title="Share via WhatsApp">
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
          </a>
          <!-- Print QR -->
          <button onclick="openGuestQR('${guestUrl}', '${escapeHTML(g.name)}')" class="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200" title="Print QR Code">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg>
          </button>
        </div>
      </td>
      <td class="p-3 text-right">
        <div class="flex items-center justify-end gap-1">
          <button onclick="editGuest('${g.id}')" class="p-1 text-gray-400 hover:text-[#4E3227]" title="Edit">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button onclick="deleteGuest('${g.id}')" class="p-1 text-gray-400 hover:text-red-600" title="Delete">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Open Add Agenda Modal
window.openAddAgendaModal = function() {
  document.getElementById('form-save-agenda').reset();
  document.getElementById('modal-agenda-id').value = '';
  document.getElementById('modal-agenda-index').value = '-1';
  document.getElementById('modal-agenda-title').textContent = 'បន្ថែមកម្មវិធីមង្គលការ (Add Agenda)';
  document.getElementById('modal-agenda-time').value = '07:00 AM';
  document.getElementById('modal-agenda-period').value = 'morning';
  document.getElementById('modal-agenda').classList.add('active');
};

// Open Edit Agenda Modal
window.openEditAgendaModal = function(idx) {
  const item = weddingData.agenda[idx];
  if (!item) return;
  document.getElementById('modal-agenda-id').value = item.id || '';
  document.getElementById('modal-agenda-index').value = idx;
  document.getElementById('modal-agenda-title').textContent = 'កែប្រែកម្មវិធីមង្គលការ (Edit Agenda)';
  document.getElementById('modal-agenda-time').value = item.time || '';
  document.getElementById('modal-agenda-period').value = item.period || 'morning';
  document.getElementById('modal-agenda-title-kh').value = item.title_kh || '';
  document.getElementById('modal-agenda-title-en').value = item.title_en || '';
  document.getElementById('modal-agenda-desc-kh').value = item.desc_kh || '';
  document.getElementById('modal-agenda-desc-en').value = item.desc_en || '';
  document.getElementById('modal-agenda-location-kh').value = item.location_kh || '';
  document.getElementById('modal-agenda-icon').value = item.icon || 'gift';
  document.getElementById('modal-agenda').classList.add('active');
};

// Render Agenda in Admin
function renderAdminAgenda() {
  const container = document.getElementById('admin-agenda-list');
  container.innerHTML = '';
  if (!weddingData || !weddingData.agenda) return;

  weddingData.agenda.forEach((item, index) => {
    const el = document.createElement('div');
    el.className = 'p-4 rounded-2xl bg-[#FAF7F2] border border-[#E5D5BC] flex items-center justify-between gap-4';
    const periodLabel = item.period === 'evening' ? '🌙 ពេលល្ងាច' : '☀️ ពេលព្រឹក';
    el.innerHTML = `
      <div class="flex items-center gap-4 flex-wrap">
        <span class="px-3 py-1 bg-white font-mono text-xs font-bold text-[#4E3227] rounded-full border border-[#E5D5BC]">${item.time}</span>
        <span class="px-2.5 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-bold rounded-full border border-amber-200">${periodLabel}</span>
        <div>
          <h4 class="font-bold text-xs text-[#4E3227]">${escapeHTML(item.title_kh)} <span class="text-[#7A6F68] font-normal">(${escapeHTML(item.title_en || '')})</span></h4>
          <p class="text-[11px] text-[#7A6F68] mt-0.5">${escapeHTML(item.desc_kh || '')} ${item.location_kh ? `• 📍 ${escapeHTML(item.location_kh)}` : ''}</p>
        </div>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button onclick="openEditAgendaModal(${index})" class="p-1.5 rounded-lg bg-white hover:bg-[#FAF7F2] text-[#4E3227] border border-[#E5D5BC] transition cursor-pointer" title="កែប្រែ (Edit)">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
        </button>
        <button onclick="deleteAgendaItem(${index})" class="p-1.5 rounded-lg bg-white hover:bg-red-50 text-red-600 border border-red-200 transition cursor-pointer" title="លុប (Delete)">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    `;
    container.appendChild(el);
  });
}

// Drag and drop state for gallery reordering
let draggedGalleryIndex = null;

// Save gallery order to API
async function saveGalleryOrder(customMsg) {
  try {
    const res = await fetch('/api/wedding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...weddingData, gallery: weddingData.gallery })
    });
    if (res.ok) {
      showToast(customMsg || 'បានប្តូរលំដាប់រូបថតជោគជ័យ! (Photo order updated!)');
    } else {
      showToast('មានបញ្ហាក្នុងការរក្សាទុក (Failed to save order)', 'error');
    }
  } catch (err) {
    console.error('Failed to save gallery order:', err);
    showToast('Error saving order', 'error');
  }
}

// Move gallery item by relative direction (-1 for left/up, +1 for right/down)
window.moveGalleryItem = async function(fromIndex, direction) {
  if (!weddingData || !weddingData.gallery) return;
  const toIndex = fromIndex + direction;
  if (toIndex < 0 || toIndex >= weddingData.gallery.length) return;

  const item = weddingData.gallery.splice(fromIndex, 1)[0];
  weddingData.gallery.splice(toIndex, 0, item);

  renderAdminGallery();
  await saveGalleryOrder(`បានរំកិលរូបថតទៅទីតាំង #${toIndex + 1} ជោគជ័យ!`);
};

// Move gallery item straight to the first position
window.moveGalleryItemToTop = async function(fromIndex) {
  if (!weddingData || !weddingData.gallery || fromIndex <= 0) return;

  const item = weddingData.gallery.splice(fromIndex, 1)[0];
  weddingData.gallery.unshift(item);

  renderAdminGallery();
  await saveGalleryOrder('បានដាក់រូបថតទៅដើមគេបង្អស់ (#1) ជោគជ័យ!');
};

// Handle Drag & Drop reorder
window.handleGalleryDrop = async function(fromIndex, toIndex) {
  if (fromIndex === undefined || fromIndex === null || fromIndex === toIndex) return;
  if (!weddingData || !weddingData.gallery) return;
  if (fromIndex < 0 || fromIndex >= weddingData.gallery.length) return;
  if (toIndex < 0 || toIndex >= weddingData.gallery.length) return;

  const item = weddingData.gallery.splice(fromIndex, 1)[0];
  weddingData.gallery.splice(toIndex, 0, item);

  renderAdminGallery();
  await saveGalleryOrder(`បានផ្លាស់ប្តូរទីតាំងរូបថតពី #${fromIndex + 1} ទៅ #${toIndex + 1} ជោគជ័យ!`);
};

// Reverse the entire gallery order
window.reverseGalleryOrder = async function() {
  if (!weddingData || !weddingData.gallery || weddingData.gallery.length <= 1) return;
  if (!confirm('តើអ្នកពិតជាចង់ត្រឡប់លំដាប់រូបថតទាំងអស់មែនទេ? (Reverse order of all photos?)')) return;

  weddingData.gallery.reverse();
  renderAdminGallery();
  await saveGalleryOrder('បានត្រឡប់លំដាប់រូបថតទាំងអស់ជោគជ័យ!');
};

// Remove duplicate photos from gallery (by URL)
window.removeDuplicateGalleryPhotos = async function() {
  if (!weddingData || !weddingData.gallery || weddingData.gallery.length <= 1) {
    showToast('ពុំមានរូបថតស្ទួនទេ (No photos to deduplicate)');
    return;
  }
  const initialCount = weddingData.gallery.length;
  const seen = new Set();
  const unique = [];

  weddingData.gallery.forEach(item => {
    const key = resolveGoogleDriveUrl(item.url || '').trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      unique.push({
        ...item,
        url: key
      });
    }
  });

  const removed = initialCount - unique.length;
  if (removed === 0) {
    showToast('ពុំមានរូបថតស្ទួនទេ! គ្រប់រូបសុទ្ធតែខុសៗគ្នា (No duplicates found)');
    return;
  }

  weddingData.gallery = unique;
  renderAdminGallery();
  await saveGalleryOrder(`បានសម្អាតរូបថតស្ទួនចំនួន ${removed} រូបដោយជោគជ័យ!`);
};

// Edit gallery caption (Khmer & English)
window.editGalleryCaption = async function(index) {
  if (!weddingData || !weddingData.gallery || !weddingData.gallery[index]) return;
  const img = weddingData.gallery[index];
  const newKh = prompt('ចំណងជើងរូបថតជាភាសាខ្មែរ (Caption KH):', img.caption_kh || 'អនុស្សាវរីយ៍ដ៏ផ្អែមល្ហែម');
  if (newKh === null) return;
  const newEn = prompt('ចំណងជើងរូបថតជាភាសាអង់គ្លេស (Caption EN):', img.caption_en || 'Sweet Memories') || newKh;

  img.caption_kh = newKh.trim();
  img.caption_en = newEn.trim();

  renderAdminGallery();
  await saveGalleryOrder('បានកែប្រែចំណងជើងរូបថតជោគជ័យ!');
};

// Render Gallery in Admin
function renderAdminGallery() {
  const container = document.getElementById('admin-gallery-grid');
  if (!container) return;
  container.innerHTML = '';
  if (!weddingData || !weddingData.gallery || weddingData.gallery.length === 0) {
    container.innerHTML = `
      <div class="col-span-2 md:col-span-4 p-8 text-center bg-[#FAF6ED] rounded-2xl border-2 border-dashed border-[#E5D5BC]">
        <p class="text-sm font-semibold text-[#1E4833] mb-1">មិនទាន់មានរូបថតក្នុង Gallery នៅឡើយទេ</p>
        <p class="text-xs text-[#7A6F68]">សូមចុចប៊ូតុង "📷 ជ្រើសរើសរូបថត Upload" ខាងលើដើម្បីចាប់ផ្តើម</p>
      </div>
    `;
    return;
  }

  const total = weddingData.gallery.length;

  weddingData.gallery.forEach((img, index) => {
    const isFirst = index === 0;
    const isLast = index === total - 1;

    const el = document.createElement('div');
    el.className = 'gallery-admin-card relative rounded-2xl overflow-hidden border-2 border-[#E5D5BC] hover:border-[#1E4833] group aspect-4/5 shadow-xs transition-all duration-200 select-none cursor-grab active:cursor-grabbing bg-gray-100 flex flex-col justify-between';
    el.setAttribute('draggable', 'true');
    el.setAttribute('data-index', index);

    const displayUrl = resolveGoogleDriveUrl(img.url);

    el.innerHTML = `
      <!-- Thumbnail Image -->
      <img src="${escapeHTML(displayUrl)}" alt="${escapeHTML(img.caption_kh || 'Gallery')}" onerror="this.onerror=null; this.src='/images/wedding-og-cover.jpg'; this.classList.add('opacity-60');" class="w-full h-full object-cover pointer-events-none absolute inset-0" loading="lazy">

      <!-- Top Bar: Order Badge and Drag Grip -->
      <div class="relative z-10 p-2 flex items-center justify-between pointer-events-none">
        <span class="px-2.5 py-1 bg-black/75 backdrop-blur-xs text-white text-[11px] font-bold rounded-lg shadow-md border border-white/20 flex items-center gap-1.5">
          <span class="text-amber-300 font-mono">⋮⋮ #${index + 1}</span>
        </span>
        <span class="text-[10px] text-white/90 bg-[#1E4833]/90 px-2 py-0.5 rounded-md font-khmer-body shadow-xs opacity-0 group-hover:opacity-100 transition-opacity">
          អូសប្តូរទីតាំង
        </span>
      </div>

      <!-- Bottom Controls Bar -->
      <div class="relative z-10 bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-6 pb-2 px-2 flex flex-col gap-1.5">
        <!-- Caption Preview -->
        <p class="text-white text-[11px] font-medium truncate px-1 drop-shadow-xs" title="${escapeHTML(img.caption_kh || '')}">
          ${escapeHTML(img.caption_kh || '(គ្មានចំណងជើង)')}
        </p>

        <!-- Action Buttons Row -->
        <div class="flex items-center justify-between gap-1 pt-1 border-t border-white/20">
          <!-- Direction Buttons -->
          <div class="flex items-center gap-1">
            <button type="button" onclick="moveGalleryItem(${index}, -1)" ${isFirst ? 'disabled class="opacity-25 cursor-not-allowed text-gray-400 p-1.5 rounded-lg bg-black/40 text-xs"' : 'class="p-1.5 bg-white/95 hover:bg-white text-[#1E4833] rounded-lg text-xs font-bold shadow-xs transition hover:scale-110 active:scale-95 cursor-pointer" title="រំកិលទៅមុខ (Move Left)"'} aria-label="Move Left">
              ◀
            </button>
            <button type="button" onclick="moveGalleryItem(${index}, 1)" ${isLast ? 'disabled class="opacity-25 cursor-not-allowed text-gray-400 p-1.5 rounded-lg bg-black/40 text-xs"' : 'class="p-1.5 bg-white/95 hover:bg-white text-[#1E4833] rounded-lg text-xs font-bold shadow-xs transition hover:scale-110 active:scale-95 cursor-pointer" title="រំកិលទៅក្រោយ (Move Right)"'} aria-label="Move Right">
              ▶
            </button>
            ${!isFirst ? `
              <button type="button" onclick="moveGalleryItemToTop(${index})" class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold shadow-xs transition hover:scale-105 active:scale-95 cursor-pointer" title="រំកិលទៅមុខគេបង្អស់ (Move to #1)">
                ⏮ ដើម
              </button>
            ` : ''}
          </div>

          <!-- Edit & Delete -->
          <div class="flex items-center gap-1">
            <button type="button" onclick="editGalleryCaption(${index})" class="p-1.5 bg-white/95 hover:bg-white text-[#1E4833] rounded-lg shadow-xs transition hover:scale-110 active:scale-95 cursor-pointer" title="កែប្រែចំណងជើង (Edit Caption)">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            </button>
            <button type="button" onclick="deleteGalleryItem(${index})" class="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs transition hover:scale-110 active:scale-95 cursor-pointer" title="លុបរូបថត (Delete Photo)">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;

    // Drag and Drop Events
    el.addEventListener('dragstart', (e) => {
      draggedGalleryIndex = index;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      setTimeout(() => el.classList.add('opacity-40', 'scale-95', 'ring-4', 'ring-[#1E4833]'), 0);
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('opacity-40', 'scale-95', 'ring-4', 'ring-[#1E4833]');
      document.querySelectorAll('.gallery-admin-card').forEach(card => {
        card.classList.remove('border-[#1E4833]', 'scale-[1.03]', 'ring-4', 'ring-amber-400');
      });
      draggedGalleryIndex = null;
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (draggedGalleryIndex !== null && draggedGalleryIndex !== index) {
        el.classList.add('border-[#1E4833]', 'scale-[1.03]', 'ring-4', 'ring-amber-400');
      }
    });

    el.addEventListener('dragleave', () => {
      el.classList.remove('border-[#1E4833]', 'scale-[1.03]', 'ring-4', 'ring-amber-400');
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('border-[#1E4833]', 'scale-[1.03]', 'ring-4', 'ring-amber-400');
      const fromIdx = draggedGalleryIndex !== null ? draggedGalleryIndex : parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (!isNaN(fromIdx) && fromIdx !== index) {
        handleGalleryDrop(fromIdx, index);
      }
    });

    container.appendChild(el);
  });
}

// Load wishes in admin
async function loadWishes() {
  try {
    const res = await fetch('/api/wishes');
    wishesList = await res.json();
    const container = document.getElementById('admin-wishes-list');
    container.innerHTML = '';

    if (wishesList.length === 0) {
      container.innerHTML = `<p class="p-6 text-center text-xs text-[#7A6F68]">មិនទាន់មានសារជូនពរនៅឡើយទេ</p>`;
      return;
    }

    wishesList.forEach(w => {
      const el = document.createElement('div');
      el.className = 'p-4 rounded-2xl bg-[#FAF7F2] border border-[#E5D5BC] flex items-start justify-between gap-4';
      el.innerHTML = `
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="font-bold text-xs text-[#4E3227]">${escapeHTML(w.guestName)}</span>
            <span class="text-[10px] text-[#C5A059] px-2 py-0.5 bg-white rounded-full border border-[#E5D5BC]">${escapeHTML(w.relationship || '')}</span>
          </div>
          <p class="text-xs text-[#2C2420]">${escapeHTML(w.message)}</p>
        </div>
        <button onclick="deleteWish('${w.id}')" class="text-gray-400 hover:text-red-600 p-1" title="Delete">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      `;
      container.appendChild(el);
    });
  } catch (err) {
    console.error('Failed to load wishes:', err);
  }
}

// User Profile & Management
function renderCurrentUserInfo() {
  if (!currentUser) return;
  const initialEl = document.getElementById('user-avatar-initial');
  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-role-badge');
  if (initialEl) initialEl.textContent = (currentUser.displayName || currentUser.username || 'A').charAt(0).toUpperCase();
  if (nameEl) nameEl.textContent = currentUser.displayName || currentUser.username;
  if (roleEl) roleEl.textContent = currentUser.role === 'superadmin' ? 'Super Admin' : 'Editor';
}

async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    if (!res.ok) {
      if (res.status === 403) {
        renderUsers([], false);
      }
      return;
    }
    usersList = await res.json();
    renderUsers(usersList, true);
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

function renderUsers(users, isSuperAdmin) {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!isSuperAdmin) {
    if (currentUser) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="p-3">
          <div class="flex items-center gap-2">
            <span class="w-8 h-8 rounded-full bg-[#4E3227] text-white flex items-center justify-center font-bold text-xs">${escapeHTML((currentUser.displayName || 'A').charAt(0).toUpperCase())}</span>
            <div>
              <span class="font-bold text-[#4E3227] block">${escapeHTML(currentUser.displayName || currentUser.username)}</span>
              <span class="text-[11px] text-[#7A6F68]">@${escapeHTML(currentUser.username)}</span>
            </div>
          </div>
        </td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 uppercase">${escapeHTML(currentUser.role)}</span>
        </td>
        <td class="p-3 text-[#7A6F68]">-</td>
        <td class="p-3 text-[#7A6F68]">បច្ចុប្បន្ន (Active Now)</td>
        <td class="p-3 text-right">
          <button onclick="openChangePasswordModal('${currentUser.id}', true)" class="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition">
            🔑 ប្តូរពាក្យសម្ងាត់
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    }
    return;
  }

  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-400">មិនមានទិន្នន័យអ្នកប្រើប្រាស់</td></tr>';
    return;
  }

  users.forEach(u => {
    const isMe = currentUser && currentUser.id === u.id;
    const roleBadge = u.role === 'superadmin' 
      ? '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">👑 Super Admin</span>'
      : '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">✏️ Editor</span>';

    const createdStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('km-KH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
    const lastLoginStr = u.lastLogin ? new Date(u.lastLogin).toLocaleString('km-KH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'មិនទាន់ចូល (Never)';

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50/80 transition';
    tr.innerHTML = `
      <td class="p-3">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-[#4E3227] text-white flex items-center justify-center font-bold text-xs shadow-xs">
            ${escapeHTML((u.displayName || u.username || 'A').charAt(0).toUpperCase())}
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-[#4E3227]">${escapeHTML(u.displayName || u.username)}</span>
              ${isMe ? '<span class="px-1.5 py-0.2 rounded text-[10px] bg-green-100 text-green-700 font-bold">You</span>' : ''}
            </div>
            <span class="text-[11px] text-[#7A6F68]">@${escapeHTML(u.username)}</span>
          </div>
        </div>
      </td>
      <td class="p-3">${roleBadge}</td>
      <td class="p-3 text-[#7A6F68]">${createdStr}</td>
      <td class="p-3 text-[#7A6F68]">${lastLoginStr}</td>
      <td class="p-3 text-right">
        <div class="flex items-center justify-end gap-1.5">
          <button onclick="openChangePasswordModal('${u.id}', ${isMe})" class="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition" title="ប្តូរពាក្យសម្ងាត់">
            🔑 ប្តូរពាក្យសម្ងាត់
          </button>
          ${!isMe ? `
            <button onclick="deleteUser('${u.id}', '${escapeHTML(u.username)}')" class="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition" title="លុបគណនី">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          ` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Form listeners
function initFormListeners() {
  // Search & Filters
  document.getElementById('guest-search').addEventListener('input', renderGuestsTable);
  document.getElementById('guest-filter-status').addEventListener('change', renderGuestsTable);
  document.getElementById('guest-filter-side').addEventListener('change', renderGuestsTable);

  // Theme cards click - Auto-save immediately
  document.querySelectorAll('.theme-select-card').forEach(card => {
    card.addEventListener('click', async () => {
      const themeId = card.getAttribute('data-theme');
      document.getElementById('selected-theme-id').value = themeId;
      updateThemeSelectionUI(themeId);

      const themeObj = THEME_PRESETS[themeId] || THEME_PRESETS['khmer-traditional'];
      if (weddingData) {
        weddingData.theme = { ...themeObj };
        try {
          const res = await fetch('/api/wedding', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(weddingData)
          });
          if (res.ok) {
            showToast(`បានប្តូរ និងរក្សាទុកស្បែក៖ ${themeObj.name}`);
          }
        } catch (err) {
          console.error('Failed to auto-save theme:', err);
        }
      }
    });
  });

  // Wedding settings save
  document.getElementById('wedding-settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const origText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="inline-flex items-center gap-2">
          <svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          កំពុងរក្សាទុក... (Saving...)
        </span>
      `;
    }

    const selThemeId = document.getElementById('selected-theme-id').value || 'khmer-traditional';
    const themeObj = THEME_PRESETS[selThemeId] || THEME_PRESETS['khmer-traditional'];
    const updated = {
      ...weddingData,
      theme: {
        ...themeObj
      },
      wedding: {
        ...weddingData.wedding,
        groom: {
          ...weddingData.wedding.groom,
          name_kh: document.getElementById('groom-name-kh').value.trim(),
          name_en: document.getElementById('groom-name-en').value.trim(),
          father_kh: document.getElementById('groom-father-kh').value.trim(),
          mother_kh: document.getElementById('groom-mother-kh').value.trim(),
          photo: document.getElementById('groom-photo').value.trim()
        },
        bride: {
          ...weddingData.wedding.bride,
          name_kh: document.getElementById('bride-name-kh').value.trim(),
          name_en: document.getElementById('bride-name-en').value.trim(),
          father_kh: document.getElementById('bride-father-kh').value.trim(),
          mother_kh: document.getElementById('bride-mother-kh').value.trim(),
          photo: document.getElementById('bride-photo').value.trim()
        },
        couple_photo: document.getElementById('couple-photo-url').value.trim(),
        quote_kh: document.getElementById('quote-kh').value.trim(),
        quote_en: document.getElementById('quote-en').value.trim(),
        event_date: document.getElementById('event-datetime').value,
        date_solar_kh: document.getElementById('date-solar-kh').value.trim(),
        date_lunar_kh: document.getElementById('date-lunar-kh').value.trim(),
        venue_name_kh: document.getElementById('venue-name-kh').value.trim(),
        venue_address_kh: document.getElementById('venue-address-kh').value.trim(),
        map_url: document.getElementById('map-url').value.trim(),
        map_embed: document.getElementById('map-embed-url').value.trim(),
        music_url: document.getElementById('music-url').value.trim(),
        video_embed: formatYouTubeEmbedUrl(document.getElementById('video-url').value.trim())
      }
    };

    try {
      const res = await fetch('/api/wedding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        if (submitBtn) {
          submitBtn.innerHTML = `<span>✓ បានរក្សាទុកជោគជ័យ! (Saved Successfully)</span>`;
          submitBtn.classList.remove('bg-[#4E3227]', 'hover:bg-[#6E4939]');
          submitBtn.classList.add('bg-emerald-600', 'text-white');
          setTimeout(() => {
            submitBtn.innerHTML = origText;
            submitBtn.disabled = false;
            submitBtn.classList.remove('bg-emerald-600');
            submitBtn.classList.add('bg-[#4E3227]', 'hover:bg-[#6E4939]');
          }, 3000);
        }
        showToast('✓ បានរក្សាទុកព័ត៌មានមង្គលការដោយជោគជ័យ!');
        await loadWeddingData();
      } else {
        const err = await res.json().catch(() => ({}));
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origText;
        }
        showToast(`⚠️ បរាជ័យក្នុងការរក្សាទុក៖ ${err.error || res.statusText || 'Error saving'}`);
      }
    } catch (err) {
      console.error('Save error:', err);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origText;
      }
      showToast(`⚠️ បញ្ហាបណ្តាញក្នុងការរក្សាទុក (Network Error): ${err.message}`);
    }
  });

  // Digital Gift settings save
  document.getElementById('digital-gift-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dg = {
      ...weddingData.digital_gift,
      groom_account: {
        bank_name: document.getElementById('dg-groom-bank').value.trim(),
        account_name: document.getElementById('dg-groom-name').value.trim(),
        account_number: document.getElementById('dg-groom-acc').value.trim(),
        qr_image: document.getElementById('dg-groom-qr').value.trim()
      },
      bride_account: {
        bank_name: document.getElementById('dg-bride-bank').value.trim(),
        account_name: document.getElementById('dg-bride-name').value.trim(),
        account_number: document.getElementById('dg-bride-acc').value.trim(),
        qr_image: document.getElementById('dg-bride-qr').value.trim()
      }
    };

    const res = await fetch('/api/wedding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...weddingData, digital_gift: dg })
    });
    if (res.ok) {
      showToast('បានរក្សាទុកព័ត៌មានចងដៃ KHQR ជោគជ័យ!');
      loadWeddingData();
    }
  });

  // Save guest modal
  document.getElementById('form-save-guest').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('modal-guest-id').value;
    const payload = {
      name: document.getElementById('modal-guest-name').value.trim(),
      name_en: document.getElementById('modal-guest-name-en').value.trim(),
      slug: document.getElementById('modal-guest-slug') ? document.getElementById('modal-guest-slug').value.trim() : '',
      side: document.getElementById('modal-guest-side').value,
      category: document.getElementById('modal-guest-category').value,
      phone: document.getElementById('modal-guest-phone').value.trim(),
      pax_allowed: document.getElementById('modal-guest-pax').value
    };

    let res;
    if (id) {
      res = await fetch(`/api/guests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      showToast('បានរក្សាទុកភ្ញៀវជោគជ័យ!');
      closeModals();
      loadGuests();
      loadStats();
    }
  });

  // Auto-fill Short Link Slug from English Name (spaces replaced with -)
  const guestNameEnInput = document.getElementById('modal-guest-name-en');
  const guestSlugInput = document.getElementById('modal-guest-slug');
  if (guestNameEnInput && guestSlugInput) {
    guestNameEnInput.addEventListener('input', () => {
      if (!isSlugManuallyEdited || !guestSlugInput.value.trim()) {
        guestSlugInput.value = slugify(guestNameEnInput.value);
      }
    });

    guestSlugInput.addEventListener('input', () => {
      isSlugManuallyEdited = Boolean(guestSlugInput.value.trim());
    });

    guestSlugInput.addEventListener('blur', () => {
      if (guestSlugInput.value.trim()) {
        guestSlugInput.value = slugify(guestSlugInput.value);
      }
    });
  }

  // Bulk import guests
  document.getElementById('form-bulk-import').addEventListener('submit', async (e) => {
    e.preventDefault();
    const names = document.getElementById('bulk-names').value;
    const side = document.getElementById('bulk-side').value;
    const category = document.getElementById('bulk-category').value;
    const pax_allowed = document.getElementById('bulk-pax').value;

    const res = await fetch('/api/guests/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names, side, category, pax_allowed })
    });

    if (res.ok) {
      const d = await res.json();
      showToast(`បានបញ្ចូលភ្ញៀវចំនួន ${d.count} នាក់ជោគជ័យ!`);
      closeModals();
      loadGuests();
      loadStats();
    }
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    const token = localStorage.getItem('admin_token');
    await fetch('/api/auth/logout', { 
      method: 'POST',
      headers: token ? { 'Authorization': 'Bearer ' + token } : {}
    });
    localStorage.removeItem('admin_token');
    document.cookie = 'admin_token=; path=/; max-age=0; SameSite=Lax';
    window.location.href = '/login';
  });

  // Color preset selector (legacy fallback)
  document.querySelectorAll('input[name="preset-color"]').forEach(r => {
    r.addEventListener('change', (e) => {
      const el = document.getElementById('setting-primary-color');
      if (el) el.value = e.target.value;
    });
  });

  // Add agenda item button - opens modal
  const btnAddAgenda = document.getElementById('btn-add-agenda-item');
  if (btnAddAgenda) {
    btnAddAgenda.addEventListener('click', () => {
      openAddAgendaModal();
    });
  }

  // Save Agenda Form in Modal
  const formSaveAgenda = document.getElementById('form-save-agenda');
  if (formSaveAgenda) {
    formSaveAgenda.addEventListener('submit', async (e) => {
      e.preventDefault();
      const idx = parseInt(document.getElementById('modal-agenda-index').value, 10);
      const existingId = document.getElementById('modal-agenda-id').value;

      const itemData = {
        id: existingId ? Number(existingId) : Date.now(),
        time: document.getElementById('modal-agenda-time').value.trim(),
        period: document.getElementById('modal-agenda-period').value,
        title_kh: document.getElementById('modal-agenda-title-kh').value.trim(),
        title_en: document.getElementById('modal-agenda-title-en').value.trim(),
        desc_kh: document.getElementById('modal-agenda-desc-kh').value.trim(),
        desc_en: document.getElementById('modal-agenda-desc-en').value.trim(),
        location_kh: document.getElementById('modal-agenda-location-kh').value.trim(),
        location_en: document.getElementById('modal-agenda-location-kh').value.trim(),
        icon: document.getElementById('modal-agenda-icon').value
      };

      const newAgenda = [...(weddingData.agenda || [])];
      if (idx >= 0 && idx < newAgenda.length) {
        newAgenda[idx] = itemData;
      } else {
        newAgenda.push(itemData);
      }

      weddingData.agenda = newAgenda;
      renderAdminAgenda();

      try {
        const res = await fetch('/api/wedding', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...weddingData, agenda: newAgenda })
        });

        if (res.ok) {
          closeModals();
          showToast(idx >= 0 ? 'បានកែប្រែកម្មវិធីជោគជ័យ!' : 'បានបន្ថែមកម្មវិធីជោគជ័យ!');
          loadWeddingData();
        } else {
          showToast('បរាជ័យក្នុងការរក្សាទុក');
        }
      } catch (err) {
        console.error('Error saving agenda:', err);
        showToast('មានបញ្ហាក្នុងការរក្សាទុក');
      }
    });
  }

  // Add gallery item button
  document.getElementById('btn-add-gallery-item').addEventListener('click', async () => {
    const rawUrl = prompt('សូមបញ្ចូល Image URL ឬ Google Drive Link:', '');
    if (!rawUrl || !rawUrl.trim()) return;
    const url = resolveGoogleDriveUrl(rawUrl.trim());

    // Deduplication check
    const currentList = weddingData.gallery || [];
    if (currentList.some(item => resolveGoogleDriveUrl(item.url || '').trim() === url)) {
      showToast('រូបថតនេះមានក្នុង Gallery រួចហើយ (Photo already exists)', 'error');
      return;
    }

    const caption_kh = prompt('ចំណងជើងរូបថត (Caption KH):', 'អនុស្សាវរីយ៍ដ៏ផ្អែមល្ហែម') || 'អនុស្សាវរីយ៍ដ៏ផ្អែមល្ហែម';

    const newGallery = [...currentList, {
      id: Date.now(),
      url,
      caption_kh,
      caption_en: 'Sweet Memories'
    }];

    await fetch('/api/wedding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...weddingData, gallery: newGallery })
    });
    showToast('បានបន្ថែមកម្រងរូបថតជោគជ័យ!');
    loadWeddingData();
  });

  // Add user submit listener
  const formAddUser = document.getElementById('form-add-user');
  if (formAddUser) {
    formAddUser.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('modal-user-username').value.trim();
      const displayName = document.getElementById('modal-user-displayname').value.trim();
      const password = document.getElementById('modal-user-password').value;
      const role = document.getElementById('modal-user-role').value;

      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, displayName, password, role })
        });
        const data = await res.json();
        if (res.ok) {
          showToast('បានបង្កើតគណនី Admin ថ្មីជោគជ័យ!');
          closeModals();
          loadUsers();
        } else {
          showToast(`⚠️ ${data.error || 'បរាជ័យក្នុងការបង្កើតគណនី'}`);
        }
      } catch (err) {
        showToast('⚠️ បញ្ហាបណ្តាញក្នុងការតភ្ជាប់');
      }
    });
  }

  // Change password submit listener
  const formChangePwd = document.getElementById('form-change-password');
  if (formChangePwd) {
    formChangePwd.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = document.getElementById('modal-pwd-user-id').value;
      const currentPassword = document.getElementById('modal-pwd-current') ? document.getElementById('modal-pwd-current').value : '';
      const newPassword = document.getElementById('modal-pwd-new').value;
      const confirmPassword = document.getElementById('modal-pwd-confirm').value;

      if (newPassword !== confirmPassword) {
        showToast('⚠️ ពាក្យសម្ងាត់ផ្ទៀងផ្ទាត់មិនដូចគ្នាទេ!');
        return;
      }

      try {
        const res = await fetch(`/api/users/${userId}/password`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await res.json();
        if (res.ok) {
          showToast('✓ បានប្តូរពាក្យសម្ងាត់ដោយជោគជ័យ!');
          closeModals();
        } else {
          showToast(`⚠️ ${data.error || 'បរាជ័យក្នុងការប្តូរពាក្យសម្ងាត់'}`);
        }
      } catch (err) {
        showToast('⚠️ បញ្ហាបណ្តាញក្នុងការតភ្ជាប់');
      }
    });
  }
}

// Global actions
window.deleteAgendaItem = async function(idx) {
  if (!confirm('តើអ្នកពិតជាចង់លុបកម្មវិធីនេះមែនទេ?')) return;
  const newAgenda = [...weddingData.agenda];
  newAgenda.splice(idx, 1);
  weddingData.agenda = newAgenda;
  renderAdminAgenda();

  try {
    const res = await fetch('/api/wedding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...weddingData, agenda: newAgenda })
    });
    if (res.ok) {
      showToast('បានលុបកម្មវិធីជោគជ័យ!');
      loadWeddingData();
    }
  } catch (err) {
    console.error('Error deleting agenda:', err);
  }
};

window.deleteGalleryItem = async function(idx) {
  if (!confirm('តើអ្នកពិតជាចង់លុបរូបថតនេះមែនទេ?')) return;
  const newGallery = [...weddingData.gallery];
  newGallery.splice(idx, 1);
  await fetch('/api/wedding', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...weddingData, gallery: newGallery })
  });
  showToast('បានលុបរូបថតជោគជ័យ!');
  loadWeddingData();
};

window.editGuest = function(id) {
  const g = guestList.find(x => x.id === id);
  if (!g) return;
  document.getElementById('modal-guest-id').value = g.id;
  document.getElementById('modal-guest-name').value = g.name;
  document.getElementById('modal-guest-name-en').value = g.name_en || '';
  if (document.getElementById('modal-guest-slug')) {
    document.getElementById('modal-guest-slug').value = g.slug || '';
  }
  isSlugManuallyEdited = Boolean(g.slug);
  document.getElementById('modal-guest-side').value = g.side || 'groom';
  document.getElementById('modal-guest-category').value = g.category || 'General';
  document.getElementById('modal-guest-phone').value = g.phone || '';
  document.getElementById('modal-guest-pax').value = g.pax_allowed || 2;
  document.getElementById('modal-guest-title').textContent = 'កែសម្រួលព័ត៌មានភ្ញៀវ';
  document.getElementById('modal-add-guest').classList.add('active');
};

window.deleteGuest = async function(id) {
  if (!confirm('តើអ្នកពិតជាចង់លុបភ្ញៀវនេះមែនទេ?')) return;
  await fetch(`/api/guests/${id}`, { method: 'DELETE' });
  showToast('បានលុបភ្ញៀវជោគជ័យ!');
  loadGuests();
  loadStats();
};

window.clearAllGuests = async function() {
  if (!confirm('តើអ្នកពិតជាចង់លុបភ្ញៀវទាំងអស់មែនទេ? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានឡើយ! (Are you sure you want to delete ALL guests?)')) return;
  try {
    const res = await fetch('/api/guests/all', { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('បានលុបភ្ញៀវទាំងអស់ជោគជ័យ!');
      loadGuests();
      loadStats();
    } else {
      showToast('បរាជ័យក្នុងការលុបភ្ញៀវទាំងអស់');
    }
  } catch (err) {
    showToast('កំហុសប្រព័ន្ធក្នុងការលុបភ្ញៀវ');
  }
};

window.deleteWish = async function(id) {
  if (!confirm('តើអ្នកពិតជាចង់លុបសារជូនពរនេះមែនទេ?')) return;
  await fetch(`/api/wishes/${id}`, { method: 'DELETE' });
  showToast('បានលុបសារជូនពរ!');
  loadWishes();
  loadStats();
};

window.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text);
  showToast('បានចម្លងតំណភ្ជាប់ជោគជ័យ! (Link copied)');
};

window.openGuestQR = function(url, name) {
  const qrUrl = `/api/qr-code?text=${encodeURIComponent(url)}&width=400&dark=%234E3227`;
  document.getElementById('qr-img-preview').src = qrUrl;
  document.getElementById('qr-guest-title').textContent = name;
  document.getElementById('btn-download-qr').href = qrUrl;
  document.getElementById('modal-qr').classList.add('active');
};

window.openChangePasswordModal = function(userId, isSelf) {
  const form = document.getElementById('form-change-password');
  if (form) form.reset();
  document.getElementById('modal-pwd-user-id').value = userId;

  const currentField = document.getElementById('pwd-field-current');
  const currentInput = document.getElementById('modal-pwd-current');
  const desc = document.getElementById('modal-pwd-user-desc');

  if (isSelf) {
    if (currentField) currentField.classList.remove('hidden');
    if (currentInput) currentInput.required = true;
    if (desc) desc.textContent = 'ប្តូរពាក្យសម្ងាត់សម្រាប់គណនីផ្ទាល់ខ្លួនរបស់អ្នក';
  } else {
    if (currentField) currentField.classList.add('hidden');
    if (currentInput) currentInput.required = false;
    const targetUser = usersList.find(u => u.id === userId);
    if (desc) desc.textContent = `កំណត់ពាក្យសម្ងាត់ថ្មីជូនអ្នកប្រើប្រាស់: ${targetUser ? targetUser.displayName : ''}`;
  }

  document.getElementById('modal-change-password').classList.add('active');
};

window.deleteUser = async function(userId, username) {
  if (!confirm(`តើអ្នកពិតជាចង់លុបគណនី "${username}" នេះមែនទេ?`)) return;
  try {
    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      showToast('✓ បានលុបគណនីជោគជ័យ!');
      loadUsers();
    } else {
      showToast(`⚠️ ${data.error || 'បរាជ័យក្នុងការលុបគណនី'}`);
    }
  } catch (err) {
    console.error('Failed to delete user:', err);
    showToast('⚠️ បញ្ហាបណ្តាញក្នុងការតភ្ជាប់');
  }
};

// Tabs
function initTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active', 'bg-[#4E3227]', 'text-white');
        t.classList.add('text-[#7A6F68]');
      });
      tab.classList.add('active', 'bg-[#4E3227]', 'text-white');
      tab.classList.remove('text-[#7A6F68]');

      const target = tab.getAttribute('data-target');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById(target).classList.remove('hidden');
      if (target === 'tab-database' && typeof loadDBDiagnostics === 'function') loadDBDiagnostics();
    });
  });
  // Set first tab active styling
  const first = document.querySelector('.admin-tab.active');
  if (first) {
    first.classList.add('bg-[#4E3227]', 'text-white');
    first.classList.remove('text-[#7A6F68]');
  }
}

// Modals
function initModals() {
  document.getElementById('btn-open-add-guest').addEventListener('click', () => {
    document.getElementById('form-save-guest').reset();
    document.getElementById('modal-guest-id').value = '';
    isSlugManuallyEdited = false;
    document.getElementById('modal-guest-title').textContent = 'បន្ថែមភ្ញៀវកិត្តិយស';
    document.getElementById('modal-add-guest').classList.add('active');
  });

  document.getElementById('btn-open-bulk-import').addEventListener('click', () => {
    document.getElementById('form-bulk-import').reset();
    document.getElementById('modal-bulk-import').classList.add('active');
  });

  const btnOpenAddUser = document.getElementById('btn-open-add-user');
  if (btnOpenAddUser) {
    btnOpenAddUser.addEventListener('click', () => {
      const form = document.getElementById('form-add-user');
      if (form) form.reset();
      document.getElementById('modal-add-user').classList.add('active');
    });
  }

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeModals);
  });

  document.querySelectorAll('.lightbox-modal').forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target.classList.contains('lightbox-modal')) closeModals();
    });
  });

  document.getElementById('btn-print-qr').addEventListener('click', () => {
    const w = window.open('');
    w.document.write(`<img src="${document.getElementById('qr-img-preview').src}" style="width:300px; display:block; margin:40px auto;"/>`);
    w.print();
    w.close();
  });
}

function closeModals() {
  document.querySelectorAll('.lightbox-modal').forEach(m => m.classList.remove('active'));
}

function showToast(msg) {
  let toast = document.getElementById('toast-notice');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notice';
    toast.className = 'toast-notice';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span class="text-base">🔔</span> <span>${escapeHTML(msg)}</span>`;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

// File Upload Handlers
window.uploadImage = async function(fileInput, targetInputId, previewImgId) {
  if (!fileInput.files || !fileInput.files[0]) return;
  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append('file', file);

  showToast('កំពុង Upload... (Uploading...)');

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (res.ok && data.url) {
      document.getElementById(targetInputId).value = data.url;
      if (previewImgId) {
        const prev = document.getElementById(previewImgId);
        if (prev) {
          prev.src = data.url;
          prev.classList.remove('hidden');
        }
      }

      // AUTO-SAVE IMMEDIATELY SO FRONTEND UPDATES INSTANTLY!
      if (['groom-photo', 'bride-photo', 'couple-photo-url'].includes(targetInputId)) {
        showToast('✓ កំពុងរក្សាទុកដោយស្វ័យប្រវត្តិ... (Auto-saving...)');
        const weddingForm = document.getElementById('wedding-settings-form');
        if (weddingForm) {
          weddingForm.requestSubmit();
        }
      } else if (['dg-groom-qr', 'dg-bride-qr'].includes(targetInputId)) {
        showToast('✓ កំពុងរក្សាទុក QR ដោយស្វ័យប្រវត្តិ... (Auto-saving QR...)');
        const dgForm = document.getElementById('digital-gift-form');
        if (dgForm) {
          dgForm.requestSubmit();
        }
      } else {
        showToast('✓ Upload ជោគជ័យ! (Upload complete)');
      }
    } else {
      showToast(data.error || 'Upload failed');
    }
  } catch (err) {
    console.error('Upload error:', err);
    showToast('Failed to upload image');
  }
};

let isUploadingGallery = false;
window.uploadGalleryFiles = async function(fileInput) {
  if (isUploadingGallery) return;
  if (!fileInput.files || fileInput.files.length === 0) return;

  isUploadingGallery = true;
  fileInput.disabled = true;
  showToast(`កំពុង Upload ${fileInput.files.length} រូបថត... (Uploading photos...)`);

  let addedCount = 0;
  weddingData.gallery = weddingData.gallery || [];

  try {
    for (let file of fileInput.files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (res.ok && data.url) {
          // Avoid duplicate photo
          const alreadyExists = weddingData.gallery.some(p => (p.url || '').trim() === data.url.trim());
          if (!alreadyExists) {
            weddingData.gallery.push({
              id: Date.now() + Math.round(Math.random() * 1000),
              url: data.url,
              caption_kh: 'អនុស្សាវរីយ៍ដ៏ផ្អែមល្ហែម',
              caption_en: 'Sweet Memories'
            });
            addedCount++;
          }
        }
      } catch (e) {
        console.error('File upload error:', e);
      }
    }

    if (addedCount > 0) {
      // Save gallery update
      await fetch('/api/wedding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...weddingData })
      });
      showToast(`✓ បាន Upload ${addedCount} រូបថតចូលកម្រងរូបភាពជោគជ័យ!`);
      await loadWeddingData();
    } else {
      showToast('ពុំមានរូបថតថ្មីត្រូវបានបញ្ចូលទេ (ប្រហែលជារូបថតស្ទួន)', 'info');
    }
  } catch (err) {
    console.error('Upload gallery error:', err);
    showToast('មានបញ្ហាក្នុងការ Upload រូបថត', 'error');
  } finally {
    try { fileInput.value = ''; } catch (e) {}
    fileInput.disabled = false;
    isUploadingGallery = false;
  }
};

function updateThemeSelectionUI(themeId) {
  document.querySelectorAll('.theme-select-card').forEach(c => {
    if (c.getAttribute('data-theme') === themeId) {
      c.classList.add('border-[#D4AF37]', 'ring-2', 'ring-[#D4AF37]/50');
      c.classList.remove('border-gray-200');
    } else {
      c.classList.remove('border-[#D4AF37]', 'ring-2', 'ring-[#D4AF37]/50');
      c.classList.add('border-gray-200');
    }
  });
  const themeObj = THEME_PRESETS[themeId] || THEME_PRESETS['khmer-traditional'];
  const badge = document.getElementById('current-theme-badge');
  if (badge) badge.textContent = themeObj.name;
}

window.uploadAudio = async function(fileInput, targetInputId) {
  if (!fileInput.files || !fileInput.files[0]) return;
  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append('file', file);

  showToast('កំពុង Upload បទចម្រៀង MP3... (Uploading audio...)');

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (res.ok && data.url) {
      document.getElementById(targetInputId).value = data.url;
      showToast('Upload បទចម្រៀង MP3 ជោគជ័យ! (Audio uploaded)');
    } else {
      showToast(data.error || 'Audio upload failed');
    }
  } catch (e) {
    showToast('Failed to upload audio');
  }
};

// ==========================================================================
// GOOGLE DRIVE CLOUD STORAGE & BACKUP RESTORE HANDLERS
// ==========================================================================

// Convert any Google Drive share link into high-speed permanent CDN image URL
function resolveGoogleDriveUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  const driveRegex = /(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=view&)?id=|uc\?(?:export=download&)?id=|thumbnail\?id=)|lh3\.googleusercontent\.com\/d\/)([a-zA-Z0-9_-]+)/;
  const match = trimmed.match(driveRegex);
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return trimmed;
}

window.resolveGoogleDriveUrl = resolveGoogleDriveUrl;

// Open Google Drive Import Modal
window.openGoogleDriveModal = function() {
  const modal = document.getElementById('modal-google-drive');
  if (modal) {
    modal.classList.add('active');
    modal.classList.remove('hidden');
    const input = document.getElementById('gdrive-input-links');
    if (input) setTimeout(() => input.focus(), 100);
  }
};

// Close Google Drive Import Modal
window.closeGoogleDriveModal = function() {
  const modal = document.getElementById('modal-google-drive');
  if (modal) {
    modal.classList.remove('active');
    modal.classList.add('hidden');
  }
};

// Submit Google Drive photos
window.submitGoogleDrivePhotos = async function() {
  const input = document.getElementById('gdrive-input-links');
  if (!input || !input.value.trim()) {
    showToast('សូមបញ្ចូល Google Drive Link យ៉ាងហោចណាស់មួយ');
    return;
  }
  const lines = input.value.split('\n').map(l => l.trim()).filter(Boolean);
  const captionKh = document.getElementById('gdrive-caption-kh')?.value.trim() || 'អនុស្សាវរីយ៍ដ៏ផ្អែមល្ហែម';
  const captionEn = document.getElementById('gdrive-caption-en')?.value.trim() || 'Sweet Memories';

  let addedCount = 0;
  weddingData.gallery = weddingData.gallery || [];
  const existingUrls = new Set(weddingData.gallery.map(p => resolveGoogleDriveUrl(p.url || '').trim()));

  for (let rawUrl of lines) {
    const resolved = resolveGoogleDriveUrl(rawUrl);
    if (resolved && !existingUrls.has(resolved)) {
      existingUrls.add(resolved);
      weddingData.gallery.push({
        id: Date.now() + Math.round(Math.random() * 10000) + addedCount,
        url: resolved,
        caption_kh: captionKh,
        caption_en: captionEn
      });
      addedCount++;
    }
  }

  if (addedCount === 0) {
    showToast('ពុំមានរូបថតថ្មីទេ (រូបថតទាំងនេះមានក្នុង Gallery រួចហើយ ឬ Link មិនត្រឹមត្រូវ)', 'info');
    return;
  }

  showToast(`កំពុងរក្សាទុក ${addedCount} រូបភាពពី Google Drive...`);

  try {
    const res = await fetch('/api/wedding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...weddingData })
    });
    if (res.ok) {
      input.value = '';
      closeGoogleDriveModal();
      showToast(`✓ បានបញ្ចូល ${addedCount} រូបភាពពី Google Drive ជោគជ័យ!`);
      loadWeddingData();
    } else {
      showToast('បរាជ័យក្នុងការរក្សាទុក');
    }
  } catch (err) {
    console.error('Save Google Drive photos error:', err);
    showToast('មានបញ្ហាក្នុងការរក្សាទុក');
  }
};

// Export Full System Backup (Wedding, Guests, Wishes)
window.exportBackupData = async function() {
  showToast('កំពុងបង្កើតឯកសារ Backup ពេញលេញ...');
  try {
    const res = await fetch('/api/backup/export');
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `wedding-full-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('✓ បានទាញយកទិន្នន័យ Backup ពេញលេញជោគជ័យ!');
      return;
    }
  } catch (e) {}

  // Fallback to client-side weddingData export
  const jsonStr = JSON.stringify(weddingData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wedding-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('✓ បានទាញយកឯកសារ Backup ដោយជោគជ័យ!');
};

// Import Full System Backup (Wedding, Guests, Wishes)
window.importBackupData = function(fileInput) {
  if (!fileInput.files || !fileInput.files[0]) return;
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || typeof parsed !== 'object') {
        showToast('ឯកសារ Backup មិនត្រឹមត្រូវ');
        return;
      }
      if (!confirm('តើអ្នកពិតជាចង់ស្តារទិន្នន័យពីឯកសារ Backup នេះមែនទេ? (Restore wedding data?)')) {
        return;
      }
      showToast('កំពុងស្តារទិន្នន័យឡើងវិញ...');
      
      if (parsed.guests || parsed.wishes) {
        await fetch('/api/backup/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed)
        });
      } else {
        await fetch('/api/wedding', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed)
        });
      }

      showToast('✓ បានស្តារទិន្នន័យ Backup ជោគជ័យ!');
      loadWeddingData();
      if (typeof loadGuests === 'function') loadGuests();
    } catch (err) {
      console.error('Import backup error:', err);
      showToast('ឯកសារមិនមែនជា JSON ត្រឹមត្រូវទេ');
    } finally {
      fileInput.value = '';
    }
  };
  reader.readAsText(file);
};

// Auto-convert Google Drive links on input fields
document.addEventListener('DOMContentLoaded', () => {
  const photoInputIds = ['groom-photo', 'bride-photo', 'couple-photo-url', 'dg-groom-qr', 'dg-bride-qr'];
  photoInputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        const original = el.value.trim();
        const converted = resolveGoogleDriveUrl(original);
        if (converted !== original) {
          el.value = converted;
          showToast('✓ បានបម្លែង Google Drive Link ជោគជ័យ!');
          // Trigger preview
          const prevId = id === 'couple-photo-url' ? 'couple-photo-preview' : `${id}-preview`;
          const prevEl = document.getElementById(prevId);
          if (prevEl) {
            prevEl.src = converted;
            prevEl.classList.remove('hidden');
          }
        }
      });
    }
  });
});
