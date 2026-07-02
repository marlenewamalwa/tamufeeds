// ============================================================
// Supabase client setup
// ============================================================
const SUPABASE_URL = 'https://bbwnleiyunzsmjrarkuy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJid25sZWl5dW56c21qcmFya3V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MTY0ODcsImV4cCI6MjA5ODQ5MjQ4N30.iZDrmet1CsuAP0y3NIv2QV52gHABYtViKQIfgI4r1S8';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
