/* ═══════════════════════════════════════════
   AGENTFORGE — MAIN APP LOGIC
   ═══════════════════════════════════════════ */

'use strict';

// ── STATE ──────────────────────────────────
const state = {
  projects: JSON.parse(localStorage.getItem('agentforge_projects') || '[]'),
  currentPage: 'builder',
  isBuilding: false,
  plannerOut: '',
  devOut: '',
  reviewerOut: '',
  generatedCode: '',
  buildStart: 0
};

// ── SAVE TO STORAGE ────────────────────────
function saveProjects() {
  localStorage.setItem('agentforge_projects', JSON.stringify(state.projects));
}

// ── PAGE NAVIGATION ────────────────────────
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  const navLink = document.querySelector(`.nav-links a[data-page="${page}"]`);
  if (navLink) navLink.classList.add('active');

  state.currentPage = page;

  if (page === 'projects') renderProjects();
  if (page === 'about') renderAbout();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── TOAST ──────────────────────────────────
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' error' : type === 'warn' ? ' warn' : ''}`;
  el.textContent = (type === 'error' ? '✗ ' : type === 'warn' ? '⚠ ' : '✓ ') + msg;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, 3500);
}

// ── PROMPT PRESETS ─────────────────────────
const PRESETS = {
  '📋 Todo App': 'Build a beautiful todo app with add/delete/edit tasks, priority levels (high/medium/low with color coding), completion toggle, task count, filter tabs (All/Active/Done), and localStorage persistence. Dark theme.',
  '🌦 Weather UI': 'Build a weather dashboard with city search, animated weather icons using CSS/SVG, current temperature display, humidity, wind speed, 5-day forecast cards, and Celsius/Fahrenheit toggle. Beautiful gradient background.',
  '💬 Chat App': 'Build a chat interface with message bubbles (left/right), timestamps, user avatars using initials, emoji picker button, typing indicator animation, message search, and clean retro-terminal aesthetic.',
  '📊 Data Table': 'Build a sortable data table with 20 sample rows, column sort arrows, search filter, pagination (10 per page), CSV export, row selection with checkboxes, and bulk delete. Clean monospace style.',
  '🛒 Cart UI': 'Build a shopping cart with a 6-product grid, add to cart with animation, cart sidebar with quantity controls, subtotal/tax/total calculation, remove items, and checkout button. Responsive layout.',
  '⏱ Pomodoro': 'Build a Pomodoro timer with circular SVG progress ring, 25/5/15 minute modes, session counter with icons, start/pause/reset controls, break notifications, optional tick sound toggle, and motivational messages.',
  '🎮 Snake Game': 'Build a playable Snake game using HTML5 Canvas with arrow key controls, growing snake, food pellet, score counter, high score saved to localStorage, game over screen with restart, and retro green-on-black aesthetic.',
  '🔐 Password Gen': 'Build a password generator with length slider (8-64), toggles for uppercase, lowercase, numbers, symbols, generated password display with copy button, strength indicator bar, and password history (last 10). All client-side.'
};

function setPreset(el) {
  const text = el.textContent.trim();
  document.getElementById('promptInput').value = PRESETS[text] || text;
  document.getElementById('promptInput').focus();
}

// ── AI API CALL — key lives in .env on server, never in browser ──
async function callAI(system, userMsg) {
  const res = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: {
        max_tokens: 1500,
        system: system,
        messages: [{ role: 'user', content: userMsg }]
      }
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'API Error');
  return data.content.map(b => b.text || '').join('');
}

// ── STREAM TEXT TO TERMINAL ────────────────
function streamToTerminal(elId, text) {
  return new Promise(resolve => {
    const el = document.getElementById(elId);
    el.textContent = '';
    let i = 0;
    const tick = () => {
      if (i < text.length) {
        el.textContent += text[i++];
        el.scrollTop = el.scrollHeight;
        setTimeout(tick, 1.5 + Math.random() * 2.5);
      } else {
        resolve();
      }
    };
    tick();
  });
}

// ── AGENT STATE ────────────────────────────
function setAgent(name, state_) {
  const card = document.getElementById('agent-' + name);
  const led = document.getElementById('led-' + name);
  const status = document.getElementById('status-' + name);

  card.className = 'agent-card' + (state_ === 'thinking' ? ' thinking' : state_ === 'done' ? ' done' : '');
  led.className = 'status-led' + (state_ === 'thinking' ? ' thinking' : state_ === 'done' ? ' done' : '');
  status.textContent = state_ === 'thinking' ? 'PROCESSING' : state_ === 'done' ? 'DONE' : 'STANDBY';

  if (state_ === 'thinking') {
    const box = document.getElementById('terminal-' + name);
    box.innerHTML = '<span class="blink-cursor"></span>';
  }
}

function setProgress(pct) {
  document.getElementById('progressFill').style.width = pct + '%';
}

// ── MAIN BUILD FUNCTION ────────────────────
async function startBuild() {
  if (state.isBuilding) return;

  const prompt = document.getElementById('promptInput').value.trim();
  if (!prompt) { toast('Enter a prompt first!', 'warn'); return; }

  const framework = document.getElementById('frameworkSelect').value;
  const complexity = document.getElementById('complexitySelect').value;

  state.isBuilding = true;
  state.buildStart = Date.now();
  state.plannerOut = '';
  state.devOut = '';
  state.reviewerOut = '';
  state.generatedCode = '';

  const btn = document.getElementById('buildBtn');
  btn.disabled = true;
  btn.textContent = '⏳ AGENTS ACTIVE...';

  document.getElementById('outputPanel').className = 'output-panel';
  setProgress(0);

  try {
    // ── PLANNER AGENT ──────────────────────
    setAgent('planner', 'thinking');
    setProgress(8);

    const plannerSystem = `You are a senior software architect and Planner Agent. Analyze app requirements and produce a detailed build plan.

Your output format:
## COMPONENTS
List each UI component needed.

## DATA MODEL
Define state/data structures needed.

## FEATURE LIST
Numbered list of all features.

## TECH DECISIONS
Framework choices, libraries, patterns.

## IMPLEMENTATION ORDER
Step-by-step build sequence.

Be precise and thorough. This plan will be given directly to a Developer Agent.`;

    const plannerPrompt = `App to build: ${prompt}
Framework: ${framework}
Complexity: ${complexity}

Create a comprehensive architectural plan.`;

    state.plannerOut = await callAI(plannerSystem, plannerPrompt);
    await streamToTerminal('terminal-planner', state.plannerOut);
    setAgent('planner', 'done');
    setProgress(38);

    // ── DEVELOPER AGENT ────────────────────
    setAgent('dev', 'thinking');
    setProgress(45);

    const devSystem = `You are an expert frontend Developer Agent. You receive architectural plans and produce complete, working, production-ready code.

RULES:
- Output ONLY the raw code. No explanation, no markdown fences, no preamble.
- Write complete, self-contained file(s).
- Include beautiful CSS with attention to detail.
- Use modern JavaScript (ES6+).
- Add meaningful comments.
- Make it responsive.
- Make it visually impressive.`;

    const devPrompt = `ARCHITECTURAL PLAN FROM PLANNER:
${state.plannerOut}

ORIGINAL REQUIREMENT: ${prompt}
FRAMEWORK: ${framework}
COMPLEXITY: ${complexity}

Implement this completely now. Output only the raw code.`;

    state.devOut = await callAI(devSystem, devPrompt);

    // Extract code if wrapped in fences
    const codeMatch = state.devOut.match(/```(?:html|jsx|vue|js|css)?([\s\S]*?)```/);
    state.generatedCode = codeMatch ? codeMatch[1].trim() : state.devOut.trim();

    const previewOut = state.devOut.length > 700
      ? state.devOut.slice(0, 700) + `\n\n... [${Math.round(state.devOut.length / 1000)}k total chars] ...`
      : state.devOut;

    await streamToTerminal('terminal-dev', previewOut);
    setAgent('dev', 'done');
    setProgress(78);

    // ── REVIEWER AGENT ─────────────────────
    setAgent('reviewer', 'thinking');
    setProgress(84);

    const reviewerSystem = `You are a senior code Reviewer Agent. Review frontend code for quality, correctness, and best practices.

Your review format:
## OVERALL SCORE: X/10

## STRENGTHS
- List 3 specific positive things

## ISSUES FOUND
- List any bugs, anti-patterns, accessibility issues, or security concerns

## PERFORMANCE NOTES
- Loading, rendering, optimization observations

## SUGGESTIONS
- Specific, actionable improvements

## VERDICT
One sentence summary.`;

    const reviewerPrompt = `ORIGINAL REQUIREMENT: ${prompt}

CODE REVIEW TARGET (first 3000 chars):
${state.devOut.slice(0, 3000)}

Review this code thoroughly.`;

    state.reviewerOut = await callAI(reviewerSystem, reviewerPrompt);
    await streamToTerminal('terminal-reviewer', state.reviewerOut);
    setAgent('reviewer', 'done');
    setProgress(100);

    // ── SHOW OUTPUT ────────────────────────
    const elapsed = ((Date.now() - state.buildStart) / 1000).toFixed(1);
    const lines = (state.generatedCode.match(/\n/g) || []).length + 1;

    document.getElementById('codeOutput').textContent = state.generatedCode;
    document.getElementById('reviewOutput').textContent = state.reviewerOut;
    document.getElementById('planOutput').textContent = state.plannerOut;
    document.getElementById('statsRow').innerHTML = `
      <div class="stat-cell"><div class="stat-val">${lines}</div><div class="stat-lbl">Lines</div></div>
      <div class="stat-cell"><div class="stat-val">${elapsed}s</div><div class="stat-lbl">Build Time</div></div>
      <div class="stat-cell"><div class="stat-val">3</div><div class="stat-lbl">Agents</div></div>
      <div class="stat-cell"><div class="stat-val">${framework.split('/')[0].replace('Vanilla ', '')}</div><div class="stat-lbl">Framework</div></div>
    `;

    const panel = document.getElementById('outputPanel');
    panel.className = 'output-panel show';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    switchTab('code');

    // Auto-save to projects
    const proj = {
      id: Date.now(),
      name: prompt.slice(0, 40) + (prompt.length > 40 ? '...' : ''),
      prompt,
      framework,
      complexity,
      code: state.generatedCode,
      review: state.reviewerOut,
      plan: state.plannerOut,
      lines,
      elapsed,
      date: new Date().toLocaleDateString()
    };
    state.projects.unshift(proj);
    saveProjects();

    toast('Build complete! Saved to projects.', 'success');

  } catch (err) {
    console.error(err);
    toast('Error: ' + err.message, 'error');
    setAgent('planner', 'idle');
    setAgent('dev', 'idle');
    setAgent('reviewer', 'idle');
    setProgress(0);
  }

  state.isBuilding = false;
  btn.disabled = false;
  btn.textContent = '▶ LAUNCH AGENTS';
}

// ── TAB SWITCHING ──────────────────────────
function switchTab(name) {
  document.querySelectorAll('.output-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  const tab = document.querySelector(`.output-tab[data-tab="${name}"]`);
  const pane = document.getElementById('tab-' + name);
  if (tab) tab.classList.add('active');
  if (pane) pane.classList.add('active');
}

// ── COPY CODE ──────────────────────────────
function copyCode() {
  const code = state.generatedCode || document.getElementById('codeOutput').textContent;
  navigator.clipboard.writeText(code).then(() => toast('Code copied!')).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = code;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('Code copied!');
  });
}

// ── DOWNLOAD CODE ──────────────────────────
function downloadCode() {
  const code = state.generatedCode || document.getElementById('codeOutput').textContent;
  const fw = document.getElementById('frameworkSelect').value;
  const ext = fw.includes('React') ? 'jsx' : fw.includes('Vue') ? 'vue' : 'html';
  const blob = new Blob([code], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `agentforge-app.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('File downloaded!');
}

// ── PREVIEW CODE ──────────────────────────
function previewCode() {
  const code = state.generatedCode;
  if (!code) { toast('No code to preview yet', 'warn'); return; }
  const win = window.open('', '_blank');
  win.document.write(code);
  win.document.close();
  toast('Preview opened in new tab');
}

// ── PROJECTS PAGE ──────────────────────────
function renderProjects() {
  const container = document.getElementById('projects-container');
  if (!state.projects.length) {
    container.innerHTML = `
      <div class="projects-empty">
        <span class="empty-icon">📂</span>
        <div class="empty-text">No projects yet. Create your first game!</div>
        <button class="btn" onclick="navigateTo('builder')">+ CREATE PROJECT</button>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="projects-grid">${state.projects.map((p, i) => `
    <div class="project-card" onclick="loadProject(${i})">
      <div class="project-card-name">${escHtml(p.name)}</div>
      <div class="project-card-desc">${escHtml(p.prompt.slice(0, 90))}${p.prompt.length > 90 ? '...' : ''}</div>
      <div class="project-card-meta">
        <span class="project-tag">${escHtml(p.framework.split('/')[0].replace('Vanilla ', ''))}</span>
        <span>${p.lines || '?'} lines · ${p.date || ''}</span>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn btn-sm" onclick="loadProject(${i});event.stopPropagation()">LOAD</button>
        <button class="btn btn-sm btn-cyan" onclick="downloadProject(${i});event.stopPropagation()">DOWNLOAD</button>
        <button class="btn btn-sm btn-red" onclick="deleteProject(${i});event.stopPropagation()">DELETE</button>
      </div>
    </div>`).join('')}</div>`;
}

function loadProject(i) {
  const p = state.projects[i];
  if (!p) return;
  state.generatedCode = p.code;
  state.reviewerOut = p.review;
  state.plannerOut = p.plan;
  document.getElementById('promptInput').value = p.prompt;
  document.getElementById('frameworkSelect').value = p.framework;
  document.getElementById('complexitySelect').value = p.complexity;
  document.getElementById('codeOutput').textContent = p.code || '';
  document.getElementById('reviewOutput').textContent = p.review || '';
  document.getElementById('planOutput').textContent = p.plan || '';
  document.getElementById('statsRow').innerHTML = `
    <div class="stat-cell"><div class="stat-val">${p.lines || '?'}</div><div class="stat-lbl">Lines</div></div>
    <div class="stat-cell"><div class="stat-val">${p.elapsed || '?'}s</div><div class="stat-lbl">Build Time</div></div>
    <div class="stat-cell"><div class="stat-val">3</div><div class="stat-lbl">Agents</div></div>
    <div class="stat-cell"><div class="stat-val">${p.framework.split('/')[0].replace('Vanilla ', '')}</div><div class="stat-lbl">Framework</div></div>
  `;
  document.getElementById('outputPanel').className = 'output-panel show';
  navigateTo('builder');
  switchTab('code');
  toast('Project loaded!');
}

function downloadProject(i) {
  const p = state.projects[i];
  const ext = p.framework.includes('React') ? 'jsx' : p.framework.includes('Vue') ? 'vue' : 'html';
  const blob = new Blob([p.code || ''], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `project-${p.id}.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Project downloaded!');
}

function deleteProject(i) {
  state.projects.splice(i, 1);
  saveProjects();
  renderProjects();
  toast('Project deleted.', 'warn');
}

// ── ABOUT PAGE ─────────────────────────────
function renderAbout() {
  // Static, already in HTML
}

// ── NEW PROJECT MODAL ──────────────────────
function openNewProject() {
  document.getElementById('newProjectModal').classList.add('show');
  document.getElementById('newProjectPrompt').focus();
}

function closeNewProject() {
  document.getElementById('newProjectModal').classList.remove('show');
}

function confirmNewProject() {
  const prompt = document.getElementById('newProjectPrompt').value.trim();
  if (!prompt) { toast('Enter a project idea!', 'warn'); return; }
  document.getElementById('promptInput').value = prompt;
  closeNewProject();
  navigateTo('builder');
  toast('Prompt loaded. Launch agents to build!');
}

// ── CLEAR BUILDER ──────────────────────────
function clearBuilder() {
  document.getElementById('promptInput').value = '';
  document.getElementById('outputPanel').className = 'output-panel';
  setAgent('planner', 'idle');
  setAgent('dev', 'idle');
  setAgent('reviewer', 'idle');
  setProgress(0);
  state.generatedCode = '';
  const btn = document.getElementById('buildBtn');
  btn.disabled = false;
  btn.textContent = '▶ LAUNCH AGENTS';
  toast('Builder cleared.');
}

// ── UTILS ──────────────────────────────────
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── KEYBOARD SHORTCUTS ─────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.show').forEach(m => m.classList.remove('show'));
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    if (state.currentPage === 'builder') startBuild();
  }
});

// ── INIT ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  navigateTo('builder');

  // Typing effect on placeholder
  const input = document.getElementById('promptInput');
  if (input && !input.value) {
    const examples = [
      'Build a retro Snake game with neon green aesthetic...',
      'Create a Pomodoro timer with circular progress ring...',
      'Build a todo app with drag-and-drop and local storage...',
    ];
    let ei = 0;
    input.setAttribute('placeholder', examples[0]);
    setInterval(() => {
      ei = (ei + 1) % examples.length;
      input.setAttribute('placeholder', examples[ei]);
    }, 4000);
  }
});
