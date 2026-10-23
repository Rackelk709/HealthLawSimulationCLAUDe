/* =====================================================================
   app.js  -  screens and interaction.

   Reads everything it displays from window.SCENARIO (js/scenario.js).
   Student work is kept only in this browser (localStorage) and in the
   files the student downloads. Nothing is sent anywhere.
   ===================================================================== */
(function () {
  'use strict';

  const S = window.SCENARIO;
  const $ = (sel) => document.querySelector(sel);
  const app = $('#app');
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---- Stop early, with a readable message, if scenario.js is broken ---- */
  const problems = !window.SimEngine ? ['js/engine.js failed to load.'] : !window.SimReport ? ['js/report.js failed to load.'] : window.SimEngine.validateScenario(S);
  if (problems.length) {
    app.innerHTML = `<section class="config-error" role="alert"><h1>This simulation can’t start</h1>
      <p>Something in <code>js/scenario.js</code> needs fixing:</p>
      <ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></section>`;
    console.error('Scenario problems:\n- ' + problems.join('\n- '));
    return;
  }

  const c = S.config;
  const rounds = S.rounds;
  const N = rounds.length;
  const metricMeta = S.metricMeta;
  const initialState = S.initialState;
  const risks = S.riskMetrics;
  const engine = window.SimEngine.createEngine(S);
  const report = window.SimReport.createReport(S, engine);
  const key = `sim-${c.id}-v${c.version}`;
  const letter = (i) => String.fromCharCode(65 + i);
  const pad2 = (n) => String(n).padStart(2, '0');
  const minutes = Number(c.suggestedMinutes) || 0;
  const needName = !!c.participant.required;

  let state = null;
  let saved = null;
  let storageOK = true;
  let lastTick = Date.now();
  let downloading = false;

  /* ---- Saved progress -------------------------------------------------- */
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const s = JSON.parse(raw);
      if (engine.isValidSaved(s)) saved = s;
    }
  } catch (_) {
    storageOK = false;
  }

  function save() {
    if (!state) return;
    state.checkpoint = Date.now();
    try {
      localStorage.setItem(key, JSON.stringify(state));
      saved = state;
    } catch (_) {
      if (storageOK) notify('Browser saving is unavailable. Keep this tab open and download your record before leaving.', 'error');
      storageOK = false;
    }
    const el = $('#save-status');
    if (el) el.textContent = storageOK ? 'Saved in this browser' : 'This tab only';
  }

  function notify(text, type = 'success') {
    $('#message').innerHTML = text ? `<div class="${type}">${esc(text)}</div>` : '';
  }

  /* ---- Page chrome (header, bars, footer) ------------------------------- */
  function renderChrome() {
    document.title = c.siteTitle;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', c.siteDescription);
    $('#exercise-bar').innerHTML = `<span class="exercise-dot" aria-hidden="true"></span><span>${esc(c.exerciseLabel)}</span><span class="bar-rule" aria-hidden="true">/</span><span>${esc(c.exerciseNote)}</span>`;
    $('#site-header').innerHTML = `<a class="brand" href="./" aria-label="${esc(c.brand.name)} simulation home"><span class="brand-mark" aria-hidden="true">${esc(c.brand.mark)}<span>+</span></span><span>${esc(c.brand.name)}<small>${esc(c.brand.sub)}</small></span></a><div class="header-meta"><span class="live-dot" aria-hidden="true"></span> ${esc(c.headerLabel)} <span class="header-code">${esc(c.headerCode)}</span></div>`;
    $('#site-footer').innerHTML = `<span class="footer-left">${esc(c.footerLeft)}</span><span>${esc(c.footerRight)}</span>`;
    $('#restart-dialog').innerHTML = `<h2 id="restart-title">Start a new response?</h2><p>Your current decisions will be cleared from this browser. Download your completed record first if you want to keep it.</p><div class="button-row"><button class="secondary" data-action="cancel-restart">Keep my response</button><button class="danger" data-action="confirm-restart">Start over</button></div>`;
  }

  /* ---- Helpers ------------------------------------------------------------ */
  function clockText() {
    return Math.floor(state.remaining / 60) + ':' + String(state.remaining % 60).padStart(2, '0');
  }

  function focusMain() {
    $('#main').scrollIntoView({ block: 'start' });
    const h = $('#round-heading') || $('#complete-title') || $('#hero-title') || app.querySelector('h1,h2');
    if (h) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
  }

  function metricsHTML(final = false) {
    return Object.entries(metricMeta)
      .map(([k, label]) => {
        const value = state.metrics[k];
        const last = state.history[state.history.length - 1];
        const delta = final ? value - initialState[k] : last ? last.after[k] - last.before[k] : 0;
        const isRisk = risks.includes(k);
        const good = isRisk ? delta < 0 : delta > 0;
        const dir = S.metricDirections[k];
        return `<div class="metric ${isRisk ? 'risk' : ''}"><div class="metric-top"><span class="metric-name">${esc(label)}</span><span class="metric-value">${value}<small>/100</small>${
          delta ? `<span class="change ${good ? 'good' : 'bad'}">${delta > 0 ? '+' : ''}${delta}</span>` : ''
        }</span></div><div class="metric-direction">${esc(dir)}</div><div class="track" role="meter" aria-label="${esc(label)}" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100" aria-valuetext="${value} out of 100. ${esc(dir)}"><span style="width:${value}%"></span></div></div>`;
      })
      .join('');
  }

  /* ---- Landing ------------------------------------------------------------ */
  const REGION_MAP =
    '<svg class="region-map" aria-hidden="true" focusable="false" viewBox="0 0 400 400"><path d="M95 35 170 42 207 22 275 55 307 104 359 151 330 211 351 263 300 307 269 369 207 345 153 372 117 318 53 293 65 238 34 185 70 127Z" fill="#244957" stroke="#4c737b" stroke-width="1.5"/><path d="M60 225Q180 225 170 85T250 30M95 330Q200 210 333 190M64 131Q197 158 280 300" fill="none" stroke="#486b73" stroke-width="2"/><path d="m180 52 13 297M59 200l267 52" fill="none" stroke="#345965" stroke-dasharray="4 5"/><circle cx="182" cy="174" r="46" stroke="#bf9e65" fill="none" opacity=".4"/><circle cx="182" cy="174" r="6" fill="#d4ad6b"/><circle cx="251" cy="257" r="5" fill="#8eafb5"/><circle cx="110" cy="249" r="5" fill="#8eafb5"/></svg>';

  function landing() {
    state = null;
    const L = S.landing;
    const d = L.dossier;
    const p = c.participant;
    app.innerHTML = `
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-main">
        <div class="eyebrow">${esc(L.eyebrow)}</div>
        <h1 id="hero-title">${esc(L.headline.line1)}<br>${esc(L.headline.line2)} <em>${esc(L.headline.accent)}</em></h1>
        <p class="lead">${esc(L.lead)}</p>
        <ul class="hero-tags">${L.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
      <div class="hero-side">
        <div class="map-grid" aria-hidden="true"></div>${REGION_MAP}
        <div class="dossier" role="group" aria-label="Situation brief">
          <div class="dossier-top"><span>${esc(d.label)}</span><span class="alert-tag">${esc(d.tag)}</span></div>
          <h2>${esc(d.title)}</h2>
          <p>${d.lines.map(esc).join('<br>')}</p>
          <div class="brief-facts">${d.facts.map((f) => `<div><b>${esc(f.value)}</b><span>${esc(f.label)}</span></div>`).join('')}</div>
          <div class="dossier-bottom">${esc(d.footer)}</div>
        </div>
      </div>
    </section>
    <div class="landing-grid">
      <section aria-labelledby="briefing-title">
        <div class="section-title"><span class="number" aria-hidden="true">01</span><h2 id="briefing-title">${esc(L.briefingTitle)}</h2></div>
        <p class="brief-copy">${esc(L.briefingBefore)}</p>
        <div class="mission"><strong>${esc(L.mission.label)}</strong>${esc(L.mission.text)}</div>
        <p class="brief-copy">${esc(L.briefingAfter)}</p>
        <ol class="sequence" role="list" aria-label="Decision sequence">${rounds.map((r, i) => `<li><span>${pad2(i + 1)}</span><p>${esc(r.title)}</p></li>`).join('')}</ol>
        <p class="local-note">${esc(c.submission.landingNote)}</p>
      </section>
      <section class="panel setup" aria-labelledby="setup-title">
        <div class="eyebrow">${esc(L.setupEyebrow)}</div>
        <h2 id="setup-title" style="margin:12px 0">${esc(L.setupTitle)}</h2>
        ${
          saved
            ? `<div class="resume-box"><p><b>${esc(saved.participant || 'Saved simulation')}</b><br>${
                saved.phase === 'complete' ? 'Completed record available' : `Saved at decision ${saved.round + 1} of ${N}`
              }</p><button class="primary" data-action="resume">${saved.phase === 'complete' ? 'Open completed record' : 'Resume simulation'} <span aria-hidden="true">→</span></button></div>`
            : ''
        }
        <form id="start-form">
          <label for="participant">${esc(p.label)} <span class="muted">(${needName ? 'required' : 'optional'})</span></label>
          <input id="participant" name="participant" maxlength="250" placeholder="${esc(p.placeholder)}" autocomplete="name" ${needName ? 'required aria-required="true"' : ''}>
          <button class="primary full" type="submit">${esc(L.beginLabel)} <span aria-hidden="true">→</span></button>
        </form>
        ${minutes ? `<p class="fine">The ${minutes}-minute timer is a discussion guide. You can pause it, and reaching zero does not lock the activity.</p>` : ''}
        <p class="fine">${storageOK ? 'Your progress saves on this browser when storage is available. On a shared computer, use “Start over” when you are finished to remove your work from the browser.' : 'Browser saving is unavailable. Keep this tab open until you download your record.'} Indicators are fictional teaching estimates, not grades or clinical predictions.</p>
      </section>
    </div>`;
  }

  /* ---- Workspace ---------------------------------------------------------- */
  function workspace() {
    const r = rounds[state.round];
    const isResult = state.phase === 'consequence';
    const W = S.workspace;
    app.innerHTML = `
    <section class="workspace-top"><div><div class="eyebrow">${esc(W.eyebrow)}</div><h1>${esc(W.title)}</h1></div>
      ${
        minutes
          ? `<div class="top-tools"><div class="clock ${state.remaining === 0 ? 'expired' : ''}" id="clock"><span class="clock-label">${state.paused ? 'Timer paused' : 'Suggested time remaining'}</span><span id="clock-value">${clockText()}</span></div><button class="pause" data-action="pause">${state.paused ? 'Resume timer' : 'Pause timer'}</button></div>`
          : ''
      }
    </section>
    <div class="workspace">
      <nav class="rounds-nav" aria-label="Simulation progress">
        <div class="sidebar-title">RESPONSE TIMELINE</div>
        <ol class="round-list" role="list">${rounds
          .map(
            (x, i) =>
              `<li class="round-item ${i === state.round ? 'active' : i < state.round ? 'done' : ''}" ${i === state.round ? 'aria-current="step"' : ''}><span class="n" aria-hidden="true">${i < state.round ? '✓' : pad2(i + 1)}</span><span><strong>${esc(x.title)}</strong><small>${
                i < state.round ? 'Decision recorded' : i === state.round ? 'Current briefing' : 'Awaiting briefing'
              }</small></span></li>`
          )
          .join('')}</ol>
        <div class="progress" aria-hidden="true"><div style="width:${(state.history.length / N) * 100}%"></div></div>
        <div class="sidebar-bottom"><b>${state.history.length} of ${N} decisions recorded</b><br><span id="save-status">${storageOK ? 'Saved in this browser' : 'This tab only'}</span><br>One device per individual or team.<br><button class="text-button" data-action="restart">Start over</button></div>
      </nav>
      <section class="decision-card" aria-labelledby="round-heading">
        <div class="card-heading"><div class="eyebrow">Decision ${pad2(state.round + 1)} of ${pad2(N)}${isResult ? ' / Consequence briefing' : ''}</div><h2 id="round-heading">${esc(r.title)}</h2></div>
        <div class="card-body">${isResult ? outcomeHTML() : decisionHTML()}</div>
      </section>
      <aside class="metrics-panel" aria-label="Situation indicators"><div class="metrics-title">Situation indicators</div><p class="metrics-caption">Fictional estimates / 0–100<br>${state.history.length ? 'Changes reflect the last decision.' : 'Starting conditions.'} These are not grades.</p>${metricsHTML()}</aside>
    </div>`;
    if (!isResult) updateChoiceDisplay();
  }

  function decisionHTML() {
    const r = rounds[state.round];
    const W = S.workspace;
    const notes = engine.contextNotes(state.metrics);
    const customIdx = engine.customIndex(state.round);
    const minChars = c.minReasoningChars;
    const all = c.allowCustomPolicy !== false ? [...r.options, { title: W.customLabel, detail: W.customDetail }] : r.options;
    return `<span class="role-badge">Your role / ${esc(r.role)}</span>
    <p class="scenario-text">${esc(r.story)}</p>
    ${notes.map((n) => `<div class="alert">${esc(n)}</div>`).join('')}
    <div class="context"><strong>Authority &amp; context</strong>${esc(r.context)}</div>
    <p class="question" id="question-text">${esc(r.question)}</p>
    <form id="decision-form" novalidate>
      <fieldset style="border:0;padding:0;margin:0;min-width:0" aria-describedby="question-text">
        <legend class="sr-only">Choose your executive response</legend>
        <div class="choices">${all
          .map(
            (o, i) =>
              `<label class="choice ${state.selected === i ? 'selected' : ''}"><input type="radio" name="choice" value="${i}" ${state.selected === i ? 'checked' : ''}><span><strong>${letter(i)}. ${esc(o.title)}</strong><span>${esc(o.detail)}</span></span></label>`
          )
          .join('')}</div>
      </fieldset>
      <div class="custom-box" id="custom-box" ${state.selected === customIdx ? '' : 'hidden'}>
        <label for="custom-policy">Your proposed policy</label>
        <textarea id="custom-policy" maxlength="6000" placeholder="Describe your alternative or blended strategy." aria-describedby="validation">${esc(state.custom)}</textarea>
        <label for="strategy">Model consequences using</label>
        <select id="strategy">${r.options.map((o, i) => `<option value="${i}" ${state.strategy === i ? 'selected' : ''}>${esc(o.title)}</option>`).join('')}</select>
        <p class="fine">Your free-text policy is recorded, but not evaluated. Consequences follow the selected response model.</p>
      </div>
      <div class="reasoning-label"><label for="reasoning">${esc(W.reasoningLabel)}</label><span>Required · ${minChars}+ characters</span></div>
      <textarea id="reasoning" maxlength="10000" placeholder="${esc(W.reasoningPlaceholder)}" aria-describedby="validation">${esc(state.reasoning)}</textarea>
      <div id="validation" class="validation" role="alert"></div>
      <div class="decision-foot"><p>Discuss your response before submitting. Decisions are final within this run.</p><button class="primary" type="submit">Submit executive decision <span aria-hidden="true">→</span></button></div>
    </form>`;
  }

  function outcomeHTML() {
    const e = state.history[state.history.length - 1];
    return `<div class="role-badge">Decision recorded / ${esc(e.role)}</div>
    <div class="chosen-summary"><b>Your response</b>${esc(e.choice)}${e.custom ? `<p class="fine">Modeled using: ${esc(e.strategy)}. Free-text policy content is not evaluated.</p>` : ''}</div>
    <div class="outcome-tag">Immediate consequences</div>
    <p class="outcome-main">${esc(e.consequence)}</p>
    <div class="briefing-item"><h3>Stakeholder response</h3><p>${esc(e.stakeholder)}</p></div>
    <div class="briefing-item"><h3>Legal &amp; ethical considerations</h3><p>${esc(e.legal)}</p>${e.warnings.map((w) => `<div class="alert">${esc(w)}</div>`).join('')}</div>
    <div class="briefing-item"><h3>Executive reflection</h3><p class="reflection-prompt">${esc(e.prompt)}</p>
      <label for="round-reflection">Capture your team's reflection <span class="muted">(optional)</span></label>
      <textarea id="round-reflection" maxlength="8000" placeholder="What does this outcome change about your thinking?">${esc(e.reflection)}</textarea></div>
    <div class="decision-foot"><p>Your decision and reasoning are saved in the final record.</p><button class="primary" data-action="next">${state.round === N - 1 ? 'View final debrief' : 'Continue to next briefing'} <span aria-hidden="true">→</span></button></div>`;
  }

  /* ---- Completion ---------------------------------------------------------- */
  function historyHTML(e) {
    return `<details class="history"><summary>${pad2(e.round)} / ${esc(e.title)}</summary><div class="history-body"><span class="role-badge">${esc(e.role)}</span>
      <h3>Decision point</h3><p>${esc(e.question)}</p><h3>Your response</h3><p>${esc(e.choice)}</p>${e.custom ? `<p class="fine">Modeled using ${esc(e.strategy)}.</p>` : ''}
      <h3>Your reasoning</h3><p>${esc(e.reasoning)}</p><h3>Immediate consequences</h3><p>${esc(e.consequence)}</p>
      <h3>Stakeholder response</h3><p>${esc(e.stakeholder)}</p><h3>Legal and ethical considerations</h3><p>${esc(e.legal)}</p>
      ${e.warnings.length ? `<p>${esc(e.warnings.join(' '))}</p>` : ''}
      <h3>Round reflection</h3><p>${esc(e.prompt)}</p><p>${esc(e.reflection || 'No round reflection provided.')}</p></div></details>`;
  }

  function completed() {
    const sub = c.submission;
    const C = S.complete;
    app.innerHTML = `
    <section class="complete-banner" aria-labelledby="complete-title"><div><div class="eyebrow">${esc(C.eyebrow)}</div><h1 id="complete-title">${esc(C.headline)}</h1><p>${esc(C.sub)}</p></div><div class="completion-icon" aria-hidden="true">✓</div></section>
    <div class="complete-grid">
      <section aria-label="Final assessment and decision record">
        <div class="panel"><div class="eyebrow">Final situation assessment</div><p class="summary-text">${esc(engine.narrative(state.metrics))}</p>
          <div class="final-metrics">${metricsHTML(true)}</div>
          <p class="fine">Changes compare final indicators with the starting conditions. These fictional estimates do not determine a grade or a single “best” response.</p></div>
        <section class="record-preview" aria-labelledby="record-title"><h2 id="record-title">Your decision record</h2><p class="muted" style="font-size:.875rem">Review the choices and reasoning you will take into the debrief.</p>${state.history.map(historyHTML).join('')}</section>
      </section>
      <aside class="panel export-panel" aria-labelledby="export-title">
        <div class="eyebrow">Take your thinking with you</div>
        <h2 id="export-title">Download and submit</h2>
        <div class="export-name">
          <label for="export-participant">${esc(c.participant.label)} on your record <span class="muted">(${needName ? 'required' : 'optional'})</span></label>
          <input id="export-participant" maxlength="250" value="${esc(state.participant)}" autocomplete="name" aria-describedby="name-error" ${needName ? 'aria-required="true"' : ''}>
          <p class="field-error" id="name-error" role="alert"></p>
        </div>
        <p>Your record includes every scenario, decision point, selected policy, rationale, consequence, indicator change, and reflection.</p>
        <button class="primary" data-action="pdf">Download PDF <span aria-hidden="true">↓</span></button>
        <button class="secondary" data-action="text">Download text (.txt) <span aria-hidden="true">↓</span></button>
        <button class="secondary" data-action="copy">Copy text to clipboard</button>
        <button class="text-button" data-action="print">Print / save as PDF</button>
        <span id="export-status" role="status"></span>
        <div class="how-to-submit"><h3>How to submit</h3><p>${esc(sub.instructions)}</p>${
          sub.linkUrl ? `<a class="button primary" href="${esc(sub.linkUrl)}" target="_blank" rel="noopener noreferrer">${esc(sub.linkLabel)} <span class="sr-only">(opens in a new tab)</span><span aria-hidden="true">↗</span></a>` : ''
        }</div>
        <div class="debrief"><h2>Leadership debrief</h2><ol>${S.debrief.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
          <label for="final-reflection">${esc(C.reflectionLabel)} <span class="muted">(optional)</span></label>
          <textarea id="final-reflection" maxlength="15000" placeholder="${esc(C.reflectionPlaceholder)}">${esc(state.finalReflection)}</textarea>
          <p class="fine" id="save-status">${storageOK ? 'Saved in this browser' : 'This tab only'}</p></div>
        <button class="text-button" data-action="restart">Start a new simulation</button>
      </aside>
    </div>`;
    // Warm the PDF libraries so the first click is quick (ignored if offline).
    setTimeout(() => loadPdfLibs().catch(() => {}), 1200);
  }

  function render() {
    if (!state) landing();
    else if (state.phase === 'complete') completed();
    else workspace();
  }

  function updateChoiceDisplay() {
    document.querySelectorAll('.choice').forEach((x, i) => x.classList.toggle('selected', state.selected === i));
    const box = $('#custom-box');
    if (box) box.hidden = state.selected !== engine.customIndex(state.round);
  }

  /* ---- Timer ------------------------------------------------------------------ */
  function tick() {
    if (!minutes || !state || state.phase === 'complete') return;
    const now = Date.now();
    const elapsed = Math.floor((now - lastTick) / 1000);
    if (elapsed < 1) return;
    lastTick += elapsed * 1000;
    if (!state.paused && state.remaining > 0) {
      state.remaining = Math.max(0, state.remaining - elapsed);
      const cv = $('#clock-value');
      if (cv) cv.textContent = clockText();
      if (state.remaining === 0) {
        const clock = $('#clock');
        if (clock) clock.classList.add('expired');
        notify(`The suggested ${minutes} minutes have elapsed. You can continue the simulation and download your record.`);
      }
      save();
    }
  }

  /* ---- PDF libraries (loaded only when needed) ------------------------------------ */
  let libsPromise = null;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = () => reject(new Error('Could not load ' + src));
      document.head.append(el);
    });
  }
  function loadPdfLibs() {
    if (!libsPromise) {
      libsPromise = (async () => {
        if (!window.PDFLib) await loadScript('js/vendor/pdf-lib.min.js');
        if (!window.fontkit) await loadScript('js/vendor/fontkit.umd.min.js');
        if (!window.SIM_FONTS) await loadScript('js/vendor/fonts.js');
        return { PDFLib: window.PDFLib, fontkit: window.fontkit, fonts: window.SIM_FONTS };
      })().catch((e) => {
        libsPromise = null; // allow a retry
        throw e;
      });
    }
    return libsPromise;
  }

  /* ---- Export actions --------------------------------------------------------------- */
  function setStatus(text) {
    const el = $('#export-status');
    if (el) el.textContent = text;
  }

  function ensureName() {
    if (!needName || state.participant.trim()) return true;
    const input = $('#export-participant');
    const err = $('#name-error');
    if (err) err.textContent = `Enter ${c.participant.label.toLowerCase()} so your instructor can identify your record.`;
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }
    return false;
  }

  function download(bytes, type, ext) {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = report.fileName(state, ext);
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    setStatus(`Your ${ext.toUpperCase()} download has started (${a.download}).`);
  }

  async function copyText() {
    const text = report.text(state);
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      // Fallback for browsers/contexts without the async clipboard API.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand && document.execCommand('copy');
      ta.remove();
      if (!ok) throw new Error('copy failed');
    }
    setStatus('Your text record is copied. Paste it into the submission box.');
  }

  function doRestart() {
    try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
    saved = null;
    state = null;
    notify('');
    landing();
    focusMain();
  }

  /* ---- Events ------------------------------------------------------------------------ */
  document.addEventListener('input', (e) => {
    if (!state) return;
    const id = e.target.id;
    if (id === 'reasoning') state.reasoning = e.target.value;
    else if (id === 'custom-policy') state.custom = e.target.value;
    else if (id === 'round-reflection') state.history[state.history.length - 1].reflection = e.target.value;
    else if (id === 'final-reflection') state.finalReflection = e.target.value;
    else if (id === 'export-participant') {
      state.participant = e.target.value;
      e.target.removeAttribute('aria-invalid');
      const err = $('#name-error');
      if (err) err.textContent = '';
    } else return;
    if (e.target.getAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid');
    save();
  });

  document.addEventListener('change', (e) => {
    if (!state) return;
    if (e.target.name === 'choice') {
      state.selected = Number(e.target.value);
      updateChoiceDisplay();
      save();
    }
    if (e.target.id === 'strategy') {
      state.strategy = Number(e.target.value);
      save();
    }
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id === 'start-form') {
      e.preventDefault();
      const name = String(new FormData(e.target).get('participant') || '').trim();
      if (needName && !name) {
        const input = $('#participant');
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      if (saved && !confirm('Starting a new simulation will replace your saved progress in this browser. Continue?')) return;
      state = engine.initial(name);
      lastTick = Date.now();
      save();
      notify('');
      render();
      focusMain();
    }
    if (e.target.id === 'decision-form') {
      e.preventDefault();
      try {
        tick();
        state = engine.decide(state);
        save();
        notify('');
        render();
        focusMain();
      } catch (err) {
        const v = $('#validation');
        v.textContent = err.message;
        const target = err.field === 'choice' ? document.querySelector('input[name="choice"]') : document.getElementById(err.field || '');
        if (target) {
          if (target.tagName !== 'INPUT') target.setAttribute('aria-invalid', 'true');
          target.focus();
        }
      }
    }
  });

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = b.dataset.action;

    if (a === 'resume') {
      state = structuredClone(saved);
      if (state.phase !== 'complete' && !state.paused) {
        state.remaining = Math.max(0, state.remaining - Math.floor((Date.now() - state.checkpoint) / 1000));
      }
      lastTick = Date.now();
      save();
      notify('');
      render();
      focusMain();
    }
    if (a === 'pause') {
      tick();
      state.paused = !state.paused;
      lastTick = Date.now();
      save();
      $('#clock .clock-label').textContent = state.paused ? 'Timer paused' : 'Suggested time remaining';
      b.textContent = state.paused ? 'Resume timer' : 'Pause timer';
    }
    if (a === 'next') {
      tick();
      state = engine.advance(state);
      save();
      render();
      focusMain();
    }
    if (a === 'restart') {
      const dlg = $('#restart-dialog');
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else if (confirm('Start a new response? Your current decisions will be cleared from this browser.')) doRestart();
    }
    if (a === 'cancel-restart') $('#restart-dialog').close();
    if (a === 'confirm-restart') {
      $('#restart-dialog').close();
      doRestart();
    }

    if (!state || state.phase !== 'complete') return;

    if (a === 'text') {
      if (!ensureName()) return;
      save();
      download('\uFEFF' + report.text(state), 'text/plain;charset=utf-8', 'txt');
    }
    if (a === 'copy') {
      if (!ensureName()) return;
      try {
        await copyText();
      } catch (_) {
        setStatus('');
        notify('Your browser blocked copying. Use “Download text (.txt)” instead.', 'error');
      }
    }
    if (a === 'pdf') {
      if (!ensureName() || downloading) return;
      downloading = true;
      b.disabled = true;
      b.firstChild.textContent = 'Preparing PDF… ';
      setStatus('Preparing your PDF…');
      try {
        save();
        const libs = await loadPdfLibs();
        const bytes = await report.makePDF(state, libs);
        notify('');
        download(bytes, 'application/pdf', 'pdf');
      } catch (err) {
        setStatus('');
        notify('The PDF could not be created. Use “Download text (.txt)” or “Print / save as PDF” to keep your record.', 'error');
        console.error(err);
      } finally {
        downloading = false;
        b.disabled = false;
        b.firstChild.textContent = 'Download PDF ';
      }
    }
    if (a === 'print') {
      if (!ensureName()) return;
      $('#print-report').innerHTML = report.blocks(state).map(([type, text]) => `<div class="print-${type}">${esc(text)}</div>`).join('');
      window.print();
    }
  });

  window.addEventListener('pagehide', () => {
    tick();
    save();
  });

  /* ---- Start ---------------------------------------------------------------------------- */
  renderChrome();
  render();
  if (minutes) setInterval(tick, 1000);
})();
