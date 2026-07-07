// App — navigation, rendering, event wiring
const CATEGORY_ICONS = {
  'Vegetables': 'https://unpkg.com/lucide-static@latest/icons/carrot.svg',
  'Fruits': 'https://unpkg.com/lucide-static@latest/icons/apple.svg',
  'Cooked food': 'https://unpkg.com/lucide-static@latest/icons/soup.svg',
  'Grains & cereals': 'https://unpkg.com/lucide-static@latest/icons/wheat.svg',
  'Dairy': 'https://unpkg.com/lucide-static@latest/icons/milk.svg',
  'Other': 'https://unpkg.com/lucide-static@latest/icons/utensils.svg'
};

let countdownTimer = null;

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === id));
  if (id === 'browse') refreshListings();
  if (id === 'dashboard' && typeof refreshDashboard === 'function') refreshDashboard();
  if (id === 'map' && typeof refreshMap === 'function') refreshMap();
}

function routeToRoleHome(profile) {
  if (profile?.role === 'restaurant') {
    showPage('donate');
  } else {
    showPage('browse');
  }
}

function updateNavForAuth(session, profile) {
  const loggedOutEls = document.querySelectorAll('[data-auth="out"]');
  const loggedInEls = document.querySelectorAll('[data-auth="in"]');
  const donateBtn = document.getElementById('nav-donate-btn');
  const heroCta = document.getElementById('hero-cta-btn');

  loggedOutEls.forEach(el => el.style.display = session ? 'none' : '');
  loggedInEls.forEach(el => el.style.display = session ? '' : 'none');

  document.querySelectorAll('[data-role]').forEach(el => {
    if (el === donateBtn) return; // donateBtn already handled explicitly below
    el.style.display = (session && profile && el.dataset.role === profile.role) ? '' : 'none';
  });

  if (session && profile) {
    if (donateBtn) {
      donateBtn.style.display = profile.role === 'restaurant' ? '' : 'none';
    }
    document.getElementById('nav-org-name').textContent = profile.org_name;
    document.getElementById('nav-role-pill').textContent = profile.role;

    if (profile.role === 'restaurant') {
      RecurringListings.checkAndPostDue();
    }

    if (heroCta) {
      if (profile.role === 'restaurant') {
        heroCta.textContent = 'Donate';
        heroCta.dataset.page = 'donate';
      } else {
        heroCta.textContent = 'Claim';
        heroCta.dataset.page = 'browse';
      }
    }
  } else {
    if (donateBtn) {
      donateBtn.style.display = 'none';
    }
    if (heroCta) {
      heroCta.textContent = 'Get Started';
      heroCta.dataset.page = 'signup';
    }
  }
}

// ---------- Auth forms ----------
let selectedSignupRole = 'restaurant';

function initAuthForms() {
  document.querySelectorAll('.role-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.role-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedSignupRole = opt.dataset.role;
    });
  });

  document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('signup-error');
    const successEl = document.getElementById('signup-success');
    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const orgName = document.getElementById('signup-org').value.trim();
    const location = document.getElementById('signup-location').value.trim();
    const phone = document.getElementById('signup-phone').value.trim();

    const { error } = await Auth.signUp({ email, password, role: selectedSignupRole, orgName, location, phone });
    if (error) {
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
      return;
    }
    successEl.textContent = 'Account created! Check your email to confirm, then log in.';
    successEl.style.display = 'block';
    e.target.reset();
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('login-error');
    errorEl.style.display = 'none';

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const { error } = await Auth.signIn({ email, password });
    if (error) {
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
      return;
    }
    await Auth.loadProfile();
    routeToRoleHome(Auth.profile);
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await Auth.signOut();
    showPage('home');
  });

  document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('forgot-error');
    const successEl = document.getElementById('forgot-success');
    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    const email = document.getElementById('forgot-email').value.trim();
    const { error } = await Auth.requestPasswordReset(email);

    if (error) {
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
      return;
    }
    successEl.style.display = 'block';
    e.target.reset();
  });

  document.getElementById('reset-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('reset-error');
    const successEl = document.getElementById('reset-success');
    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    const newPassword = document.getElementById('reset-password-input').value;
    const { error } = await Auth.updatePassword(newPassword);

    if (error) {
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
      return;
    }
    successEl.style.display = 'block';
    e.target.reset();
    setTimeout(() => showPage('login'), 2000);
  });
}

// ---------- Donate form ----------
function initDonateForm() {
  document.getElementById('donate-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('donate-error');
    const successEl = document.getElementById('donate-success');
    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    const foodItem = document.getElementById('donate-item').value.trim();
    const quantity = document.getElementById('donate-quantity').value.trim();
    const category = document.getElementById('donate-category').value;
    const location = document.getElementById('donate-location').value.trim();
    const availableUntil = document.getElementById('donate-until').value;
    const notes = document.getElementById('donate-notes').value.trim();
    const photoFile = document.getElementById('donate-photo').files[0] || null;
    const isRecurring = document.getElementById('donate-recurring').checked;

    const { data, error } = await Listings.create({
      foodItem, quantity, category, location,
      availableUntil: new Date(availableUntil).toISOString(),
      notes, photoFile
    });

    if (error) {
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
      return;
    }

    if (isRecurring && data) {
      const durationHours = Math.max(1, Math.round((new Date(availableUntil) - Date.now()) / 3600000));
      await RecurringListings.createFromListing({
        foodItem, quantity, category, location,
        lat: data.lat, lng: data.lng, notes, durationHours
      });
    }

    successEl.style.display = 'block';
    e.target.reset();
  });
}

// ---------- Browse / listings rendering ----------
async function refreshListings() {
  try {
    await Listings.fetchAll();
    const claims = Listings.cache.flatMap(l => l.claims || []);
    await Claims.expireOverdue(claims);
    await Listings.fetchAll(); // re-fetch after any expiry updates
  } catch (err) {
    console.error('refreshListings failed', err);
  }
  renderListings();
}

function renderListings() {
  const query = document.getElementById('search-input')?.value || '';
  const category = selectedCategory;
  const onlyAvailable = document.getElementById('available-only')?.checked ?? true;

  const filtered = Listings.filter(Listings.cache, { query, category, onlyAvailable });
  const container = document.getElementById('listings-container');
  if (!container) return;

  if (smartMatchActive) {
    filtered.forEach(l => { l._matchScore = computeMatchScore(l); });
    filtered.sort((a, b) => b._matchScore - a._matchScore);
  } else if (sortByDistance && userLocation) {
    filtered.forEach(l => {
      l._distance = (l.lat != null && l.lng != null)
        ? Listings.distanceKm(userLocation.lat, userLocation.lng, l.lat, l.lng)
        : Infinity;
    });
    filtered.sort((a, b) => a._distance - b._distance);
  }

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><div class="big">🍽️</div><p>No listings match right now. Check back soon.</p></div>`;
    return;
  }

  container.innerHTML = filtered.map(l => renderListingCard(l)).join('');
  attachListingEvents();
  tickCountdowns();
}

function renderListingCard(l) {
  const claim = Listings.activeClaim(l);
  const statusBadge = {
    available: '<span class="badge">Available</span>',
    claimed: '<span class="badge claimed-badge">Claimed</span>',
    completed: '<span class="badge completed-badge">Completed</span>',
    expired: '<span class="badge expired-badge">Expired</span>'
  }[l.status] || '';

  const isNgo = Auth.isNgo();
  const isOwnListing = Auth.session && l.restaurant_id === Auth.session.user.id;
  const isClaimant = claim && Auth.session && claim.ngo_id === Auth.session.user.id;

  let actionHtml = '';
  if (l.status === 'available' && isNgo) {
    actionHtml = `<button class="claim-btn" data-action="claim" data-id="${l.id}">Claim this</button>`;
  } else if (l.status === 'claimed' && isClaimant) {
    actionHtml = `<button class="claim-btn pickup-btn" data-action="pickup" data-claim-id="${claim.id}">Mark picked up</button>`;
  } else if (l.status === 'claimed' && isOwnListing) {
    actionHtml = `<span style="font-size:12px;color:var(--text-light);">Reserved by ${claim?.ngo?.org_name || 'an NGO'}</span>`;
  }

  let countdownHtml = '';
  if (l.status === 'claimed' && claim) {
    countdownHtml = `<div class="countdown-box" data-deadline="${claim.pickup_deadline}">
      <span class="countdown-label">Pickup within:</span>
      <span class="countdown-time">--</span>
    </div>`;
  }

  const distanceHtml = Number.isFinite(l._distance) ? `<span class="badge distance-badge">${l._distance.toFixed(1)} km</span>` : '';
  const matchHtml = Number.isFinite(l._matchScore) ? `<span class="badge match-badge">🎯 ${l._matchScore}% match</span>` : '';

  const topVisual = l.photo_url
    ? `<img class="listing-photo" src="${l.photo_url}" alt="${escapeHtml(l.food_item)}">`
    : `<img class="listing-card-icon" src="${CATEGORY_ICONS[l.category] || CATEGORY_ICONS['Other']}" alt="">`;

  return `
    <div class="listing-card ${l.status}" data-listing-id="${l.id}">
      <div class="listing-card-top ${l.photo_url ? 'has-photo' : ''}">
        ${topVisual}
        <div class="badge-wrap">${statusBadge}${distanceHtml}${matchHtml}</div>
      </div>
      <div class="listing-body">
        <div class="listing-name">${escapeHtml(l.food_item)}</div>
        <div class="listing-biz">${escapeHtml(l.restaurant?.org_name || 'Unknown restaurant')}</div>
        <div class="listing-meta">
          <span>📦 ${escapeHtml(l.quantity)}</span>
          <span>📍 ${escapeHtml(l.location)}</span>
          <span>⏰ Until ${new Date(l.available_until).toLocaleString()}</span>
        </div>
        ${countdownHtml}
        <div class="listing-action">${actionHtml}</div>
      </div>
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Notifications (toasts) ----------
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'warning' ? 'warning' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

function handleRealtimeNotification(payload) {
  if (!Auth.session) return;
  const uid = Auth.session.user.id;

  if (payload.table === 'claims' && payload.eventType === 'INSERT') {
    const listing = Listings.cache.find(l => l.id === payload.new.listing_id);
    if (listing && listing.restaurant_id === uid) {
      showToast(`🎉 Your listing "${listing.food_item}" was just claimed!`);
    }
  }
}

function attachListingEvents() {
  document.querySelectorAll('[data-action="claim"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const { error } = await Claims.claim(btn.dataset.id);
      if (error) alert(error.message);
      await refreshListings();
    });
  });
  document.querySelectorAll('[data-action="pickup"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const { error } = await Claims.markPickedUp(btn.dataset.claimId);
      if (error) alert(error.message);
      await refreshListings();
    });
  });
}

function tickCountdowns() {
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    document.querySelectorAll('.countdown-box').forEach(box => {
      const deadline = box.dataset.deadline;
      const label = box.querySelector('.countdown-time');
      const text = Claims.formatCountdown(deadline);
      label.textContent = text;
      const remainingMs = new Date(deadline).getTime() - Date.now();
      box.classList.toggle('urgent', remainingMs > 0 && remainingMs < 30 * 60 * 1000);
      if (remainingMs > 0 && remainingMs < 15 * 60 * 1000 && !box.dataset.warned) {
        box.dataset.warned = 'true';
        showToast('⏰ A pickup window is about to expire — 15 minutes left!', 'warning');
      }
      if (text === 'Expired') refreshListings();
    });
  }, 1000);
}

let selectedCategory = '';
let userLocation = null;
let sortByDistance = false;
let smartMatchActive = false;
let ngoAffinity = null;

function initFilters() {
  document.getElementById('search-input')?.addEventListener('input', renderListings);
  document.getElementById('available-only')?.addEventListener('change', renderListings);

  document.querySelectorAll('#category-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#category-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedCategory = chip.dataset.category;
      renderListings();
    });
  });

  document.getElementById('near-me-btn')?.addEventListener('click', toggleNearMe);
  document.getElementById('smart-match-btn')?.addEventListener('click', toggleSmartMatch);
}

async function toggleSmartMatch() {
  const btn = document.getElementById('smart-match-btn');

  if (smartMatchActive) {
    smartMatchActive = false;
    btn.classList.remove('active');
    btn.textContent = '🎯 Smart Match';
    renderListings();
    return;
  }

  btn.textContent = 'Matching…';
  if (sortByDistance) {
    sortByDistance = false;
    const nearBtn = document.getElementById('near-me-btn');
    nearBtn.classList.remove('active');
    nearBtn.textContent = '📍 Near Me';
  }
  ngoAffinity = await Listings.getNgoAffinity(Auth.session.user.id);
  smartMatchActive = true;
  btn.classList.add('active');
  btn.textContent = '🎯 Smart Match ✓';
  renderListings();
}

function computeMatchScore(l) {
  let score = 0;

  const catAffinity = ngoAffinity?.[l.category] || 0;
  score += catAffinity * 50;

  const hoursLeft = (new Date(l.available_until) - Date.now()) / 3600000;
  if (hoursLeft > 0) {
    const urgency = Math.max(0, 1 - Math.min(hoursLeft, 12) / 12);
    score += urgency * 30;
  }

  if (userLocation && l.lat != null && l.lng != null) {
    const dist = Listings.distanceKm(userLocation.lat, userLocation.lng, l.lat, l.lng);
    const proximity = Math.max(0, 1 - Math.min(dist, 15) / 15);
    score += proximity * 20;
  }

  return Math.round(score);
}

function toggleNearMe() {
  const btn = document.getElementById('near-me-btn');

  if (sortByDistance) {
    sortByDistance = false;
    userLocation = null;
    btn.classList.remove('active');
    btn.textContent = '📍 Near Me';
    renderListings();
    return;
  }

  if (smartMatchActive) {
    smartMatchActive = false;
    const smartBtn = document.getElementById('smart-match-btn');
    smartBtn.classList.remove('active');
    smartBtn.textContent = '🎯 Smart Match';
  }

  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  btn.textContent = 'Locating...';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      sortByDistance = true;
      btn.classList.add('active');
      btn.textContent = '📍 Near Me ✓';
      renderListings();
    },
    (err) => {
      console.error('Geolocation error', err);
      alert("Couldn't get your location. Check your browser's location permission and try again.");
      btn.textContent = '📍 Near Me';
    }
  );
}

// ---------- Init ----------
document.getElementById('logo-home-link')?.addEventListener('click', () => showPage('home'));

const footerYearEl = document.getElementById('footer-year');
if (footerYearEl) footerYearEl.textContent = new Date().getFullYear();

// ---------- Home page live stats ----------
async function loadHomeStats() {
  const el = document.getElementById('home-impact-stats');
  if (!el) return;

  try {
    const [{ count: totalListings }, { count: completed }, { count: restaurants }, { count: ngos }] = await Promise.all([
      sb.from('listings').select('*', { count: 'exact', head: true }),
      sb.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'restaurant'),
      sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'ngo')
    ]);

    const nums = el.querySelectorAll('.tf-counter .num');
    nums[0].textContent = totalListings ?? '0';
    nums[1].textContent = completed ?? '0';
    nums[2].textContent = restaurants ?? '0';
    nums[3].textContent = ngos ?? '0';
  } catch (err) {
    console.error('Failed to load home stats', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });

  initAuthForms();
  initDonateForm();
  initFilters();

  Auth.init((session, profile, event) => {
    updateNavForAuth(session, profile);
    if (event === 'PASSWORD_RECOVERY') {
      showPage('reset-password');
    } else if (event === 'INITIAL_SESSION') {
      if (session && profile) {
        routeToRoleHome(profile);
      } else {
        showPage('home');
      }
      loadHomeStats();
    }
  });

  Listings.subscribeToChanges((payload) => {
    handleRealtimeNotification(payload);
    if (document.getElementById('browse')?.classList.contains('active')) {
      refreshListings();
    }
  });
});