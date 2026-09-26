// State management
let currentLang = 'kh';
let weddingData = null;
let currentGuest = null;
let isAudioPlaying = false;
const audioPlayer = new Audio();

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', async () => {
  await fetchWeddingData();
  await checkGuestParameter();
  initPetals();
  initCountdown();
  initEventListeners();
  renderAll();
});

// Fetch wedding data from API
async function fetchWeddingData() {
  try {
    const res = await fetch('/api/wedding');
    weddingData = await res.json();
    const musicUrl = (weddingData.wedding && weddingData.wedding.music_url) || '/audio/wedding-music.mp3';
    audioPlayer.src = musicUrl;
    audioPlayer.loop = true;
    audioPlayer.preload = 'auto';
  } catch (err) {
    console.error('Failed to load wedding data:', err);
  }
}

// Check guest parameter from URL
async function checkGuestParameter() {
  const urlParams = new URLSearchParams(window.location.search);
  let guestSlug = urlParams.get('to') || urlParams.get('guest');

  // Also check pathname: /invitation/:slug
  const pathParts = window.location.pathname.split('/');
  if (pathParts[1] === 'invitation' && pathParts[2]) {
    guestSlug = pathParts[2];
  }

  if (guestSlug) {
    try {
      const res = await fetch(`/api/guest/${encodeURIComponent(guestSlug)}`);
      if (res.ok) {
        currentGuest = await res.json();
      } else {
        // Fallback: use query param as plain name
        currentGuest = {
          name: decodeURIComponent(guestSlug).replace(/\+/g, ' '),
          name_en: decodeURIComponent(guestSlug).replace(/\+/g, ' '),
          side: 'groom',
          pax_allowed: 2
        };
      }
    } catch (e) {
      currentGuest = {
        name: decodeURIComponent(guestSlug).replace(/\+/g, ' '),
        name_en: decodeURIComponent(guestSlug).replace(/\+/g, ' '),
        side: 'groom',
        pax_allowed: 2
      };
    }
  }
}

// Render dynamic content
function renderAll() {
  if (!weddingData) return;
  const w = weddingData.wedding;

  // Set Theme Class on Body
  const themeId = (weddingData.theme && weddingData.theme.id) || 'khmer-traditional';
  document.body.className = `wedding-bg-pattern min-h-screen relative text-[#2C2420] theme-${themeId}`;

  if (weddingData.theme) {
    document.documentElement.style.setProperty('--primary', weddingData.theme.primaryColor || '#8C1D2F');
    document.documentElement.style.setProperty('--accent', weddingData.theme.accentColor || '#D4AF37');
  }

  // Update top bar theme switcher display
  const themeIconEl = document.getElementById('active-theme-icon');
  if (themeIconEl) {
    const emblemMap = { 'khmer-traditional': '🪷', 'western-modern': '💍', 'chinese-traditional': '囍' };
    themeIconEl.textContent = emblemMap[themeId] || '🪷';
  }
  const themeLabelEl = document.getElementById('active-theme-label');
  if (themeLabelEl) {
    const labelMap = { 'khmer-traditional': '១. ខ្មែរ', 'western-modern': '២. Modern', 'chinese-traditional': '៣. 囍 ចិន' };
    themeLabelEl.textContent = labelMap[themeId] || 'Theme';
  }

  // Language based text rendering
  const isKh = currentLang === 'kh';

  // Groom and Bride initials for monogram
  const groomInitial = (w.groom.name_en || w.groom.name_kh || 'G').trim().charAt(0).toUpperCase();
  const brideInitial = (w.bride.name_en || w.bride.name_kh || 'B').trim().charAt(0).toUpperCase();

  // Inject Theme Small Component Emblem (Lotus / Monogram / 囍)
  const heroEmblemEl = document.getElementById('hero-theme-emblem');
  if (heroEmblemEl) {
    if (themeId === 'chinese-traditional') {
      heroEmblemEl.innerHTML = `<img src="/images/components/chinese-double-happiness.svg" alt="囍" class="h-14 filter drop-shadow-md">`;
    } else if (themeId === 'western-modern') {
      heroEmblemEl.innerHTML = `
        <div class="w-16 h-16 rounded-full border-2 border-[#C5A059] flex items-center justify-center font-serif text-lg tracking-widest text-[#1B4332] bg-white shadow-xs">
          ${groomInitial} & ${brideInitial}
        </div>
      `;
    } else {
      // Default: Khmer Traditional
      heroEmblemEl.innerHTML = `<img src="/images/components/lotus-ornament.svg" alt="Lotus" class="h-11 filter drop-shadow-xs">`;
    }
  }

  // Inject Theme Small Component Divider (Angkor / Olive Branch / Auspicious Cloud)
  const heroDividerEl = document.getElementById('hero-theme-divider');
  if (heroDividerEl) {
    if (themeId === 'chinese-traditional') {
      heroDividerEl.innerHTML = `
        <div class="flex items-center gap-3">
          <img src="/images/components/auspicious-cloud.svg" alt="Cloud" class="h-6 opacity-75">
          <span class="text-xs text-[#A31621] font-bold">🌸 百年好合 • 喜结良缘 🌸</span>
          <img src="/images/components/auspicious-cloud.svg" alt="Cloud" class="h-6 opacity-75 transform scale-x-[-1]">
        </div>
      `;
    } else if (themeId === 'western-modern') {
      heroDividerEl.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="h-px w-10 bg-[#C5A059]/40"></span>
          <img src="/images/components/botanical-olive.svg" alt="Olive Branch" class="h-7">
          <span class="h-px w-10 bg-[#C5A059]/40"></span>
        </div>
      `;
    } else {
      // Khmer Traditional
      heroDividerEl.innerHTML = `
        <div class="flex flex-col items-center gap-1.5 opacity-80">
          <img src="/images/components/angkor-silhouette.svg" alt="Angkor Wat" class="h-9 text-[#8C1D2F]">
          <span class="text-[10px] text-[#D4AF37] font-bold tracking-widest uppercase">ប្រាសាទអង្គរវត្ត • សិរីសួស្តីជ័យមង្គល</span>
        </div>
      `;
    }
  }

  // 1. Transform Wax Seal based on Theme
  const sealContentEl = document.getElementById('wax-seal-content');
  if (sealContentEl) {
    if (themeId === 'chinese-traditional') {
      sealContentEl.innerHTML = `<span class="text-3xl text-[#FFE866] font-bold block leading-none drop-shadow-md">囍</span><span class="text-[8px] tracking-wider uppercase block mt-1 font-bold">OPEN</span>`;
    } else if (themeId === 'western-modern') {
      sealContentEl.innerHTML = `<span class="text-2xl block leading-none">💍</span><span class="text-[8px] tracking-wider uppercase block mt-1 font-bold">OPEN</span>`;
    } else {
      // Default: khmer-traditional
      sealContentEl.innerHTML = `<span class="text-2xl block leading-none">🪷</span><span class="text-[8px] tracking-wider uppercase block mt-1 font-bold">OPEN</span>`;
    }
  }

  // 2. Transform Hero Motif Ribbon
  const heroMotifEl = document.getElementById('hero-motif-text');
  if (heroMotifEl) {
    if (themeId === 'chinese-traditional') {
      heroMotifEl.innerHTML = isKh ? '囍 喜结良缘 • 百年好合 • 鸾凤和鸣 囍' : '囍 Double Happiness • A Celebration of Love 囍';
    } else if (themeId === 'western-modern') {
      heroMotifEl.innerHTML = isKh ? 'TOGETHER WITH THEIR FAMILIES' : 'TOGETHER WITH THEIR FAMILIES';
    } else {
      heroMotifEl.innerHTML = isKh ? '🪷 សិរីសួស្តី អាពាហ៍ពិពាហ៍ប្រពៃណីខ្មែរ 🪷' : '🪷 Traditional Khmer Wedding Celebration 🪷';
    }
  }

  // 3. Transform Footer Stamp Icon
  const footerStampEl = document.getElementById('footer-stamp-icon');
  if (footerStampEl) {
    if (themeId === 'chinese-traditional') {
      footerStampEl.innerHTML = `<span class="text-2xl font-bold text-[#FFD700]">囍</span>`;
    } else if (themeId === 'western-modern') {
      footerStampEl.innerHTML = `<span class="text-xl">💍</span>`;
    } else {
      footerStampEl.innerHTML = `<span class="text-xl">🪷</span>`;
    }
  }

  // Guest name on envelope
  const guestBadgeName = document.getElementById('envelope-guest-name');
  const envelopeInviteText = document.getElementById('envelope-invite-text');
  if (currentGuest) {
    guestBadgeName.textContent = isKh ? (currentGuest.name || currentGuest.name_en) : (currentGuest.name_en || currentGuest.name);
    envelopeInviteText.textContent = isKh ? 'សូមគោរពអញ្ជើញ' : 'Cordially Invited:';
    document.getElementById('envelope-guest-container').classList.remove('hidden');
  }

  // Monogram initials on Envelope
  const monogramEl = document.getElementById('envelope-monogram');
  if (monogramEl) {
    if (themeId === 'chinese-traditional') {
      monogramEl.innerHTML = `<span class="text-3xl text-[#FFD700] font-bold">囍</span>`;
    } else if (themeId === 'western-modern') {
      monogramEl.innerHTML = `<span class="font-serif text-2xl tracking-widest text-[#1B4332] font-bold">${groomInitial} & ${brideInitial}</span>`;
    } else {
      monogramEl.textContent = `${groomInitial} & ${brideInitial}`;
    }
  }

  // Couple names on Envelope
  const envelopeCoupleEl = document.getElementById('envelope-couple-names');
  if (envelopeCoupleEl) {
    let connectorHtml = '<span>និង</span>';
    if (themeId === 'western-modern') {
      connectorHtml = '<span class="italic font-serif text-base text-[var(--accent)]">&</span>';
    } else if (themeId === 'chinese-traditional') {
      connectorHtml = '<span class="font-bold text-[#FFD700] text-sm">囍</span>';
    } else if (themeId === 'khmer-traditional') {
      connectorHtml = '<span class="text-xs">🪷 និង 🪷</span>';
    }

    if (isKh) {
      envelopeCoupleEl.innerHTML = `
        <div class="flex flex-col items-center justify-center">
          <div class="couple-names-khmer text-xl sm:text-2xl font-bold tracking-normal">
            ${escapeHTML(w.groom.name_kh)}
          </div>
          <div class="couple-connector my-1">
            ${connectorHtml}
          </div>
          <div class="couple-names-khmer text-xl sm:text-2xl font-bold tracking-normal">
            ${escapeHTML(w.bride.name_kh)}
          </div>
        </div>
      `;
    } else {
      envelopeCoupleEl.innerHTML = `
        <div class="font-en-script text-3xl sm:text-4xl text-[var(--primary)] leading-tight">
          <div>${escapeHTML(w.groom.name_en)}</div>
          <div class="text-xl text-[var(--accent)] my-0.5">&</div>
          <div>${escapeHTML(w.bride.name_en)}</div>
        </div>
      `;
    }
  }

  // Main Page Header Titles - Theme Tailored
  const mainTitleEl = document.getElementById('main-wedding-title');
  if (mainTitleEl) {
    if (themeId === 'chinese-traditional') {
      mainTitleEl.textContent = isKh ? '囍 សិរីសួស្តី អាពាហ៍ពិពាហ៍ 喜结良缘 囍' : '囍 DOUBLE HAPPINESS CELEBRATION 囍';
    } else if (themeId === 'western-modern') {
      mainTitleEl.textContent = isKh ? 'WEDDING CELEBRATION' : 'THE WEDDING CELEBRATION OF';
    } else {
      mainTitleEl.textContent = isKh ? (w.title_kh || 'សិរីសួស្តី អាពាហ៍ពិពាហ៍ប្រពៃណីខ្មែរ') : (w.title_en || 'Traditional Khmer Wedding');
    }
  }
  
  const mainCoupleKhEl = document.getElementById('main-couple-kh');
  if (mainCoupleKhEl) {
    let mainConnector = `<span class="inline-block mx-2 text-[var(--accent)] font-normal text-sm font-khmer-body">និង</span>`;
    if (themeId === 'chinese-traditional') {
      mainConnector = `<span class="inline-block mx-2 text-[#FFD700] font-bold text-base">囍</span>`;
    } else if (themeId === 'western-modern') {
      mainConnector = `<span class="inline-block mx-2 text-[#C5A059] font-serif italic text-lg">&</span>`;
    } else if (themeId === 'khmer-traditional') {
      mainConnector = `<span class="inline-block mx-2 text-[#D4AF37] font-bold text-sm">🪷 និង 🪷</span>`;
    }

    mainCoupleKhEl.innerHTML = `
      <span class="couple-names-khmer text-xl sm:text-2xl font-bold">
        ${escapeHTML(w.groom.name_kh)}
      </span>
      ${mainConnector}
      <span class="couple-names-khmer text-xl sm:text-2xl font-bold">
        ${escapeHTML(w.bride.name_kh)}
      </span>
    `;
  }

  const mainCoupleEnEl = document.getElementById('main-couple-en');
  if (mainCoupleEnEl) {
    if (themeId === 'western-modern') {
      mainCoupleEnEl.textContent = `${w.groom.name_en.toUpperCase()} & ${w.bride.name_en.toUpperCase()}`;
    } else if (themeId === 'chinese-traditional') {
      mainCoupleEnEl.textContent = `${w.groom.name_en} 囍 ${w.bride.name_en}`;
    } else {
      mainCoupleEnEl.textContent = `${w.groom.name_en} & ${w.bride.name_en}`;
    }
  }

  // Quote - Theme Tailored
  const quoteEl = document.getElementById('couple-quote');
  if (quoteEl) {
    if (themeId === 'chinese-traditional') {
      quoteEl.textContent = isKh ? '«两姓联姻，一堂缔约，良缘永结，匹配同称»' : '"Two families united, a blessed bond formed for eternity."';
    } else if (themeId === 'western-modern') {
      quoteEl.textContent = isKh ? '"Two lives, two hearts, joined together in friendship, united forever in love."' : '"Two lives, two hearts, joined together in friendship, united forever in love."';
    } else {
      quoteEl.textContent = isKh ? (w.quote_kh || '«សេចក្ដីស្រឡាញ់ គឺការរួមរស់ ផ្ដល់ក្ដីសុខ និងដើរទៅមុខជាមួយគ្នាជារៀងរហូត»') : (w.quote_en || 'Love is patient, love is kind.');
    }
  }

  // Parents Headings - Theme Tailored
  const groomParentsH = document.getElementById('groom-parents-heading');
  const brideParentsH = document.getElementById('bride-parents-heading');
  if (groomParentsH) {
    groomParentsH.textContent = themeId === 'chinese-traditional' ? '男方家长 (Groom\'s Parents)' : (isKh ? 'លោកឪពុក អ្នកម្តាយ ខាងកូនប្រុស' : "GROOM'S PARENTS");
  }
  if (brideParentsH) {
    brideParentsH.textContent = themeId === 'chinese-traditional' ? '女方家长 (Bride\'s Parents)' : (isKh ? 'លោកឪពុក អ្នកម្តាយ ខាងកូនស្រី' : "BRIDE'S PARENTS");
  }

  document.getElementById('groom-father').textContent = isKh ? w.groom.father_kh : w.groom.father_en;
  document.getElementById('groom-mother').textContent = isKh ? w.groom.mother_kh : w.groom.mother_en;
  document.getElementById('groom-name-card').textContent = isKh ? w.groom.name_kh : w.groom.name_en;

  document.getElementById('bride-father').textContent = isKh ? w.bride.father_kh : w.bride.father_en;
  document.getElementById('bride-mother').textContent = isKh ? w.bride.mother_kh : w.bride.mother_en;
  document.getElementById('bride-name-card').textContent = isKh ? w.bride.name_kh : w.bride.name_en;

  // Photos
  if (w.couple_photo) document.getElementById('main-couple-img').src = w.couple_photo;
  if (w.groom.photo) document.getElementById('groom-img').src = w.groom.photo;
  if (w.bride.photo) document.getElementById('bride-img').src = w.bride.photo;

  // Date and Venue
  document.getElementById('event-date-solar').textContent = isKh ? w.date_solar_kh : w.date_solar_en;
  document.getElementById('event-date-lunar').textContent = isKh ? w.date_lunar_kh : w.date_lunar_en;
  document.getElementById('venue-name').textContent = isKh ? w.venue_name_kh : w.venue_name_en;
  document.getElementById('venue-address').textContent = isKh ? w.venue_address_kh : w.venue_address_en;
  document.getElementById('btn-google-maps').href = w.map_url;
  document.getElementById('map-iframe').src = w.map_embed;

  // Video embed
  if (w.video_embed) {
    document.getElementById('video-container').classList.remove('hidden');
    document.getElementById('wedding-video-iframe').src = w.video_embed;
  }

  // Render Agenda / Schedule
  renderAgenda();

  // Render Gallery
  renderGallery();

  // Digital Gift info
  renderDigitalGift();

  // RSVP Form Guest prepopulation
  if (currentGuest) {
    document.getElementById('rsvp-name').value = isKh ? (currentGuest.name || currentGuest.name_en) : (currentGuest.name_en || currentGuest.name);
    if (currentGuest.phone) document.getElementById('rsvp-phone').value = currentGuest.phone;
    if (currentGuest.side) document.getElementById('rsvp-side').value = currentGuest.side;
    if (currentGuest.pax_allowed) {
      document.getElementById('rsvp-pax-hint').textContent = isKh 
        ? `(ចំនួនភ្ញៀវអញ្ជើញចូលរួម: ${currentGuest.pax_allowed} នាក់)`
        : `(Reserved for: ${currentGuest.pax_allowed} pax)`;
    }
  }

  // Render Wishes Wall
  loadWishes();

  // Update static UI translations
  updateUITranslations();
}

// Render Agenda
function renderAgenda() {
  const container = document.getElementById('agenda-container');
  container.innerHTML = '';
  const isKh = currentLang === 'kh';

  if (!weddingData.agenda) return;

  const iconsMap = {
    'gift': `<svg class="w-6 h-6 text-[#C5A059]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V3.5a2.5 2.5 0 115 0V8h-5zm0 0H7.5A2.5 2.5 0 105 10.5V13h7V8zm0 5h7a2 2 0 012 2v5a2 2 0 01-2 2h-7v-9z"/></svg>`,
    'hands-praying': `<svg class="w-6 h-6 text-[#C5A059]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"/></svg>`,
    'scissors': `<svg class="w-6 h-6 text-[#C5A059]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879a3 3 0 11-4.242-4.242 3 3 0 014.242 0L12 12zm0 0l-2.879-2.879a3 3 0 10-4.242 4.242 3 3 0 004.242 0L12 12z"/></svg>`,
    'ring': `<svg class="w-6 h-6 text-[#C5A059]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" stroke-width="2"/><path stroke-linecap="round" stroke-width="2" d="M9 5l3-3 3 3"/></svg>`,
    'camera': `<svg class="w-6 h-6 text-[#C5A059]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="4" stroke-width="2"/></svg>`,
    'utensils': `<svg class="w-6 h-6 text-[#C5A059]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`
  };

  weddingData.agenda.forEach(item => {
    const iconHtml = iconsMap[item.icon] || iconsMap['gift'];
    const el = document.createElement('div');
    el.className = 'relative flex items-start gap-4 mb-8 group';
    el.innerHTML = `
      <div class="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-white border-2 border-[#C5A059] shadow-md shrink-0">
        ${iconHtml}
      </div>
      <div class="bg-white/80 backdrop-blur-xs p-5 rounded-2xl border border-[#E5D5BC] shadow-xs flex-1 transition hover:shadow-md hover:border-[#C5A059]">
        <div class="inline-block px-3 py-1 bg-[#FAF7F2] text-[#4E3227] text-xs font-bold rounded-full mb-2 border border-[#E5D5BC]">
          ${item.time}
        </div>
        <h4 class="text-base font-bold text-[#4E3227] mb-1 font-khmer-title">
          ${isKh ? item.title_kh : item.title_en}
        </h4>
        <p class="text-sm text-[#7A6F68] font-khmer-body">
          ${isKh ? item.desc_kh : item.desc_en}
        </p>
      </div>
    `;
    container.appendChild(el);
  });
}

// Render Gallery
function renderGallery() {
  const container = document.getElementById('gallery-container');
  container.innerHTML = '';
  const isKh = currentLang === 'kh';

  if (!weddingData.gallery) return;

  weddingData.gallery.forEach(img => {
    const el = document.createElement('div');
    el.className = 'relative overflow-hidden rounded-2xl shadow-sm border border-[#E5D5BC] group cursor-pointer aspect-4/5';
    el.innerHTML = `
      <img src="${img.url}" alt="${img.caption_en || 'Wedding'}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy">
      <div class="absolute inset-0 bg-gradient-to-t from-[#4E3227]/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
        <span class="text-white text-sm font-medium">
          ${isKh ? (img.caption_kh || '') : (img.caption_en || '')}
        </span>
      </div>
    `;
    el.addEventListener('click', () => {
      openLightbox(img.url, isKh ? img.caption_kh : img.caption_en);
    });
    container.appendChild(el);
  });
}

// Render Digital Gift KHQR
function renderDigitalGift() {
  if (!weddingData.digital_gift || !weddingData.digital_gift.enabled) {
    document.getElementById('digital-gift-section').classList.add('hidden');
    return;
  }
  const isKh = currentLang === 'kh';
  const dg = weddingData.digital_gift;

  const themeId = (weddingData.theme && weddingData.theme.id) || 'khmer-traditional';
  if (themeId === 'chinese-traditional') {
    document.getElementById('gift-title').textContent = isKh ? '🧧 ចំណងដៃមង្គលការ (红包 / Red Packet)' : '🧧 AUSPICIOUS RED PACKET & GIFT';
    document.getElementById('gift-description').textContent = isKh ? 'ពាក្យជូនពរ និងអំណោយចំណងដៃរបស់អ្នក គឺជាពរជ័យដ៏មានតម្លៃបំផុតសម្រាប់យើងខ្ញុំទាំងពីរ។' : 'Your blessings and warm gifts are the most cherished wishes for our new journey together.';
  } else if (themeId === 'western-modern') {
    document.getElementById('gift-title').textContent = 'WEDDING REGISTRY & GIFT';
    document.getElementById('gift-description').textContent = isKh ? 'វត្តមានរបស់អ្នក គឺជាអំណោយដ៏ធំធេងបំផុត។ ប្រសិនបើលោកអ្នកមានបំណងជូនពរតាមរយៈចំណងដៃឌីជីថល៖' : 'Your presence is the greatest gift. If you wish to celebrate with a gift, digital details are below:';
  } else {
    document.getElementById('gift-title').textContent = isKh ? dg.title_kh : dg.title_en;
    document.getElementById('gift-description').textContent = isKh ? dg.description_kh : dg.description_en;
  }

  // Groom account
  document.getElementById('groom-bank-name').textContent = dg.groom_account.bank_name;
  document.getElementById('groom-acc-name').textContent = dg.groom_account.account_name;
  document.getElementById('groom-acc-num').textContent = dg.groom_account.account_number;
  document.getElementById('groom-qr-img').src = dg.groom_account.qr_image;

  // Bride account
  document.getElementById('bride-bank-name').textContent = dg.bride_account.bank_name;
  document.getElementById('bride-acc-name').textContent = dg.bride_account.account_name;
  document.getElementById('bride-acc-num').textContent = dg.bride_account.account_number;
  document.getElementById('bride-qr-img').src = dg.bride_account.qr_image;
}

// Lightbox
function openLightbox(url, caption) {
  const modal = document.getElementById('lightbox-modal');
  const img = document.getElementById('lightbox-img');
  const cap = document.getElementById('lightbox-caption');
  img.src = url;
  cap.textContent = caption || '';
  modal.classList.add('active');
}

function closeLightbox() {
  document.getElementById('lightbox-modal').classList.remove('active');
}

// Event Listeners
function initEventListeners() {
  // Wax seal envelope open
  const waxBtn = document.getElementById('btn-open-envelope');
  if (waxBtn) {
    waxBtn.addEventListener('click', () => {
      openEnvelope();
    });
  }

  // Music toggle
  const musicBtn = document.getElementById('floating-music-btn');
  if (musicBtn) {
    musicBtn.addEventListener('click', () => {
      toggleMusic();
    });
  }

  // Language toggle
  const langBtn = document.getElementById('lang-toggle-btn');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      currentLang = currentLang === 'kh' ? 'en' : 'kh';
      const label = document.getElementById('current-lang-label');
      if (label) label.textContent = currentLang === 'kh' ? 'ខ្មែរ' : 'EN';
      renderAll();
    });
  }

  // Theme dropdown toggle on click (mobile friendly)
  const themeBtn = document.getElementById('theme-menu-btn');
  const themeDropdown = document.getElementById('theme-menu-dropdown');
  if (themeBtn && themeDropdown) {
    themeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      themeDropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', () => {
      themeDropdown.classList.add('hidden');
    });
  }

  // Lightbox close
  const lbClose = document.getElementById('lightbox-close');
  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  const lbModal = document.getElementById('lightbox-modal');
  if (lbModal) {
    lbModal.addEventListener('click', (e) => {
      if (e.target.id === 'lightbox-modal') closeLightbox();
    });
  }

  // Copy account buttons
  const groomCopyBtn = document.getElementById('btn-copy-groom-acc');
  if (groomCopyBtn) {
    groomCopyBtn.addEventListener('click', () => {
      const acc = weddingData?.digital_gift?.groom_account?.account_number || '';
      navigator.clipboard.writeText(acc);
      showToast(currentLang === 'kh' ? 'បានចម្លងលេខគណនីជោគជ័យ!' : 'Account number copied!');
    });
  }

  const brideCopyBtn = document.getElementById('btn-copy-bride-acc');
  if (brideCopyBtn) {
    brideCopyBtn.addEventListener('click', () => {
      const acc = weddingData?.digital_gift?.bride_account?.account_number || '';
      navigator.clipboard.writeText(acc);
      showToast(currentLang === 'kh' ? 'បានចម្លងលេខគណនីជោគជ័យ!' : 'Account number copied!');
    });
  }

  // Add to Calendar Button
  const calBtn = document.getElementById('btn-add-calendar');
  if (calBtn) calBtn.addEventListener('click', addToCalendar);

  // RSVP Form submission
  const rsvpForm = document.getElementById('rsvp-form');
  if (rsvpForm) rsvpForm.addEventListener('submit', handleRSVPSubmit);

  // Wish Form submission
  const wishForm = document.getElementById('wish-form');
  if (wishForm) wishForm.addEventListener('submit', handleWishSubmit);
}

// Open Envelope
function openEnvelope() {
  const screen = document.getElementById('envelope-screen');
  if (screen) screen.classList.add('opened');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Play music on first interaction
  playMusic();
}
window.openEnvelope = openEnvelope;
window.toggleMusic = toggleMusic;

// Audio Control
function playMusic() {
  audioPlayer.play().then(() => {
    isAudioPlaying = true;
    updateMusicBtn();
  }).catch(e => {
    console.log('Audio autoplay prevented:', e);
  });
}

function toggleMusic() {
  if (isAudioPlaying) {
    audioPlayer.pause();
    isAudioPlaying = false;
  } else {
    audioPlayer.play();
    isAudioPlaying = true;
  }
  updateMusicBtn();
}

function updateMusicBtn() {
  const iconPlay = document.getElementById('music-icon-play');
  const iconPause = document.getElementById('music-icon-pause');
  const btn = document.getElementById('floating-music-btn');

  if (isAudioPlaying) {
    iconPlay.classList.add('hidden');
    iconPause.classList.remove('hidden');
    btn.classList.add('spin-record');
  } else {
    iconPlay.classList.remove('hidden');
    iconPause.classList.add('hidden');
    btn.classList.remove('spin-record');
  }
}

// Countdown Timer
function initCountdown() {
  function update() {
    if (!weddingData || !weddingData.wedding.event_date) return;
    const target = new Date(weddingData.wedding.event_date).getTime();
    const now = new Date().getTime();
    const diff = target - now;

    if (diff <= 0) {
      document.getElementById('cd-days').textContent = '00';
      document.getElementById('cd-hours').textContent = '00';
      document.getElementById('cd-minutes').textContent = '00';
      document.getElementById('cd-seconds').textContent = '00';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    document.getElementById('cd-days').textContent = String(days).padStart(2, '0');
    document.getElementById('cd-hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('cd-minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('cd-seconds').textContent = String(seconds).padStart(2, '0');
  }
  update();
  setInterval(update, 1000);
}

// Falling Golden Petals
function initPetals() {
  const colors = ['#C5A059', '#E5C384', '#F4E3C1', '#D4AF37'];
  const container = document.body;

  function createPetal() {
    if (document.hidden) return;
    const petal = document.createElement('div');
    petal.className = 'petal-fall';
    const size = Math.random() * 8 + 6;
    petal.style.width = `${size}px`;
    petal.style.height = `${size * 1.4}px`;
    petal.style.left = `${Math.random() * 100}vw`;
    petal.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    petal.style.borderRadius = '50% 0 50% 50%';
    petal.style.animationDuration = `${Math.random() * 6 + 6}s`;
    petal.style.opacity = (Math.random() * 0.5 + 0.3).toString();

    container.appendChild(petal);
    setTimeout(() => petal.remove(), 12000);
  }

  setInterval(createPetal, 1200);
}

// Add to Calendar
function addToCalendar() {
  if (!weddingData) return;
  const w = weddingData.wedding;
  const startDate = new Date(w.event_date);
  const endDate = new Date(startDate.getTime() + 15 * 60 * 60 * 1000); // 15 hours

  function formatTime(d) {
    return d.toISOString().replace(/-|:|\.\d\d\d/g, '');
  }

  const title = encodeURIComponent(`${w.groom.name_en} & ${w.bride.name_en} Wedding Celebration`);
  const details = encodeURIComponent(`We cordially invite you to celebrate our wedding. Venue: ${w.venue_name_en}, ${w.venue_address_en}`);
  const location = encodeURIComponent(`${w.venue_name_en}, ${w.venue_address_en}`);
  const dates = `${formatTime(startDate)}/${formatTime(endDate)}`;

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  window.open(googleUrl, '_blank');
}

// Handle RSVP Submit
async function handleRSVPSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('rsvp-name').value.trim();
  const phone = document.getElementById('rsvp-phone').value.trim();
  const status = document.getElementById('rsvp-status').value;
  const attendees = document.getElementById('rsvp-attendees').value;
  const side = document.getElementById('rsvp-side').value;
  const wishes = document.getElementById('rsvp-wishes').value.trim();

  const isKh = currentLang === 'kh';

  try {
    const payload = {
      guestId: currentGuest ? currentGuest.id : null,
      slug: currentGuest ? currentGuest.slug : null,
      name,
      phone,
      status,
      attendees,
      side,
      wishes
    };

    const res = await fetch('/api/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
      showToast(isKh ? 'សូមអរគុណ! ការឆ្លើយតបរបស់អ្នកត្រូវបានកត់ត្រា។' : 'Thank you! Your RSVP has been submitted.');
      document.getElementById('rsvp-form').reset();
      loadWishes();
    } else {
      showToast(data.error || 'Submission error');
    }
  } catch (err) {
    showToast('Failed to submit RSVP');
  }
}

// Handle Direct Wish Submit
async function handleWishSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('wish-sender-name').value.trim();
  const relationship = document.getElementById('wish-sender-rel').value;
  const message = document.getElementById('wish-message').value.trim();

  const isKh = currentLang === 'kh';

  if (!name || !message) {
    showToast(isKh ? 'សូមបំពេញឈ្មោះ និងពាក្យជូនពរ' : 'Please enter your name and message');
    return;
  }

  try {
    const res = await fetch('/api/wishes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestName: name, relationship, message })
    });
    if (res.ok) {
      showToast(isKh ? 'សូមអរគុណសម្រាប់ពាក្យជូនពរដ៏មានអត្ថន័យ!' : 'Thank you for your lovely wish!');
      document.getElementById('wish-message').value = '';
      loadWishes();
    }
  } catch (err) {
    showToast('Failed to send wish');
  }
}

// Load and Render Wishes
async function loadWishes() {
  const container = document.getElementById('wishes-list');
  try {
    const res = await fetch('/api/wishes');
    const wishes = await res.json();
    container.innerHTML = '';

    if (wishes.length === 0) {
      container.innerHTML = `<p class="text-center text-sm text-[#7A6F68] py-4">សូមផ្ញើសារជូនពរដំបូងគេដល់គូស្វាមីភរិយាថ្មី!</p>`;
      return;
    }

    wishes.slice(0, 10).forEach(w => {
      const el = document.createElement('div');
      el.className = 'p-4 rounded-xl bg-[#FAF7F2] border border-[#E5D5BC] shadow-2xs mb-3';
      el.innerHTML = `
        <div class="flex items-center justify-between mb-1">
          <span class="font-bold text-[#4E3227] text-sm">${escapeHTML(w.guestName)}</span>
          <span class="text-[11px] text-[#C5A059] px-2 py-0.5 bg-white rounded-full border border-[#E5D5BC]">${escapeHTML(w.relationship || '')}</span>
        </div>
        <p class="text-xs text-[#2C2420] mt-1 leading-relaxed font-khmer-body">${escapeHTML(w.message)}</p>
      `;
      container.appendChild(el);
    });
  } catch (e) {
    console.error('Error loading wishes:', e);
  }
}

// Toast notification
function showToast(msg) {
  const toast = document.getElementById('toast-notice');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
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

// UI Translations
function updateUITranslations() {
  const isKh = currentLang === 'kh';
  document.querySelectorAll('[data-kh]').forEach(el => {
    el.textContent = isKh ? el.getAttribute('data-kh') : el.getAttribute('data-en');
  });
}

// Live Theme Switcher for Invitation
const THEME_DATA_MAP = {
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
    name: 'Western Modern Luxury (រចនាបថបស្ចិមប្រទេស - ចិញ្ចៀន & ត្បូងមរកត)',
    primaryColor: '#1B4332',
    accentColor: '#C5A059',
    secondaryColor: '#2D6A4F',
    bgColor: '#F8F9FA',
    emblem: '💍',
    sealEmblem: 'rings'
  },
  'chinese-traditional': {
    id: 'chinese-traditional',
    name: 'Chinese Traditional 囍 (រចនាបថប្រពៃណីចិន - មង្គលទ្វេ & ក្រហម)',
    primaryColor: '#A31621',
    accentColor: '#D4AF37',
    secondaryColor: '#C72535',
    bgColor: '#FFF7F7',
    emblem: '囍',
    sealEmblem: 'shuangxi'
  }
};

window.switchThemeLive = async function(themeId) {
  const themeObj = THEME_DATA_MAP[themeId];
  if (!themeObj || !weddingData) return;
  weddingData.theme = { ...themeObj };

  // Set Theme Class on Body
  document.body.className = `wedding-bg-pattern min-h-screen relative text-[#2C2420] theme-${themeId}`;
  document.documentElement.style.setProperty('--primary', themeObj.primaryColor);
  document.documentElement.style.setProperty('--accent', themeObj.accentColor);

  renderAll();

  showToast(`បានប្តូររចនាបថ៖ ${themeObj.name}`);

  // Persist to server
  try {
    await fetch('/api/wedding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(weddingData)
    });
  } catch (err) {
    console.error('Failed to auto-save theme:', err);
  }
};
