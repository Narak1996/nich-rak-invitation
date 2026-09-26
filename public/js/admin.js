// Admin State
let weddingData = null;
let guestList = [];
let wishesList = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth
  const authRes = await fetch('/api/auth/check');
  const auth = await authRes.json();
  if (!auth.authenticated) {
    window.location.href = '/login';
    return;
  }

  initTabs();
  initModals();
  await loadAllData();
  initFormListeners();
});

// Load all initial data
async function loadAllData() {
  await Promise.all([
    loadStats(),
    loadWeddingData(),
    loadGuests(),
    loadWishes()
  ]);
}

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

const THEME_PRESETS = {
  'khmer-traditional': {
    id: 'khmer-traditional',
    name: 'Khmer Traditional (រចនាបថប្រពៃណីខ្មែរ - ផ្កាឈូក & មាស)',
    primaryColor: '#8C1D2F',
    accentColor: '#D4AF37',
    secondaryColor: '#B22B42',
    bgColor: '#FAF6ED',
    emblem: '🪷',
    sealEmblem: 'lotus'
  },
  'western-modern': {
    id: 'western-modern',
    name: 'Western Modern Luxury (រចនាបថបស្ចិមប្រទេស - Cotton Paper & Olive)',
    primaryColor: '#1B4332',
    accentColor: '#C5A059',
    secondaryColor: '#2D6A4F',
    bgColor: '#FAF8F5',
    emblem: '💍',
    sealEmblem: 'rings'
  },
  'chinese-traditional': {
    id: 'chinese-traditional',
    name: 'Chinese Traditional 囍 (រចនាបថប្រពៃណីចិន - មង្គលទ្វេ & ផ្កាម៉ូនៀ)',
    primaryColor: '#A81822',
    accentColor: '#FFD700',
    secondaryColor: '#C72535',
    bgColor: '#FFF7F7',
    emblem: '囍',
    sealEmblem: 'shuangxi'
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
    // Generate personalized invitation URL
    const guestUrl = `${window.location.origin}/?to=${encodeURIComponent(g.name)}`;
    const statusBadges = {
      'confirmed': '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800">✓ ចូលរួម (Confirmed)</span>',
      'declined': '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">✕ មិនចូលរួម (Declined)</span>',
      'pending': '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">⏳ រង់ចាំ (Pending)</span>'
    };

    // Pre-composed telegram invitation text in Khmer
    const tgText = encodeURIComponent(`សូមគោរពអញ្ជើញ ${g.name} ចូលរួមជាអធិបតី និងជាភ្ញៀវកិត្តិយស ក្នុងពិធីមង្គលការរបស់យើងខ្ញុំ។ សូមចុចតំណភ្ជាប់ខាងក្រោមដើម្បីបើកសំបុត្រអញ្ជើញ៖\n${guestUrl}`);
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(guestUrl)}&text=${tgText}`;
    const waUrl = `https://api.whatsapp.com/send?text=${tgText}`;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50/80 transition';
    tr.innerHTML = `
      <td class="p-3">
        <span class="font-bold text-[#4E3227] text-xs block">${escapeHTML(g.name)}</span>
        <span class="text-[11px] text-[#7A6F68] block">${escapeHTML(g.name_en || '')}</span>
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

// Render Gallery in Admin
function renderAdminGallery() {
  const container = document.getElementById('admin-gallery-grid');
  container.innerHTML = '';
  if (!weddingData || !weddingData.gallery) return;

  weddingData.gallery.forEach((img, index) => {
    const el = document.createElement('div');
    el.className = 'relative rounded-2xl overflow-hidden border border-[#E5D5BC] group aspect-4/5';
    el.innerHTML = `
      <img src="${img.url}" class="w-full h-full object-cover">
      <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
        <button onclick="deleteGalleryItem(${index})" class="p-2 bg-red-600 hover:bg-red-700 text-white rounded-full">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    `;
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
        video_embed: document.getElementById('video-url').value.trim()
      }
    };

    const res = await fetch('/api/wedding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    if (res.ok) {
      showToast('បានរក្សាទុកព័ត៌មានមង្គលការដោយជោគជ័យ!');
      loadWeddingData();
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
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  });

  // Color preset selector
  document.querySelectorAll('input[name="preset-color"]').forEach(r => {
    r.addEventListener('change', (e) => {
      document.getElementById('setting-primary-color').value = e.target.value;
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
    });
  }

  // Add gallery item button
  document.getElementById('btn-add-gallery-item').addEventListener('click', async () => {
    const url = prompt('Image URL:', 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80');
    if (!url) return;
    const caption_kh = prompt('ចំណងជើងរូបថត (Caption KH):', 'អនុស្សាវរីយ៍ដ៏ផ្អែមល្ហែម') || '';

    const newGallery = [...(weddingData.gallery || []), {
      id: Date.now(),
      url,
      caption_kh,
      caption_en: caption_kh
    }];

    await fetch('/api/wedding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...weddingData, gallery: newGallery })
    });
    showToast('បានបន្ថែមកម្រងរូបថតជោគជ័យ!');
    loadWeddingData();
  });
}

// Global actions
window.deleteAgendaItem = async function(idx) {
  if (!confirm('តើអ្នកពិតជាចង់លុបកម្មវិធីនេះមែនទេ?')) return;
  const newAgenda = [...weddingData.agenda];
  newAgenda.splice(idx, 1);
  await fetch('/api/wedding', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...weddingData, agenda: newAgenda })
  });
  showToast('បានលុបកម្មវិធីជោគជ័យ!');
  loadWeddingData();
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
    document.getElementById('modal-guest-title').textContent = 'បន្ថែមភ្ញៀវកិត្តិយស';
    document.getElementById('modal-add-guest').classList.add('active');
  });

  document.getElementById('btn-open-bulk-import').addEventListener('click', () => {
    document.getElementById('form-bulk-import').reset();
    document.getElementById('modal-bulk-import').classList.add('active');
  });

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
  const toast = document.getElementById('toast-notice');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
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
      showToast('Upload ជោគជ័យ! (Upload complete)');
    } else {
      showToast(data.error || 'Upload failed');
    }
  } catch (err) {
    showToast('Failed to upload image');
  }
};

window.uploadGalleryFiles = async function(fileInput) {
  if (!fileInput.files || fileInput.files.length === 0) return;
  showToast('កំពុង Upload រូបថត... (Uploading photos...)');

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
        weddingData.gallery = weddingData.gallery || [];
        weddingData.gallery.push({
          id: Date.now() + Math.round(Math.random() * 1000),
          url: data.url,
          caption_kh: 'អនុស្សាវរីយ៍ដ៏ផ្អែមល្ហែម',
          caption_en: 'Sweet Memories'
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Save gallery update
  await fetch('/api/wedding', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...weddingData })
  });

  showToast('បាន Upload រូបថតចូលកម្រងរូបភាពជោគជ័យ!');
  loadWeddingData();
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
