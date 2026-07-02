const BADGES = [
  { id: 'first_rescue', icon: '🌱', name: 'First Rescue', desc: '1 completed handoff', threshold: 1 },
  { id: 'on_a_roll', icon: '🔥', name: 'On a Roll', desc: '5 completed handoffs', threshold: 5 },
  { id: 'community_hero', icon: '🏆', name: 'Community Hero', desc: '20 completed handoffs', threshold: 20 },
  { id: 'legend', icon: '⭐', name: 'TamuFeeds Legend', desc: '50 completed handoffs', threshold: 50 }
];

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

  const badgesHtml = BADGES.map(b => {
    const unlocked = completed >= b.threshold;
    return `
      <div class="badge-card ${unlocked ? '' : 'locked'}">
        <div class="badge-icon">${b.icon}</div>
        <div class="badge-name">${b.name}</div>
        <div class="badge-desc">${b.desc}</div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="section-eyebrow">Your impact</div>
    <div class="section-heading">${data.org_name}'s progress</div>
    ${actionHtml}
    ${statsHtml}
    <div class="section-eyebrow" style="margin-top:36px;">Badges</div>
    <div class="section-heading" style="font-size:20px;margin-bottom:18px;">Milestones unlocked</div>
    <div class="badges-grid">${badgesHtml}</div>
  `;
}