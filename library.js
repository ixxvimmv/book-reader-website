// =========================================================
// WHAT STAYED — Library
// =========================================================

import { supabase, requireAuth } from './supabaseClient.js';
import { logout } from './auth.js';
import { coverGradient, coverInitial, timeAgo, escapeHtml, toast } from './utils.js';

const state = {
  user: null,
  books: [],
  filter: 'all',
  search: '',
  sort: 'recent-added',
  editingId: null,
  deletingId: null,
};

const els = {
  userName: document.getElementById('user-name'),
  userEmail: document.getElementById('user-email'),
  userAvatar: document.getElementById('user-avatar'),
  count: document.getElementById('lib-count'),
  grid: document.getElementById('book-grid'),
  emptyLibrary: document.getElementById('empty-library'),
  noMatches: document.getElementById('no-matches'),
  search: document.getElementById('search-input'),
  sort: document.getElementById('sort-select'),
  chips: document.getElementById('filter-chips'),

  openUpload: document.getElementById('open-upload'),
  openUploadEmpty: document.getElementById('open-upload-empty'),
  uploadForm: document.getElementById('form-upload'),
  uploadAlert: document.getElementById('upload-alert'),
  fileInput: document.getElementById('file-input'),
  dropzoneFile: document.getElementById('dropzone-file'),
  dropzoneFileLabel: document.getElementById('dropzone-file-label'),
  coverInput: document.getElementById('cover-input'),
  dropzoneCover: document.getElementById('dropzone-cover'),
  dropzoneCoverLabel: document.getElementById('dropzone-cover-label'),

  editForm: document.getElementById('form-edit'),
  editAlert: document.getElementById('edit-alert'),

  confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
  deleteCopy: document.getElementById('delete-copy'),
};

let pickedBookFile = null;
let pickedCoverFile = null;

init();

async function init() {
  const session = await requireAuth();
  if (!session) return;

  state.user = session.user;
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('logout-btn-mobile').addEventListener('click', logout);

  await renderUser(state.user);
  wireToolbar();
  wireModals();
  wireUpload();

  await fetchBooks();

  document.addEventListener('click', () => closeAllMenus());

  if (new URLSearchParams(window.location.search).get('upload') === '1') {
    openModal('modal-upload-backdrop');
  }
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

// ---------------------------------------------------------
// Fetch + render
// ---------------------------------------------------------
async function fetchBooks() {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('owner_id', state.user.id);

  if (error) {
    toast('Couldn\u2019t load your library. Try refreshing.', 'error');
    return;
  }

  state.books = await Promise.all(
    data.map(async (book) => ({ ...book, _coverUrl: await coverUrl(book.cover_path) }))
  );

  render();
}

async function coverUrl(coverPath) {
  if (!coverPath) return null;
  const { data, error } = await supabase.storage
    .from('book-covers')
    .createSignedUrl(coverPath, 3600);
  return error ? null : data.signedUrl;
}

function render() {
  const total = state.books.length;
  els.count.textContent = total
    ? `${total} book${total === 1 ? '' : 's'} on your shelf`
    : 'Your shelf is empty';

  if (!total) {
    els.grid.style.display = 'none';
    els.noMatches.style.display = 'none';
    els.emptyLibrary.style.display = 'block';
    return;
  }
  els.emptyLibrary.style.display = 'none';

  let list = state.books.filter((b) => {
    if (state.filter === 'reading') return !b.is_completed && b.progress_percent > 0;
    if (state.filter === 'completed') return b.is_completed;
    if (state.filter === 'favorites') return b.is_favorite;
    return true;
  });

  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    list = list.filter(
      (b) => b.title.toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q)
    );
  }

  list = sortBooks(list, state.sort);

  if (!list.length) {
    els.grid.style.display = 'none';
    els.noMatches.style.display = 'block';
    return;
  }
  els.noMatches.style.display = 'none';
  els.grid.style.display = 'grid';
  els.grid.innerHTML = list.map(bookCardHtml).join('');
  wireCardInteractions();
}

function sortBooks(list, sort) {
  const copy = [...list];
  if (sort === 'title') return copy.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'progress') return copy.sort((a, b) => b.progress_percent - a.progress_percent);
  if (sort === 'recent-opened') {
    return copy.sort((a, b) => new Date(b.last_opened_at || 0) - new Date(a.last_opened_at || 0));
  }
  return copy.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at)); // recent-added
}

function bookCardHtml(book) {
  const bg = coverGradient(book.id);
  const cover = book._coverUrl
    ? `<img src="${book._coverUrl}" alt="" loading="lazy" />`
    : coverInitial(book.title);
  const badge = book.file_type ? book.file_type.toUpperCase() : '';
  const status = book.is_completed
    ? 'Completed'
    : book.progress_percent > 0
    ? `${Math.round(book.progress_percent)}% read`
    : 'Not started';

  return `
    <div class="book-card" data-id="${book.id}">
      <a href="reader.html?book=${encodeURIComponent(book.id)}" style="display:block;text-decoration:none;color:inherit;">
        <div class="book-cover" style="background:${bg};">
          <span class="book-badge">${badge}</span>
          ${cover}
        </div>
      </a>
      <button class="book-fav ${book.is_favorite ? 'is-fav' : ''}" data-fav="${book.id}" aria-label="${book.is_favorite ? 'Remove from favorites' : 'Add to favorites'}">${book.is_favorite ? '★' : '☆'}</button>
      <div class="book-title">${escapeHtml(book.title)}</div>
      <div class="book-author">${escapeHtml(book.author || 'Unknown author')}</div>
      <div class="book-progress-track"><div class="book-progress-fill" style="width:${book.progress_percent || 0}%;"></div></div>
      <div class="book-status">
        <span>${status}</span>
        <span>${timeAgo(book.last_opened_at)}</span>
      </div>
      <button class="book-menu-btn" data-menu="${book.id}" aria-label="Book options">⋯</button>
      <div class="book-menu" data-menu-panel="${book.id}">
        <button data-edit="${book.id}">Edit details</button>
        <button data-toggle-complete="${book.id}">${book.is_completed ? 'Mark as unread' : 'Mark as completed'}</button>
        <button class="danger" data-delete="${book.id}">Delete book</button>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------
// Card interactions (menu, favorite, edit, delete, complete)
// ---------------------------------------------------------
function wireCardInteractions() {
  els.grid.querySelectorAll('[data-menu]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.menu;
      closeAllMenus(id);
      document.querySelector(`[data-menu-panel="${id}"]`).classList.toggle('is-open');
    });
  });

  els.grid.querySelectorAll('[data-fav]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await toggleFavorite(btn.dataset.fav);
    });
  });

  els.grid.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openEditModal(btn.dataset.edit);
      closeAllMenus();
    });
  });

  els.grid.querySelectorAll('[data-toggle-complete]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await toggleCompleted(btn.dataset.toggleComplete);
      closeAllMenus();
    });
  });

  els.grid.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openDeleteModal(btn.dataset.delete);
      closeAllMenus();
    });
  });
}

function closeAllMenus(exceptId) {
  document.querySelectorAll('.book-menu.is-open').forEach((menu) => {
    if (menu.dataset.menuPanel !== exceptId) menu.classList.remove('is-open');
  });
}

async function toggleFavorite(id) {
  const book = state.books.find((b) => b.id === id);
  const next = !book.is_favorite;
  const { error } = await supabase.from('books').update({ is_favorite: next }).eq('id', id);
  if (error) return toast('Couldn\u2019t update favorite.', 'error');
  book.is_favorite = next;
  render();
}

async function toggleCompleted(id) {
  const book = state.books.find((b) => b.id === id);
  const next = !book.is_completed;
  const { error } = await supabase
    .from('books')
    .update({ is_completed: next, progress_percent: next ? 100 : book.progress_percent })
    .eq('id', id);
  if (error) return toast('Couldn\u2019t update status.', 'error');
  book.is_completed = next;
  if (next) book.progress_percent = 100;
  render();
  toast(next ? 'Marked as completed.' : 'Marked as unread.', 'success');
}

// ---------------------------------------------------------
// Toolbar: search, sort, filter chips
// ---------------------------------------------------------
function wireToolbar() {
  els.search.addEventListener('input', () => {
    state.search = els.search.value;
    render();
  });
  els.sort.addEventListener('change', () => {
    state.sort = els.sort.value;
    render();
  });
  els.chips.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      els.chips.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      state.filter = chip.dataset.filter;
      render();
    });
  });
}

// ---------------------------------------------------------
// Modals — generic open/close
// ---------------------------------------------------------
function wireModals() {
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal(backdrop.id);
    });
  });
  els.openUpload.addEventListener('click', () => openModal('modal-upload-backdrop'));
  els.openUploadEmpty.addEventListener('click', () => openModal('modal-upload-backdrop'));

  els.editForm.addEventListener('submit', handleEditSubmit);
  els.confirmDeleteBtn.addEventListener('click', handleDeleteConfirm);
}

function openModal(id) {
  document.getElementById(id).classList.add('is-open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('is-open');
}

// ---------------------------------------------------------
// Upload flow
// ---------------------------------------------------------
function wireUpload() {
  els.dropzoneFile.addEventListener('click', () => els.fileInput.click());
  els.dropzoneFile.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') els.fileInput.click();
  });
  els.fileInput.addEventListener('change', () => handleFilePicked(els.fileInput.files[0]));
  wireDropzoneDrag(els.dropzoneFile, handleFilePicked);

  els.dropzoneCover.addEventListener('click', () => els.coverInput.click());
  els.coverInput.addEventListener('change', () => handleCoverPicked(els.coverInput.files[0]));
  wireDropzoneDrag(els.dropzoneCover, handleCoverPicked);

  els.uploadForm.addEventListener('submit', handleUploadSubmit);
}

function wireDropzoneDrag(zone, handler) {
  ['dragover', 'dragleave', 'drop'].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.toggle('is-dragover', evt === 'dragover');
      if (evt === 'drop' && e.dataTransfer.files[0]) handler(e.dataTransfer.files[0]);
    });
  });
}

function handleFilePicked(file) {
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf', 'epub'].includes(ext)) {
    toast('Please choose a PDF or EPUB file.', 'error');
    return;
  }
  pickedBookFile = file;
  els.dropzoneFileLabel.innerHTML = `<strong>${escapeHtml(file.name)}</strong><div class="file-picked">Ready to upload</div>`;

  const titleField = document.getElementById('up-title');
  if (!titleField.value.trim()) {
    titleField.value = file.name
      .replace(/\.(pdf|epub)$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

function handleCoverPicked(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast('Please choose an image file for the cover.', 'error');
    return;
  }
  pickedCoverFile = file;
  els.dropzoneCoverLabel.innerHTML = `<strong>${escapeHtml(file.name)}</strong><div class="file-picked">Ready to upload</div>`;
}

async function handleUploadSubmit(event) {
  event.preventDefault();
  hideAlert(els.uploadAlert);

  const title = document.getElementById('up-title').value.trim();
  const author = document.getElementById('up-author').value.trim();
  const description = document.getElementById('up-description').value.trim();
  const collection = document.getElementById('up-collection').value.trim();

  if (!title) return showAlert(els.uploadAlert, 'Give your book a title.');
  if (!pickedBookFile) return showAlert(els.uploadAlert, 'Choose a PDF or EPUB to upload.');

  const submitBtn = els.uploadForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.dataset.loading = 'true';

  try {
    const ext = pickedBookFile.name.split('.').pop().toLowerCase();
    const fileType = ext === 'epub' ? 'epub' : 'pdf';
    const filePath = `${state.user.id}/${crypto.randomUUID()}.${ext}`;

    const { error: fileErr } = await supabase.storage
      .from('book-files')
      .upload(filePath, pickedBookFile, { upsert: false });
    if (fileErr) throw fileErr;

    let coverPath = null;
    if (pickedCoverFile) {
      const coverExt = pickedCoverFile.name.split('.').pop().toLowerCase();
      coverPath = `${state.user.id}/${crypto.randomUUID()}.${coverExt}`;
      const { error: coverErr } = await supabase.storage
        .from('book-covers')
        .upload(coverPath, pickedCoverFile, { upsert: false });
      if (coverErr) throw coverErr;
    }

    const { error: insertErr } = await supabase.from('books').insert({
      owner_id: state.user.id,
      title,
      author: author || null,
      description: description || null,
      collection: collection || null,
      file_path: filePath,
      file_type: fileType,
      cover_path: coverPath,
    });
    if (insertErr) throw insertErr;

    toast('Added to your library.', 'success');
    resetUploadForm();
    closeModal('modal-upload-backdrop');
    await fetchBooks();
  } catch (err) {
    showAlert(els.uploadAlert, err.message || 'Upload failed. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.dataset.loading = 'false';
  }
}

function resetUploadForm() {
  els.uploadForm.reset();
  pickedBookFile = null;
  pickedCoverFile = null;
  els.dropzoneFileLabel.innerHTML = '<strong>Click to choose</strong> a PDF or EPUB, or drag it here';
  els.dropzoneCoverLabel.innerHTML = '<strong>Add a cover</strong> (optional) — click or drag an image';
}

// ---------------------------------------------------------
// Edit flow
// ---------------------------------------------------------
function openEditModal(id) {
  const book = state.books.find((b) => b.id === id);
  state.editingId = id;
  document.getElementById('edit-title-input').value = book.title || '';
  document.getElementById('edit-author').value = book.author || '';
  document.getElementById('edit-description').value = book.description || '';
  document.getElementById('edit-collection').value = book.collection || '';
  hideAlert(els.editAlert);
  openModal('modal-edit-backdrop');
}

async function handleEditSubmit(event) {
  event.preventDefault();
  hideAlert(els.editAlert);

  const title = document.getElementById('edit-title-input').value.trim();
  if (!title) return showAlert(els.editAlert, 'Give your book a title.');

  const submitBtn = els.editForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.dataset.loading = 'true';

  const { error } = await supabase
    .from('books')
    .update({
      title,
      author: document.getElementById('edit-author').value.trim() || null,
      description: document.getElementById('edit-description').value.trim() || null,
      collection: document.getElementById('edit-collection').value.trim() || null,
    })
    .eq('id', state.editingId);

  submitBtn.disabled = false;
  submitBtn.dataset.loading = 'false';

  if (error) return showAlert(els.editAlert, 'Couldn\u2019t save changes. Try again.');

  closeModal('modal-edit-backdrop');
  toast('Book updated.', 'success');
  await fetchBooks();
}

// ---------------------------------------------------------
// Delete flow
// ---------------------------------------------------------
function openDeleteModal(id) {
  const book = state.books.find((b) => b.id === id);
  state.deletingId = id;
  els.deleteCopy.textContent = `"${book.title}" and its file will be permanently removed from your library. This can't be undone.`;
  openModal('modal-delete-backdrop');
}

async function handleDeleteConfirm() {
  const book = state.books.find((b) => b.id === state.deletingId);
  if (!book) return;

  els.confirmDeleteBtn.disabled = true;

  const pathsToRemove = [book.file_path];
  await supabase.storage.from('book-files').remove(pathsToRemove);
  if (book.cover_path) {
    await supabase.storage.from('book-covers').remove([book.cover_path]);
  }

  const { error } = await supabase.from('books').delete().eq('id', book.id);

  els.confirmDeleteBtn.disabled = false;
  closeModal('modal-delete-backdrop');

  if (error) return toast('Couldn\u2019t delete the book. Try again.', 'error');

  toast('Book removed.', 'success');
  await fetchBooks();
}

// ---------------------------------------------------------
// Small helpers
// ---------------------------------------------------------
function showAlert(el, message) {
  el.textContent = message;
  el.dataset.tone = 'error';
}
function hideAlert(el) {
  el.textContent = '';
  el.removeAttribute('data-tone');
}
