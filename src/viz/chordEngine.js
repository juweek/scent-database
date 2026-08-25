/**
 * THE CHORD ENGINE — plain canvas drawing, no React.
 *
 * Ported from the three standalone wheel prototypes, which share one design:
 * ribbons inside, one or two grouped arc bands outside, a hit test that reads
 * radius first (which band?) then falls through to the ribbons.
 *
 * The canvas keeps a FIXED logical size and is scaled by CSS (`max-width:100%`)
 * exactly as the prototypes did. Every client→logical conversion goes through
 * the measured rect, so CSS scaling can never desync the hit test.
 *
 * d3 is passed in (dynamically imported by the caller) so this file has no
 * import cost of its own.
 */

const TAU = 2 * Math.PI;
const HALF = Math.PI / 2;

export function createEngine({ canvas, overlay, d3, spec, maxPixelRatio = 2, buildThreshold = 0 }) {
  const { size, inner, bands, padAngle } = spec;
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  const overlayCtx = overlay?.getContext('2d', { alpha: true, desynchronized: true });
  const dpr = Math.min(maxPixelRatio, Math.max(1, window.devicePixelRatio || 1));

  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  if (overlay) {
    overlay.width = size * dpr;
    overlay.height = size * dpr;
    overlay.style.width = `${size}px`;
    overlay.style.height = `${size}px`;
  }

  // logical → device, used to pre-transform hit paths so picking can run with
  // an identity transform (cheaper than re-stroking every ribbon per move).
  const DM = new DOMMatrix([dpr, 0, 0, dpr, (size / 2) * dpr, (size / 2) * dpr]);
  const applyTransform = () => ctx.setTransform(dpr, 0, 0, dpr, (size / 2) * dpr, (size / 2) * dpr);

  let names = [];
  let chords = [];
  let meta = [];
  let arcs = {}; // band key → [{ key, family, startAngle, endAngle }]
  let attrs = {}; // the current view's per-note attribute lookups

  /** Contiguous runs of equal key across the chord groups → one arc each. */
  function runs(keyOf) {
    const out = [];
    let i = 0;
    while (i < chords.groups.length) {
      const k = keyOf(i);
      let j = i;
      while (j < chords.groups.length && keyOf(j) === k) j++;
      out.push({
        key: k,
        startAngle: chords.groups[i].startAngle,
        endAngle: chords.groups[j - 1].endAngle,
      });
      i = j;
    }
    return out;
  }

  /**
   * Re-pad so that gaps appear BETWEEN groups rather than uniformly: a small
   * gap where the inner band changes, a larger one where the outer band does.
   * Straight port of the pyramid prototype's repad2 — without it the two rings
   * read as one undifferentiated ribbon of colour.
   */
  function repad(innerGap, outerGap, innerOf, outerOf) {
    const n = chords.groups.length;
    const off = new Array(n);
    let run = outerGap * 0.5;
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        if (outerOf(i) !== outerOf(i - 1)) run += outerGap;
        else if (innerOf(i) !== innerOf(i - 1)) run += innerGap;
      }
      off[i] = run;
    }
    const scale = (TAU - (run + outerGap * 0.5)) / TAU;
    const map = (a, gi) => a * scale + off[gi];
    chords.groups.forEach((g, i) => {
      g.startAngle = map(g.startAngle, i);
      g.endAngle = map(g.endAngle, i);
    });
    chords.forEach((d) => {
      const si = d.source.index;
      const ti = d.target.index;
      d.source.startAngle = map(d.source.startAngle, si);
      d.source.endAngle = map(d.source.endAngle, si);
      d.target.startAngle = map(d.target.startAngle, ti);
      d.target.endAngle = map(d.target.endAngle, ti);
    });
  }

  function compute(view) {
    const v = spec.resolve(view);
    names = v.names;
    attrs = v;

    chords = d3.chord().padAngle(padAngle).sortSubgroups(d3.descending)(v.matrix);

    if (spec.repad) {
      repad(
        spec.repad.innerGap,
        spec.repad.outerGap,
        (i) => v.innerKey(names[i]),
        (i) => v.outerKey(names[i]),
      );
    }

    arcs = {};
    for (const band of bands) {
      arcs[band.key] = runs((i) => v[band.keyOf](names[i])).map((r) => ({
        key: r.key,
        family: band.familyOf ? v[band.familyOf](r.key) : r.key,
        startAngle: r.startAngle,
        endAngle: r.endAngle,
      }));
    }

    applyTransform();
    const ribbon = d3.ribbon().radius(inner);
    meta = chords.map((d) => {
      const value = Math.max(d.source.value, d.target.value);
      if (value < buildThreshold) return null;
      const sa = (d.source.startAngle + d.source.endAngle) / 2;
      const ta = (d.target.startAngle + d.target.endAngle) / 2;
      const g = ctx.createLinearGradient(
        Math.sin(sa) * inner,
        -Math.cos(sa) * inner,
        Math.sin(ta) * inner,
        -Math.cos(ta) * inner,
      );
      g.addColorStop(0, v.colorOf(names[d.source.index]));
      g.addColorStop(1, v.colorOf(names[d.target.index]));

      const path = new Path2D();
      ribbon.context(path)(d);
      const hit = new Path2D();
      hit.addPath(path, DM);

      return {
        grad: g,
        value,
        path,
        hit,
        source: { x: Math.sin(sa) * inner, y: -Math.cos(sa) * inner },
        target: { x: Math.sin(ta) * inner, y: -Math.cos(ta) * inner },
      };
    });
  }

  /** Is this ribbon shown under the current focus? */
  function visible(d, state) {
    const s = names[d.source.index];
    const t = names[d.target.index];
    if (state.note && s !== state.note && t !== state.note) return false;
    for (const band of bands) {
      const active = state.sticky[band.key] || state.hovered[band.key];
      if (active) {
        const keyOf = attrs[band.keyOf];
        if (keyOf(s) !== active && keyOf(t) !== active) return false;
      }
    }
    return true;
  }

  function filtering(state) {
    if (state.note) return true;
    return bands.some((b) => state.sticky[b.key] || state.hovered[b.key]);
  }

  function draw(state) {
    applyTransform();
    ctx.clearRect(-size / 2, -size / 2, size, size);
    const filt = filtering(state);

    for (let i = 0; i < chords.length; i++) {
      const m = meta[i];
      if (!m || m.value < state.minShared) continue;
      const a = filt
        ? visible(chords[i], state)
          ? spec.alpha.focused
          : 0
        : spec.alpha.base(m.value);
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = m.grad;
      ctx.fill(m.path);
    }

    const activeChord = state.hoveredChord ?? state.selectedChord;
    if (activeChord != null && meta[activeChord] && meta[activeChord].value >= state.minShared) {
      ctx.globalAlpha = 1;
      ctx.lineWidth = state.hoveredChord != null ? 1.4 : 2;
      ctx.strokeStyle = spec.ink;
      ctx.stroke(meta[activeChord].path);
    }

    for (const band of bands) {
      const list = arcs[band.key] || [];
      list.forEach((a) => {
        const inset = band.inset && a.endAngle - a.startAngle > 0.01 ? band.inset : 0;
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          band.radius + band.width / 2,
          a.startAngle - HALF + inset,
          a.endAngle - HALF - inset,
        );
        ctx.lineWidth = band.width;
        ctx.strokeStyle = attrs.colorOfKey(a.family) || '#888';
        ctx.globalAlpha = band.alpha(a, state);
        ctx.stroke();
      });
    }

    // Labels ride on whichever band asked for them (the outermost one).
    const labelled = bands.find((b) => b.labels);
    const compact = canvas.getBoundingClientRect().width < 620;
    if (labelled && !compact) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${spec.labelSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = spec.ink;
      (arcs[labelled.key] || []).forEach((a) => {
        const mid = (a.startAngle + a.endAngle) / 2;
        ctx.globalAlpha = labelled.alpha(a, state);
        ctx.fillText(
          String(a.key).toUpperCase(),
          Math.sin(mid) * spec.labelRadius,
          -Math.cos(mid) * spec.labelRadius,
        );
      });
    }

    ctx.globalAlpha = 1;
  }

  function drawPulse(state) {
    if (!overlayCtx) return;
    overlayCtx.setTransform(dpr, 0, 0, dpr, (size / 2) * dpr, (size / 2) * dpr);
    overlayCtx.clearRect(-size / 2, -size / 2, size, size);
    if (state.pulseProgress == null || state.pulseChord == null) return;
    const item = meta[state.pulseChord];
    if (!item || item.value < state.minShared) return;
    if (filtering(state) && !visible(chords[state.pulseChord], state)) return;

    overlayCtx.save();
    overlayCtx.globalCompositeOperation = 'lighter';
    overlayCtx.shadowColor = spec.ink;
    overlayCtx.shadowBlur = 10;
    for (let tail = 0; tail < 5; tail++) {
      const t = state.pulseProgress - tail * 0.026;
      if (t < 0 || t > 1) continue;
      const u = 1 - t;
      const x = u * u * item.source.x + t * t * item.target.x;
      const y = u * u * item.source.y + t * t * item.target.y;
      overlayCtx.beginPath();
      overlayCtx.arc(x, y, Math.max(1.2, 3.2 - tail * 0.45), 0, TAU);
      overlayCtx.fillStyle = spec.ink;
      overlayCtx.globalAlpha = 0.86 - tail * 0.15;
      overlayCtx.fill();
    }
    overlayCtx.restore();
  }

  function clearPulse() {
    if (!overlayCtx) return;
    overlayCtx.setTransform(dpr, 0, 0, dpr, (size / 2) * dpr, (size / 2) * dpr);
    overlayCtx.clearRect(-size / 2, -size / 2, size, size);
  }

  function angleIn(a, s, e) {
    s = ((s % TAU) + TAU) % TAU;
    e = ((e % TAU) + TAU) % TAU;
    return s <= e ? a >= s && a <= e : a >= s || a <= e;
  }

  /**
   * Radius decides WHAT was hit: inside `inner` is the ribbon field, each band
   * owns an annulus out to its `hitTo`. Returns { chord, <bandKey>: value }.
   */
  function pick(clientX, clientY, state, pointerType = 'mouse') {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return { chord: null };
    const fx = size / rect.width;
    const lx = (clientX - rect.left) * fx - size / 2;
    const ly = (clientY - rect.top) * fx - size / 2;
    const radius = Math.hypot(lx, ly);
    let ang = Math.atan2(lx, -ly);
    if (ang < 0) ang += TAU;

    const empty = { chord: null };
    for (const band of bands) empty[band.key] = null;

    if (radius < inner) {
      const px = (clientX - rect.left) * (canvas.width / rect.width);
      const py = (clientY - rect.top) * (canvas.height / rect.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0); // hit paths are pre-transformed
      const filt = filtering(state);
      for (let i = 0; i < chords.length; i++) {
        const m = meta[i];
        if (!m || m.value < state.minShared) continue;
        if (filt && !visible(chords[i], state)) continue;
        if (ctx.isPointInPath(m.hit, px, py)) return { ...empty, chord: i };
      }
      return empty;
    }

    // Touch targets use a minimum 44 CSS-pixel annulus. Where the pyramid's
    // two rings overlap, the closest visible ring wins.
    const cssToLogical = size / rect.width;
    const targetPadding = (pointerType === 'touch' ? 22 : 7) * cssToLogical;
    const candidates = bands
      .map((band) => ({ band, distance: Math.abs(radius - (band.radius + band.width / 2)) }))
      .filter(({ band, distance }) => distance <= band.width / 2 + targetPadding)
      .sort((a, b) => a.distance - b.distance);
    for (const { band } of candidates) {
      const a = (arcs[band.key] || []).find((arc) => angleIn(ang, arc.startAngle, arc.endAngle));
      if (a) return { ...empty, [band.key]: a.key };
    }
    return empty;
  }

  function pulseCandidate(state) {
    const candidates = [];
    for (let i = 0; i < chords.length; i++) {
      const item = meta[i];
      if (!item || item.value < state.minShared) continue;
      if (filtering(state) && !visible(chords[i], state)) continue;
      candidates.push(i);
    }
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /** Strongest partner of a note in the current matrix — used by the readout. */
  function strongestPartner(note) {
    const idx = names.indexOf(note);
    if (idx < 0) return null;
    const M = attrs.matrix;
    let best = -1;
    let bj = -1;
    for (let j = 0; j < names.length; j++) {
      if (j !== idx && M[idx][j] > best) {
        best = M[idx][j];
        bj = j;
      }
    }
    return bj >= 0 ? names[bj] : null;
  }

  const pairOf = (i) => {
    const d = chords[i];
    return {
      source: names[d.source.index],
      target: names[d.target.index],
      value: Math.max(d.source.value, d.target.value),
    };
  };

  return {
    compute,
    draw,
    pick,
    pairOf,
    strongestPartner,
    pulseCandidate,
    drawPulse,
    clearPulse,
    get names() {
      return names;
    },
  };
}
