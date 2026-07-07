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

 async create({ foodItem, quantity, category, location, availableUntil, notes, photoFile }) {
    if (!Auth.session) return { error: { message: 'Not logged in' } };
    if (!photoFile) return { error: { message: 'Please attach a photo of the food.' } };

    const coords = await this.geocode(location);
    const photoUrl = await this.uploadPhoto(photoFile);
    if (!photoUrl) {
      return { error: { message: 'Photo upload failed. Please try a different image or check your connection.' } };
    }

    const { data, error } = await sb.from('listings').insert({
      restaurant_id: Auth.session.user.id,
      food_item: foodItem,
      quantity,
      category,
      location,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      available_until: availableUntil,
      notes: notes || null,
      photo_url: photoUrl
    }).select().single();
    return { data, error };
  },

  // Uploads a listing photo to Supabase Storage and returns its public URL (or null on failure)
  async uploadPhoto(file) {
    try {
      const ext = file.name.split('.').pop();
      const path = `${Auth.session.user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await sb.storage.from('listing-photos').upload(path, file);
      if (uploadError) {
        console.error('Photo upload failed', uploadError);
        return null;
      }
      const { data } = sb.storage.from('listing-photos').getPublicUrl(path);
      return data?.publicUrl || null;
    } catch (err) {
      console.error('Photo upload failed', err);
      return null;
    }
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

  // Straight-line distance in km between two lat/lng points (haversine formula)
  // Tally which categories this NGO has claimed most in the past, for smart-match scoring
  async getNgoAffinity(ngoId) {
    const { data, error } = await sb
      .from('claims')
      .select('listing:listings(category)')
      .eq('ngo_id', ngoId);

    if (error) {
      console.error('getNgoAffinity error', error);
      return {};
    }

    const counts = {};
    let total = 0;
    (data || []).forEach(c => {
      const cat = c.listing?.category;
      if (!cat) return;
      counts[cat] = (counts[cat] || 0) + 1;
      total++;
    });

    const affinity = {};
    Object.keys(counts).forEach(cat => {
      affinity[cat] = counts[cat] / total;
    });
    return affinity; // e.g. { 'Cooked food': 0.6, 'Dairy': 0.4 }
  },

  distanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  },

  async cancelListing(id) {
    const { error } = await sb.from('listings').update({ status: 'expired' }).eq('id', id);
    return { error };
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
// Recurring Listings module — daily-repeat templates for restaurants
// ============================================================

const RecurringListings = {
  async createFromListing({ foodItem, quantity, category, location, lat, lng, notes, durationHours }) {
    if (!Auth.session) return { error: { message: 'Not logged in' } };
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await sb.from('recurring_listings').insert({
      restaurant_id: Auth.session.user.id,
      food_item: foodItem,
      quantity,
      category,
      location,
      lat: lat ?? null,
      lng: lng ?? null,
      notes: notes || null,
      duration_hours: durationHours,
      last_posted_date: today
    }).select().single();
    return { data, error };
  },

  async fetchMine() {
    if (!Auth.session) return [];
    const { data, error } = await sb
      .from('recurring_listings')
      .select('*')
      .eq('restaurant_id', Auth.session.user.id)
      .eq('active', true)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('fetchMine recurring listings error', error);
      return [];
    }
    return data || [];
  },

  async stop(id) {
    const { error } = await sb.from('recurring_listings').update({ active: false }).eq('id', id);
    return { error };
  },

  // Checks this restaurant's active templates and posts today's listing for any not yet posted today.
  // Safe to call on every page load — it no-ops if everything is already posted for today.
  async checkAndPostDue() {
    if (!Auth.session) return;
    const today = new Date().toISOString().slice(0, 10);
    const templates = await this.fetchMine();
    const due = templates.filter(t => t.last_posted_date !== today);

    for (const t of due) {
      const availableUntil = new Date(Date.now() + t.duration_hours * 60 * 60 * 1000).toISOString();
      await sb.from('listings').insert({
        restaurant_id: t.restaurant_id,
        food_item: t.food_item,
        quantity: t.quantity,
        category: t.category,
        location: t.location,
        lat: t.lat,
        lng: t.lng,
        available_until: availableUntil,
        notes: t.notes
      });
      await sb.from('recurring_listings').update({ last_posted_date: today }).eq('id', t.id);
    }
    return due.length;
  }
};

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