/**
 * PlayJo – shared sample data + helpers for the inner pages.
 * Mirrors schema.sql seed. Replace with fetch('/api/...') calls when the backend exists.
 * Pages live in /pages/<area>/, so ROOT is '../../'.
 */
const ROOT = '../../';

const PJ = {
  user: { id: 5, name: 'Omar Haddad', email: 'omar@example.com', phone: '+962791234567',
          role: 'customer', phone_verified: true, points: 1250, tier: 'silver', next_tier_at: 2000 },

  facilities: [
    { id: 1, name: 'Trax Amman', city: 'Amman', area: 'Abdoun', rating: 4.7, grad: 'from-emerald-500 to-teal-700',
      about: 'Multi-sport complex with floodlit football pitches and padel courts.',
      hours: '08:00 – 24:00',
      courts: [{ id: 1, name: 'Pitch A', sport: 'football', price: 40 }, { id: 2, name: 'Padel 1', sport: 'padel', price: 24 }] },
    { id: 2, name: 'Padel Arena', city: 'Amman', area: 'Deir Ghbar', rating: 4.6, grad: 'from-sky-500 to-indigo-700',
      about: 'Premium indoor and outdoor padel courts with coaching.',
      hours: '09:00 – 24:00',
      courts: [{ id: 3, name: 'Court 1', sport: 'padel', price: 28 }, { id: 4, name: 'Court 2', sport: 'padel', price: 28 }] },
    { id: 3, name: 'Ayla Golf Club', city: 'Aqaba', area: 'Ayla Oasis', rating: 4.9, grad: 'from-lime-500 to-green-800',
      about: '18-hole championship course on the Red Sea.',
      hours: '07:00 – 19:00',
      courts: [{ id: 5, name: 'Main Course (4 players)', sport: 'golf', price: 85 }] },
    { id: 4, name: 'Hoops Zone', city: 'Zarqa', area: 'Downtown', rating: 4.4, grad: 'from-orange-500 to-red-700',
      about: 'Indoor basketball courts for pickup games and leagues.',
      hours: '10:00 – 24:00',
      courts: [{ id: 6, name: 'Court A', sport: 'basketball', price: 30 }] }
  ],

  // facilityId null = platform-wide
  deals: [
    { code: 'PADEL20',   facilityId: 2,    title: 'Weekday Padel 20% Off',     desc: 'Sunday to Thursday before 5 PM.', type: 'percent', value: 20, until: '2026-12-31' },
    { code: 'TRAX5',     facilityId: 1,    title: 'Football Night: 5 JOD off', desc: 'Evening slots after 9 PM.',      type: 'fixed',   value: 5,  until: '2026-11-30' },
    { code: 'WELCOME10', facilityId: null, title: 'Welcome to PlayJo',         desc: '10% off your first booking.',    type: 'percent', value: 10, until: '2026-12-31' }
  ],
  claimed: ['WELCOME10'],

  bookings: [
    { id: 'B-1001', facilityId: 2, court: 'Court 1', date: '2026-10-10', time: '19:00', total: 28.00, status: 'completed' },
    { id: 'B-1002', facilityId: 1, court: 'Pitch A', date: '2026-10-17', time: '21:00', total: 35.00, status: 'completed' },
    { id: 'B-1003', facilityId: 2, court: 'Court 1', date: '2026-10-28', time: '18:00', total: 22.40, status: 'confirmed' }
  ],

  tx: [
    { date: '2026-10-10', note: 'Padel Arena booking',                 points: 280 },
    { date: '2026-10-17', note: 'Trax Amman booking (x1.25 multiplier)', points: 438 },
    { date: '2026-10-01', note: 'Welcome bonus',                       points: 100 }
  ]
};

/* ---------- helpers ---------- */
const JOD = (n) => Number(n).toFixed(2) + ' JOD';
const facilityById = (id) => PJ.facilities.find((f) => f.id === Number(id));
const dealByCode = (code) => PJ.deals.find((d) => d.code === String(code).trim().toUpperCase());

// Codes claimed in the seed data plus any claimed on the Deals page in this browser
function claimedCodes() {
  let extra = [];
  try { extra = JSON.parse(localStorage.getItem('playjo_claimed') || '[]'); } catch (_) {}
  return [...new Set([...PJ.claimed, ...extra])];
}

function loadLocalBookings() {
  try { return JSON.parse(localStorage.getItem('playjo_bookings') || '[]'); } catch (_) { return []; }
}
function saveLocalBooking(b) {
  try { const all = loadLocalBookings(); all.push(b); localStorage.setItem('playjo_bookings', JSON.stringify(all)); } catch (_) {}
}
function allBookings() { return [...PJ.bookings, ...loadLocalBookings()].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)); }

// Points currently available (base + earned/spent on locally-made bookings)
function pointsBalance() {
  return PJ.user.points + loadLocalBookings().reduce((s, b) => s + (b.pointsEarned || 0) - (b.pointsUsed || 0), 0);
}

// Loyalty multiplier from the number of bookings in the last 30 days (before the new one)
function loyaltyMultiplier() {
  const now = new Date();
  const recent = allBookings().filter((b) => b.status !== 'cancelled' && (now - new Date(b.date)) / 864e5 <= 30).length;
  return recent >= 4 ? 1.5 : recent >= 2 ? 1.25 : 1.0;   // the new booking is the (recent+1)th
}

function renderNav(active) {
  const links = [['Explore', ROOT + 'index.html#facilities'], ['Deals', ROOT + 'pages/customer/deals.html'],
                 ['My dashboard', ROOT + 'pages/customer/dashboard.html'], ['For Owners', ROOT + 'pages/auth/register.html?role=owner']];
  document.getElementById('nav').innerHTML = `
  <header class="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
    <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
      <a href="${ROOT}index.html" class="flex items-center gap-2 font-extrabold text-xl">
        <span class="inline-flex w-9 h-9 rounded-xl bg-brand-600 text-white items-center justify-center">P</span>
        Play<span class="text-brand-600">Jo</span></a>
      <nav class="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
        ${links.map(([t, h]) => `<a href="${h}" class="hover:text-brand-600 ${t === active ? 'text-brand-600 font-semibold' : ''}">${t}</a>`).join('')}
      </nav>
      <a href="${ROOT}pages/customer/dashboard.html" class="flex items-center gap-2 text-sm font-semibold">
        <span class="hidden sm:inline">${PJ.user.name}</span>
        <span class="w-9 h-9 rounded-full bg-brand-50 text-brand-700 inline-flex items-center justify-center">${PJ.user.name[0]}</span></a>
    </div>
  </header>`;
}

function showToast(msg, ms = 3500) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div'); t.id = 'toast';
    t.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] hidden px-5 py-3 rounded-xl bg-ink text-white text-sm shadow-xl max-w-[90vw]';
    document.body.appendChild(t);
  }
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(showToast._t); showToast._t = setTimeout(() => t.classList.add('hidden'), ms);
}

// Shared Tailwind config snippet (each page inlines the same one)
const TW_CONFIG = { theme: { extend: { colors: {
  brand: { 50: '#ecfdf5', 100: '#d1fae5', 500: '#10b981', 600: '#059669', 700: '#047857', 900: '#064e3b' }, ink: '#0f172a' },
  fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] } } } };
