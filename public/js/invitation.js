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
    if (weddingData.wedding && weddingData.wedding.music_url) {
      audioPlayer.src = weddingData.wedding.music_url;
      audioPlayer.loop = true;
    }
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

  // Set Theme Colors
  if (weddingData.theme) {
    document.documentElement.style.setProperty('--primary', weddingData.theme.primaryColor || '#4E3227');
    document.documentElement.style.setProperty('--accent', weddingData.theme.accentColor || '#C5A059');
  }

  // Language based text rendering
  const isKh = currentLang === 'kh';

  // Guest name on envelope
  const guestBadgeName = document.getElementById('envelope-guest-name');
  const envelopeInviteText = document.getElementById('envelope-invite-text');
  if (currentGuest) {
    guestBadgeName.textContent = isKh ? (currentGuest.name || currentGuest.name_en) : (currentGuest.name_en || currentGuest.name);
    envelopeInviteText.textContent = isKh ? 'សូមគោរពអញ្ជើញ' : 'Cordially Invited:';
    document.getElementById('envelope-guest-container').classList.remove('hidden');
  }

  // Monogram initials
  const groomInitial = (w.groom.name_en || w.groom.name_kh || 'G').trim().charAt(0).toUpperCase();
  const brideInitial = (w.bride.name_en || w.bride.name_kh || 'B').trim().charAt(0).toUpperCase();
  const monogramEl = document.getElementById('envelope-monogram');
  if (monogramEl) {
    monogramEl.textContent = `${groomInitial} & ${brideInitial}`;
  }

  // Couple names on Envelope
  const envelopeCoupleEl = document.getElementById('envelope-couple-names');
  if (envelopeCoupleEl) {
    if (isKh) {
      envelopeCoupleEl.innerHTML = `
        <div class="flex flex-col items-center justify-center">
          <div class="couple-names-khmer text-xl sm:text-2xl font-bold tracking-normal">
            ${escapeHTML(w.groom.name_kh)}
          </div>
          <div class="couple-connector">
            <span>និង</span>
          </div>
          <div class="couple-names-khmer text-xl sm:text-2xl font-bold tracking-normal">
            ${escapeHTML(w.bride.name_kh)}
          </div>
        </div>
      `;
    } else {
      envelopeCoupleEl.innerHTML = `
        <div class="font-en-script text-3xl sm:text-4xl text-[#4E3227] leading-tight">
          <div>${escapeHTML(w.groom.name_en)}</div>
          <div class="text-xl text-[#C5A059] my-0.5">&</div>
          <div>${escapeHTML(w.bride.name_en)}</div>
        </div>
      `;
    }
  }

  // Main Page Header Titles
  document.getElementById('main-wedding-title').textContent = isKh ? w.title_kh : w.title_en;
  
  const mainCoupleKhEl = document.getElementById('main-couple-kh');
  if (mainCoupleKhEl) {
    mainCoupleKhEl.innerHTML = `
      <span class="couple-names-khmer text-xl sm:text-2xl font-bold text-[#4E3227]">
        ${escapeHTML(w.groom.name_kh)}
      </span>
      <span class="inline-block mx-2 text-[#C5A059] font-normal text-sm font-khmer-body">និង</span>
      <span class="couple-names-khmer text-xl sm:text-2xl font-bold text-[#4E3227]">
        ${escapeHTML(w.bride.name_kh)}
      </span>
    `;
  }
  document.getElementById('main-couple-en').textContent = `${w.groom.name_en} & ${w.bride.name_en}`;

  // Quote
  document.getElementById('couple-quote').textContent = isKh ? w.quote_kh : w.quote_en;

  // Parents
  document.getElementById('groom-parents-heading').textContent = isKh ? 'លោកឪពុក អ្នកម្តាយ ខាងកូនប្រុស' : "Groom's Parents";
  document.getElementById('groom-father').textContent = isKh ? w.groom.father_kh : w.groom.father_en;
  document.getElementById('groom-mother').textContent = isKh ? w.groom.mother_kh : w.groom.mother_en;
  document.getElementById('groom-name-card').textContent = isKh ? w.groom.name_kh : w.groom.name_en;

  document.getElementById('bride-parents-heading').textContent = isKh ? 'លោកឪពុក អ្នកម្តាយ ខាងកូនស្រី' : "Bride's Parents";
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

  document.getElementById('gift-title').textContent = isKh ? dg.title_kh : dg.title_en;
  document.getElementById('gift-description').textContent = isKh ? dg.description_kh : dg.description_en;

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
  waxBtn.addEventListener('click', () => {
    openEnvelope();
  });

  // Music toggle
  const musicBtn = document.getElementById('floating-music-btn');
  musicBtn.addEventListener('click', () => {
    toggleMusic();
  });

  // Language toggle
  document.getElementById('lang-toggle-btn').addEventListener('click', () => {
    currentLang = currentLang === 'kh' ? 'en' : 'kh';
    document.getElementById('current-lang-label').textContent = currentLang === 'kh' ? 'ខ្មែរ' : 'EN';
    renderAll();
  });

  // Lightbox close
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox-modal').addEventListener('click', (e) => {
    if (e.target.id === 'lightbox-modal') closeLightbox();
  });

  // Copy account buttons
  document.getElementById('btn-copy-groom-acc').addEventListener('click', () => {
    const acc = weddingData.digital_gift.groom_account.account_number;
    navigator.clipboard.writeText(acc);
    showToast(currentLang === 'kh' ? 'បានចម្លងលេខគណនីជោគជ័យ!' : 'Account number copied!');
  });

  document.getElementById('btn-copy-bride-acc').addEventListener('click', () => {
    const acc = weddingData.digital_gift.bride_account.account_number;
    navigator.clipboard.writeText(acc);
    showToast(currentLang === 'kh' ? 'បានចម្លងលេខគណនីជោគជ័យ!' : 'Account number copied!');
  });

  // Add to Calendar Button
  document.getElementById('btn-add-calendar').addEventListener('click', addToCalendar);

  // RSVP Form submission
  document.getElementById('rsvp-form').addEventListener('submit', handleRSVPSubmit);

  // Wish Form submission
  document.getElementById('wish-form').addEventListener('submit', handleWishSubmit);
}

// Open Envelope
function openEnvelope() {
  const screen = document.getElementById('envelope-screen');
  screen.classList.add('opened');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Play music on first interaction
  playMusic();
}

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
