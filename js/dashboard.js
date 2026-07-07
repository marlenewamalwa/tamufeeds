async function refreshDashboard() {
  const container = document.getElementById('dashboard-content');
  if (!container) return;

  if (!Auth.session) {
    container.innerHTML = `<div class="empty-state"><div class="big">🔒</div><p>Log in to see your impact.</p></div>`;
    return;
  }

  const { data, error } = await sb
    .from('impact_stats')
    .select('*')
    .eq('user_id', Auth.session.user.id)
    .single();

  if (error) {
    container.innerHTML = `<div class="empty-state"><div class="big">⚠️</div><p>Couldn't load your stats. Try again shortly.</p></div>`;
    console.error('dashboard fetch error', error);
    return;
  }

  const { count: platformTotal } = await sb.from('listings').select('*', { count: 'exact', head: true });

  const completed = data.completed_count || 0;
  const total = data.total_count || 0;
  const roleLabel = data.role === 'restaurant' ? 'Listings Posted' : 'Items Claimed';
  const completedLabel = data.role === 'restaurant' ? 'Handoffs Completed' : 'Successful Pickups';

 const statsHtml = `
    <div class="dash-grid">
      <div class="dash-stat"><div class="num">${total}</div><div class="label">${roleLabel}</div></div>
      <div class="dash-stat"><div class="num">${completed}</div><div class="label">${completedLabel}</div></div>
      <div class="dash-stat"><div class="num">${total ? Math.round((completed / total) * 100) : 0}%</div><div class="label">Completion Rate</div></div>
      <div class="dash-stat"><div class="num">${platformTotal ?? '—'}</div><div class="label">Total Listings on TamuFeeds</div></div>
    </div>`;

  const actionHtml = data.role === 'restaurant'
    ? `<button class="submit-btn dash-action-btn" onclick="showPage('donate')">+ Post a New Listing</button>`
    : `<button class="submit-btn dash-action-btn" onclick="showPage('browse')">Browse Available Listings</button>`;

  let recurringHtml = '';
  if (data.role === 'restaurant') {
    const templates = await RecurringListings.fetchMine();
    if (templates.length) {
      recurringHtml = `
        <div class="section-eyebrow" style="margin-top:36px;">Recurring listings</div>
        <div class="section-heading" style="font-size:20px;margin-bottom:18px;">Auto-posting daily</div>
        <div class="recurring-list">
          ${templates.map(t => `
            <div class="recurring-item">
              <div>
                <strong>${t.food_item}</strong>
                <span class="recurring-meta">${t.quantity} · ${t.location}</span>
              </div>
              <button class="btn-outline recurring-stop-btn" data-id="${t.id}" style="width:auto;padding:6px 16px;font-size:12px;">Stop repeating</button>
            </div>
          `).join('')}
        </div>`;
    }
  }

  // ---------- My Activity (listings for restaurants, claims for NGOs) ----------
  await Listings.fetchAll();
  const uid = Auth.session.user.id;
  const isRestaurant = data.role === 'restaurant';

  const myItems = isRestaurant
    ? Listings.cache.filter(l => l.restaurant_id === uid)
    : Listings.cache.filter(l => (l.claims || []).some(c => c.ngo_id === uid));

  const activityRows = myItems.map(l => {
    if (isRestaurant) {
      const activeClaim = (l.claims || []).find(c => c.status === 'reserved' || c.status === 'picked_up');
      const group = l.status === 'available' || l.status === 'claimed' ? 'active' : l.status;
      const claimedByHtml = activeClaim?.ngo?.org_name
        ? `<span class="activity-sub">Claimed by ${activeClaim.ngo.org_name}</span>` : '';
      const cancelBtn = l.status === 'available'
        ? `<button class="btn-outline activity-cancel-btn" data-id="${l.id}" style="width:auto;padding:6px 14px;font-size:12px;">Cancel</button>` : '';
      const messageBtn = activeClaim
        ? `<button class="btn-outline" data-open-chat data-claim-id="${activeClaim.id}" data-other-name="${escapeHtml(activeClaim.ngo?.org_name || 'NGO')}" style="width:auto;padding:6px 14px;font-size:12px;">💬 Message</button>` : '';
      return `
        <div class="activity-row" data-group="${group}">
          <div>
            <strong>${l.food_item}</strong>
            <span class="activity-sub">${l.quantity} · ${l.location} · ${new Date(l.created_at).toLocaleDateString()}</span>
            ${claimedByHtml}
          </div>
          <div class="activity-row-right">
            <span class="badge status-badge-${l.status}">${l.status}</span>
            ${messageBtn}
            ${cancelBtn}
          </div>
        </div>`;
    } else {
      const myClaim = (l.claims || []).find(c => c.ngo_id === uid);
      const group = myClaim.status === 'reserved' ? 'active' : (myClaim.status === 'picked_up' ? 'completed' : 'expired');
      const isOverdue = myClaim.status === 'reserved' && new Date(myClaim.pickup_deadline).getTime() < Date.now();
      const countdown = myClaim.status === 'reserved' && !isOverdue
        ? `<span class="activity-sub">⏱ ${Claims.formatCountdown(myClaim.pickup_deadline)} left</span>` : '';
      const pickupBtn = myClaim.status === 'reserved' && !isOverdue
        ? `<button class="submit-btn activity-pickup-btn" data-claim-id="${myClaim.id}" style="width:auto;padding:6px 14px;font-size:12px;">Mark picked up</button>` : '';
      const messageBtn = `<button class="btn-outline" data-open-chat data-claim-id="${myClaim.id}" data-other-name="${escapeHtml(l.restaurant?.org_name || 'Restaurant')}" style="width:auto;padding:6px 14px;font-size:12px;">💬 Message</button>`;
      return `
        <div class="activity-row" data-group="${group}">
          <div>
            <strong>${l.food_item}</strong>
            <span class="activity-sub">${l.restaurant?.org_name || 'Unknown'} · ${l.location}</span>
            ${countdown}
          </div>
          <div class="activity-row-right">
            <span class="badge status-badge-${myClaim.status}">${myClaim.status}</span>
            ${messageBtn}
            ${pickupBtn}
          </div>
        </div>`;
    }
  }).join('');

  const activityHtml = `
    <div class="section-eyebrow" style="margin-top:36px;">My activity</div>
    <div class="section-heading" style="font-size:20px;margin-bottom:14px;">${isRestaurant ? 'Your posted listings' : 'Your claims'}</div>
    <div class="activity-tabs">
      <button type="button" class="activity-tab active" data-group="all">All</button>
      <button type="button" class="activity-tab" data-group="active">Active</button>
      <button type="button" class="activity-tab" data-group="completed">Completed</button>
      <button type="button" class="activity-tab" data-group="expired">Expired</button>
    </div>
    <div class="activity-list" id="activity-list">
      ${activityRows || '<div class="empty-state" style="padding:24px 0;"><p>Nothing here yet.</p></div>'}
    </div>`;

  container.innerHTML = `
    <div class="section-eyebrow">Your impact</div>
    <div class="section-heading">${data.org_name}'s progress</div>
    ${actionHtml}
    ${statsHtml}
    ${recurringHtml}
    ${activityHtml}
  `;

  container.querySelectorAll('.recurring-stop-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await RecurringListings.stop(btn.dataset.id);
      refreshDashboard();
    });
  });

  container.querySelectorAll('.activity-cancel-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await Listings.cancelListing(btn.dataset.id);
      refreshDashboard();
    });
  });

  container.querySelectorAll('.activity-pickup-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await Claims.markPickedUp(btn.dataset.claimId);
      refreshDashboard();
    });
  });

  container.querySelectorAll('.activity-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.activity-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const group = tab.dataset.group;
      container.querySelectorAll('.activity-row').forEach(row => {
        row.style.display = (group === 'all' || row.dataset.group === group) ? 'flex' : 'none';
      });
    });
  });
}