// State management
let currentLang = 'kh';
let weddingData = null;
let currentGuest = null;
let isAudioPlaying = false;
const audioPlayer = new Audio();

// YouTube Background Music Player State
let ytMusicPlayer = null;
let isYtMusicActive = false;
let pendingYtPlay = false;

// Extract YouTube Video ID from any YouTube URL format (youtu.be, watch?v=, embed, shorts)
function extractYouTubeId(url) {
  if (!url) return null;
  const match = String(url).trim().match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

// Convert any YouTube link into a clean Embed URL
function formatYouTubeEmbedUrl(url) {
  if (!url) return '';
  const videoId = extractYouTubeId(url);
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0&modestbranding=1`;
  }
  return String(url).trim();
}

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

// Initialize Background Music (Supports standard MP3 audio file OR YouTube video link)
function initMusic(musicUrl) {
  if (!musicUrl) musicUrl = '/audio/wedding-music.mp3';
  const ytId = extractYouTubeId(musicUrl);

  if (ytId) {
    isYtMusicActive = true;
    try { audioPlayer.pause(); } catch (e) {}

    const setupYT = () => {
      if (ytMusicPlayer && ytMusicPlayer.loadVideoById) {
        try { ytMusicPlayer.cueVideoById(ytId); } catch (e) {}
        return;
      }
      if (window.YT && window.YT.Player) {
        try {
          ytMusicPlayer = new YT.Player('yt-bg-audio-container', {
            height: '1',
            width: '1',
            videoId: ytId,
            playerVars: {
              autoplay: 0,
              loop: 1,
              playlist: ytId,
              controls: 0,
              disablekb: 1,
              fs: 0,
              rel: 0
            },
            events: {
              onReady: (e) => {
                if (pendingYtPlay) {
                  try { e.target.playVideo(); } catch (err) {}
                  isAudioPlaying = true;
                  updateMusicBtn();
                }
              },
              onStateChange: (e) => {
                if (window.YT && e.data === YT.PlayerState.PLAYING) {
                  isAudioPlaying = true;
                  updateMusicBtn();
                } else if (window.YT && (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED)) {
                  isAudioPlaying = false;
                  updateMusicBtn();
                }
              }
            }
          });
        } catch (err) {
          console.error('Error creating YouTube audio player:', err);
        }
      }
    };

    if (window.YT && window.YT.Player) {
      setupYT();
    } else {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function() {
        if (typeof prevCallback === 'function') prevCallback();
        setupYT();
      };
      if (!document.getElementById('yt-iframe-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScript = document.getElementsByTagName('script')[0];
        if (firstScript && firstScript.parentNode) {
          firstScript.parentNode.insertBefore(tag, firstScript);
        } else {
          document.head.appendChild(tag);
        }
      }
    }
  } else {
    isYtMusicActive = false;
    audioPlayer.src = musicUrl;
    audioPlayer.loop = true;
    audioPlayer.preload = 'auto';
  }
}

// Convert Arabic digits (0-9) to authentic Khmer numerals (០-៩)
function toKhmerNumber(val) {
  if (val === null || val === undefined) return '';
  const khmerDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(val).replace(/[0-9]/g, digit => khmerDigits[parseInt(digit, 10)]);
}

// Hide luxury preloader smoothly
function hidePreloader() {
  const preloader = document.getElementById('app-preloader');
  if (preloader && !preloader.classList.contains('loaded')) {
    preloader.classList.add('loaded');
    setTimeout(() => {
      try { preloader.remove(); } catch (e) {}
    }, 750);
  }
}

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Safety timeout so preloader never hangs indefinitely
  const preloaderTimer = setTimeout(() => {
    hidePreloader();
  }, 3500);

  try {
    await Promise.all([
      fetchWeddingData(),
      checkGuestParameter()
    ]);
  } catch (err) {
    console.error('Initialization fetch error:', err);
  } finally {
    clearTimeout(preloaderTimer);
    initPetals();
    initCountdown();
    initEventListeners();
    renderAll();
    initBottomNavScrollSpy();
    initScrollReveal();
    hidePreloader();
  }
});

// Fetch wedding data from API
async function fetchWeddingData() {
  try {
    const res = await fetch('/api/wedding?_t=' + Date.now(), { cache: 'no-store' });
    weddingData = await res.json();
    if (weddingData?.wedding) {
      const preloaderCouple = document.getElementById('preloader-couple');
      if (preloaderCouple) {
        const groomKh = weddingData.wedding.groom?.name_kh || 'ឡេង ចាន់ណារៈ';
        const brideKh = weddingData.wedding.bride?.name_kh || 'នាត ស្រីនិច';
        preloaderCouple.textContent = `${groomKh} & ${brideKh}`;
      }
    }
    const musicUrl = (weddingData.wedding && weddingData.wedding.music_url) || '/audio/wedding-music.mp3';
    initMusic(musicUrl);
  } catch (err) {
    console.error('Failed to load wedding data:', err);
  }
}

// Check guest parameter from URL (friendly routes: /to/:name, /invite/:name, /invitation/:slug, ?to=...)
async function checkGuestParameter() {
  const urlParams = new URLSearchParams(window.location.search);
  let guestSlug = urlParams.get('to') || urlParams.get('guest');

  // Check explicit ?theme= URL parameter (supports template20, template11, template3, etc.)
  const requestedTheme = urlParams.get('theme');
  if (requestedTheme && THEME_DATA_MAP[requestedTheme] && weddingData) {
    weddingData.theme = { ...THEME_DATA_MAP[requestedTheme] };
  }

  // Check friendly pathnames: /to/:guest, /invite/:guest, /invitation/:slug
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts.length >= 2) {
    const prefix = pathParts[0].toLowerCase();
    if (prefix === 'to' || prefix === 'invite' || prefix === 'invitation') {
      guestSlug = decodeURIComponent(pathParts.slice(1).join('/'));
    }
  }

  if (guestSlug) {
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
        // Fallback: use decoded name
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

// Render dynamic content
function renderAll() {
  if (!weddingData) return;
  const w = weddingData.wedding;

  // Set Theme Class on Body
  const themeId = (weddingData.theme && weddingData.theme.id) || 'khmer-traditional';
  document.body.className = `wedding-bg-pattern min-h-screen relative text-[#2C2420] theme-${themeId} ${currentLang === 'en' ? 'lang-en' : 'lang-kh'}`;

  if (weddingData.theme) {
    document.documentElement.style.setProperty('--primary', weddingData.theme.primaryColor || '#1E4833');
    document.documentElement.style.setProperty('--accent', weddingData.theme.accentColor || '#C5A059');
  }

  // Update top bar theme switcher display
  const themeIconEl = document.getElementById('active-theme-icon');
  if (themeIconEl) {
    if (themeId === 'western-modern') {
      themeIconEl.textContent = '💍';
    } else if (themeId === 'chinese-traditional') {
      themeIconEl.textContent = '囍';
    } else {
      themeIconEl.innerHTML = '<img src="/images/components/romduol-flower.svg" class="w-3.5 h-3.5 object-contain" alt="Romduol">';
    }
  }
  const themeLabelEl = document.getElementById('active-theme-label');
  if (themeLabelEl) {
    const labelMap = { 
      'khmer-traditional': 'ខ្មែរ', 
      'western-modern': 'សម័យថ្មី', 
      'chinese-traditional': 'ចិន' 
    };
    themeLabelEl.textContent = labelMap[themeId] || 'ខ្មែរ';
  }

  // Language based text rendering
  const isKh = currentLang === 'kh';

  // ------------------ RENDER THEME WELCOME CARDS ------------------
  renderThemeWelcome(themeId, w, isKh);

  // Main Page Header Titles - Theme Tailored
  const mainTitleEl = document.getElementById('main-wedding-title');
  if (mainTitleEl) {
    if (themeId === 'chinese-traditional') {
      mainTitleEl.innerHTML = isKh
        ? `<span class="kh-title-line">សិរីសួស្តី អាពាហ៍ពិពាហ៍</span><span class="cn-title-line">囍 喜结良缘 囍</span>`
        : `<span class="kh-title-line">WEDDING CELEBRATION</span><span class="cn-title-line">囍 DOUBLE HAPPINESS 囍</span>`;
    } else if (themeId === 'western-modern') {
      mainTitleEl.textContent = isKh ? (w.title_kh || 'សិរីសួស្តី អាពាហ៍ពិពាហ៍') : (w.title_en || 'THE WEDDING CELEBRATION');
    } else {
      mainTitleEl.textContent = isKh ? (w.title_kh || 'សិរីសួស្តី អាពាហ៍ពិពាហ៍ប្រពៃណីខ្មែរ') : (w.title_en || 'Traditional Khmer Wedding');
    }
  }
  
  const mainCoupleKhEl = document.getElementById('main-couple-kh');
  if (mainCoupleKhEl) {
    let mainConnector = `<span class="inline-block mx-2 text-[#D4AF37] font-normal text-sm font-khmer-body">និង</span>`;
    if (themeId === 'chinese-traditional') {
      mainConnector = `<span class="inline-block mx-2 text-[#FFD700] font-bold text-base">囍</span>`;
    } else if (themeId === 'western-modern') {
      mainConnector = `<span class="inline-block mx-2 text-[#C5A059] font-serif italic text-lg">&</span>`;
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

  // Couple English Name - Completely removed / hidden in Khmer & Chinese themes
  const mainCoupleEnEl = document.getElementById('main-couple-en');
  if (mainCoupleEnEl) {
    if (themeId === 'khmer-traditional' || themeId === 'chinese-traditional') {
      mainCoupleEnEl.style.display = 'none';
      mainCoupleEnEl.textContent = '';
    } else if (themeId === 'western-modern') {
      mainCoupleEnEl.style.display = '';
      mainCoupleEnEl.textContent = `${w.groom.name_en.toUpperCase()} & ${w.bride.name_en.toUpperCase()}`;
    } else {
      mainCoupleEnEl.style.display = '';
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

  const useKhmerNames = themeId === 'khmer-traditional' || themeId === 'chinese-traditional' || isKh;
  document.getElementById('groom-father').textContent = useKhmerNames ? w.groom.father_kh : w.groom.father_en;
  document.getElementById('groom-mother').textContent = useKhmerNames ? w.groom.mother_kh : w.groom.mother_en;
  document.getElementById('groom-name-card').textContent = useKhmerNames ? w.groom.name_kh : w.groom.name_en;

  document.getElementById('bride-father').textContent = useKhmerNames ? w.bride.father_kh : w.bride.father_en;
  document.getElementById('bride-mother').textContent = useKhmerNames ? w.bride.mother_kh : w.bride.mother_en;
  document.getElementById('bride-name-card').textContent = useKhmerNames ? w.bride.name_kh : w.bride.name_en;

  // Photos
  if (w.couple_photo) document.getElementById('main-couple-img').src = w.couple_photo;
  if (w.groom.photo) document.getElementById('groom-img').src = w.groom.photo;
  if (w.bride.photo) document.getElementById('bride-img').src = w.bride.photo;

  // Date and Venue with Khmer Numerals
  document.getElementById('event-date-solar').textContent = isKh ? toKhmerNumber(w.date_solar_kh) : w.date_solar_en;
  document.getElementById('event-date-lunar').textContent = isKh ? toKhmerNumber(w.date_lunar_kh) : w.date_lunar_en;
  document.getElementById('venue-name').textContent = isKh ? toKhmerNumber(w.venue_name_kh) : w.venue_name_en;
  document.getElementById('venue-address').textContent = isKh ? toKhmerNumber(w.venue_address_kh) : w.venue_address_en;
  document.getElementById('btn-google-maps').href = w.map_url;
  document.getElementById('map-iframe').src = w.map_embed;

  // Video embed
  if (w.video_embed) {
    const isShorts = String(w.video_embed).includes('/shorts/');
    const wrapper = document.getElementById('video-player-wrapper');
    const label = document.getElementById('video-aspect-label');
    if (isShorts) {
      currentVideoAspect = 'portrait';
      if (wrapper) wrapper.className = 'w-full max-w-sm mx-auto rounded-2xl overflow-hidden shadow-2xl bg-black flex items-center justify-center relative min-h-[460px] sm:min-h-[520px] h-[480px] sm:h-[540px] transition-all duration-300';
      if (label) label.textContent = '🎬 ទំហំកុន (Wide)';
    } else {
      currentVideoAspect = 'cinema';
      if (wrapper) wrapper.className = 'w-full rounded-2xl overflow-hidden shadow-xl bg-black flex items-center justify-center relative min-h-[280px] sm:min-h-[380px] md:min-h-[440px] h-[300px] sm:h-[400px] md:h-[460px] transition-all duration-300';
      if (label) label.textContent = '📱 ទំហំវែង (Tall)';
    }
    document.getElementById('video-container').classList.remove('hidden');
    document.getElementById('wedding-video-iframe').src = formatYouTubeEmbedUrl(w.video_embed);
  } else {
    document.getElementById('video-container').classList.add('hidden');
  }

  // Render Agenda / Schedule
  renderAgenda();

  // Render Gallery
  renderGallery();

  // Digital Gift info
  renderDigitalGift();

  // RSVP Form & Frontend Guest Prepopulation
  if (currentGuest) {
    const guestDisplayName = isKh ? (currentGuest.name || currentGuest.name_en) : (currentGuest.name_en || currentGuest.name);
    
    // 1. RSVP Guest Name (Readonly for invited guest)
    const rsvpNameEl = document.getElementById('rsvp-name');
    if (rsvpNameEl) {
      rsvpNameEl.value = guestDisplayName || '';
      rsvpNameEl.readOnly = true;
      rsvpNameEl.classList.add('cursor-default', 'bg-amber-50/40', 'font-semibold', 'text-[#4E3227]');
    }

    // 2. RSVP Phone
    const rsvpPhoneEl = document.getElementById('rsvp-phone');
    if (rsvpPhoneEl && currentGuest.phone) {
      rsvpPhoneEl.value = currentGuest.phone;
    }

    // 3. RSVP Attendance Status
    const rsvpStatusEl = document.getElementById('rsvp-status');
    if (rsvpStatusEl) {
      if (currentGuest.status && currentGuest.status !== 'pending') {
        rsvpStatusEl.value = currentGuest.status;
      } else {
        // Default to confirmed for quick one-click submission
        rsvpStatusEl.value = 'confirmed';
      }
    }

    // 4. RSVP Attendees count and dropdown options
    const rsvpAttendeesEl = document.getElementById('rsvp-attendees');
    if (rsvpAttendeesEl) {
      const allowed = parseInt(currentGuest.pax_allowed, 10) || 1;
      const targetVal = (currentGuest.attendees && currentGuest.attendees > 0) ? currentGuest.attendees : allowed;
      
      const maxOpt = Math.max(4, allowed);
      rsvpAttendeesEl.innerHTML = '';
      for (let i = 1; i <= maxOpt; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = isKh ? `${toKhmerNumber(i)} នាក់ (${i} person${i > 1 ? 's' : ''})` : `${i} person${i > 1 ? 's' : ''}`;
        if (i === targetVal) opt.selected = true;
        rsvpAttendeesEl.appendChild(opt);
      }
      const optZero = document.createElement('option');
      optZero.value = 0;
      optZero.textContent = isKh ? '០ នាក់ (មិនអាចចូលរួមបាន)' : '0 (Unable to attend)';
      if (targetVal === 0 || currentGuest.status === 'declined') optZero.selected = true;
      rsvpAttendeesEl.appendChild(optZero);
    }

    // 5. RSVP Pax Hint
    const rsvpPaxHintEl = document.getElementById('rsvp-pax-hint');
    if (rsvpPaxHintEl && currentGuest.pax_allowed) {
      rsvpPaxHintEl.textContent = isKh 
        ? `(ចំនួនភ្ញៀវអញ្ជើញចូលរួម: ${toKhmerNumber(currentGuest.pax_allowed)} នាក់)`
        : `(Reserved for: ${currentGuest.pax_allowed} pax)`;
    }

    // 6. RSVP Wishes
    const rsvpWishesEl = document.getElementById('rsvp-wishes');
    if (rsvpWishesEl && currentGuest.wishes) {
      rsvpWishesEl.value = currentGuest.wishes;
    }

    // 7. Wishes Guestbook Form Auto-fill (Readonly)
    const wishSenderName = document.getElementById('wish-sender-name');
    if (wishSenderName) {
      wishSenderName.value = guestDisplayName || '';
      wishSenderName.readOnly = true;
      wishSenderName.classList.add('cursor-default', 'bg-amber-50/40', 'font-semibold', 'text-[#4E3227]');
    }

    // 8. Main Invitation Presentation Greeting Banner
    const mainGuestBanner = document.getElementById('main-guest-invitation-banner');
    const mainGuestName = document.getElementById('main-guest-invitation-name');
    if (mainGuestBanner && mainGuestName) {
      mainGuestName.textContent = guestDisplayName || '';
      mainGuestBanner.classList.remove('hidden');
    }
  } else {
    // If no guest slug in URL, allow typing manually
    const rsvpNameEl = document.getElementById('rsvp-name');
    if (rsvpNameEl) {
      rsvpNameEl.readOnly = false;
      rsvpNameEl.classList.remove('cursor-default', 'bg-amber-50/40');
    }
    const wishSenderName = document.getElementById('wish-sender-name');
    if (wishSenderName) {
      wishSenderName.readOnly = false;
      wishSenderName.classList.remove('cursor-default', 'bg-amber-50/40');
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
    el.className = 'relative flex items-start gap-3.5 mb-6 group';
    el.innerHTML = `
      <div class="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-white/80 backdrop-blur-md border-2 border-[#1E4833] shadow-md shrink-0 ring-4 ring-[#1E4833]/15">
        ${iconHtml}
      </div>
      <div class="bg-white/70 backdrop-blur-xl p-5 rounded-3xl border border-white/85 shadow-sm ring-1 ring-[#4E7D63]/15 flex-1 transition-all duration-300 hover:shadow-lg hover:bg-white/80">
        <div class="inline-flex items-center gap-1.5 px-3 py-0.5 bg-gradient-to-r from-[#1E4833] to-[#2D5A43] text-amber-200 text-xs font-bold rounded-full mb-2 shadow-2xs">
          <span>🕒</span>
          <span>${isKh ? toKhmerNumber(item.time) : item.time}</span>
        </div>
        <h4 class="text-base font-bold text-[#1E4833] mb-1 font-khmer-title">
          ${isKh ? item.title_kh : item.title_en}
        </h4>
        <p class="text-xs sm:text-sm text-[#5D4E46] font-khmer-body leading-relaxed">
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

  if (!weddingData.gallery || !weddingData.gallery.length) return;

  weddingData.gallery.forEach((img, index) => {
    const directUrl = resolveGoogleDriveUrl(img.url);
    const tiltClass = index % 2 === 0 ? 'hover:rotate-1' : 'hover:-rotate-1';
    const el = document.createElement('div');
    el.className = `relative overflow-hidden rounded-3xl p-1.5 bg-white/70 backdrop-blur-xl shadow-md border border-white/85 ring-1 ring-[#4E7D63]/15 group cursor-pointer aspect-4/5 transition-all duration-300 hover:shadow-2xl hover:scale-[1.03] ${tiltClass}`;
    el.innerHTML = `
      <div class="w-full h-full rounded-2xl overflow-hidden relative">
        <img src="${directUrl}" alt="${img.caption_en || 'Wedding'}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-108" loading="lazy">
        <div class="absolute inset-0 bg-gradient-to-t from-[#1E4833]/90 via-[#1E4833]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
          <span class="text-white text-xs sm:text-sm font-medium font-khmer-body leading-snug drop-shadow-md">
            ${isKh ? (img.caption_kh || '') : (img.caption_en || '')}
          </span>
        </div>
        <div class="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-white/75 backdrop-blur-md text-[10px] text-[#1E4833] font-bold opacity-0 group-hover:opacity-100 transition font-mono border border-white/80 shadow-xs">
          🔍 #${index + 1}
        </div>
      </div>
    `;
    el.addEventListener('click', () => {
      openLightboxByIndex(index);
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
  document.getElementById('groom-acc-num').textContent = isKh ? toKhmerNumber(dg.groom_account.account_number) : dg.groom_account.account_number;
  document.getElementById('groom-qr-img').src = dg.groom_account.qr_image;

  // Bride account
  document.getElementById('bride-bank-name').textContent = dg.bride_account.bank_name;
  document.getElementById('bride-acc-name').textContent = dg.bride_account.account_name;
  document.getElementById('bride-acc-num').textContent = isKh ? toKhmerNumber(dg.bride_account.account_number) : dg.bride_account.account_number;
  document.getElementById('bride-qr-img').src = dg.bride_account.qr_image;
}

// Lightbox with Next & Previous Photo Navigation
let currentLightboxIndex = -1;
let currentLightboxList = [];

function openLightboxByIndex(index) {
  if (!weddingData.gallery || !weddingData.gallery.length) return;
  currentLightboxList = weddingData.gallery;
  currentLightboxIndex = (index + currentLightboxList.length) % currentLightboxList.length;
  updateLightboxDisplay();
  const modal = document.getElementById('lightbox-modal');
  if (modal) modal.classList.add('active');
}

function openLightbox(url, caption) {
  if (weddingData.gallery && weddingData.gallery.length) {
    const foundIdx = weddingData.gallery.findIndex(g => g.url === url);
    if (foundIdx !== -1) {
      openLightboxByIndex(foundIdx);
      return;
    }
  }
  // Single image fallback
  currentLightboxList = [{ url, caption_kh: caption, caption_en: caption }];
  currentLightboxIndex = 0;
  updateLightboxDisplay();
  const modal = document.getElementById('lightbox-modal');
  if (modal) modal.classList.add('active');
}

function updateLightboxDisplay() {
  if (!currentLightboxList || currentLightboxList.length === 0 || currentLightboxIndex < 0) return;
  const item = currentLightboxList[currentLightboxIndex];
  const isKh = currentLang === 'kh';
  const caption = isKh ? (item.caption_kh || item.caption_en || '') : (item.caption_en || item.caption_kh || '');

  const img = document.getElementById('lightbox-img');
  const cap = document.getElementById('lightbox-caption');
  const counter = document.getElementById('lightbox-counter');
  const prevBtn = document.getElementById('lightbox-prev');
  const nextBtn = document.getElementById('lightbox-next');

  if (img) {
    img.style.opacity = '0.4';
    img.src = resolveGoogleDriveUrl(item.url);
    img.alt = caption || 'Photo';
    img.onload = () => { img.style.opacity = '1'; };
  }
  if (cap) {
    cap.textContent = caption;
    cap.style.display = caption ? 'block' : 'none';
  }
  if (counter) {
    if (currentLightboxList.length > 1) {
      counter.textContent = `${currentLightboxIndex + 1} / ${currentLightboxList.length}`;
      counter.style.display = 'inline-block';
    } else {
      counter.style.display = 'none';
    }
  }
  if (prevBtn && nextBtn) {
    if (currentLightboxList.length <= 1) {
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
    } else {
      prevBtn.style.display = 'flex';
      nextBtn.style.display = 'flex';
    }
  }
}

function nextLightboxImage(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  if (!currentLightboxList || currentLightboxList.length <= 1) return;
  currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxList.length;
  updateLightboxDisplay();
}

function prevLightboxImage(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  if (!currentLightboxList || currentLightboxList.length <= 1) return;
  currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxList.length) % currentLightboxList.length;
  updateLightboxDisplay();
}

function closeLightbox() {
  const modal = document.getElementById('lightbox-modal');
  if (modal) modal.classList.remove('active');
}

// Expose globally for inline DOM event listeners
window.openLightboxByIndex = openLightboxByIndex;
window.openLightbox = openLightbox;
window.nextLightboxImage = nextLightboxImage;
window.prevLightboxImage = prevLightboxImage;
window.closeLightbox = closeLightbox;

// Event Listeners
function initEventListeners() {
  // Theme-specific envelope openers
  ['btn-open-envelope', 'btn-open-khmer', 'btn-open-modern', 'chinese-gate-lock'].forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', () => {
        openEnvelope();
      });
    }
  });

  // Top Bar Theme Dropdown Toggle
  const themeBtn = document.getElementById('theme-menu-btn');
  const themeDropdown = document.getElementById('theme-menu-dropdown');
  if (themeBtn && themeDropdown) {
    themeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      themeDropdown.classList.toggle('hidden');
      themeDropdown.classList.toggle('flex');
    });

    // Close when clicking anywhere outside
    document.addEventListener('click', (e) => {
      if (!themeDropdown.contains(e.target) && !themeBtn.contains(e.target)) {
        themeDropdown.classList.add('hidden');
        themeDropdown.classList.remove('flex');
      }
    });

    // Close after clicking an option
    themeDropdown.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        themeDropdown.classList.add('hidden');
        themeDropdown.classList.remove('flex');
      });
    });
  }

  // Music toggle
  const musicBtn = document.getElementById('floating-music-btn');
  if (musicBtn) {
    musicBtn.addEventListener('click', () => {
      toggleMusic();
    });
  }

  // Cute Love Counter Badge initialization
  const loveBadge = document.getElementById('love-counter-badge');
  if (loveBadge) {
    const savedLoves = parseInt(localStorage.getItem('wedding_love_count') || '1280', 10);
    loveBadge.textContent = `❤️ ${savedLoves.toLocaleString()}`;
  }

  // Lightbox close & touch swipe
  const lbClose = document.getElementById('lightbox-close');
  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  const lbModal = document.getElementById('lightbox-modal');
  if (lbModal) {
    lbModal.addEventListener('click', (e) => {
      if (e.target.id === 'lightbox-modal') closeLightbox();
    });

    // Mobile touch swipe gesture (swipe left -> next, swipe right -> prev)
    let touchStartX = 0;
    let touchStartY = 0;
    lbModal.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length === 1) {
        touchStartX = e.touches[0].screenX;
        touchStartY = e.touches[0].screenY;
      }
    }, { passive: true });

    lbModal.addEventListener('touchend', (e) => {
      if (e.changedTouches && e.changedTouches.length === 1) {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;
        // Check horizontal swipe vs vertical scroll
        if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
          if (diffX < 0) {
            nextLightboxImage(e);
          } else {
            prevLightboxImage(e);
          }
        }
      }
    }, { passive: true });
  }

  // Keyboard navigation for Lightbox (Left / Right / Escape)
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('lightbox-modal');
    if (!modal || !modal.classList.contains('active')) return;
    if (e.key === 'ArrowRight') {
      nextLightboxImage(e);
    } else if (e.key === 'ArrowLeft') {
      prevLightboxImage(e);
    } else if (e.key === 'Escape') {
      closeLightbox();
    }
  });

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
// Scroll to Ticket Content (Merged 1-Page Layout)
function scrollToTicketContent() {
  playMusic();
  const hero = document.getElementById('hero-section');
  if (hero) {
    hero.scrollIntoView({ behavior: 'smooth' });
  }
}
window.scrollToTicketContent = scrollToTicketContent;
window.openEnvelope = scrollToTicketContent;
window.toggleMusic = toggleMusic;

// Audio Control (Supports both HTML5 Audio and YouTube Audio)
function playMusic() {
  if (isYtMusicActive) {
    if (ytMusicPlayer && ytMusicPlayer.playVideo) {
      try {
        ytMusicPlayer.playVideo();
        isAudioPlaying = true;
        updateMusicBtn();
      } catch (e) {
        console.log('YT play error:', e);
      }
    } else {
      pendingYtPlay = true;
    }
  } else {
    audioPlayer.play().then(() => {
      isAudioPlaying = true;
      updateMusicBtn();
    }).catch(e => {
      console.log('Audio autoplay prevented:', e);
    });
  }
}

function toggleMusic() {
  if (isYtMusicActive && ytMusicPlayer && ytMusicPlayer.playVideo) {
    if (isAudioPlaying) {
      try { ytMusicPlayer.pauseVideo(); } catch (e) {}
      isAudioPlaying = false;
    } else {
      try { ytMusicPlayer.playVideo(); } catch (e) {}
      isAudioPlaying = true;
    }
    updateMusicBtn();
    return;
  }

  if (isAudioPlaying) {
    audioPlayer.pause();
    isAudioPlaying = false;
  } else {
    audioPlayer.play().catch(e => console.log(e));
    isAudioPlaying = true;
  }
  updateMusicBtn();
}

function updateMusicBtn() {
  const iconPlay = document.getElementById('music-icon-play');
  const iconPause = document.getElementById('music-icon-pause');
  const btn = document.getElementById('floating-music-btn');
  const vinylBtn = document.getElementById('cute-vinyl-music-btn');

  if (isAudioPlaying) {
    if (iconPlay) { iconPlay.classList.add('hidden'); iconPlay.style.display = 'none'; }
    if (iconPause) { iconPause.classList.add('hidden'); iconPause.style.display = 'none'; }
    if (btn) btn.classList.add('spin-record');
    if (vinylBtn) vinylBtn.classList.add('playing');
  } else {
    if (iconPlay) { iconPlay.classList.add('hidden'); iconPlay.style.display = 'none'; }
    if (iconPause) { iconPause.classList.add('hidden'); iconPause.style.display = 'none'; }
    if (btn) btn.classList.remove('spin-record');
    if (vinylBtn) vinylBtn.classList.remove('playing');
  }
}

// Modern Botanical Love Burst Animation Effect
window.burstHearts = function(originX, originY) {
  const natureGems = ['🌿', '💚', '✨', '🌸', '💕', '🍃', '💍'];
  const count = 16;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'floating-heart-particle';
    el.textContent = natureGems[Math.floor(Math.random() * natureGems.length)];
    
    const x = (originX || (window.innerWidth / 2)) + (Math.random() - 0.5) * 80;
    const y = (originY || (window.innerHeight / 2)) + (Math.random() - 0.5) * 40;
    
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.fontSize = `${Math.floor(Math.random() * 14 + 18)}px`;
    el.style.animationDuration = `${(Math.random() * 0.8 + 1.2).toFixed(2)}s`;
    
    document.body.appendChild(el);
    setTimeout(() => {
      try { el.remove(); } catch (e) {}
    }, 2000);
  }
};

// Interactive Send Love Reaction
window.sendLoveReaction = function(e) {
  const rect = e ? e.currentTarget.getBoundingClientRect() : null;
  const x = rect ? (rect.left + rect.width / 2) : (window.innerWidth / 2);
  const y = rect ? (rect.top + rect.height / 2) : (window.innerHeight / 2);
  
  window.burstHearts(x, y);

  // Increment local love counter
  let loveCount = parseInt(localStorage.getItem('wedding_love_count') || '1280', 10);
  loveCount += 1;
  localStorage.setItem('wedding_love_count', String(loveCount));
  
  const badge = document.getElementById('love-counter-badge');
  if (badge) {
    badge.textContent = `❤️ ${loveCount.toLocaleString()}`;
    badge.classList.add('scale-125');
    setTimeout(() => badge.classList.remove('scale-125'), 300);
  }

  showToast('🌿 អរគុណសម្រាប់ក្តីស្រឡាញ់ដ៏កក់ក្តៅ! 💕');
};

// Video Aspect Ratio Toggle (Cinema Wide vs Portrait Tall)
let currentVideoAspect = 'cinema';

window.toggleVideoAspect = function() {
  const wrapper = document.getElementById('video-player-wrapper');
  const label = document.getElementById('video-aspect-label');
  if (!wrapper) return;

  if (currentVideoAspect === 'cinema') {
    currentVideoAspect = 'portrait';
    wrapper.className = 'w-full max-w-sm mx-auto rounded-2xl overflow-hidden shadow-2xl bg-black flex items-center justify-center relative min-h-[460px] sm:min-h-[520px] h-[480px] sm:h-[540px] transition-all duration-300';
    if (label) label.textContent = '🎬 ទំហំកុន (Wide)';
  } else {
    currentVideoAspect = 'cinema';
    wrapper.className = 'w-full rounded-2xl overflow-hidden shadow-xl bg-black flex items-center justify-center relative min-h-[280px] sm:min-h-[380px] md:min-h-[440px] h-[300px] sm:h-[400px] md:h-[460px] transition-all duration-300';
    if (label) label.textContent = '📱 ទំហំវែង (Tall)';
  }
};

// Countdown Timer
function initCountdown() {
  function update() {
    if (!weddingData || !weddingData.wedding.event_date) return;
    const target = new Date(weddingData.wedding.event_date).getTime();
    const now = new Date().getTime();
    const diff = target - now;

    const isKhNumerals = currentLang === 'kh' || (weddingData?.theme?.id === 'khmer-traditional');

    if (diff <= 0) {
      const zeroStr = isKhNumerals ? '០០' : '00';
      document.getElementById('cd-days').textContent = zeroStr;
      document.getElementById('cd-hours').textContent = zeroStr;
      document.getElementById('cd-minutes').textContent = zeroStr;
      document.getElementById('cd-seconds').textContent = zeroStr;
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const dStr = String(days).padStart(2, '0');
    const hStr = String(hours).padStart(2, '0');
    const mStr = String(minutes).padStart(2, '0');
    const sStr = String(seconds).padStart(2, '0');

    document.getElementById('cd-days').textContent = isKhNumerals ? toKhmerNumber(dStr) : dStr;
    document.getElementById('cd-hours').textContent = isKhNumerals ? toKhmerNumber(hStr) : hStr;
    document.getElementById('cd-minutes').textContent = isKhNumerals ? toKhmerNumber(mStr) : mStr;
    document.getElementById('cd-seconds').textContent = isKhNumerals ? toKhmerNumber(sStr) : sStr;
  }
  update();
  setInterval(update, 1000);
}

// Unique Traditional Falling Objects (Authentic Khmer Flowers, Western Rose & Olive, Chinese Double Happiness & Peonies)
const THEME_FALLING_GENERATORS = {
  'khmer-traditional': [
    // 1. Cambodia National Flower: ផ្ការំដួល (Authentic Romduol Flower Component)
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const size = Math.floor(Math.random() * 10 + 24); // 24-34px
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.innerHTML = `<img src="/images/components/romduol-flower.svg" alt="ផ្ការំដួល" class="w-full h-full object-contain filter drop-shadow-md select-none">`;
      return el;
    },
    // 2. Khmer Sacred Golden Lotus (ផ្កាឈូកមាសអង្គរ)
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const size = Math.floor(Math.random() * 8 + 22); // 22-30px
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.innerHTML = `<img src="/images/components/lotus-ornament.svg" alt="ផ្កាឈូក" class="w-full h-full object-contain filter drop-shadow-sm select-none">`;
      return el;
    },
    // 3. Khmer Sacred Wedding Pka Sla (ផ្កាស្លាពន្លកមង្គល)
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const w = Math.floor(Math.random() * 5 + 16);
      const h = Math.floor(w * 1.6);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.innerHTML = `
        <svg viewBox="0 0 20 32" width="${w}" height="${h}" class="filter drop-shadow-xs">
          <path d="M10 2 Q11 16 10 30" stroke="#C29424" stroke-width="1.3" fill="none"/>
          <circle cx="10" cy="4" r="2.8" fill="#FFF2BF" stroke="#A67817" stroke-width="0.7"/>
          <circle cx="6" cy="10" r="2.5" fill="#FFE07A" stroke="#A67817" stroke-width="0.7"/>
          <circle cx="14" cy="10" r="2.5" fill="#FFE07A" stroke="#A67817" stroke-width="0.7"/>
          <circle cx="5" cy="17" r="2.3" fill="#DFB342" stroke="#A67817" stroke-width="0.7"/>
          <circle cx="15" cy="17" r="2.3" fill="#DFB342" stroke="#A67817" stroke-width="0.7"/>
        </svg>
      `;
      return el;
    },
    // 4. Golden Romduol Petal (ត្របកផ្ការំដួលមាស)
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const w = Math.floor(Math.random() * 6 + 16);
      const h = Math.floor(w * 1.4);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.innerHTML = `
        <svg viewBox="0 0 24 34" width="${w}" height="${h}" class="filter drop-shadow-xs">
          <defs>
            <linearGradient id="romPetalG" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FFF2BF"/>
              <stop offset="45%" stop-color="#E5BE53"/>
              <stop offset="90%" stop-color="#C29424"/>
            </linearGradient>
          </defs>
          <path d="M12 2 C3 10, 2 24, 12 32 C22 24, 21 10, 12 2 Z" fill="url(#romPetalG)" stroke="#A67817" stroke-width="0.8"/>
        </svg>
      `;
      return el;
    },
    // 5. Fragrant White Jasmine Blossom (ផ្កាម្លិះពន្លកសួស្តី)
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const size = Math.floor(Math.random() * 6 + 16);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.innerHTML = `
        <svg viewBox="0 0 24 24" width="${size}" height="${size}">
          <g filter="drop-shadow(0 1px 2px rgba(200, 170, 100, 0.3))">
            <circle cx="12" cy="5.5" r="4.2" fill="#FFFFFF" stroke="#EAE2D2" stroke-width="0.6"/>
            <circle cx="17.5" cy="10" r="4.2" fill="#FFFFF4" stroke="#EAE2D2" stroke-width="0.6"/>
            <circle cx="15.5" cy="16.5" r="4.2" fill="#FFFFFF" stroke="#EAE2D2" stroke-width="0.6"/>
            <circle cx="8.5" cy="16.5" r="4.2" fill="#FFFFF4" stroke="#EAE2D2" stroke-width="0.6"/>
            <circle cx="6.5" cy="10" r="4.2" fill="#FFFFFF" stroke="#EAE2D2" stroke-width="0.6"/>
            <circle cx="12" cy="12" r="2.5" fill="#FCE182"/>
          </g>
        </svg>
      `;
      return el;
    }
  ]
};

// Aliases for falling generators

function initPetals() {
  const container = document.body;
  const animations = ['fallSwayLeft', 'fallSwayRight', 'fallFlutter'];

  function createFallingItem() {
    if (document.hidden) return;
    const themeId = (weddingData && weddingData.theme && weddingData.theme.id) || 'khmer-traditional';
    const generatorList = THEME_FALLING_GENERATORS[themeId] || THEME_FALLING_GENERATORS['khmer-traditional'];
    const randomGen = generatorList[Math.floor(Math.random() * generatorList.length)];
    const el = randomGen();

    const animName = animations[Math.floor(Math.random() * animations.length)];
    const duration = Math.random() * 5 + 8; // 8s - 13s graceful descent
    el.style.animationName = animName;
    el.style.animationDuration = `${duration}s`;
    el.style.left = `${Math.random() * 94 + 3}vw`;
    el.style.opacity = (Math.random() * 0.3 + 0.65).toString();

    container.appendChild(el);
    setTimeout(() => el.remove(), (duration + 1) * 1000);
  }

  setInterval(createFallingItem, 900);
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
  const side = (currentGuest && currentGuest.side) ? currentGuest.side : 'groom';
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
      if (typeof confetti === 'function') {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      }
      if (typeof window.burstHearts === 'function') {
        window.burstHearts();
      }
      showToast(isKh ? '🎉 សូមអរគុណ! ការឆ្លើយតបរបស់អ្នកត្រូវបានកត់ត្រា។' : '🎉 Thank you! Your RSVP has been submitted.');
      document.getElementById('rsvp-wishes').value = '';
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
  let relationship = '';
  if (currentGuest && currentGuest.side === 'bride') {
    relationship = 'ភ្ញៀវខាងស្រី';
  } else if (currentGuest && currentGuest.side === 'groom') {
    relationship = 'ភ្ញៀវខាងប្រុស';
  } else {
    relationship = 'ភ្ញៀវកិត្តិយស (Honored Guest)';
  }
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
      if (typeof confetti === 'function') {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      }
      if (typeof window.burstHearts === 'function') {
        window.burstHearts();
      }
      showToast(isKh ? '💌 សូមអរគុណសម្រាប់ពាក្យជូនពរដ៏មានអត្ថន័យ!' : '💌 Thank you for your lovely wish!');
      document.getElementById('wish-message').value = '';
      loadWishes();
    }
  } catch (err) {
    showToast('Failed to send wish');
  }
}

// Load and Render Wishes as Cute Pastel Sticky Notes
async function loadWishes() {
  const container = document.getElementById('wishes-list');
  try {
    const res = await fetch('/api/wishes');
    const wishes = await res.json();
    container.innerHTML = '';

    if (wishes.length === 0) {
      container.innerHTML = `<p class="text-center text-sm text-[#7A6F68] py-4 font-khmer-body">សូមផ្ញើសារជូនពរដំបូងគេដល់គូស្វាមីភរិយាថ្មី! 💕</p>`;
      return;
    }

    const noteThemes = ['note-pink', 'note-mint', 'note-yellow', 'note-purple'];
    const emojiAvatars = ['🌸', '✨', '💖', '🍀', '🌼', '🎀'];

    wishes.slice(0, 12).forEach((w, idx) => {
      const themeClass = noteThemes[idx % noteThemes.length];
      const avatarEmoji = emojiAvatars[idx % emojiAvatars.length];
      const guestName = escapeHTML(w.guestName || 'ភ្ញៀវកិត្តិយស');
      const firstLetter = guestName.charAt(0) || '🌸';
      
      const el = document.createElement('div');
      el.className = `cute-wish-note ${themeClass}`;
      el.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-full bg-white/90 border border-black/10 flex items-center justify-center text-xs font-bold shadow-xs">
              ${avatarEmoji}
            </div>
            <span class="font-bold text-[#1E4833] text-xs sm:text-sm font-khmer-title">${guestName}</span>
          </div>
          <span class="text-[10px] text-[#685D56] px-2.5 py-0.5 bg-white/80 rounded-full border border-black/5 font-medium shadow-2xs">
            ${escapeHTML(w.relationship || 'ភ្ញៀវកិត្តិយស')}
          </span>
        </div>
        <p class="text-xs sm:text-sm text-[#2C2420] mt-1 pl-9 leading-relaxed font-khmer-body">${escapeHTML(w.message)}</p>
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
    name: 'ខ្មែរប្រពៃណី',
    primaryColor: '#1E4833',
    accentColor: '#C5A059',
    secondaryColor: '#2D5A43',
    bgColor: '#FAF6ED',
    emblem: 'romduol',
    sealEmblem: 'romduol'
  }
};

// Aliases for quick links and direct template references

window.switchThemeLive = async function(themeId) {
  const themeObj = THEME_DATA_MAP[themeId];
  if (!themeObj || !weddingData) return;
  weddingData.theme = { ...themeObj };

  // Set Theme Class on Body
  document.body.className = `wedding-bg-pattern min-h-screen relative text-[#2C2420] theme-${themeId}`;
  document.documentElement.style.setProperty('--primary', themeObj.primaryColor);
  document.documentElement.style.setProperty('--accent', themeObj.accentColor);

  // Clear falling objects from previous theme
  document.querySelectorAll('.falling-object-wrap').forEach(el => el.remove());

  renderAll();

  showToast(`បានប្តូររចនាបថ៖ ${themeObj.name}`);

  // Persist to server
  try {
    await fetch('/api/wedding/quick-style', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: weddingData.theme })
    });
  } catch (err) {
    console.error('Failed to auto-save theme:', err);
  }
};

// ================= DRESS CODE / ATTIRE PALETTE RENDERER =================
function renderAttirePalette() {
  const container = document.getElementById('attire-palette');
  if (!container) return;

  const isKh = currentLang === 'kh';
  const themeId = (weddingData?.theme?.id) || 'khmer-traditional';

  let colors = [
    { name_kh: 'មាសស្រាល', name_en: 'Champagne Gold', hex: '#D4AF37' },
    { name_kh: 'ក្រហមទុំ', name_en: 'Burgundy Silk', hex: '#8C1D2F' },
    { name_kh: 'ក្រែមសូត្រ', name_en: 'Warm Ivory', hex: '#FAF0D7' },
    { name_kh: 'ទង់ដែងសូត្រ', name_en: 'Copper Bronze', hex: '#B37D4E' }
  ];

  if (weddingData?.dress_code?.colors && weddingData.dress_code.colors.length > 0) {
    colors = weddingData.dress_code.colors;
  }

  container.innerHTML = colors.map(c => `
    <button type="button" onclick="copyAttireHex('${c.hex}')" class="attire-swatch-btn group" title="ចុចដើម្បីចម្លងកូដពណ៌ ${c.hex}">
      <div class="attire-color-circle" style="background-color: ${c.hex};">
        <span class="opacity-0 group-hover:opacity-100 text-white text-[10px] font-bold transition">Copy</span>
      </div>
      <span class="text-[11px] sm:text-xs font-semibold text-[#4E3227] font-khmer-body text-center">${isKh ? c.name_kh : c.name_en}</span>
      <span class="px-2 py-0.5 rounded-full text-[9px] font-mono bg-white/80 border border-[#C5A059]/40 text-[#4E3227] shadow-2xs">${c.hex}</span>
    </button>
  `).join('');
}

// ================= FLOATING BOTTOM NAVIGATION DOCK SCROLL SPY =================
function initBottomNavScrollSpy() {
  const dock = document.getElementById('bottom-nav-dock');
  if (!dock) return;

  const navLinks = dock.querySelectorAll('.bottom-nav-item');
  const sections = [
    { id: 'opening-cover-section', nav: dock.querySelector('a[href="#opening-cover-section"]') },
    { id: 'hero-section', nav: dock.querySelector('a[href="#hero-section"]') },
    { id: 'ceremony-section', nav: dock.querySelector('a[href="#ceremony-section"]') },
    { id: 'venue-section', nav: dock.querySelector('a[href="#venue-section"]') },
    { id: 'gallery-section', nav: dock.querySelector('a[href="#gallery-section"]') },
    { id: 'digital-gift-section', nav: dock.querySelector('a[href="#digital-gift-section"]') },
    { id: 'rsvp-section', nav: dock.querySelector('a[href="#rsvp-section"]') }
  ];

  // Smooth scroll click handler
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId && targetId.startsWith('#')) {
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  window.addEventListener('scroll', () => {
    const scrollPos = window.scrollY + 250;
    let currentId = 'hero-section';
    sections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el && el.offsetTop <= scrollPos) {
        currentId = s.id;
      }
    });

    sections.forEach(s => {
      if (!s.nav) return;
      if (s.id === currentId) {
        s.nav.classList.add('active-nav-tab');
      } else {
        s.nav.classList.remove('active-nav-tab');
      }
    });
  }, { passive: true });
}

// ================= ULTRA-SMOOTH SCROLL REVEAL OBSERVER =================
let scrollRevealObserver = null;

function initScrollReveal() {
  const revealElements = document.querySelectorAll('.reveal-on-scroll');
  if (!revealElements.length) return;

  if ('IntersectionObserver' in window) {
    if (scrollRevealObserver) {
      try { scrollRevealObserver.disconnect(); } catch (e) {}
    }

    scrollRevealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.08
    });

    revealElements.forEach(el => scrollRevealObserver.observe(el));
  } else {
    // Fallback if IntersectionObserver is not supported
    revealElements.forEach(el => el.classList.add('is-visible'));
  }
}

function triggerVisibleReveals() {
  const revealElements = document.querySelectorAll('.reveal-on-scroll:not(.is-visible)');
  revealElements.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      el.classList.add('is-visible');
      if (scrollRevealObserver) {
        try { scrollRevealObserver.unobserve(el); } catch (e) {}
      }
    }
  });
}



// ================= MODERN PLATFORM UTILITIES =================

window.addToCalendar = function(type) { if (type === "ics") window.downloadIcsCalendar(); else window.addToGoogleCalendar(); };

window.addToGoogleCalendar = function() {
  if (!weddingData?.wedding) return;
  const w = weddingData.wedding;
  const startDate = new Date(w.event_date || '2027-01-24T16:30:00+07:00');
  const endDate = new Date(startDate.getTime() + 5 * 60 * 60 * 1000);
  const formatTime = (d) => d.toISOString().replace(/-|:|.\d\d\d/g, '');
  const title = encodeURIComponent(`${w.groom?.name_en || 'Channarak'} & ${w.bride?.name_en || 'SreyNich'} Wedding Celebration`);
  const details = encodeURIComponent(`We cordially invite you to celebrate our wedding.\nVenue: ${w.venue_name_kh || ''}, ${w.venue_address_kh || ''}`);
  const location = encodeURIComponent(`${w.venue_name_kh || ''}, ${w.venue_address_kh || ''}`);
  const dates = `${formatTime(startDate)}/${formatTime(endDate)}`;
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  window.open(googleUrl, '_blank');
};

window.downloadIcsCalendar = function() {
  if (!weddingData?.wedding) return;
  const w = weddingData.wedding;
  const startDate = new Date(w.event_date || '2027-01-24T16:30:00+07:00');
  const endDate = new Date(startDate.getTime() + 5 * 60 * 60 * 1000);
  const formatIcsTime = (d) => d.toISOString().replace(/-|:|.\d\d\d/g, '');
  const title = `${w.groom?.name_en || 'Channarak'} & ${w.bride?.name_en || 'SreyNich'} Wedding Celebration`;
  const desc = `We cordially invite you to celebrate our wedding.\\nVenue: ${w.venue_name_kh || ''}, ${w.venue_address_kh || ''}`;
  const loc = `${w.venue_name_kh || ''}, ${w.venue_address_kh || ''}`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//E-Invitation//KH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:wedding-${startDate.getTime()}@rak-nich.com`,
    `DTSTAMP:${formatIcsTime(new Date())}`,
    `DTSTART:${formatIcsTime(startDate)}`,
    `DTEND:${formatIcsTime(endDate)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${loc}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', 'wedding-invitation.ics');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(currentLang === 'kh' ? 'បានទាញយកឯកសារប្រតិទិន (.ics)!' : 'Calendar event (.ics) downloaded!');
};

window.copyVenueAddress = function() {
  const w = weddingData?.wedding || {};
  const addr = w.venue_address_kh || w.venue_address_en || w.venue_name_kh || 'មជ្ឈមណ្ឌលសន្និបាត និងពិព័រណ៍ ព្រីមៀរ សែនសុខ';
  navigator.clipboard.writeText(addr);
  showToast(currentLang === 'kh' ? 'បានចម្លងអាសយដ្ឋានទីតាំងជោគជ័យ!' : 'Venue address copied!');
};

window.copyAttireHex = function(hex) {
  navigator.clipboard.writeText(hex);
  showToast(currentLang === 'kh' ? `បានចម្លងកូដពណ៌ ${hex}!` : `Color ${hex} copied!`);
};

window.openQrModal = function(type) {
  const dg = weddingData?.digital_gift;
  if (!dg) return;
  const modal = document.getElementById('qr-lightbox-modal');
  const title = document.getElementById('qr-modal-title');
  const acc = document.getElementById('qr-modal-acc');
  const img = document.getElementById('qr-modal-img');
  if (!modal || !img) return;

  const isGroom = type === 'groom';
  const accData = isGroom ? dg.groom_account : dg.bride_account;
  if (title) title.textContent = `${accData.bank_name} (${isGroom ? 'ខាងកូនប្រុស' : 'ខាងកូនស្រី'})`;
  if (acc) acc.textContent = `${accData.account_name} — ${accData.account_number}`;
  img.src = accData.qr_image;
  modal.classList.remove('hidden');
};

window.closeQrModal = function() {
  const modal = document.getElementById('qr-lightbox-modal');
  if (modal) modal.classList.add('hidden');
};


function renderThemeWelcome(themeId, w, isKh) {
  const guestDisplayName = currentGuest 
    ? (isKh ? (currentGuest.name || currentGuest.name_en) : (currentGuest.name_en || currentGuest.name)) 
    : (isKh ? 'ភ្ញៀវកិត្តិយស' : 'Honorable Guest');

  const wKhmer = document.getElementById('welcome-khmer');
  if (wKhmer) {
    wKhmer.classList.remove('hidden');

    // 1. Couple Calligraphic Names
    const khmerCouple = document.getElementById('khmer-envelope-couple-names');
    if (khmerCouple) {
      khmerCouple.innerHTML = `
        <div class="couple-names-khmer font-khmer-title text-base sm:text-lg md:text-xl text-[#1E4833] tracking-wide filter drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
          <span>${escapeHTML(w.groom.name_kh)}</span>
          <span class="opening-ampersand inline-block mx-1 text-[#C5A059] font-serif italic text-base sm:text-lg">&</span>
          <span>${escapeHTML(w.bride.name_kh)}</span>
        </div>
        <p class="opening-names-en text-[9px] sm:text-[10px] font-serif uppercase tracking-widest text-[#7A6F68] mt-0.5">
          ${escapeHTML(w.groom.name_en)} & ${escapeHTML(w.bride.name_en)}
        </p>
      `;
    }

    // 2. Personalized Guest Pill
    const guestBox = document.getElementById('khmer-envelope-guest-box');
    const guestName = document.getElementById('khmer-envelope-guest-name');
    if (guestBox && guestName) {
      guestName.textContent = guestDisplayName;
      guestBox.classList.remove('hidden');
    }

    // 3. Opening Event Date & Venue snippet
    const openDateEl = document.getElementById('opening-date-solar');
    if (openDateEl) {
      openDateEl.textContent = isKh ? toKhmerNumber(w.date_solar_kh) : w.date_solar_en;
    }
    const openVenueEl = document.getElementById('opening-venue-snippet');
    if (openVenueEl) {
      const timeStr = isKh ? 'វេលាម៉ោង ០៧:០០ ព្រឹក' : 'Time: 7:00 AM';
      const venueStr = isKh ? (w.venue_name_kh || 'នៅគេហដ្ឋានខាងស្រី') : (w.venue_name_en || "Bride's Residence");
      openVenueEl.innerHTML = `<span>${timeStr}</span> • <span>${escapeHTML(venueStr)}</span>`;
    }

    // 4. Opening Button text
    const openBtnText = document.getElementById('opening-btn-text');
    if (openBtnText) {
      openBtnText.textContent = isKh ? 'បើកលិខិតអញ្ជើញ (Open)' : 'Open Invitation';
    }
  }
}


// Start background music on user's first touch/click
document.addEventListener('click', function initMusicOnFirstInteraction() {
  if (!isAudioPlaying) {
    playMusic();
  }
  document.removeEventListener('click', initMusicOnFirstInteraction);
}, { once: true });
