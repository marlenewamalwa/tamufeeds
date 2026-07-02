// App — navigation, rendering, event wiring
const CATEGORY_EMOJI = {
  'Vegetables': '🥬', 'Fruits': '🍎', 'Cooked food': '🍲',
  'Grains & cereals': '🌾', 'Dairy': '🥛', 'Other': '🍽️'
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

function updateNavForAuth(session, profile) {
  const loggedOutEls = document.querySelectorAll('[data-auth="out"]');
  const loggedInEls = document.querySelectorAll('[data-auth="in"]');
  const donateBtn = document.getElementById('nav-donate-btn');
  const heroCta = document.getElementById('hero-cta-btn');

  loggedOutEls.forEach(el => el.style.display = session ? 'none' : '');
  loggedInEls.forEach(el => el.style.display = session ? '' : 'none');

  if (session && profile) {
    if (donateBtn) {
      donateBtn.style.display = profile.role === 'restaurant' ? '' : 'none';
    }
    document.getElementById('nav-org-name').textContent = profile.org_name;
    document.getElementById('nav-role-pill').textContent = profile.role;

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
    showPage('browse');
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

    const { error } = await Listings.create({
      foodItem, quantity, category, location,
      availableUntil: new Date(availableUntil).toISOString(),
      notes
    });

    if (error) {
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
      return;
    }
    successEl.style.display = 'block';
    e.target.reset();
  });
}

// ---------- Browse / listings rendering ----------
async function refreshListings() {
  await Listings.fetchAll();
  const claims = Listings.cache.flatMap(l => l.claims || []);
  await Claims.expireOverdue(claims);
  await Listings.fetchAll(); // re-fetch after any expiry updates
  renderListings();
}

function renderListings() {
  const query = document.getElementById('search-input')?.value || '';
  const category = selectedCategory;
  const onlyAvailable = document.getElementById('available-only')?.checked ?? true;

  const filtered = Listings.filter(Listings.cache, { query, category, onlyAvailable });
  const container = document.getElementById('listings-container');
  if (!container) return;

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

  return `
    <div class="listing-card ${l.status}" data-listing-id="${l.id}">
      <div class="listing-card-top">
        <div class="listing-emoji">${CATEGORY_EMOJI[l.category] || '🍽️'}</div>
        ${statusBadge}
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
      if (text === 'Expired') refreshListings();
    });
  }, 1000);
}

let selectedCategory = '';

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
}

// ---------- Init ----------
document.getElementById('logo-home-link')?.addEventListener('click', () => showPage('home'));

const footerYearEl = document.getElementById('footer-year');
if (footerYearEl) footerYearEl.textContent = new Date().getFullYear();

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
    }
  });

  Listings.subscribeToChanges(() => {
    if (document.getElementById('browse')?.classList.contains('active')) {
      refreshListings();
    }
  });

  showPage('home');
});