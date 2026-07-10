// =========================================================
// WHAT STAYED — Dashboard
// =========================================================

import { supabase, requireAuth } from './supabaseClient.js';
import { logout } from './auth.js';
import { coverGradient, coverInitial, timeAgo, escapeHtml, toast } from './utils.js';

const els = {
  greeting: document.getElementById('greeting'),
  date: document.getElementById('today-date'),
  userName: document.getElementById('user-name'),
  userEmail: document.getElementById('user-email'),
  userAvatar: document.getElementById('user-avatar'),
  statGrid: document.getElementById('stat-grid'),
  recentSection: document.getElementById('recent-section'),
  recentRow: document.getElementById('recent-row'),
  emptyDashboard: document.getElementById('empty-dashboard'),
};

document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('logout-btn-mobile').addEventListener('click', logout);

init();

async function init() {
  const session = await requireAuth();
  if (!session) return; // requireAuth already redirected to login.html

  const user = session.user;
  renderGreeting();
  await renderUser(user);
  await renderStatsAndRecent(user.id);
}

function renderGreeting() {
  const hour = new Date().getHours();
  const time = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  els.greeting.textContent = `Good ${time}.`;
  els.date.textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

async function renderUser(user) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const name = profile?.full_name || user.email;
  els.userName.textContent = name;
  els.userEmail.textContent = user.email;
  els.userAvatar.textContent = name.trim().charAt(0).toUpperCase();
}

async function renderStatsAndRecent(userId) {
  const { data: books, error } = await supabase
    .from('books')
    .select('id, title, author, cover_path, progress_percent, is_completed, is_favorite, last_opened_at')
    .eq('owner_id', userId);

  if (error) {
    toast('Couldn\u2019t load your library. Try refreshing.', 'error');
    els.statGrid.innerHTML = '';
    return;
  }

  if (!books.length) {
    els.statGrid.style.display = 'none';
    els.recentSection.style.display = 'none';
    els.emptyDashboard.style.display = 'block';
    return;
  }

  const total = books.length;
  const currentlyReading = books.filter((b) => !b.is_completed && b.progress_percent > 0).length;
  const completed = books.filter((b) => b.is_completed).length;
  const favorites = books.filter((b) => b.is_favorite).length;

  els.statGrid.innerHTML = `
    ${statCard('Total books', total, `${books.length === 1 ? 'book' : 'books'} in your library`)}
    ${statCard('Currently reading', currentlyReading, currentlyReading ? 'in progress' : 'nothing in progress')}
    ${statCard('Completed', completed, completed ? 'finished so far' : 'none finished yet')}
    ${statCard('Favorites', favorites, favorites ? 'marked as favorite' : 'none marked yet')}
  `;

  const recent = books
    .filter((b) => b.last_opened_at)
    .sort((a, b) => new Date(b.last_opened_at) - new Date(a.last_opened_at))
    .slice(0, 6);

  if (!recent.length) {
    els.recentSection.style.display = 'none';
    return;
  }

  els.recentSection.style.display = 'block';
  const cards = await Promise.all(recent.map(recentCard));
  els.recentRow.innerHTML = cards.join('');
}

async function coverUrl(coverPath) {
  if (!coverPath) return null;
  const { data, error } = await supabase.storage
    .from('book-covers')
    .createSignedUrl(coverPath, 3600);
  return error ? null : data.signedUrl;
}

function statCard(label, value, sub) {
  return `
    <div class="stat-card">
      <div class="stat-label">${escapeHtml(label)}</div>
      <div class="stat-value">${value}</div>
      <div class="stat-sub">${escapeHtml(sub)}</div>
    </div>
  `;
}

async function recentCard(book) {
  const url = await coverUrl(book.cover_path);
  const bg = coverGradient(book.id);
  const initial = coverInitial(book.title);
  const inner = url
    ? `<img src="${url}" alt="" loading="lazy" />`
    : initial;
  return `
    <a class="recent-card" href="reader.html?book=${encodeURIComponent(book.id)}">
      <div class="recent-cover" style="background:${bg};">
        ${inner}
        <div class="recent-progress-track">
          <div class="recent-progress-fill" style="width:${book.progress_percent || 0}%;"></div>
        </div>
      </div>
      <div class="recent-title">${escapeHtml(book.title)}</div>
      <div class="recent-meta">${timeAgo(book.last_opened_at)}</div>
    </a>
  `;
}
