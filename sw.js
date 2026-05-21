'use strict';
const CACHE = 'glowup-v2';
const SHELL = ['./index.html', './manifest.json'];

// ─── Full daily notification schedule ────────────────────────────────────────
const DAILY = [
  { h:6,  m:45, title:'🌅 Rise & Glow',           body:'Morning routine — open app to start checklist',       tag:'wake'      },
  { h:7,  m:0,  title:'🧼 Step 1: Wash Face',      body:'Soon Jung Cleanser. Gentle — no scrubbing.',         tag:'wash-am'   },
  { h:7,  m:5,  title:'❄️ Step 2: Caffeine Eye',   body:'Cold from fridge! Apply under eyes now.',            tag:'caff'      },
  { h:7,  m:10, title:'💧 Step 3: Moisturize',     body:'2 drops Volufiline + SKIN1004. Focus under eyes.',   tag:'moist-am'  },
  { h:7,  m:13, title:'☀️ Step 4: SPF 40',         body:'Beauty of Joseon. Daily — non-negotiable.',          tag:'spf'       },
  { h:8,  m:0,  title:'🍳 Breakfast + Protein',    body:'Hit your protein every meal, not just one.',         tag:'bfast'     },
  { h:9,  m:0,  title:'💧 Water + Mewing',         body:'Full glass. Is your entire tongue on your palate?',  tag:'w9'        },
  { h:11, m:0,  title:'💧 Water Reminder',         body:'Stay hydrated — skin quality depends on it.',        tag:'w11'       },
  { h:12, m:0,  title:'🦷 Mastic Gum',             body:'20 chews LEFT (weaker side), 10 RIGHT. 10-15 min.', tag:'gum-noon'  },
  { h:13, m:0,  title:'🍽️ Lunch',                  body:'Protein! 0.7-1g per pound of bodyweight daily.',    tag:'lunch'     },
  { h:15, m:0,  title:'💧 Water + Mewing',         body:'Another glass. Chin tucked, tongue on palate?',      tag:'w15'       },
  { h:17, m:0,  title:'🦷 Mastic Gum',             body:'Evening: 20 LEFT, 10 RIGHT. Lead with left!',        tag:'gum-5pm'   },
  { h:18, m:0,  title:'👅 Mewing Check',           body:'Full tongue on palate including back third!',        tag:'mew-6pm'   },
  { h:19, m:0,  title:'🍽️ Dinner',                 body:'2500-3000 cal daily. Eat — you\'re bulking!',        tag:'dinner'    },
  { h:21, m:0,  title:'💧 Last Water',             body:'Final big glass. Finish your 12 glasses today.',     tag:'w9pm'      },
  { h:21, m:30, title:'🌙 Night Routine',           body:'Cleanse → moisturize → wait 10 min → tret → moisturize', tag:'night'  },
  { h:22, m:0,  title:'💊 Tretinoin (sandwich)',   body:'Moisturize first → 10 min → pea-sized tret → moisturize on top', tag:'tret' },
  { h:22, m:2,  title:'💧 Top layer moisturizer',  body:'Sandwich complete. SKIN1004 on top — do it now!',   tag:'moist-pm'  },
  { h:22, m:10, title:'👅 Final Mewing Check',     body:'Tongue on palate. Chin tucked. Sleep well.',         tag:'mew-pm'    },
];

let timers = [];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (url.pathname.match(/icon-(192|512)\.png$/)) {
    const size = url.pathname.includes('192') ? 192 : 512;
    e.respondWith(serveIcon(size));
    return;
  }

  e.respondWith(
    caches.match(e.request)
      .then(hit => hit || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});

// ─── Icon generation ──────────────────────────────────────────────────────────
async function serveIcon(size) {
  const key = `./icon-${size}.png`;
  const cached = await caches.match(key);
  if (cached) return cached;

  try {
    const cv = new OffscreenCanvas(size, size);
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#3b82f6'); g.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = g;
    const r = size * 0.22;
    ctx.beginPath();
    ctx.moveTo(r,0); ctx.lineTo(size-r,0); ctx.arcTo(size,0,size,r,r);
    ctx.lineTo(size,size-r); ctx.arcTo(size,size,size-r,size,r);
    ctx.lineTo(r,size); ctx.arcTo(0,size,0,size-r,r);
    ctx.lineTo(0,r); ctx.arcTo(0,0,r,0,r); ctx.closePath(); ctx.fill();
    ctx.font = `${Math.round(size*.46)}px serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('✨', size/2, size/2+size*.03);
    const blob = await cv.convertToBlob({ type:'image/png' });
    const resp = new Response(blob, { headers:{'Content-Type':'image/png'} });
    (await caches.open(CACHE)).put(key, resp.clone());
    return resp;
  } catch {
    return new Response(new Uint8Array([137,80,78,71,13,10,26,10]), { headers:{'Content-Type':'image/png'} });
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────
self.addEventListener('message', e => {
  if (!e.data) return;
  const { type, payload } = e.data;
  if (type === 'SCHEDULE') scheduleAll(payload || {});
  if (type === 'PING') e.source?.postMessage({ type: 'PONG' });
});

function scheduleAll({ dow = 0, gymType = null, skipTret = false, tanToday = false, tanMins = 3, isTanFriday = false } = {}) {
  timers.forEach(clearTimeout);
  timers = [];
  const now = new Date();

  // Daily notifications
  for (const n of DAILY) {
    // Skip tret notification on skip nights
    if (n.tag === 'tret' && skipTret) continue;

    const t = new Date(now); t.setHours(n.h, n.m, 0, 0);
    const ms = t - now;
    if (ms > 0) timers.push(setTimeout(() => notify(n.title, n.body, n.tag), ms));
  }

  // Gym reminder (Mon/Tue/Thu/Fri) at 5:30 PM
  if (gymType) {
    const label = gymType === 'push' ? 'PUSH' : 'PULL';
    const t = new Date(now); t.setHours(17, 30, 0, 0);
    const ms = t - now;
    if (ms > 0) timers.push(setTimeout(() =>
      notify(`💪 Gym Day — ${label}!`, `Today is ${label} day. Check the Workout tab for your exercises.`, 'gym'), ms));
  }

  // Wednesday hair at 8 PM
  if (dow === 3) {
    const t = new Date(now); t.setHours(20, 0, 0, 0);
    const ms = t - now;
    if (ms > 0) timers.push(setTimeout(() =>
      notify('💇 Hair Night!', 'Deep condition with Aussie 3 Minute Miracle tonight.', 'hair'), ms));
  }

  // Pre-tan Thursday: skip tretinoin warning at 9 PM
  if (skipTret && !isTanFriday) {
    const t = new Date(now); t.setHours(21, 0, 0, 0);
    const ms = t - now;
    if (ms > 0) timers.push(setTimeout(() =>
      notify('⚠️ SKIP TRETINOIN Tonight!', 'Tanning tomorrow — no tret tonight AND tomorrow night.', 'skip-tret'), ms));
  }

  // Tan day Friday at 6 PM
  if (isTanFriday) {
    const t = new Date(now); t.setHours(18, 0, 0, 0);
    const ms = t - now;
    if (ms > 0) timers.push(setTimeout(() =>
      notify(`🌞 TAN DAY — ${tanMins} minutes max!`, `Set timer for exactly ${tanMins} mins. Moisturize heavily after.`, 'tan-day'), ms));
    // Post-tan: skip tret at 10 PM
    const t2 = new Date(now); t2.setHours(22, 0, 0, 0);
    const ms2 = t2 - now;
    if (ms2 > 0) timers.push(setTimeout(() =>
      notify('⚠️ Skip Tretinoin Again Tonight', 'Post-tan rest night — no tret. Moisturize heavily instead.', 'skip-tret-post'), ms2));
  }
}

function notify(title, body, tag) {
  self.registration.showNotification(title, {
    body,
    tag,
    icon: './icon-192.png',
    badge: './icon-192.png',  // Small monochrome icon for Apple Watch
    vibrate: [200, 100, 200],
    silent: false,
    data: { url: './' },
  });
}

// ─── Notification click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(cs => {
      const open = cs.find(c => c.url && 'focus' in c);
      return open ? open.focus() : self.clients.openWindow(e.notification.data?.url || './');
    })
  );
});

// ─── Push (future server integration) ────────────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return;
  try {
    const d = e.data.json();
    e.waitUntil(notify(d.title, d.body, d.tag || 'push'));
  } catch {}
});
