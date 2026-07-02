// ============================================================
// Auth module — signup / login / logout / current profile
// ============================================================

const Auth = {
  session: null,
  profile: null,

 async init(onChange) {
    const { data: { session } } = await sb.auth.getSession();
    this.session = session;
    if (session) await this.loadProfile();
    onChange(this.session, this.profile, 'INITIAL_SESSION');

    sb.auth.onAuthStateChange(async (event, session) => {
      this.session = session;
      if (session) {
        await this.loadProfile();
      } else {
        this.profile = null;
      }
      onChange(this.session, this.profile, event);
    });
  },

  async loadProfile() {
    if (!this.session) return null;
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', this.session.user.id)
      .single();
    if (error) {
      console.error('Failed to load profile', error);
      return null;
    }
    this.profile = data;
    return data;
  },

  async signUp({ email, password, role, orgName, location, phone }) {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { role, org_name: orgName, location, phone }
      }
    });
    return { data, error };
  },

  async signIn({ email, password }) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    return { data, error };
  },

 async signOut() {
    await sb.auth.signOut();
  },

  async requestPasswordReset(email) {
    const { data, error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    return { data, error };
  },

  async updatePassword(newPassword) {
    const { data, error } = await sb.auth.updateUser({ password: newPassword });
    return { data, error };
  },

  async requestPasswordReset(email) {
    const { data, error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    return { data, error };
  },

  async updatePassword(newPassword) {
    const { data, error } = await sb.auth.updateUser({ password: newPassword });
    return { data, error };
  },

  isRestaurant() {
    return this.profile?.role === 'restaurant';
  },

  isNgo() {
    return this.profile?.role === 'ngo';
  }
};