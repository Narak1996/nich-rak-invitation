/**
 * THEAP KHMER TEMPLATE 11 (ROYAL PALACE) - DEDICATED CLIENT CONTROLLER
 */

let weddingData = null;
let currentGuest = null;
let audioPlayer = new Audio();
let isAudioPlaying = false;

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

async function fetchWeddingData() {
  try {
    const res = await fetch('/api/wedding');
    weddingData = await res.json();
    initAudio();
  } catch (err) {
    console.error('Failed to load wedding data:', err);
  }
}

async function checkGuestParameter() {
  const urlParams = new URLSearchParams(window.location.search);
  let guestSlug = urlParams.get('to') || urlParams.get('guest');

  if (!guestSlug) {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      guestSlug = decodeURIComponent(pathParts.slice(1).join('/'));
    }
  }

  if (guestSlug && !guestSlug.startsWith('opening-') && !guestSlug.startsWith('invitation')) {
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
        currentGuest = { name: cleanWithSpaces, name_en: cleanWithSpaces, side: 'groom', pax_allowed: 2 };
      }
    } catch (e) {
      currentGuest = { name: cleanWithSpaces, name_en: cleanWithSpaces, side: 'groom', pax_allowed: 2 };
    }
  }
}

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
  } else {
    iconPlay?.classList.remove('hidden');
    iconPause?.classList.add('hidden');
  }
}

window.toggleMusic = function() {
  if (isAudioPlaying) {
    audioPlayer.pause();
  } else {
    audioPlayer.play().catch(e => console.log('Audio playback prevented:', e));
  }
};

window.openEnvelope = function() {
  const screen = document.getElementById('t11-opening-screen');
  if (!screen) return;
  screen.classList.add('opacity-0', 'pointer-events-none');
  if (!isAudioPlaying) {
    audioPlayer.play().catch(e => console.log('Autoplay blocked:', e));
  }
  setTimeout(() => {
    screen.style.display = 'none';
    const dock = document.getElementById('t11-bottom-dock');
    if (dock) dock.classList.remove('opacity-0', 'translate-y-10');
  }, 700);
};

function renderAll() {
  if (!weddingData) return;
  const w = weddingData.wedding || {};

  const guestName = currentGuest?.name || currentGuest?.name_en || 'ភ្ញៀវកិត្តិយស';
  const opGuestName = document.getElementById('t11-opening-guest-name');
  if (opGuestName) opGuestName.textContent = guestName;

  const groomNameEl = document.getElementById('t11-groom-name');
  if (groomNameEl) groomNameEl.textContent = w.groom?.name_kh || 'ឡេង ចាន់ណារៈ';
  const brideNameEl = document.getElementById('t11-bride-name');
  if (brideNameEl) brideNameEl.textContent = w.bride?.name_kh || 'នាត ស្រីនិច';

  const gf = document.getElementById('t11-groom-father');
  if (gf) gf.textContent = w.groom?.father_kh || 'លោក សឿន សុខុម';
  const gm = document.getElementById('t11-groom-mother');
  if (gm) gm.textContent = w.groom?.mother_kh || 'អ្នកស្រី ម៉ៅ សុផល';
  const bf = document.getElementById('t11-bride-father');
  if (bf) bf.textContent = w.bride?.father_kh || 'លោក សៀម វិបុល';
  const bm = document.getElementById('t11-bride-mother');
  if (bm) bm.textContent = w.bride?.mother_kh || 'អ្នកស្រី ចាន់ ធីតា';

  const invQuote = document.getElementById('t11-invitation-body');
  if (invQuote) invQuote.textContent = w.quote_kh || 'មានកិត្តិយសសូមគោរពអញ្ជើញ ឯកឧត្តម លោកជំទាវ លោក លោកស្រី អ្នកនាង កញ្ញា និងប្រិយមិត្ត អញ្ជើញចូលរួមជាអធិបតី និងជាភ្ញៀវកិត្តិយស ដើម្បីប្រសិទ្ធពរជ័យសិរីសួស្តី ក្នុងពិធីរៀបអាពាហ៍ពិពាហ៍ កូនប្រុស-កូនស្រី របស់យើងខ្ញុំ។';

  const dateEl = document.getElementById('t11-date-text');
  if (dateEl) dateEl.textContent = w.date_solar_kh || w.event_date || 'ថ្ងៃសៅរ៍ ទី២៤ ខែមករា ឆ្នាំ២០២៧';

  const venueEl = document.getElementById('t11-venue-text');
  if (venueEl) venueEl.textContent = w.venue_address_kh || w.venue_name_kh || 'មជ្ឈមណ្ឌលសន្និបាត និងពិព័រណ៍ ព្រីមៀរ សែនសុខ';

  initCountdown();
  renderTimeline();
  renderGallery();
  renderRSVP();
}

function initCountdown() {
  function update() {
    if (!weddingData?.wedding?.event_date) return;
    const diff = new Date(weddingData.wedding.event_date).getTime() - Date.now();
    if (diff <= 0) return;
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    const dEl = document.getElementById('t11-cd-days');
    const hEl = document.getElementById('t11-cd-hours');
    const mEl = document.getElementById('t11-cd-mins');
    const sEl = document.getElementById('t11-cd-secs');

    if (dEl) dEl.textContent = String(d).padStart(2, '0');
    if (hEl) hEl.textContent = String(h).padStart(2, '0');
    if (mEl) mEl.textContent = String(m).padStart(2, '0');
    if (sEl) sEl.textContent = String(s).padStart(2, '0');
  }
  update();
  setInterval(update, 1000);
}

function renderTimeline() {
  const container = document.getElementById('t11-timeline-container');
  if (!container || !weddingData?.agenda) return;

  container.innerHTML = weddingData.agenda.map(item => `
    <div class="relative flex items-start gap-4 pl-1">
      <div class="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#b87923] text-white shadow-sm ring-4 ring-white">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      </div>
      <div class="flex-1 rounded-2xl bg-white/90 p-4 border border-[#b87923]/30 shadow-xs">
        <div class="flex items-center justify-between gap-1">
          <h3 class="font-moulpali text-sm text-[#724414]">${escapeHTML(item.title_kh || item.title_en)}</h3>
          ${item.time ? `<span class="rounded-full bg-[#81501b] text-white px-2 py-0.5 text-[10px] font-semibold">${escapeHTML(item.time)}</span>` : ''}
        </div>
        ${item.location_kh ? `<p class="mt-1 text-xs text-[#81501b] font-medium">${escapeHTML(item.location_kh)}</p>` : ''}
        ${item.desc_kh ? `<p class="mt-1 text-xs text-[#532f0c] leading-relaxed font-battambang">${escapeHTML(item.desc_kh)}</p>` : ''}
      </div>
    </div>
  `).join('');
}

function renderGallery() {
  const container = document.getElementById('t11-gallery-grid');
  if (!container || !weddingData?.gallery) return;
  container.innerHTML = weddingData.gallery.map(img => `
    <div class="relative overflow-hidden rounded-2xl border border-[#b87923]/30 aspect-4/5 shadow-xs">
      <img src="${img.url}" alt="${escapeHTML(img.caption_kh || '')}" class="w-full h-full object-cover">
    </div>
  `).join('');
}

function renderRSVP() {
  const nameInput = document.getElementById('t11-rsvp-name');
  if (currentGuest && nameInput) {
    nameInput.value = currentGuest.name || currentGuest.name_en;
    nameInput.readOnly = true;
  }

  const form = document.getElementById('t11-rsvp-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: nameInput?.value.trim() || '',
        phone: document.getElementById('t11-rsvp-phone')?.value.trim() || '',
        status: document.getElementById('t11-rsvp-status')?.value || 'confirmed',
        attendees: document.getElementById('t11-rsvp-attendees')?.value || 1,
        wishes: document.getElementById('t11-rsvp-wishes')?.value.trim() || ''
      };
      try {
        const res = await fetch('/api/rsvp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showToast('សូមអរគុណ! ការឆ្លើយតបរបស់អ្នកត្រូវបានកត់ត្រា។');
        } else {
          showToast('Submission error');
        }
      } catch (err) {
        showToast('Network error');
      }
    });
  }
}

function initNavScroll() {
  document.querySelectorAll('.t11-dock-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.getAttribute('data-target'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([fetchWeddingData(), checkGuestParameter()]);
  renderAll();
  initNavScroll();
});
