/**
 * PlayJo – landing page logic: sample data, category filters, search, list/map toggle, deals.
 * In production, replace SAMPLE_* with fetch('/api/facilities'), fetch('/api/promotions'), etc.
 */

/* ---------------- Sample data (mirrors schema.sql seed) ---------------- */
const SAMPLE_USERS = {
  customer: { id: 5, name: 'Omar Haddad', email: 'omar@example.com', phone: '+962791234567', role: 'customer', points: 1250, tier: 'silver' },
  owner:    { id: 2, name: 'Layla Nasser', email: 'owner@trax.example.com', phone: '+962781112233', role: 'facility_owner', facilityId: 1 },
  admin:    { id: 1, name: 'PlayJo Admin', email: 'admin@playjo.example.com', phone: '+962799000000', role: 'super_admin' }
};

const CATEGORIES = [
  { id: 'all',        label: 'All',        icon: '🏟️' },
  { id: 'padel',      label: 'Padel',      icon: '🎾' },
  { id: 'football',   label: 'Football',   icon: '⚽' },
  { id: 'basketball', label: 'Basketball', icon: '🏀' },
  { id: 'golf',       label: 'Golf',       icon: '⛳' },
  { id: 'tennis',     label: 'Tennis',     icon: '🎾' },
  { id: 'volleyball', label: 'Volleyball', icon: '🏐' }
];

const FACILITIES = [
  { id: 1, name: 'Trax Amman',     city: 'Amman', area: 'Abdoun',     sports: ['football', 'padel'], from: 24, rating: 4.7, lat: 31.9454, lng: 35.9020, tag: 'Popular',
    grad: 'from-emerald-500 to-teal-700' },
  { id: 2, name: 'Padel Arena',    city: 'Amman', area: 'Deir Ghbar', sports: ['padel'],             from: 28, rating: 4.6, lat: 31.9552, lng: 35.8780, tag: '20% off weekdays',
    grad: 'from-sky-500 to-indigo-700' },
  { id: 3, name: 'Ayla Golf Club', city: 'Aqaba', area: 'Ayla Oasis', sports: ['golf'],              from: 20, rating: 4.9, lat: 29.5430, lng: 35.0070, tag: 'Premium',
    grad: 'from-lime-500 to-green-800' },
  { id: 4, name: 'Hoops Zone',     city: 'Zarqa', area: 'Downtown',   sports: ['basketball'],        from: 18, rating: 4.4, lat: 32.0728, lng: 36.0880, tag: 'New',
    grad: 'from-orange-500 to-red-700' },
  { id: 5, name: 'Sports City Amman',  city: 'Amman',  area: 'Shmeisani',        sports: ['football', 'basketball', 'volleyball'], from: 22, rating: 4.5, lat: 31.9680, lng: 35.9050, tag: 'Multi-sport',
    grad: 'from-cyan-500 to-blue-700' },
  { id: 6, name: 'Aqaba Beach Padel',  city: 'Aqaba',  area: 'South Beach',      sports: ['padel'],                                from: 26, rating: 4.8, lat: 29.4780, lng: 35.0000, tag: 'Sea view',
    grad: 'from-teal-400 to-cyan-700' },
  { id: 7, name: 'Irbid Arena',        city: 'Irbid',  area: 'University Street', sports: ['football', 'volleyball'],               from: 18, rating: 4.3, lat: 32.5556, lng: 35.8500, tag: 'New',
    grad: 'from-amber-500 to-orange-700' },
  { id: 8, name: 'Amman Tennis Club',  city: 'Amman',  area: 'Jabal Amman',      sports: ['tennis'],                               from: 20, rating: 4.6, lat: 31.9530, lng: 35.9250, tag: 'Clay courts',
    grad: 'from-rose-500 to-red-700' },
  { id: 9, name: 'Madaba Sports Hub',  city: 'Madaba', area: 'City Center',      sports: ['football', 'basketball', 'padel'],      from: 22, rating: 4.4, lat: 31.7160, lng: 35.7940, tag: 'Multi-sport',
    grad: 'from-green-500 to-emerald-700' }
];

const DEALS = [
  { title: 'Weekday Padel 20% Off', club: 'Padel Arena', code: 'PADEL20',   desc: 'Sunday–Thursday before 5 PM.',   until: 'Dec 31', badge: '-20%' },
  { title: 'Football Night: 5 JOD off', club: 'Trax Amman', code: 'TRAX5',  desc: 'Evening slots after 9 PM.',      until: 'Nov 30', badge: '-5 JOD' },
  { title: 'Welcome to PlayJo',     club: 'All clubs',   code: 'WELCOME10', desc: '10% off your first booking.',    until: 'Dec 31', badge: '-10%' }
];

/* ---------------- State ---------------- */
const state = { category: 'all', query: '', city: '', view: 'list', map: null, markers: [] };
const $$ = (id) => document.getElementById(id);

/* ---------------- Rendering ---------------- */
function renderChips() {
  $$('category-chips').innerHTML = CATEGORIES.map((c) => `
    <button data-cat="${c.id}" class="shrink-0 px-4 py-2 rounded-full border border-slate-200 bg-white text-sm font-semibold hover:border-brand-500 transition ${state.category === c.id ? 'chip-active' : ''}">
      <span class="mr-1">${c.icon}</span>${c.label}
    </button>`).join('');
}

function filtered() {
  const q = state.query.trim().toLowerCase();
  return FACILITIES.filter((f) =>
    (state.category === 'all' || f.sports.includes(state.category)) &&
    (!state.city || f.city === state.city) &&
    (!q || f.name.toLowerCase().includes(q) || f.area.toLowerCase().includes(q))
  );
}

function renderList() {
  const items = filtered();
  $$('empty-state').classList.toggle('hidden', items.length > 0);
  $$('list-view').innerHTML = items.map((f) => `
    <article class="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition">
      <div class="h-40 bg-gradient-to-br ${f.grad} relative">
        <span class="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 text-xs font-semibold">${f.tag}</span>
        <span class="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/40 text-white text-xs font-semibold">★ ${f.rating}</span>
      </div>
      <div class="p-5">
        <h3 class="font-bold text-lg">${f.name}</h3>
        <p class="text-sm text-slate-500">${f.area}, ${f.city}</p>
        <div class="mt-3 flex flex-wrap gap-1.5">
          ${f.sports.map((s) => `<span class="px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 text-xs font-semibold capitalize">${s}</span>`).join('')}
        </div>
        <div class="mt-4 flex items-center justify-between">
          <p class="text-sm text-slate-500">From <b class="text-ink text-base">${f.from} JOD</b>/hr</p>
          <a href="pages/customer/facility.html?id=${f.id}" class="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700">Book now</a>
        </div>
      </div>
    </article>`).join('');
}

function renderDeals() {
  $$('deals-grid').innerHTML = DEALS.map((d) => `
    <div class="rounded-2xl border border-dashed border-brand-500/50 bg-brand-50/50 p-5 relative">
      <span class="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-brand-600 text-white text-xs font-bold">${d.badge}</span>
      <p class="text-xs font-semibold text-brand-700">${d.club}</p>
      <h3 class="font-bold text-lg mt-1 pr-16">${d.title}</h3>
      <p class="text-sm text-slate-600 mt-1">${d.desc}</p>
      <div class="mt-4 flex items-center justify-between text-sm">
        <button data-code="${d.code}" class="copy-code px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-mono font-semibold hover:border-brand-500">${d.code}</button>
        <span class="text-slate-500">Until ${d.until}</span>
      </div>
    </div>`).join('');
}

/* ---------------- Map (Leaflet + OpenStreetMap) ---------------- */
function renderMap() {
  if (!state.map) {
    state.map = L.map('map-view').setView([31.5, 36.0], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 18
    }).addTo(state.map);
  }
  state.markers.forEach((m) => m.remove());
  state.markers = filtered().map((f) =>
    L.marker([f.lat, f.lng]).addTo(state.map).bindPopup(
      `<b>${f.name}</b><br>${f.area}, ${f.city}<br>From ${f.from} JOD/hr<br><a href="pages/customer/facility.html?id=${f.id}">Book now →</a>`
    )
  );
  if (state.markers.length) {
    state.map.fitBounds(L.featureGroup(state.markers).getBounds().pad(0.3), { maxZoom: 12 });
  }
  setTimeout(() => state.map.invalidateSize(), 50);
}

function setView(view) {
  state.view = view;
  $$('list-view').classList.toggle('hidden', view !== 'list');
  $$('map-view').classList.toggle('hidden', view !== 'map');
  $$('view-list').className = 'px-4 py-2 rounded-lg ' + (view === 'list' ? 'bg-brand-600 text-white' : 'text-slate-600');
  $$('view-map').className  = 'px-4 py-2 rounded-lg ' + (view === 'map'  ? 'bg-brand-600 text-white' : 'text-slate-600');
  if (view === 'map') renderMap();
}

function refresh() {
  renderChips();
  renderList();
  if (state.view === 'map') renderMap();
}

/* ---------------- Events ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  refresh();
  renderDeals();

  $$('category-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    state.category = b.dataset.cat;
    refresh();
  });

  $$('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.query = $$('search-input').value;
    state.city = $$('city-select').value;
    refresh();
    document.getElementById('facilities').scrollIntoView({ behavior: 'smooth' });
  });

  $$('view-list').addEventListener('click', () => setView('list'));
  $$('view-map').addEventListener('click', () => setView('map'));

  $$('deals-grid').addEventListener('click', async (e) => {
    const b = e.target.closest('.copy-code');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.code); } catch (_) {}
    showToast(`Code ${b.dataset.code} copied!`, 2500);
  });

  // After OTP success, swap the navbar buttons for the user's name
  document.addEventListener('playjo:verified', (e) => {
    const first = e.detail.name.split(' ')[0];
    $$('btn-login').classList.add('hidden');
    // Clone the button to drop the "open modal" listener, then point it at the dashboard
    const old = $$('btn-signup');
    const fresh = old.cloneNode(true);
    fresh.textContent = `Hi, ${first}`;
    fresh.addEventListener('click', () => (location.href = 'pages/customer/dashboard.html'));
    old.replaceWith(fresh);
  });
});
