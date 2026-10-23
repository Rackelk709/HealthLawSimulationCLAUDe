/* =====================================================================
   report.js  -  builds the student's decision record.

   createReport(S, engine) returns:
     blocks(state)            -> [[type, text], ...]  (shared by every format)
     text(state)              -> plain-text record (.txt, clipboard)
     makePDF(state, libs)     -> Promise<Uint8Array>  (needs pdf-lib + fontkit + fonts)
     fileName(state, ext)     -> e.g. redwood-valley-decision-record-jane-doe.pdf

   All wording comes from scenario.js (config.report, metricMeta, debrief).
   ===================================================================== */
(function (root) {
  'use strict';

  function createReport(S, engine) {
    const cfg = S.config;
    const R = cfg.report;
    const meta = S.metricMeta;
    const init = S.initialState;
    const minutes = Number(cfg.suggestedMinutes) || 0;
    const letter = (i) => String.fromCharCode(65 + i);
    const signed = (n) => (n >= 0 ? '+' : '') + n;

    function blocks(s) {
      const b = [
        ['title', R.title],
        ['subtitle', R.subtitle],
        ['label', R.label],
        ['body', 'Participant(s): ' + (s.participant || 'Not specified')],
        ['body', 'Started: ' + new Date(s.started).toLocaleString()],
        ['body', 'Completed: ' + (s.completed ? new Date(s.completed).toLocaleString() : 'In progress')],
      ];
      if (minutes > 0) {
        b.push(['body', 'Timer remaining: ' + Math.floor(s.remaining / 60) + ':' + String(s.remaining % 60).padStart(2, '0')]);
      }
      b.push(['note', R.disclaimer], ['heading', 'Executive summary'], ['body', engine.narrative(s.metrics)], ['heading', 'Final indicators']);
      for (const [k, label] of Object.entries(meta)) {
        b.push(['body', `${label}: ${s.metrics[k]}/100 (initial: ${init[k]})`]);
      }

      for (const e of s.history) {
        b.push(['round', `Decision ${e.round} | ${e.title}`], ['body', 'Role: ' + e.role], ['label', 'SCENARIO'], ['body', e.story], ['body', 'Authority briefing: ' + e.context]);
        if (e.contextNotes.length) b.push(['body', 'Situation updates: ' + e.contextNotes.join(' ')]);
        b.push(['label', 'DECISION POINT'], ['body', e.question], ['label', 'AVAILABLE RESPONSES']);
        e.options.forEach((o, i) => b.push(['body', `${letter(i)}. ${o.title} — ${o.detail}`]));
        if (cfg.allowCustomPolicy !== false) {
          b.push(['body', `${letter(e.options.length)}. ${S.workspace.customLabel}.`]);
        }
        b.push(['label', 'SELECTED RESPONSE'], ['body', e.choice]);
        if (e.custom) {
          b.push(['note', 'Alternative policy consequences are modeled using: ' + e.strategy + '. The app does not evaluate free-text policy content.']);
        }
        b.push(
          ['label', 'LEGAL AND ETHICAL REASONING'], ['body', e.reasoning],
          ['label', 'CONSEQUENCE'], ['body', e.consequence],
          ['label', 'STAKEHOLDER RESPONSE'], ['body', e.stakeholder],
          ['label', 'LEGAL AND ETHICAL CONSIDERATIONS'], ['body', e.legal]
        );
        if (e.warnings.length) b.push(['body', e.warnings.join(' ')]);
        b.push(['label', 'INDICATOR CHANGES']);
        for (const [k, label] of Object.entries(meta)) {
          b.push(['body', `${label}: ${e.before[k]} → ${e.after[k]} (${signed(e.after[k] - e.before[k])})`]);
        }
        b.push(['label', 'ROUND REFLECTION'], ['body', e.prompt], ['body', e.reflection || 'No round reflection provided.']);
      }

      b.push(['heading', 'Leadership debrief']);
      S.debrief.forEach((q, i) => b.push(['body', `${i + 1}. ${q}`]));
      b.push(
        ['heading', S.complete.reflectionLabel],
        ['body', s.finalReflection.trim() || 'No final reflection provided.'],
        ['note', R.closingNote]
      );
      return b;
    }

    function text(s) {
      return blocks(s)
        .map(([type, t]) => (['title', 'heading', 'round'].includes(type) ? '\n' + t + '\n' + '─'.repeat(Math.min(65, t.length)) : t))
        .join('\n\n');
    }

    function fileName(s, ext) {
      const slug = String(s.participant || '')
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, '-')
        .slice(0, 40)
        .replace(/^-+|-+$/g, '');
      return R.fileSlug + (slug ? '-' + slug : '') + '.' + ext;
    }

    /* ---------------------------------------------------------------
       PDF
       libs = { PDFLib, fontkit, fonts: { 'DejaVuSans.ttf': base64, ... } }
       --------------------------------------------------------------- */
    async function makePDF(state, libs) {
      if (!libs || !libs.PDFLib || !libs.fontkit || !libs.fonts) throw new Error('PDF libraries are unavailable.');
      const { PDFDocument, rgb } = libs.PDFLib;
      const pdf = await PDFDocument.create();
      pdf.registerFontkit(libs.fontkit);
      const bytesOf = (name) => Uint8Array.from(atob(libs.fonts[name]), (c) => c.charCodeAt(0));
      // The bundled fonts are already trimmed to Latin/Greek/Cyrillic/punctuation (js/vendor/fonts.js).
      // They are embedded whole: pdf-lib's own glyph subsetter drops letters from fonts that were
      // pre-processed with fontTools, so { subset: false } is required here.
      const regular = await pdf.embedFont(bytesOf('DejaVuSans.ttf'), { subset: false });
      const bold = await pdf.embedFont(bytesOf('DejaVuSans-Bold.ttf'), { subset: false });
      const serif = await pdf.embedFont(bytesOf('DejaVuSerif.ttf'), { subset: false });
      pdf.setTitle(R.pdfTitle);
      pdf.setAuthor(R.pdfAuthor);
      pdf.setSubject(R.pdfSubject);

      const navy = rgb(0.094, 0.176, 0.231), teal = rgb(0.122, 0.373, 0.341), muted = rgb(0.32, 0.38, 0.42);
      const ink = rgb(0.13, 0.2, 0.25), rule = rgb(0.84, 0.87, 0.85);
      const margin = 52, width = 508;
      const pages = [];
      let page, y;

      // Characters the font cannot draw would show as empty boxes, so substitute them.
      const charSets = new Map([regular, bold, serif].map((f) => [f, new Set(f.getCharacterSet())]));
      const FALLBACK = { '→': ' -> ', '—': ' - ', '–': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '•': '*', '≥': '>=', '≤': '<=', '✓': '+' };
      function safe(input, font) {
        const set = charSets.get(font);
        let out = '';
        const cleaned = String(input)
          .replace(/\r\n?/g, '\n')
          .replace(/\t/g, '    ')
          .replace(/[\u200B-\u200D\u2060\uFE0E\uFE0F\uFEFF]/g, '')
          .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
        for (const ch of cleaned) {
          if (ch === '\n' || set.has(ch.codePointAt(0))) out += ch;
          else out += FALLBACK[ch] || '?';
        }
        return out;
      }

      function newPage() {
        page = pdf.addPage([612, 792]);
        pages.push(page);
        y = 726;
        page.drawRectangle({ x: 0, y: 752, width: 612, height: 40, color: navy });
        page.drawText(safe(R.pdfHeader, bold), { x: margin, y: 767, size: 8, font: bold, color: rgb(1, 1, 1) });
      }

      function wrap(t, font, size) {
        const result = [];
        for (const para of t.split('\n')) {
          let current = '';
          for (let word of para.split(/\s+/)) {
            if (!word) continue;
            while (font.widthOfTextAtSize(word, size) > width) {
              if (current) { result.push(current); current = ''; }
              let n = word.length;
              while (n > 1 && font.widthOfTextAtSize(word.slice(0, n), size) > width) n--;
              result.push(word.slice(0, n));
              word = word.slice(n);
            }
            const next = current ? current + ' ' + word : word;
            if (font.widthOfTextAtSize(next, size) > width) { result.push(current); current = word; }
            else current = next;
          }
          result.push(current);
        }
        return result;
      }

      const styles = {
        title: { size: 25, font: serif, color: navy, pre: 6, post: 7 },
        subtitle: { size: 11, font: regular, color: muted, pre: 0, post: 10 },
        label: { size: 8, font: bold, color: teal, pre: 10, post: 4 },
        body: { size: 9.5, font: regular, color: ink, pre: 0, post: 6 },
        note: { size: 8.5, font: regular, color: muted, pre: 5, post: 8 },
        heading: { size: 17, font: serif, color: navy, pre: 17, post: 10 },
        round: { size: 22, font: serif, color: navy, pre: 5, post: 13 },
      };

      newPage();
      for (const [type, t] of blocks(state)) {
        const st = styles[type] || styles.body;
        if (type === 'round') {
          // Each decision starts on a fresh page, unless the current page is still mostly empty
          // (a short overflow from the previous decision) - then continue below a divider.
          if (y < 490 || pages.length === 1) newPage();
          else {
            page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: margin + width, y: y + 6 }, thickness: 0.75, color: rule });
            y -= 14;
          }
        }
        const lines = wrap(safe(t, st.font), st.font, st.size);
        const leading = st.size * 1.4;
        const keepWithNext = type === 'heading' || type === 'label' || type === 'round';
        if (y - st.pre - (keepWithNext ? leading + 35 : leading) < 58) newPage();
        y -= st.pre;
        for (const line of lines) {
          if (y - leading < 55) newPage();
          if (line) page.drawText(line, { x: margin, y, size: st.size, font: st.font, color: st.color });
          y -= leading;
        }
        y -= st.post;
      }

      // Footer on every page: exercise note, participant name (so loose pages stay identifiable), page number.
      const footerLeft = safe(R.pdfFooter, regular);
      const leftWidth = regular.widthOfTextAtSize(footerLeft, 7);
      const room = 500 - margin - leftWidth - 24;
      let who = safe(state.participant || '', regular).replace(/\s+/g, ' ').trim();
      while (who && regular.widthOfTextAtSize(who, 7) > room) who = who.slice(0, -1);
      pages.forEach((p, i) => {
        p.drawLine({ start: { x: margin, y: 43 }, end: { x: 560, y: 43 }, thickness: 0.5, color: rule });
        p.drawText(footerLeft, { x: margin, y: 28, size: 7, font: regular, color: muted });
        if (who) {
          const w = regular.widthOfTextAtSize(who, 7);
          p.drawText(who, { x: 508 - w, y: 28, size: 7, font: bold, color: muted });
        }
        const num = `${i + 1} / ${pages.length}`;
        p.drawText(num, { x: 560 - regular.widthOfTextAtSize(num, 8), y: 28, size: 8, font: regular, color: muted });
      });
      return pdf.save();
    }

    return { blocks, text, fileName, makePDF };
  }

  const api = { createReport };
  root.SimReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
