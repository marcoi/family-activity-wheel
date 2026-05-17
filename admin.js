'use strict';

const STORAGE_KEY = 'family-wheel-data';

const WHO_LABELS = {
  kids_only:    'Kids only',
  with_parents: 'With parents',
  with_nanny:   'With nanny',
  with_friends: 'With friends',
};

let data        = null;
let editingIdx  = null;   // null = new activity
let searchQuery = '';

const CAT_COLORS = {
  cards:        '#4263EB',
  crafts:       '#F06595',
  boardgames:   '#CC5DE8',
  puzzles:      '#F59F00',
  construction: '#FF922B',
  active:       '#2F9E44',
  books:        '#74C0FC',
  cooking:      '#FF6B6B',
  learning:     '#20C997',
  pretend:      '#845EF7',
};

// ── Boot ──────────────────────────────────────────────────────────────────────

if (location.protocol === 'file:') {
  document.getElementById('admin-app').innerHTML =
    '<p style="padding:40px;text-align:center;color:#888">Run a local server to use the admin. See README.</p>';
} else {
  loadData().then(() => { render(); setupEvents(); });
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Reject stale data that predates the categories field
      if (parsed._meta?.categories?.length > 0) {
        data = parsed;
        return;
      }
    } catch(e) {}
  }
  const r = await fetch('data/activities.json');
  data = await r.json();
  persist();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'activities.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

async function resetData() {
  if (!confirm('Discard all edits and reload from the original activities.json file?')) return;
  localStorage.removeItem(STORAGE_KEY);
  const r = await fetch('data/activities.json');
  data = await r.json();
  persist();
  render();
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  const q = searchQuery.toLowerCase();
  const items = data.activities
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => !q || a.name.toLowerCase().includes(q))
    .sort((x, y) => x.a.name.localeCompare(y.a.name));

  document.getElementById('activity-count').textContent =
    items.length === data.activities.length
      ? `${data.activities.length} activities`
      : `${items.length} of ${data.activities.length} activities`;

  const list = document.getElementById('activity-list');

  if (items.length === 0) {
    list.innerHTML = '<p class="empty">No activities match your search.</p>';
    return;
  }

  list.innerHTML = items.map(({ a, i }) => {
    const dur = a.duration_min === a.duration_max
      ? `${a.duration_min} min`
      : `${a.duration_min}–${a.duration_max} min`;
    const ppl = a.max_people === null
      ? `${a.min_people}+ people`
      : a.min_people === a.max_people
        ? `${a.min_people} ${a.min_people === 1 ? 'person' : 'people'}`
        : `${a.min_people}–${a.max_people} people`;
    const tags = a.tags.map(t => `<span class="mini-tag">${esc(t)}</span>`).join('');
    const catColor = (a.category && CAT_COLORS[a.category]) || '#aaa';
    const catBadge = a.category
      ? `<span class="cat-badge" style="--cat:${catColor}">${esc(a.category)}</span>`
      : '';
    return `
      <div class="activity-card">
        <div class="card-body">
          <div class="card-name-row">${catBadge}<span class="card-name">${esc(a.name)}</span></div>
          <div class="card-meta">${dur} · ${ppl}</div>
          <div class="card-tags">${tags}</div>
        </div>
        <button class="edit-btn" data-idx="${i}">Edit</button>
      </div>`;
  }).join('');
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Events ────────────────────────────────────────────────────────────────────

function setupEvents() {
  document.getElementById('search').addEventListener('input', e => {
    searchQuery = e.target.value;
    render();
  });

  document.getElementById('export-btn').addEventListener('click', exportJSON);
  document.getElementById('reset-btn').addEventListener('click', resetData);
  document.getElementById('add-btn').addEventListener('click', () => openModal(null));

  // Delegated edit button clicks
  document.getElementById('activity-list').addEventListener('click', e => {
    const btn = e.target.closest('.edit-btn');
    if (btn) openModal(parseInt(btn.dataset.idx, 10));
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  document.getElementById('edit-form').addEventListener('submit', e => {
    e.preventDefault();
    saveActivity();
  });

  document.getElementById('delete-btn').addEventListener('click', deleteActivity);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(idx) {
  editingIdx = idx;
  const isNew = idx === null;
  const a = isNew
    ? { name: '', duration_min: 15, duration_max: 60, min_people: 1, max_people: 4, who: ['kids_only'], tags: [], category: null }
    : { ...data.activities[idx], who: [...data.activities[idx].who], tags: [...data.activities[idx].tags] };

  document.getElementById('modal-title').textContent = isNew ? 'New activity' : 'Edit activity';
  document.getElementById('field-name').value        = a.name;
  document.getElementById('field-dur-min').value     = a.duration_min;
  document.getElementById('field-dur-max').value     = a.duration_max;
  document.getElementById('field-people-min').value  = a.min_people;
  document.getElementById('field-people-max').value  = a.max_people === null ? '' : a.max_people;

  renderCategoryRadios(a.category || null);
  renderWhoCheckboxes(a.who);
  renderTagCheckboxes(a.tags);

  // Delete button: hidden for new activities
  document.getElementById('delete-btn').style.visibility = isNew ? 'hidden' : 'visible';

  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('field-name').focus(), 60);
}

function renderCategoryRadios(selected) {
  const cats = (data._meta.categories || []);
  document.getElementById('field-category').innerHTML = cats.map(cat => {
    const color = CAT_COLORS[cat] || '#aaa';
    return `<label class="check-label cat-radio" style="--cat:${color}">
      <input type="radio" name="category" value="${esc(cat)}" ${cat === selected ? 'checked' : ''}>
      ${esc(cat)}
    </label>`;
  }).join('');
}

function renderWhoCheckboxes(checked) {
  document.getElementById('field-who').innerHTML =
    Object.entries(WHO_LABELS).map(([val, label]) =>
      checkLabel(val, label, checked.includes(val))
    ).join('');
}

function renderTagCheckboxes(checked) {
  document.getElementById('field-tags').innerHTML =
    data._meta.tags.map(tag => checkLabel(tag, tag, checked.includes(tag))).join('');

  // Wire up the "add new tag" input
  const input = document.getElementById('new-tag-input');
  input.value = '';
  input.addEventListener('keydown', onNewTagKeydown);
}

function checkLabel(val, label, isChecked) {
  return `<label class="check-label">
    <input type="checkbox" value="${esc(val)}" ${isChecked ? 'checked' : ''}>
    ${esc(label)}
  </label>`;
}

function onNewTagKeydown(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const raw = e.target.value.trim().toLowerCase().replace(/\s+/g, '-');
  if (!raw) return;
  if (data._meta.tags.includes(raw)) {
    e.target.value = '';
    return;
  }
  // Add to global tag list
  data._meta.tags.push(raw);
  // Gather currently checked tags before re-render
  const currentlyChecked = checkedValues('#field-tags');
  currentlyChecked.push(raw);
  renderTagCheckboxes(currentlyChecked);
  e.target.value = '';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingIdx = null;
}

function saveActivity() {
  const name = document.getElementById('field-name').value.trim();
  if (!name) { document.getElementById('field-name').focus(); return; }

  const durMin = pos(document.getElementById('field-dur-min').value)  || 15;
  const durMax = pos(document.getElementById('field-dur-max').value)  || durMin;
  const pplMin = pos(document.getElementById('field-people-min').value) || 1;
  const pplMaxRaw = document.getElementById('field-people-max').value.trim();
  const pplMax = pplMaxRaw === '' ? null : (pos(pplMaxRaw) || null);

  const categoryEl = document.querySelector('#field-category input:checked');

  const activity = {
    name,
    duration_min: durMin,
    duration_max: Math.max(durMin, durMax),
    min_people:   pplMin,
    max_people:   pplMax,
    who:          checkedValues('#field-who'),
    tags:         checkedValues('#field-tags'),
    category:     categoryEl ? categoryEl.value : null,
  };

  if (editingIdx === null) {
    data.activities.push(activity);
  } else {
    data.activities[editingIdx] = activity;
  }

  persist();
  render();
  closeModal();
}

function deleteActivity() {
  if (editingIdx === null) return;
  const name = data.activities[editingIdx].name;
  if (!confirm(`Delete "${name}"?\nThis cannot be undone.`)) return;
  data.activities.splice(editingIdx, 1);
  persist();
  render();
  closeModal();
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function checkedValues(selector) {
  return [...document.querySelectorAll(`${selector} input:checked`)].map(i => i.value);
}

function pos(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
