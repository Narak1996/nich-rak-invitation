/**
 * THEAP KHMER TEMPLATE 20 (EMERALD BOTANICAL) - 100% EXACT CLIENT CONTROLLER
 */

let weddingData = null;
let currentGuest = null;
let audioPlayer = new Audio();
let isAudioPlaying = false;
let currentLang = 'kh';

// Convert Arabic digits (0-9) to Khmer numerals (០-៩)
function toKhmerNumber(val) {
  if (val === null || val === undefined) return '';
  const khmerDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(val).replace(/[0-9]/g, digit => khmerDigits[parseInt(digit, 10)]);
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

function showToast(msg) {
  const toast = document.getElementById('toast-notice');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// 1. Fetch Wedding Data
async function fetchWeddingData() {
  try {
    const res = await fetch('/api/wedding');
    weddingData = await res.json();
    initAudio();
  } catch (err) {
    console.error('Failed to load wedding data:', err);
  }
}

// 2. Fetch Guest Data from URL slug
async function checkGuestParameter() {
  const urlParams = new URLSearchParams(window.location.search);
  let guestSlug = urlParams.get('to') || urlParams.get('guest');

  if (!guestSlug) {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      const prefix = pathParts[0].toLowerCase();
      if (prefix === 'to' || prefix === 'invite' || prefix === 'invitation' || prefix === 'template20') {
        guestSlug = decodeURIComponent(pathParts.slice(1).join('/'));
      }
    }
  }

  if (guestSlug && guestSlug !== 'invitation20') {
    const rawClean = decodeURIComponent(guestSlug).replace(/\+/g, ' ').trim();
    const cleanWithSpaces = rawClean.replace(/-/g, ' ');

    try {
      let res = await fetch(`/api/guest/${encodeURIComponent(rawClean)}`);
      if (!res.ok && rawClean !== cleanWithSpaces) {
        res = await fetch(`/api/guest/${encodeURIComponent(cleanWithSpaces)}`);
      }
      if (res.ok) {
        currentGuest = await res.json();
      } else {
        currentGuest = {
          name: cleanWithSpaces,
          name_en: cleanWithSpaces,
          side: 'groom',
          pax_allowed: 2
        };
      }
    } catch (e) {
      currentGuest = {
        name: cleanWithSpaces,
        name_en: cleanWithSpaces,
        side: 'groom',
        pax_allowed: 2
      };
    }
  }
}

// 3. Audio Player Initialization
function initAudio() {
  const musicUrl = weddingData?.wedding?.music_url || '/audio/wedding-music.mp3';
  audioPlayer.src = musicUrl;
  audioPlayer.loop = true;
  audioPlayer.preload = 'auto';

  audioPlayer.addEventListener('play', () => updateMusicButton(true));
  audioPlayer.addEventListener('pause', () => updateMusicButton(false));
}

function updateMusicButton(isPlaying) {
  isAudioPlaying = isPlaying;
  const iconPlay = document.getElementById('music-icon-play');
  const iconPause = document.getElementById('music-icon-pause');
  if (isPlaying) {
    iconPlay?.classList.add('hidden');
    iconPause?.classList.remove('hidden');
    iconPause?.classList.add('spin-slow');
  } else {
    iconPlay?.classList.remove('hidden');
    iconPause?.classList.add('hidden');
    iconPause?.classList.remove('spin-slow');
  }
}

window.toggleMusic = function() {
  if (isAudioPlaying) {
    audioPlayer.pause();
  } else {
    audioPlayer.play().catch(e => console.log('Audio playback prevented:', e));
  }
};

// 4. Open Invitation Screen Transition
window.openEnvelope = function() {
  const screen = document.getElementById('t20-opening-screen');
  if (!screen || screen.classList.contains('opened')) return;

  // Add opening class to trigger door zoom-out, aisle reveal, and content fade-out
  screen.classList.add('opening');

  // Start background music
  if (!isAudioPlaying) {
    audioPlayer.play().catch(e => console.log('Autoplay blocked:', e));
  }

  setTimeout(() => {
    screen.classList.add('opened');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Show floating navigation dock
    const dock = document.getElementById('t20-bottom-dock');
    if (dock) dock.classList.remove('opacity-0', 'translate-y-10');
  }, 950);
};

// 5. Render All Template 20 Elements
function renderAll() {
  if (!weddingData) return;
  const w = weddingData.wedding || {};
  const isKh = currentLang === 'kh';

  // --- Opening Screen Elements ---
  const guestDisplayName = currentGuest 
    ? (isKh ? (currentGuest.name || currentGuest.name_en) : (currentGuest.name_en || currentGuest.name))
    : (isKh ? 'ភ្ញៀវកិត្តិយស' : 'Honorable Guest');

  const opGuestNameEl = document.getElementById('t20-opening-guest-name');
  if (opGuestNameEl) opGuestNameEl.textContent = guestDisplayName;

  const opCurvedTitle = document.getElementById('t20-curved-title-text');
  if (opCurvedTitle) {
    opCurvedTitle.textContent = w.title_kh || 'សិរីមង្គលអាពាហ៍ពិពាហ៍';
  }

  // --- Section 1: Home (#home) ---
  const mainTitleEl = document.getElementById('t20-main-title');
  if (mainTitleEl) mainTitleEl.textContent = w.title_kh || 'សិរីមង្គលអាពាហ៍ពិពាហ៍';

  // Parents Names
  const gfEl = document.getElementById('t20-groom-father');
  if (gfEl) gfEl.textContent = w.groom?.father_kh || 'លោក សឿន សុខុម';
  const gmEl = document.getElementById('t20-groom-mother');
  if (gmEl) gmEl.textContent = w.groom?.mother_kh || 'អ្នកស្រី ម៉ៅ សុផល';

  const bfEl = document.getElementById('t20-bride-father');
  if (bfEl) bfEl.textContent = w.bride?.father_kh || 'លោក សៀម វិបុល';
  const bmEl = document.getElementById('t20-bride-mother');
  if (bmEl) bmEl.textContent = w.bride?.mother_kh || 'អ្នកស្រី ចាន់ ធីតា';

  // Couple Center Feature
  const groomNameEl = document.getElementById('t20-groom-name');
  if (groomNameEl) groomNameEl.textContent = w.groom?.name_kh || 'ឡេង ចាន់ណារៈ';
  const brideNameEl = document.getElementById('t20-bride-name');
  if (brideNameEl) brideNameEl.textContent = w.bride?.name_kh || 'នាត ស្រីនិច';

  // Invitation Message Body
  const invBodyEl = document.getElementById('t20-invitation-body-kh');
  if (invBodyEl) {
    invBodyEl.textContent = w.quote_kh || 'មានកិត្តិយសសូមគោរពអញ្ជើញ ឯកឧត្តម លោកជំទាវ លោក លោកស្រី អ្នកនាង កញ្ញា និងប្រិយមិត្ត អញ្ជើញចូលរួមជាអធិបតី និងជាភ្ញៀវកិត្តិយស ដើម្បីប្រសិទ្ធពរជ័យសិរីសួស្តី ក្នុងពិធីរៀបអាពាហ៍ពិពាហ៍ កូនប្រុស-កូនស្រី របស់យើងខ្ញុំ។';
  }

  // Date and Venue Pills
  const datePillText = document.getElementById('t20-date-pill-text');
  if (datePillText) {
    datePillText.textContent = w.date_solar_kh || w.event_date || 'ថ្ងៃសៅរ៍ ទី២៤ ខែមករា ឆ្នាំ២០២៧';
  }
  const venuePillText = document.getElementById('t20-venue-pill-text');
  if (venuePillText) {
    venuePillText.textContent = w.venue_address_kh || w.venue_name_kh || 'មជ្ឈមណ្ឌលសន្និបាត និងពិព័រណ៍ ព្រីមៀរ សែនសុខ (អគារ A)';
  }

  // English Invitation Block
  if (w.quote_en) {
    const enBlock = document.getElementById('t20-english-block');
    const enQuote = document.getElementById('t20-english-quote');
    const enDate = document.getElementById('t20-english-date');
    if (enBlock) enBlock.classList.remove('hidden');
    if (enQuote) enQuote.textContent = `"${w.quote_en}"`;
    if (enDate && w.event_date) {
      enDate.textContent = new Date(w.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  }

  // --- Section 2: Countdown (#countdown) ---
  initCountdown();

  // --- Section 3: Program / Timeline (#program) ---
  renderProgramTimeline();

  // --- Section 4: Dress Code (#dress-code) ---
  renderDressCodeSwatches();

  // --- Section 5: Venue & Location (#location) ---
  renderLocationSection();

  // --- Section 6: Photo Gallery (#gallery) ---
  renderGalleryGrid();

  // --- Section 7: With Gratitude / Thank You (#thanks) ---
  const thanksCouple = document.getElementById('t20-thanks-couple');
  if (thanksCouple) {
    thanksCouple.textContent = `${w.groom?.name_en || 'Channarak'} & ${w.bride?.name_en || 'SreyNich'} · 2027`;
  }

  // --- Section 8: Digital Gift (#gift) ---
  renderDigitalGift();

  // --- Section 9: RSVP (#rsvp) ---
  renderRSVPForm();
}

// Countdown Calculation
function initCountdown() {
  function update() {
    if (!weddingData?.wedding?.event_date) return;
    const target = new Date(weddingData.wedding.event_date).getTime();
    const diff = target - Date.now();

    if (diff <= 0) {
      document.getElementById('t20-cd-days').textContent = '00';
      document.getElementById('t20-cd-hours').textContent = '00';
      document.getElementById('t20-cd-mins').textContent = '00';
      document.getElementById('t20-cd-secs').textContent = '00';
      return;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    const dEl = document.getElementById('t20-cd-days');
    const hEl = document.getElementById('t20-cd-hours');
    const mEl = document.getElementById('t20-cd-mins');
    const sEl = document.getElementById('t20-cd-secs');

    if (dEl) dEl.textContent = String(d).padStart(2, '0');
    if (hEl) hEl.textContent = String(h).padStart(2, '0');
    if (mEl) mEl.textContent = String(m).padStart(2, '0');
    if (sEl) sEl.textContent = String(s).padStart(2, '0');
  }

  update();
  setInterval(update, 1000);
}

// Render Timeline
function renderProgramTimeline() {
  const container = document.getElementById('t20-timeline-container');
  if (!container || !weddingData?.agenda) return;

  container.innerHTML = weddingData.agenda.map((item, idx) => `
    <div class="relative flex items-start gap-4 pl-1">
      <div class="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#1e3526] to-[#3a5643] text-[#F5E6C8] shadow-sm ring-4 ring-white/90 border border-[#C5A059]/50">
        <svg class="w-3.5 h-3.5 text-[#ECD08C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <div class="timeline-card-t20 flex-1 p-4 border border-[#C5A059]/35">
        <div class="flex flex-wrap items-center justify-between gap-1.5">
          <h3 class="font-moulpali text-sm sm:text-base text-[#1e3526]">${escapeHTML(item.title_kh || item.title_en)}</h3>
          ${item.time ? `
            <span class="flex items-center gap-1 rounded-full bg-gradient-to-r from-[#1e3526] to-[#2d4d38] text-[#FAF8F5] px-2.5 py-0.5 text-[11px] font-semibold border border-[#C5A059]/40 shadow-xs">
              <svg class="w-3 h-3 text-[#ECD08C]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3"/></svg>
              ${escapeHTML(item.time)}
            </span>
          ` : ''}
        </div>
        ${item.location_kh ? `
          <p class="mt-1.5 flex items-center gap-1 text-xs text-[#556B5C]">
            <svg class="w-3 h-3 text-[#A47C33] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
            <span class="text-[#3a5643] font-medium">${escapeHTML(item.location_kh)}</span>
          </p>
        ` : ''}
        ${item.desc_kh ? `
          <p class="mt-2 text-xs leading-relaxed text-[#445D48] font-battambang">${escapeHTML(item.desc_kh)}</p>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// Render Dress Code Palette Swatches
function renderDressCodeSwatches() {
  const container = document.getElementById('t20-dress-swatches');
  if (!container) return;

  const colors = [
    { name: 'Emerald Green', hex: '#1E3526' },
    { name: 'Champagne Gold', hex: '#C5A059' },
    { name: 'Warm Ivory', hex: '#FAF0D7' },
    { name: 'Sage Leaf', hex: '#3A5643' }
  ];

  container.innerHTML = colors.map(c => `
    <button type="button" onclick="copyHex('${c.hex}')" class="group flex flex-col items-center gap-2 cursor-pointer focus:outline-none" title="Click to copy ${c.hex}">
      <div class="relative">
        <span class="block h-14 w-14 rounded-full border-2 border-white shadow-[0_8px_18px_rgba(36,56,44,0.18)] ring-2 ring-[#C5A059]/55 transition-all duration-300 group-hover:scale-110 group-active:scale-95" style="background-color: ${c.hex};" aria-hidden="true"></span>
        <div class="absolute inset-0 flex items-center justify-center rounded-full bg-black/35 opacity-0 transition-opacity group-hover:opacity-100 text-white">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
        </div>
      </div>
      <span class="text-xs font-semibold text-[#1e3526]">${c.name}</span>
      <span class="rounded-full bg-white/85 border border-[#C5A059]/35 px-2 py-0.5 text-[10px] font-mono font-semibold text-[#8C6D38] shadow-xs" id="hex-label-${c.hex.replace('#','')}">${c.hex}</span>
    </button>
  `).join('');
}

window.copyHex = function(hex) {
  navigator.clipboard.writeText(hex);
  const label = document.getElementById(`hex-label-${hex.replace('#','')}`);
  if (label) {
    const orig = label.textContent;
    label.textContent = 'Copied!';
    label.classList.add('bg-emerald-100', 'text-emerald-800');
    setTimeout(() => {
      label.textContent = orig;
      label.classList.remove('bg-emerald-100', 'text-emerald-800');
    }, 2000);
  }
  showToast(`Color ${hex} copied!`);
};

// Render Location Section
function renderLocationSection() {
  const w = weddingData?.wedding || {};
  const venueTitle = document.getElementById('t20-venue-title');
  if (venueTitle) venueTitle.textContent = w.venue_name_kh || 'មជ្ឈមណ្ឌលសន្និបាត និងពិព័រណ៍ ព្រីមៀរ សែនសុខ (អគារ A)';

  const venueAddress = document.getElementById('t20-venue-address');
  if (venueAddress) venueAddress.textContent = w.venue_address_kh || 'ផ្លូវ ១០០៣ សង្កាត់ភ្នំពេញថ្មី ខណ្ឌសែនសុខ រាជធានីភ្នំពេញ';

  const mapIframe = document.getElementById('t20-map-iframe');
  if (mapIframe && w.map_embed) {
    mapIframe.src = w.map_embed;
  }

  const mapLink = document.getElementById('t20-map-link');
  if (mapLink && w.map_url) {
    mapLink.href = w.map_url;
  }
}

// Render Gallery Grid
function renderGalleryGrid() {
  const container = document.getElementById('t20-gallery-grid');
  if (!container || !weddingData?.gallery) return;

  container.innerHTML = weddingData.gallery.map(img => `
    <div onclick="openLightbox('${img.url}', '${escapeHTML(img.caption_kh || '')}')" class="relative overflow-hidden rounded-2xl shadow-sm border border-[#C5A059]/25 group cursor-pointer aspect-4/5 transition transform hover:-translate-y-1 hover:shadow-lg">
      <img src="${img.url}" alt="${escapeHTML(img.caption_kh || '')}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy">
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
        <span class="text-white text-xs font-semibold font-battambang">${escapeHTML(img.caption_kh || '')}</span>
      </div>
    </div>
  `).join('');
}

window.openLightbox = function(url, caption) {
  const modal = document.getElementById('lightbox-modal');
  const img = document.getElementById('lightbox-img');
  const cap = document.getElementById('lightbox-caption');
  if (!modal || !img) return;

  img.src = url;
  if (cap) cap.textContent = caption || '';
  modal.classList.add('active');
};

window.closeLightbox = function() {
  const modal = document.getElementById('lightbox-modal');
  if (modal) modal.classList.remove('active');
};

// Render Digital Gift
function renderDigitalGift() {
  const dg = weddingData?.digital_gift;
  if (!dg) return;

  // Groom Account
  const groomBank = document.getElementById('t20-dg-groom-bank');
  if (groomBank) groomBank.textContent = dg.groom_account?.bank_name || 'ABA Bank (KHQR)';
  const groomName = document.getElementById('t20-dg-groom-name');
  if (groomName) groomName.textContent = dg.groom_account?.account_name || 'CHAN NARAK';
  const groomAcc = document.getElementById('t20-dg-groom-acc');
  if (groomAcc) groomAcc.textContent = dg.groom_account?.account_number || '001 888 999';
  const groomQr = document.getElementById('t20-dg-groom-qr');
  if (groomQr && dg.groom_account?.qr_image) groomQr.src = dg.groom_account.qr_image;

  // Bride Account
  const brideBank = document.getElementById('t20-dg-bride-bank');
  if (brideBank) brideBank.textContent = dg.bride_account?.bank_name || 'ACLEDA Bank (KHQR)';
  const brideName = document.getElementById('t20-dg-bride-name');
  if (brideName) brideName.textContent = dg.bride_account?.account_name || 'NEAT SREYNICH';
  const brideAcc = document.getElementById('t20-dg-bride-acc');
  if (brideAcc) brideAcc.textContent = dg.bride_account?.account_number || '012 345 678';
  const brideQr = document.getElementById('t20-dg-bride-qr');
  if (brideQr && dg.bride_account?.qr_image) brideQr.src = dg.bride_account.qr_image;
}

window.copyAccount = function(type) {
  const dg = weddingData?.digital_gift;
  const acc = type === 'groom' ? dg?.groom_account?.account_number : dg?.bride_account?.account_number;
  if (acc) {
    navigator.clipboard.writeText(acc);
    showToast('បានចម្លងលេខគណនីជោគជ័យ!');
  }
};

// Render RSVP Form
function renderRSVPForm() {
  const isKh = currentLang === 'kh';
  const nameInput = document.getElementById('t20-rsvp-name');
  const phoneInput = document.getElementById('t20-rsvp-phone');
  const statusInput = document.getElementById('t20-rsvp-status');
  const attendeesInput = document.getElementById('t20-rsvp-attendees');

  if (currentGuest) {
    const guestDisplayName = isKh ? (currentGuest.name || currentGuest.name_en) : (currentGuest.name_en || currentGuest.name);
    if (nameInput) {
      nameInput.value = guestDisplayName;
      nameInput.readOnly = true;
      nameInput.classList.add('bg-emerald-50/50', 'cursor-default', 'font-semibold', 'text-[#1e3526]');
    }
    if (phoneInput && currentGuest.phone) phoneInput.value = currentGuest.phone;
    if (statusInput && currentGuest.status && currentGuest.status !== 'pending') {
      statusInput.value = currentGuest.status;
    }
    if (attendeesInput) {
      const allowed = parseInt(currentGuest.pax_allowed, 10) || 1;
      const targetVal = currentGuest.attendees || allowed;
      attendeesInput.innerHTML = '';
      for (let i = 1; i <= Math.max(4, allowed); i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${toKhmerNumber(i)} នាក់ (${i} person${i > 1 ? 's' : ''})`;
        if (i === targetVal) opt.selected = true;
        attendeesInput.appendChild(opt);
      }
      const optZero = document.createElement('option');
      optZero.value = 0;
      optZero.textContent = '០ នាក់ (មិនអាចចូលរួមបាន)';
      if (targetVal === 0 || currentGuest.status === 'declined') optZero.selected = true;
      attendeesInput.appendChild(optZero);
    }
  }

  // Hook submit
  const rsvpForm = document.getElementById('t20-rsvp-form');
  if (rsvpForm) {
    rsvpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        guestId: currentGuest?.id || null,
        slug: currentGuest?.slug || null,
        name: nameInput?.value.trim() || '',
        phone: phoneInput?.value.trim() || '',
        status: statusInput?.value || 'confirmed',
        attendees: attendeesInput?.value || 1,
        side: currentGuest?.side || 'groom',
        wishes: document.getElementById('t20-rsvp-wishes')?.value.trim() || ''
      };

      try {
        const res = await fetch('/api/rsvp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
          showToast('សូមអរគុណ! ការឆ្លើយតបរបស់អ្នកត្រូវបានកត់ត្រា។');
          const wishInput = document.getElementById('t20-rsvp-wishes');
          if (wishInput) wishInput.value = '';
          loadWishes();
        } else {
          showToast(data.error || 'Submission error');
        }
      } catch (err) {
        showToast('Failed to submit RSVP');
      }
    });
  }

  loadWishes();
}

// Load and render public wishes wall
async function loadWishes() {
  const container = document.getElementById('t20-wishes-wall');
  if (!container) return;

  try {
    const res = await fetch('/api/wishes');
    if (!res.ok) return;
    const wishes = await res.json();

    if (!Array.isArray(wishes) || wishes.length === 0) {
      container.innerHTML = `
        <div class="text-center py-6 text-xs text-[#556B5C] font-battambang">
          មិនទាន់មានពាក្យជូនពរនៅឡើយទេ។ សូមក្លាយជាអ្នកជូនពរដំបូងគេ!
        </div>
      `;
      return;
    }

    container.innerHTML = wishes.map(w => `
      <div class="rounded-xl border border-[#C5A059]/25 bg-white/80 p-3 shadow-xs text-left">
        <div class="flex items-center justify-between gap-2">
          <span class="font-bold text-xs text-[#1e3526] font-battambang">${escapeHTML(w.guestName || w.name || 'ភ្ញៀវកិត្តិយស')}</span>
          <span class="text-[10px] text-[#8C6D38] font-mono">${w.createdAt ? new Date(w.createdAt).toLocaleDateString('km-KH') : ''}</span>
        </div>
        <p class="mt-1 text-xs text-[#3a5643] leading-relaxed font-battambang">${escapeHTML(w.message || w.wishes || '')}</p>
      </div>
    `).join('');
  } catch (err) {
    console.warn('Could not load wishes:', err);
  }
}

// 6. Bottom Navigation Dock ScrollSpy
function initBottomNavScrollSpy() {
  const navItems = document.querySelectorAll('.nav-dock-item');
  const sections = ['home', 'program', 'dress-code', 'location', 'gallery', 'thanks', 'gift', 'rsvp'];

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetId = item.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  const observer = new IntersectionObserver((entries) => {
    const visibleEntries = entries.filter(e => e.isIntersecting);
    if (visibleEntries.length) {
      const topEntry = visibleEntries.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const activeId = topEntry.target.id;
      navItems.forEach(btn => {
        if (btn.getAttribute('data-target') === activeId) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
  }, {
    threshold: [0.15, 0.35, 0.6],
    rootMargin: '-15% 0px -25% 0px'
  });

  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

// DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([
    fetchWeddingData(),
    checkGuestParameter()
  ]);
  renderAll();
  initBottomNavScrollSpy();
});
