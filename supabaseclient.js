// =========================================================
// WHAT STAYED — Supabase client
//
// This is the single place that talks to Supabase's SDK.
// Every other script (auth.js, library.js, reader.js, ...)
// imports `supabase` from here so there's one connection
// and one source of truth for the project credentials.
//
// SETUP — replace the two values below with your own
// project's values. Find them in your Supabase dashboard
// under Project Settings > API.
// =========================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://zvffnmbttlkbswkyfpga.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_REJy0AnE5HgfOi17hhbCDw_vKkp8yZ2';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// -----------------------------------------------------------
// Shared session helpers used across pages.
// -----------------------------------------------------------

/**
 * Resolves the current session, or null if signed out.
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('getSession error:', error.message);
    return null;
  }
  return data.session;
}

/**
 * Guards a page that requires a signed-in user.
 * Call at the top of dashboard.html / library.html / reader.html.
 * Redirects to login.html if there is no active session.
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

/**
 * Guards a page meant only for signed-out visitors (login.html).
 * Redirects to dashboard.html if a session already exists.
 */
export async function redirectIfAuthed(destination = 'dashboard.html') {
  const session = await getSession();
  if (session) {
    window.location.href = destination;
  }
  return session;
}
