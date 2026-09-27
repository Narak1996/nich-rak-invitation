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
    initMusic(musicUrl);
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
  document.body.className = `wedding-bg-pattern min-h-screen relative text-[#2C2420] theme-${themeId} ${currentLang === 'en' ? 'lang-en' : 'lang-kh'}`;

  if (weddingData.theme) {
    document.documentElement.style.setProperty('--primary', weddingData.theme.primaryColor || '#8C1D2F');
    document.documentElement.style.setProperty('--accent', weddingData.theme.accentColor || '#D4AF37');
  }

  // Update top bar theme switcher display
  const themeIconEl = document.getElementById('active-theme-icon');
  if (themeIconEl) {
    if (themeId === 'khmer-traditional') {
      themeIconEl.innerHTML = '<img src="/images/components/romduol-flower.svg" class="w-3.5 h-3.5 object-contain" alt="Romduol">';
    } else if (themeId === 'western-modern') {
      themeIconEl.textContent = '💍';
    } else if (themeId === 'chinese-traditional') {
      themeIconEl.textContent = '囍';
    } else {
      themeIconEl.innerHTML = '<img src="/images/components/romduol-flower.svg" class="w-3.5 h-3.5 object-contain" alt="Romduol">';
    }
  }
  const themeLabelEl = document.getElementById('active-theme-label');
  if (themeLabelEl) {
    const labelMap = { 'khmer-traditional': 'ខ្មែរ', 'western-modern': 'សម័យថ្មី', 'chinese-traditional': 'ចិន' };
    themeLabelEl.textContent = labelMap[themeId] || 'ខ្មែរ';
  }

  // Language based text rendering
  const isKh = currentLang === 'kh';

  // Groom and Bride initials for monogram
  const groomInitial = (w.groom.name_en || w.groom.name_kh || 'G').trim().charAt(0).toUpperCase();
  const brideInitial = (w.bride.name_en || w.bride.name_kh || 'B').trim().charAt(0).toUpperCase();

  // Inject Theme Small Component Emblem (Romduol / Monogram / 囍)
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
      // Default: Khmer Traditional - Authentic ផ្ការំដួល (Romduol Flower)
      heroEmblemEl.innerHTML = `<img src="/images/components/romduol-flower.svg" alt="ផ្ការំដួល" class="h-16 filter drop-shadow-md transition-transform hover:scale-105">`;
    }
  }

  // Inject Theme Small Component Divider (Romduol Vine / Botanical Olive / Auspicious Cloud)
  const heroDividerEl = document.getElementById('hero-theme-divider');
  if (heroDividerEl) {
    if (themeId === 'chinese-traditional') {
      heroDividerEl.innerHTML = `
        <div class="flex flex-col items-center gap-1.5 w-full max-w-sm mx-auto">
          <img src="/images/components/chinese-divider.svg" alt="囍" class="h-8 w-full filter drop-shadow-sm">
          <span class="text-[11px] text-[#FFD700] font-bold tracking-widest">百年好合 • 喜结良缘 • 永结同心</span>
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
      // Khmer Traditional - ផ្ការំដួល Divider (No Angkor Wat image or text)
      heroDividerEl.innerHTML = `
        <div class="flex flex-col items-center gap-1.5 w-full max-w-sm mx-auto">
          <img src="/images/components/romduol-divider.svg" alt="ផ្ការំដួល" class="h-7 w-full">
          <span class="text-[11px] text-[#D4AF37] font-bold tracking-widest font-khmer-body">សិរីសួស្តី ជ័យមង្គល វិបុលសុខ មហាប្រសើរ</span>
        </div>
      `;
    }
  }

  // 1. Transform Wax Seal based on Theme
  const sealContentEl = document.getElementById('wax-seal-content');
  if (sealContentEl) {
    if (themeId === 'chinese-traditional') {
      sealContentEl.innerHTML = `
        <div class="flex flex-col items-center justify-center">
          <span class="text-3xl text-[#FFE866] font-bold block leading-none drop-shadow-md">囍</span>
          <span class="text-[8px] tracking-wider uppercase block mt-1 font-bold text-[#FFF9E6]">开 • OPEN</span>
        </div>
      `;
    } else if (themeId === 'western-modern') {
      sealContentEl.innerHTML = `<span class="text-2xl block leading-none">💍</span><span class="text-[8px] tracking-wider uppercase block mt-1 font-bold">OPEN</span>`;
    } else {
      // Default: Khmer Traditional - ផ្ការំដួល Wax Seal
      sealContentEl.innerHTML = `
        <img src="/images/components/romduol-flower.svg" alt="រំដួល" class="w-8 h-8 mx-auto filter drop-shadow-xs">
        <span class="text-[8px] tracking-wider uppercase block mt-0.5 font-bold text-[#FFF2BF]">បើកសំបុត្រ</span>
      `;
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
      heroMotifEl.innerHTML = isKh ? 'សិរីសួស្តី អាពាហ៍ពិពាហ៍ប្រពៃណីខ្មែរ' : 'Traditional Khmer Wedding Celebration';
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
      footerStampEl.innerHTML = `<img src="/images/components/romduol-flower.svg" alt="ផ្ការំដួល" class="w-7 h-7 mx-auto inline-block">`;
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
      monogramEl.innerHTML = `<img src="/images/components/romduol-flower.svg" alt="រំដួល" class="w-8 h-8 mx-auto">`;
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
      connectorHtml = '<span class="text-sm text-[#D4AF37] font-bold font-khmer-body">និង</span>';
    }

    // In Khmer & Chinese themes: strictly display Khmer name without English
    const coupleNameColor = themeId === 'chinese-traditional' ? 'text-[#FFD700]' : 'text-[var(--primary)]';
    if (themeId === 'khmer-traditional' || themeId === 'chinese-traditional' || isKh) {
      envelopeCoupleEl.innerHTML = `
        <div class="flex flex-col items-center justify-center">
          <div class="couple-names-khmer text-xl sm:text-2xl font-bold tracking-normal ${coupleNameColor}">
            ${escapeHTML(w.groom.name_kh)}
          </div>
          <div class="couple-connector my-1">
            ${connectorHtml}
          </div>
          <div class="couple-names-khmer text-xl sm:text-2xl font-bold tracking-normal ${coupleNameColor}">
            ${escapeHTML(w.bride.name_kh)}
          </div>
        </div>
      `;
    } else {
      envelopeCoupleEl.innerHTML = `
        <div class="font-en-script text-3xl sm:text-4xl ${coupleNameColor} leading-tight">
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
      mainTitleEl.innerHTML = isKh
        ? `<span class="kh-title-line">សិរីសួស្តី អាពាហ៍ពិពាហ៍</span><span class="cn-title-line">囍 喜结良缘 囍</span>`
        : `<span class="kh-title-line">WEDDING CELEBRATION</span><span class="cn-title-line">囍 DOUBLE HAPPINESS 囍</span>`;
    } else if (themeId === 'western-modern') {
      mainTitleEl.textContent = isKh ? (w.title_kh || 'សិរីសួស្តី អាពាហ៍ពិពាហ៍') : (w.title_en || 'WEDDING CELEBRATION');
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
      mainConnector = `<span class="inline-block mx-2 text-[#D4AF37] font-bold text-base font-khmer-body">និង</span>`;
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

  // RSVP Form Guest prepopulation
  if (currentGuest) {
    document.getElementById('rsvp-name').value = isKh ? (currentGuest.name || currentGuest.name_en) : (currentGuest.name_en || currentGuest.name);
    if (currentGuest.phone) document.getElementById('rsvp-phone').value = currentGuest.phone;
    if (currentGuest.side) document.getElementById('rsvp-side').value = currentGuest.side;
    if (currentGuest.pax_allowed) {
      document.getElementById('rsvp-pax-hint').textContent = isKh 
        ? `(ចំនួនភ្ញៀវអញ្ជើញចូលរួម: ${toKhmerNumber(currentGuest.pax_allowed)} នាក់)`
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
          ${isKh ? toKhmerNumber(item.time) : item.time}
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
  document.getElementById('groom-acc-num').textContent = isKh ? toKhmerNumber(dg.groom_account.account_number) : dg.groom_account.account_number;
  document.getElementById('groom-qr-img').src = dg.groom_account.qr_image;

  // Bride account
  document.getElementById('bride-bank-name').textContent = dg.bride_account.bank_name;
  document.getElementById('bride-acc-name').textContent = dg.bride_account.account_name;
  document.getElementById('bride-acc-num').textContent = isKh ? toKhmerNumber(dg.bride_account.account_number) : dg.bride_account.account_number;
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

  // Theme dropdown toggle on click (open when click, not hover)
  const themeBtn = document.getElementById('theme-menu-btn');
  const themeDropdown = document.getElementById('theme-menu-dropdown');
  if (themeBtn && themeDropdown) {
    themeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = themeDropdown.classList.contains('hidden');
      if (isHidden) {
        themeDropdown.classList.remove('hidden');
        themeDropdown.classList.add('flex');
      } else {
        themeDropdown.classList.add('hidden');
        themeDropdown.classList.remove('flex');
      }
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
      el.innerHTML = `
        <img src="/images/components/romduol-flower.svg" alt="ផ្ការំដួល" class="w-full h-full object-contain filter drop-shadow-md select-none">
      `;
      return el;
    },
    // 2. Khmer Sacred Golden Lotus (ផ្កាឈូកមាសអង្គរ)
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const size = Math.floor(Math.random() * 8 + 22); // 22-30px
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.innerHTML = `
        <img src="/images/components/lotus-ornament.svg" alt="ផ្កាឈូក" class="w-full h-full object-contain filter drop-shadow-sm select-none">
      `;
      return el;
    },
    // 3. Khmer Sacred Wedding Pka Sla (ផ្កាស្លាពន្លកមង្គល - Areca Palm Blossom Spikes)
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const w = Math.floor(Math.random() * 5 + 16); // 16-21px
      const h = Math.floor(w * 1.6);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.innerHTML = `
        <svg viewBox="0 0 20 32" width="${w}" height="${h}" class="filter drop-shadow-xs">
          <!-- Pka Sla Golden Stem -->
          <path d="M10 2 Q11 16 10 30" stroke="#C29424" stroke-width="1.3" fill="none"/>
          <!-- Sacred Golden Palm Blossom Beads -->
          <circle cx="10" cy="4" r="2.8" fill="#FFF2BF" stroke="#A67817" stroke-width="0.7"/>
          <circle cx="6" cy="10" r="2.5" fill="#FFE07A" stroke="#A67817" stroke-width="0.7"/>
          <circle cx="14" cy="10" r="2.5" fill="#FFE07A" stroke="#A67817" stroke-width="0.7"/>
          <circle cx="5" cy="17" r="2.3" fill="#DFB342" stroke="#A67817" stroke-width="0.7"/>
          <circle cx="15" cy="17" r="2.3" fill="#DFB342" stroke="#A67817" stroke-width="0.7"/>
          <circle cx="7" cy="24" r="2" fill="#C29424" stroke="#8C630D" stroke-width="0.6"/>
          <circle cx="13" cy="24" r="2" fill="#C29424" stroke="#8C630D" stroke-width="0.6"/>
        </svg>
      `;
      return el;
    },
    // 4. Golden Romduol Petal (ត្របកផ្ការំដួលមាស)
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const w = Math.floor(Math.random() * 6 + 16); // 16-22px
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
          <path d="M12 4 Q12 18 12 30" stroke="#FFF7CC" stroke-width="1.1" fill="none" opacity="0.9"/>
        </svg>
      `;
      return el;
    },
    // 5. Fragrant White Jasmine Blossom (ផ្កាម្លិះពន្លកសួស្តី)
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const size = Math.floor(Math.random() * 6 + 16); // 16-22px
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
  ],

  'western-modern': [
    // 1. Silky Ivory White Rose Petal
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const w = Math.floor(Math.random() * 8 + 17);
      const h = Math.floor(w * 1.35);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.background = 'linear-gradient(145deg, #FFFFFF 0%, #FBF8F3 60%, #E8DFC8 100%)';
      el.style.borderRadius = '50% 50% 55% 45% / 40% 40% 60% 60%';
      el.style.boxShadow = '0 3px 8px rgba(78, 50, 39, 0.08)';
      return el;
    },
    // 2. Tuscan Olive / Eucalyptus Branch (Botanical SVG Component)
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const w = Math.floor(Math.random() * 8 + 26); // 26-34px
      const h = Math.floor(w * 0.35);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.innerHTML = `
        <img src="/images/components/botanical-olive.svg" alt="Olive Branch" class="w-full h-full object-contain filter drop-shadow-sm select-none opacity-85">
      `;
      return el;
    },
    // 3. Champagne Gold Sparkle Star (✦ Diamond Light)
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const size = Math.floor(Math.random() * 6 + 15);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.innerHTML = `
        <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="#C5A059">
          <path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" filter="drop-shadow(0 0 3px rgba(197, 160, 89, 0.5))"/>
        </svg>
      `;
      return el;
    },
    // 4. Tuscan Botanical Olive & Eucalyptus Single Leaf
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const w = Math.floor(Math.random() * 5 + 11);
      const h = Math.floor(w * 2.2);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.innerHTML = `
        <svg viewBox="0 0 16 34" width="${w}" height="${h}" fill="none">
          <path d="M8 0 C0 10, 0 24, 8 34 C16 24, 16 10, 8 0 Z" fill="#3D5A47" opacity="0.65"/>
          <path d="M8 3 L8 31" stroke="#A3B18A" stroke-width="0.8" opacity="0.8"/>
        </svg>
      `;
      return el;
    },
    // 5. Luxury Champagne Gold Confetti
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const size = Math.floor(Math.random() * 5 + 7);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.background = 'linear-gradient(135deg, #FFF2D6 0%, #C5A059 100%)';
      el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      el.style.boxShadow = '0 2px 6px rgba(197, 160, 89, 0.35)';
      return el;
    }
  ],

  'chinese-traditional': [
    // 1. Auspicious Double Happiness Medallion (囍 Medallion SVG Component)
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const size = Math.floor(Math.random() * 8 + 22); // 22-30px
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.innerHTML = `
        <img src="/images/components/chinese-double-happiness.svg" alt="囍" class="w-full h-full object-contain filter drop-shadow-md select-none">
      `;
      return el;
    },
    // 2. Auspicious Peony Flower (Peony SVG Component)
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const size = Math.floor(Math.random() * 8 + 20); // 20-28px
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.innerHTML = `
        <img src="/images/components/chinese-peony.svg" alt="牡丹" class="w-full h-full object-contain filter drop-shadow-sm select-none">
      `;
      return el;
    },
    // 3. Imperial Ruby Peony Petal (牡丹花瓣)
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const w = Math.floor(Math.random() * 8 + 16);
      const h = Math.floor(w * 1.4);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.background = 'linear-gradient(145deg, #FF334B 0%, #D41428 50%, #7D0A14 100%)';
      el.style.borderRadius = '50% 50% 60% 0 / 40% 50% 60% 0';
      el.style.boxShadow = '0 3px 12px rgba(168, 24, 34, 0.45)';
      return el;
    },
    // 4. Auspicious Gold Coin / Sycee (金钱/元宝)
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const size = Math.floor(Math.random() * 5 + 15);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.innerHTML = `
        <svg viewBox="0 0 20 20" width="${size}" height="${size}">
          <circle cx="10" cy="10" r="9" fill="#FFD700" stroke="#B8860B" stroke-width="1.2" filter="drop-shadow(0 1px 3px rgba(0,0,0,0.4))"/>
          <rect x="7.5" y="7.5" width="5" height="5" fill="#800B13" stroke="#B8860B" stroke-width="0.8"/>
        </svg>
      `;
      return el;
    },
    // 5. Shimmering Gold Flake (金箔飞金)
    () => {
      const el = document.createElement('div');
      el.className = 'falling-object-wrap';
      const size = Math.floor(Math.random() * 5 + 9);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.background = 'linear-gradient(135deg, #FFF6BD 0%, #FFD700 60%, #FFA500 100%)';
      el.style.clipPath = 'polygon(50% 0%, 90% 20%, 100% 60%, 75% 100%, 25% 100%, 0% 60%, 10% 20%)';
      el.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.7)';
      return el;
    }
  ]
};

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
    name: 'ខ្មែរ',
    primaryColor: '#8C1D2F',
    accentColor: '#D4AF37',
    secondaryColor: '#B22B42',
    bgColor: '#FAF5E8',
    emblem: 'romduol',
    sealEmblem: 'romduol'
  },
  'western-modern': {
    id: 'western-modern',
    name: 'សម័យថ្មី',
    primaryColor: '#1B4332',
    accentColor: '#C5A059',
    secondaryColor: '#2D6A4F',
    bgColor: '#FAF8F5',
    emblem: '💍',
    sealEmblem: 'rings'
  },
  'chinese-traditional': {
    id: 'chinese-traditional',
    name: 'ចិន',
    primaryColor: '#A81822',
    accentColor: '#FFD700',
    secondaryColor: '#C72535',
    bgColor: '#7D0A12',
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
