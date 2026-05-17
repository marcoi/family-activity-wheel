'use strict';

const WHO_LABELS = {
  kids_only:    'Kids only',
  with_parents: 'With parents',
  with_nanny:   'With nanny',
  with_friends: 'With friends',
};

const SECTOR_COLORS = [
  '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF',
  '#FF922B', '#CC5DE8', '#20C997', '#F06595',
  '#74C0FC', '#A9E34B', '#FFB340', '#63E6BE',
];

const state = {
  time:      15,
  people:    1,
  who:       ['kids_only'],
  tags:      [],
  filtered:  [],
  winner:    null,
  spinAngle: 0,
  spinning:  false,
};

// ── Boot ──────────────────────────────────────────────────────────────────────

if (location.protocol === 'file:') {
  showScreen('file-error');
  setupCopyBtn();
} else {
  fetch('data/activities.json')
    .then(r => r.json())
    .then(init)
    .catch(() => {
      showScreen('file-error');
      setupCopyBtn();
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init(data) {
  buildChips('who-chips', Object.keys(WHO_LABELS), WHO_LABELS, state.who);

  // Pre-select 15 min
  document.querySelector('.time-btn[data-value="15"]').classList.add('selected');

  updatePeopleDisplay();

  document.getElementById('people-minus').addEventListener('click', () => {
    if (state.people > 1) { state.people--; updatePeopleDisplay(); }
  });
  document.getElementById('people-plus').addEventListener('click', () => {
    if (state.people < 8) { state.people++; updatePeopleDisplay(); }
  });

  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.time = parseInt(btn.dataset.value, 10);
    });
  });

  document.getElementById('go-btn').addEventListener('click', goToWheel);
  document.getElementById('do-spin-btn').addEventListener('click', doSpin);
  document.getElementById('wheel-back-btn').addEventListener('click', () => showScreen('inputs'));

  document.getElementById('spin-again-btn').addEventListener('click', () => {
    state.spinAngle = 0;
    state.spinning = false;
    showScreen('wheel');
  });
  document.getElementById('start-over-btn').addEventListener('click', () => showScreen('inputs'));

  // Store activities for filtering
  init._activities = data.activities;

  showScreen('inputs');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');

  if (name === 'wheel') {
    // Reset the "too few" state so a normal wheel shows correctly on Spin Again
    document.getElementById('wheel-wrap').classList.remove('hidden');
    document.getElementById('do-spin-btn').classList.remove('hidden');
    document.getElementById('too-few-msg').classList.add('hidden');
    if (state.filtered.length >= 2) drawWheel();
  }
}

function updatePeopleDisplay() {
  document.getElementById('people-count').textContent =
    state.people >= 8 ? '8+' : String(state.people);
}

function buildChips(containerId, values, labels, stateArray) {
  const container = document.getElementById(containerId);
  values.forEach(val => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (stateArray.includes(val) ? ' selected' : '');
    btn.dataset.value = val;
    btn.textContent = labels
      ? labels[val]
      : val.charAt(0).toUpperCase() + val.slice(1).replace(/-/g, ' ');
    btn.addEventListener('click', () => {
      btn.classList.toggle('selected');
      const idx = stateArray.indexOf(val);
      if (idx === -1) stateArray.push(val);
      else stateArray.splice(idx, 1);
    });
    container.appendChild(btn);
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function setupCopyBtn() {
  const btn = document.getElementById('copy-cmd');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const cmd = 'python3 -m http.server';
    navigator.clipboard.writeText(cmd).then(() => {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    }).catch(() => {
      // Fallback: select the text for manual copy
      const range = document.createRange();
      range.selectNodeContents(document.getElementById('server-cmd'));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
  });
}

// ── Filtering ─────────────────────────────────────────────────────────────────

function filterActivities() {
  const activities = init._activities || [];
  const time = state.time;
  return activities.filter(a => {
    if (a.duration_min > time) return false;
    if (state.people < a.min_people) return false;
    if (a.max_people !== null && state.people > a.max_people) return false;
    if (state.who.length > 0 && !state.who.some(w => a.who.includes(w))) return false;
    if (state.tags.length > 0 && !state.tags.some(t => a.tags.includes(t))) return false;
    return true;
  });
}

function goToWheel() {
  const all = filterActivities();

  if (all.length < 2) {
    // Show wheel screen with the "too few" message
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-wheel').classList.add('active');
    document.getElementById('wheel-wrap').classList.add('hidden');
    document.getElementById('do-spin-btn').classList.add('hidden');
    document.getElementById('too-few-msg').classList.remove('hidden');
    return;
  }

  // 6–12 items on the wheel; fewer than 6 shows all
  state.filtered = shuffle(all).slice(0, Math.min(12, all.length));
  state.spinAngle = 0;
  state.spinning = false;
  showScreen('wheel');
}

// ── Wheel drawing ─────────────────────────────────────────────────────────────

function drawWheel() {
  const canvas = document.getElementById('wheel-canvas');
  const size = clamp(Math.floor(window.innerWidth - 40), 220, 320);
  if (canvas.width !== size) {
    canvas.width = size;
    canvas.height = size;
  }

  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const R  = cx - 4;
  const n  = state.filtered.length;
  const step = (2 * Math.PI) / n;

  // Font / truncation scaled to sector count
  const fontSize = n <= 5 ? 14 : n <= 8 ? 12 : 11;
  const maxChars = n <= 5 ? 24 : n <= 8 ? 19 : 16;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(state.spinAngle);

  for (let i = 0; i < n; i++) {
    const startA = -Math.PI / 2 + i * step;
    const endA   = startA + step;
    const midA   = startA + step / 2;

    // Sector
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, startA, endA);
    ctx.closePath();
    ctx.fillStyle = SECTOR_COLORS[i % SECTOR_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label — draw along the radius, right-aligned near the rim
    ctx.save();
    ctx.rotate(midA);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.font = `bold ${fontSize}px -apple-system, system-ui, sans-serif`;
    ctx.shadowColor = 'rgba(255,255,255,0.55)';
    ctx.shadowBlur = 3;
    ctx.fillText(truncate(state.filtered[i].name, maxChars), R - 12, fontSize * 0.38);
    ctx.restore();
  }

  // Centre cap
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, 2 * Math.PI);
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

// ── Spin animation ────────────────────────────────────────────────────────────

function doSpin() {
  if (state.spinning) return;
  state.spinning = true;
  document.getElementById('do-spin-btn').disabled = true;

  const n    = state.filtered.length;
  const step = (2 * Math.PI) / n;

  // Pick a random winning sector
  const winner = Math.floor(Math.random() * n);

  // Compute the spin angle needed so winner's midpoint lands at the pointer (top, -π/2).
  //
  // After the canvas rotates by spinAngle, a point that was at angle θ in wheel-local
  // coordinates appears at θ + spinAngle on screen. We want the sector midpoint
  // (-π/2 + (winner + 0.5)*step) to land at -π/2 on screen:
  //
  //   (-π/2 + (winner+0.5)*step) + spinAngle  ≡  -π/2  (mod 2π)
  //   spinAngle ≡ -(winner+0.5)*step            (mod 2π)
  const TAU = 2 * Math.PI;
  const targetMod  = (-(winner + 0.5) * step % TAU + TAU) % TAU;
  const currentMod = (state.spinAngle % TAU + TAU) % TAU;
  let   delta      = (targetMod - currentMod + TAU) % TAU;
  if (delta < 0.15) delta += TAU;               // avoid near-zero spin

  const extraSpins = (5 + Math.floor(Math.random() * 4)) * TAU;
  const fromAngle  = state.spinAngle;
  const toAngle    = state.spinAngle + delta + extraSpins;
  const duration   = 4200;
  const t0         = performance.now();

  function frame(now) {
    const t = Math.min((now - t0) / duration, 1);
    state.spinAngle = fromAngle + (toAngle - fromAngle) * easeOutQuart(t);
    drawWheel();
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      state.spinAngle = toAngle;
      state.winner    = winner;
      state.spinning  = false;
      document.getElementById('do-spin-btn').disabled = false;
      setTimeout(showResult, 500);
    }
  }

  requestAnimationFrame(frame);
}

function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

// ── Result ────────────────────────────────────────────────────────────────────

function showResult() {
  const a = state.filtered[state.winner];

  document.getElementById('result-name').textContent = a.name;

  const durText = a.duration_min === a.duration_max
    ? `${a.duration_min} min`
    : `${a.duration_min}–${a.duration_max} min`;

  const peopleText = a.max_people === null
    ? `${a.min_people}+ people`
    : a.min_people === a.max_people
      ? `${a.min_people} ${a.min_people === 1 ? 'person' : 'people'}`
      : `${a.min_people}–${a.max_people} people`;

  document.getElementById('result-info').textContent = `${durText}  ·  ${peopleText}`;
  document.getElementById('result-badge').textContent = badgeEmoji(a);

  showScreen('result');
  launchConfetti();
}

function badgeEmoji(a) {
  if (a.tags.includes('outdoor'))     return '🌳';
  if (a.tags.includes('active'))      return '⚡';
  if (a.tags.includes('creative'))    return '🎨';
  if (a.tags.includes('learning'))    return '🧠';
  if (a.tags.includes('screen'))      return '📱';
  if (a.tags.includes('strategy'))    return '♟️';
  if (a.tags.includes('imaginative')) return '✨';
  if (a.tags.includes('messy'))       return '🎭';
  return '🎉';
}

// ── Confetti ──────────────────────────────────────────────────────────────────

function launchConfetti() {
  const colors = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF922B','#CC5DE8'];
  for (let i = 0; i < 70; i++) {
    const el   = document.createElement('div');
    const size = 6 + Math.random() * 8;
    el.className = 'confetti-piece';
    el.style.cssText = [
      `left: ${(Math.random() * 100).toFixed(1)}vw`,
      `width: ${size.toFixed(1)}px`,
      `height: ${size.toFixed(1)}px`,
      `background: ${colors[Math.floor(Math.random() * colors.length)]}`,
      `border-radius: ${Math.random() > 0.4 ? '50%' : '2px'}`,
      `animation-delay: ${(Math.random() * 0.9).toFixed(2)}s`,
      `animation-duration: ${(1.6 + Math.random() * 1.4).toFixed(2)}s`,
    ].join(';');
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}
