// =========================================================
// WHAT STAYED — Auth
// Handles the login/register panel on login.html.
// Each signed-up user gets an isolated account; all library,
// notebook, and progress data is scoped to auth.uid() via
// Supabase Row Level Security (see /supabase/schema.sql).
// =========================================================

import { supabase, redirectIfAuthed } from './supabaseClient.js';

const els = {
  tabs: document.querySelectorAll('.auth-tab'),
  panels: {
    login: document.getElementById('panel-login'),
    register: document.getElementById('panel-register'),
  },
  loginForm: document.getElementById('form-login'),
  registerForm: document.getElementById('form-register'),
  loginAlert: document.getElementById('login-alert'),
  registerAlert: document.getElementById('register-alert'),
};

init();

async function init() {
  // If already signed in, skip straight to the dashboard.
  await redirectIfAuthed('dashboard.html');

  els.tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  els.loginForm.addEventListener('submit', handleLogin);
  els.registerForm.addEventListener('submit', handleRegister);

  // Deep-link support: login.html#register opens the register tab directly.
  if (window.location.hash === '#register') switchTab('register');
}

function switchTab(name) {
  els.tabs.forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(active));
  });
  Object.entries(els.panels).forEach(([key, panel]) => {
    panel.classList.toggle('is-active', key === name);
  });
  hideAlert(els.loginAlert);
  hideAlert(els.registerAlert);
}

// ---------------------------------------------------------
// Login
// ---------------------------------------------------------
async function handleLogin(event) {
  event.preventDefault();
  hideAlert(els.loginAlert);

  const form = event.target;
  const email = form.email.value.trim();
  const password = form.password.value;

  if (!isValidEmail(email)) {
    return showAlert(els.loginAlert, 'Enter a valid email address.', 'error');
  }
  if (!password) {
    return showAlert(els.loginAlert, 'Enter your password.', 'error');
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  setLoading(submitBtn, true);

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  setLoading(submitBtn, false);

  if (error) {
    showAlert(els.loginAlert, humanizeAuthError(error), 'error');
    return;
  }

  window.location.href = 'dashboard.html';
}

// ---------------------------------------------------------
// Register
// ---------------------------------------------------------
async function handleRegister(event) {
  event.preventDefault();
  hideAlert(els.registerAlert);

  const form = event.target;
  const fullName = form.fullName.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const confirm = form.confirmPassword.value;

  clearFieldErrors(form);

  let valid = true;
  if (fullName.length < 2) {
    setFieldError(form.fullName, 'Enter your name.');
    valid = false;
  }
  if (!isValidEmail(email)) {
    setFieldError(form.email, 'Enter a valid email address.');
    valid = false;
  }
  if (password.length < 8) {
    setFieldError(form.password, 'Use at least 8 characters.');
    valid = false;
  }
  if (confirm !== password) {
    setFieldError(form.confirmPassword, 'Passwords don\u2019t match.');
    valid = false;
  }
  if (!valid) return;

  const submitBtn = form.querySelector('button[type="submit"]');
  setLoading(submitBtn, true);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName }, // stored on the profiles row by a DB trigger
    },
  });

  setLoading(submitBtn, false);

  if (error) {
    showAlert(els.registerAlert, humanizeAuthError(error), 'error');
    return;
  }

  // If email confirmation is enabled in Supabase, there's no session yet.
  if (!data.session) {
    showAlert(
      els.registerAlert,
      'Check your inbox to confirm your email, then sign in.',
      'success'
    );
    form.reset();
    switchTab('login');
    return;
  }

  window.location.href = 'dashboard.html';
}

// ---------------------------------------------------------
// Small helpers
// ---------------------------------------------------------
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function setLoading(button, isLoading) {
  button.disabled = isLoading;
  button.dataset.loading = String(isLoading);
}

function showAlert(el, message, tone) {
  el.textContent = message;
  el.dataset.tone = tone;
}

function hideAlert(el) {
  el.textContent = '';
  el.removeAttribute('data-tone');
}

function setFieldError(input, message) {
  const field = input.closest('.field');
  field.classList.add('has-error');
  field.querySelector('.field-error').textContent = message;
}

function clearFieldErrors(form) {
  form.querySelectorAll('.field.has-error').forEach((field) => {
    field.classList.remove('has-error');
    field.querySelector('.field-error').textContent = '';
  });
}

function humanizeAuthError(error) {
  const msg = error.message || '';
  if (msg.includes('Invalid login credentials')) {
    return 'That email or password doesn\u2019t match our records.';
  }
  if (msg.includes('User already registered')) {
    return 'An account with that email already exists — try signing in instead.';
  }
  if (msg.includes('Password should be')) {
    return 'Choose a stronger password (at least 8 characters).';
  }
  return msg || 'Something went wrong. Please try again.';
}

// ---------------------------------------------------------
// Logout — imported by dashboard.js / library.js / reader.js
// ---------------------------------------------------------
export async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}
