// ============================================================
// Listings module — fetch / create / filter / realtime
// ============================================================

const Listings = {
  cache: [],

  async fetchAll() {
    const { data, error } = await sb
      .from('listings')
      .select(`
        *,
        restaurant:profiles!listings_restaurant_id_fkey ( org_name, location, phone ),
        claims ( id, ngo_id, pickup_deadline, status, ngo:profiles!claims_ngo_id_fkey ( org_name ) )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchAll listings error', error);
      return [];
    }
    this.cache = data || [];
    return this.cache;
  },

  async create({ foodItem, quantity, category, location, availableUntil, notes }) {
    if (!Auth.session) return { error: { message: 'Not logged in' } };

    const coords = await this.geocode(location);

    const { data, error } = await sb.from('listings').insert({
      restaurant_id: Auth.session.user.id,
      food_item: foodItem,
      quantity,
      category,
      location,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      available_until: availableUntil,
      notes: notes || null
    }).select().single();
    return { data, error };
  },

  // Turn a free-text location (e.g. "Westlands, Nairobi") into { lat, lng } via OSM Nominatim.
  // Returns null if geocoding fails or finds nothing — listing still gets created, just without a map pin.
  async geocode(locationText) {
    if (!locationText) return null;
    try {
      const query = /kenya/i.test(locationText) ? locationText : `${locationText}, Kenya`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (!res.ok) return null;
      const results = await res.json();
      if (!results.length) return null;
      return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
    } catch (err) {
      console.error('Geocoding failed', err);
      return null;
    }
  },

  // Active (non-expired, non-completed) claim for a listing, if any
  activeClaim(listing) {
    if (!listing.claims || !listing.claims.length) return null;
    return listing.claims.find(c => c.status === 'reserved') || null;
  },

  filter(data, { query, category, onlyAvailable }) {
    const q = (query || '').toLowerCase();
    return data.filter(l => {
      const matchesQuery = !q ||
        l.food_item.toLowerCase().includes(q) ||
        l.location.toLowerCase().includes(q) ||
        (l.restaurant?.org_name || '').toLowerCase().includes(q);
      const matchesCategory = !category || l.category === category;
      const matchesAvailability = !onlyAvailable || l.status === 'available';
      return matchesQuery && matchesCategory && matchesAvailability;
    });
  },

  // Subscribe to realtime changes on listings + claims, calling `cb` on any change
  subscribeToChanges(cb) {
    const channel = sb.channel('public:listings-and-claims')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, cb)
      .subscribe();
    return channel;
  }
};

// ============================================================
// Claims module — reserve / pickup / countdown
// ============================================================

const Claims = {
  RESERVATION_HOURS: 3, // how long an NGO has to pick up after claiming

  async claim(listingId) {
    if (!Auth.session) return { error: { message: 'Not logged in' } };
    const deadline = new Date(Date.now() + this.RESERVATION_HOURS * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb.from('claims').insert({
      listing_id: listingId,
      ngo_id: Auth.session.user.id,
      pickup_deadline: deadline
    }).select().single();
    return { data, error };
  },

  async markPickedUp(claimId) {
    const { data, error } = await sb
      .from('claims')
      .update({ status: 'picked_up' })
      .eq('id', claimId)
      .select().single();
    return { data, error };
  },

  async cancel(claimId) {
    const { data, error } = await sb
      .from('claims')
      .update({ status: 'cancelled' })
      .eq('id', claimId)
      .select().single();
    return { data, error };
  },

  // Auto-expire claims whose deadline has passed (called client-side on load/tick)
  async expireOverdue(claims) {
    const now = Date.now();
    const overdue = claims.filter(c => c.status === 'reserved' && new Date(c.pickup_deadline).getTime() < now);
    for (const c of overdue) {
      await sb.from('claims').update({ status: 'expired' }).eq('id', c.id);
    }
    return overdue.length;
  },

  formatCountdown(deadlineIso) {
    const diff = new Date(deadlineIso).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  }
};