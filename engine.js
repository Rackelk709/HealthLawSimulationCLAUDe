/* =====================================================================
   engine.js  -  simulation logic (no DOM, no scenario text).

   Reads the scenario from scenario.js and provides:
     validateScenario(S)  -> list of plain-language problems ([] if fine)
     createEngine(S)      -> { initial, decide, advance, isValidSaved, ... }

   The scoring rules match the original Redwood Valley simulation:
   1. indicators before the decision are recorded;
   2. situation-dependent modifiers (scenario.rules.modifiers) are applied;
   3. the chosen option's own `effects` are added;
   4. every indicator is clamped to 0-100.
   ===================================================================== */
(function (root) {
  'use strict';

  const clamp = (n) => Math.max(0, Math.min(100, n));
  const letter = (i) => String.fromCharCode(65 + i);

  /** Error that remembers which form field should receive focus. */
  function FormError(message, field) {
    const e = new Error(message);
    e.field = field;
    return e;
  }

  function validateScenario(S) {
    const problems = [];
    const add = (m) => problems.push(m);
    if (!S || typeof S !== 'object') return ['js/scenario.js did not define window.SCENARIO.'];

    const cfg = S.config || {};
    if (!cfg.id) add('config.id is missing.');
    if (!cfg.report || !cfg.report.fileSlug) add('config.report.fileSlug is missing.');

    const keys = Object.keys(S.metricMeta || {});
    if (!keys.length) add('metricMeta must list at least one indicator.');
    for (const k of keys) {
      const v = (S.initialState || {})[k];
      if (typeof v !== 'number' || v < 0 || v > 100) add(`initialState.${k} must be a number from 0 to 100.`);
      if (!(S.metricDirections || {})[k]) add(`metricDirections.${k} is missing.`);
    }
    for (const k of Object.keys(S.initialState || {})) {
      if (!keys.includes(k)) add(`initialState.${k} has no matching entry in metricMeta.`);
    }
    for (const k of S.riskMetrics || []) {
      if (!keys.includes(k)) add(`riskMetrics lists "${k}", which is not in metricMeta.`);
    }

    if (!Array.isArray(S.rounds) || !S.rounds.length) add('rounds must contain at least one decision.');
    (S.rounds || []).forEach((r, i) => {
      const where = `Decision ${i + 1}`;
      for (const f of ['title', 'role', 'story', 'context', 'question']) {
        if (!r[f]) add(`${where}: "${f}" is missing.`);
      }
      if (!Array.isArray(r.options) || r.options.length < 2 || r.options.length > 5) {
        add(`${where}: needs between 2 and 5 options.`);
        return;
      }
      r.options.forEach((o, j) => {
        const w = `${where}, option ${letter(j)}`;
        for (const f of ['title', 'detail', 'result', 'stakeholder', 'legal', 'reflection']) {
          if (!o[f]) add(`${w}: "${f}" is missing.`);
        }
        for (const k of keys) {
          if (!o.effects || typeof o.effects[k] !== 'number') add(`${w}: effects.${k} must be a number.`);
        }
        for (const k of Object.keys(o.effects || {})) {
          if (!keys.includes(k)) add(`${w}: effects.${k} is not a listed indicator.`);
        }
      });
    });

    const rules = S.rules || {};
    for (const f of ['contextNotes', 'modifiers', 'narrative']) {
      if (typeof rules[f] !== 'function') add(`rules.${f} must be a function.`);
    }
    if (!Array.isArray(S.debrief)) add('debrief must be a list of questions.');
    return problems;
  }

  function createEngine(S) {
    const rounds = S.rounds;
    const cfg = S.config;
    const rules = S.rules;
    const metricKeys = Object.keys(S.metricMeta);
    const minChars = Number.isInteger(cfg.minReasoningChars) ? cfg.minReasoningChars : 20;
    const allowCustom = cfg.allowCustomPolicy !== false;
    const minutes = Number(cfg.suggestedMinutes) || 0;

    /** Default "model consequences using" choice for a custom policy: the middle option. */
    const defaultStrategy = (roundIndex) => Math.floor(rounds[Math.min(roundIndex, rounds.length - 1)].options.length / 2);

    function initial(participant) {
      return {
        version: 1,
        scenarioId: cfg.id,
        scenarioVersion: cfg.version,
        participant,
        started: new Date().toISOString(),
        completed: null,
        round: 0,
        phase: 'decision',
        selected: null,
        reasoning: '',
        custom: '',
        strategy: defaultStrategy(0),
        metrics: { ...S.initialState },
        history: [],
        remaining: minutes * 60,
        paused: false,
        checkpoint: Date.now(),
        finalReflection: '',
      };
    }

    function decide(state) {
      if (state.phase !== 'decision' || state.history.length !== state.round) {
        throw FormError('This decision has already been submitted.');
      }
      const round = rounds[state.round];
      const n = round.options.length;
      const customIndex = n;
      const valid = allowCustom ? n + 1 : n;
      if (!Number.isInteger(state.selected) || state.selected < 0 || state.selected >= valid) {
        throw FormError('Choose a response before submitting your decision.', 'choice');
      }
      if (state.reasoning.trim().length < minChars) {
        throw FormError(`Explain your legal and ethical reasoning in at least ${minChars} characters.`, 'reasoning');
      }
      const isCustom = state.selected === customIndex;
      if (isCustom && state.custom.trim().length < minChars) {
        throw FormError(`Describe your alternative policy in at least ${minChars} characters.`, 'custom-policy');
      }
      const index = isCustom ? Number(state.strategy) : state.selected;
      if (!Number.isInteger(index) || index < 0 || index >= n) {
        throw FormError('Choose a modeled approach for your policy.', 'strategy');
      }

      const option = round.options[index];
      const before = { ...state.metrics };
      const after = { ...before };

      // Situation-dependent consequences first, then the option's own effects.
      const mod = rules.modifiers(before, index, state.round) || {};
      const warnings = [...(mod.warnings || [])];
      for (const [k, d] of Object.entries(mod.adjust || {})) {
        if (k in after) after[k] = clamp(after[k] + d);
      }
      for (const k of metricKeys) after[k] = clamp(after[k] + option.effects[k]);

      const entry = {
        round: state.round + 1,
        title: round.title,
        role: round.role,
        story: round.story,
        context: round.context,
        contextNotes: rules.contextNotes(before),
        question: round.question,
        options: round.options.map((o) => ({ title: o.title, detail: o.detail })),
        selected: state.selected,
        choice: isCustom ? 'Alternative policy: ' + state.custom.trim() : option.title,
        custom: isCustom ? state.custom.trim() : '',
        strategy: option.title,
        reasoning: state.reasoning.trim(),
        before,
        after,
        consequence: option.result,
        stakeholder: option.stakeholder,
        legal: option.legal,
        prompt: option.reflection,
        reflection: '',
        warnings,
      };
      return { ...state, phase: 'consequence', metrics: after, history: [...state.history, entry] };
    }

    function advance(s) {
      if (s.phase !== 'consequence') return s;
      if (s.round === rounds.length - 1) {
        return { ...s, phase: 'complete', completed: new Date().toISOString() };
      }
      return {
        ...s,
        round: s.round + 1,
        phase: 'decision',
        selected: null,
        reasoning: '',
        custom: '',
        strategy: defaultStrategy(s.round + 1),
      };
    }

    /** True only for saved state that belongs to this scenario and is internally consistent. */
    function isValidSaved(s) {
      try {
        if (!s || typeof s !== 'object') return false;
        if (s.version !== 1 || s.scenarioId !== cfg.id || s.scenarioVersion !== cfg.version) return false;
        if (!['decision', 'consequence', 'complete'].includes(s.phase)) return false;
        if (!Number.isInteger(s.round) || s.round < 0 || s.round >= rounds.length) return false;
        if (!Array.isArray(s.history)) return false;
        const expected = s.phase === 'decision' ? s.round : s.round + 1;
        if (s.history.length !== expected) return false;
        if (s.phase === 'complete' && s.round !== rounds.length - 1) return false;
        if (!s.metrics || !metricKeys.every((k) => Number.isFinite(s.metrics[k]))) return false;
        for (const f of ['participant', 'reasoning', 'custom', 'finalReflection']) {
          if (typeof s[f] !== 'string') return false;
        }
        if (!Number.isFinite(s.remaining) || typeof s.paused !== 'boolean') return false;
        if (s.selected !== null && !Number.isInteger(s.selected)) return false;
        return s.history.every(
          (e) =>
            e && typeof e === 'object' &&
            e.before && e.after &&
            metricKeys.every((k) => Number.isFinite(e.before[k]) && Number.isFinite(e.after[k])) &&
            Array.isArray(e.options) && Array.isArray(e.contextNotes) && Array.isArray(e.warnings) &&
            typeof e.title === 'string' && typeof e.choice === 'string' && typeof e.reasoning === 'string'
        );
      } catch (_) {
        return false;
      }
    }

    return {
      initial,
      decide,
      advance,
      isValidSaved,
      defaultStrategy,
      contextNotes: rules.contextNotes,
      narrative: rules.narrative,
      customIndex: (roundIndex) => rounds[roundIndex].options.length,
    };
  }

  const api = { createEngine, validateScenario, clamp, letter };
  root.SimEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
