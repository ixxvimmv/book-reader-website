// =========================================================
// WHAT STAYED — shared UI utilities
// =========================================================

const GRADIENTS = [
  ['#5B4636', '#2E241C'], // walnut
  ['#3E5641', '#1E2B20'], // forest
  ['#4A3B63', '#241C33'], // plum
  ['#2E4A5B', '#16262F'], // ink blue
  ['#6B4226', '#331F10'], // umber
  ['#4B3A2A', '#231A11'], // coffee
  ['#3A4A3E', '#1B241D'], // moss
  ['#5C3A4A', '#2C1B22'], // wine
];

/** Deterministic hash so the same book always gets the same cover treatment. */
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Returns a CSS linear-gradient() string for a placeholder cover. */
export function coverGradient(seed) {
  const [a, b] = GRADIENTS[hashString(seed) % GRADIENTS.length];
  return `linear-gradient(160deg, ${a}, ${b})`;
}

/** First letter of the title, for placeholder covers. */
export function coverInitial(title) {
  return (title || '?').trim().charAt(0).toUpperCase();
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/** "3 days ago", "just now", etc. — no external date library needed. */
export function timeAgo(isoString) {
  if (!isoString) return 'Never opened';
  const then = new Date(isoString).getTime();
  const diffSec = Math.max(0, (Date.now() - then) / 1000);

  const steps = [
    [60, 'just now', null],
    [3600, 'minute', 60],
    [86400, 'hour', 3600],
    [2592000, 'day', 86400],
    [31536000, 'month', 2592000],
  ];

  if (diffSec < 60) return 'just now';
  for (const [limit, unit, div] of steps.slice(1)) {
    if (diffSec < limit) {
      const n = Math.floor(diffSec / div);
      return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
    }
  }
  const n = Math.floor(diffSec / 31536000);
  return `${n} year${n === 1 ? '' : 's'} ago`;
}

// ---------------------------------------------------------
// Toasts — expects a <div class="toast-stack" id="toast-stack">
// to exist somewhere in the page.
// ---------------------------------------------------------
export function toast(message, tone = 'default') {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;

  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('data-tone', tone);
  el.setAttribute('role', 'status');
  el.textContent = message;
  stack.appendChild(el);

  setTimeout(() => {
    el.style.transition = 'opacity 0.25s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  }, 3200);
}
