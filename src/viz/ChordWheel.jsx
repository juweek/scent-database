import { useRef, useEffect, useState, useCallback } from 'react';
import { createEngine } from './chordEngine';

let d3Promise;
function loadD3() {
  d3Promise ||= Promise.all([import('d3-chord'), import('d3-array')]).then(([chord, array]) => ({
    ...chord,
    descending: array.descending,
  }));
  return d3Promise;
}

/**
 * React owns interaction state; the canvas engine owns pixels. Pointer moves,
 * ambient pulses, and hit testing never re-render React.
 */
export default function ChordWheel({
  spec,
  view,
  sticky,
  hovered,
  minShared,
  note,
  onHover = () => {},
  onReadout,
  onPick = () => {},
  interactive = true,
  ambientPulse = false,
  pixelRatio = 2,
  buildThreshold = 0,
  ariaLabel = 'Interactive fragrance chord diagram',
}) {
  const canvasRef = useRef(null);
  const pulseCanvasRef = useRef(null);
  const engineRef = useRef(null);
  const rafRef = useRef(null);
  const pulseRafRef = useRef(null);
  const stateRef = useRef({
    hoveredChord: null,
    selectedChord: null,
    pulseChord: null,
    pulseProgress: null,
    hovered: {},
    sticky: {},
    minShared: 0,
    note: null,
  });
  const [d3, setD3] = useState(null);

  useEffect(() => {
    let live = true;
    loadD3().then((modules) => live && setD3(modules));
    return () => {
      live = false;
    };
  }, []);

  const publishReadout = useCallback(() => {
    if (!onReadout || !engineRef.current) return;
    const state = stateRef.current;
    const activeBand = {};
    for (const band of spec.bands) {
      activeBand[band.key] = state.sticky[band.key] || state.hovered[band.key];
    }
    onReadout(
      spec.readout({
        ...view,
        engine: engineRef.current,
        hoveredChord: state.hoveredChord ?? state.selectedChord,
        note: state.note,
        activeBand,
      }),
    );
  }, [spec, view, onReadout]);

  const schedule = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      engineRef.current?.draw(stateRef.current);
      publishReadout();
    });
  }, [publishReadout]);

  useEffect(() => {
    if (!d3 || !canvasRef.current) return undefined;
    const engine = createEngine({
      canvas: canvasRef.current,
      overlay: pulseCanvasRef.current,
      d3,
      spec,
      maxPixelRatio: pixelRatio,
      buildThreshold,
    });
    engine.compute(view);
    engineRef.current = engine;
    Object.assign(stateRef.current, {
      hoveredChord: null,
      selectedChord: null,
      sticky,
      hovered,
      minShared,
      note,
    });
    engine.clearPulse();
    engine.draw(stateRef.current);
    publishReadout();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (pulseRafRef.current) cancelAnimationFrame(pulseRafRef.current);
      rafRef.current = null;
      pulseRafRef.current = null;
      engineRef.current = null;
    };
    // `view` is memoized by the page and intentionally owns recomputation.
  }, [d3, spec, view, pixelRatio, buildThreshold, publishReadout]);

  useEffect(() => {
    stateRef.current.sticky = sticky;
    stateRef.current.hovered = hovered;
    stateRef.current.minShared = minShared;
    stateRef.current.note = note;
    schedule();
  }, [sticky, hovered, minShared, note, schedule]);

  useEffect(() => {
    if (!ambientPulse || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    let timeout;
    let live = true;
    const queue = () => {
      timeout = window.setTimeout(start, 6500 + Math.random() * 4500);
    };
    const start = () => {
      if (!live) return;
      if (document.hidden || !engineRef.current) {
        queue();
        return;
      }
      const state = stateRef.current;
      state.pulseChord = engineRef.current.pulseCandidate(state);
      if (state.pulseChord == null) {
        queue();
        return;
      }
      const started = performance.now();
      const frame = (now) => {
        if (!live || !engineRef.current) return;
        state.pulseProgress = Math.min(1, (now - started) / 1150);
        engineRef.current.drawPulse(state);
        if (state.pulseProgress < 1) {
          pulseRafRef.current = requestAnimationFrame(frame);
        } else {
          state.pulseProgress = null;
          state.pulseChord = null;
          engineRef.current.clearPulse();
          pulseRafRef.current = null;
          queue();
        }
      };
      pulseRafRef.current = requestAnimationFrame(frame);
    };
    queue();

    return () => {
      live = false;
      clearTimeout(timeout);
      if (pulseRafRef.current) cancelAnimationFrame(pulseRafRef.current);
      pulseRafRef.current = null;
    };
  }, [ambientPulse, d3, spec, view]);

  function handleMove(event) {
    const engine = engineRef.current;
    if (!engine || !interactive) return;
    const hit = engine.pick(event.clientX, event.clientY, stateRef.current, event.pointerType);
    const state = stateRef.current;
    let changed = false;

    if (hit.chord !== state.hoveredChord) {
      state.hoveredChord = hit.chord;
      changed = true;
    }
    for (const band of spec.bands) {
      const next = hit[band.key] ?? null;
      const previous = state.hovered[band.key] ?? null;
      if (next !== previous && !state.sticky[band.key]) onHover(band.key, next);
    }
    if (changed) schedule();

    const anything = hit.chord != null || spec.bands.some((band) => hit[band.key]);
    canvasRef.current.style.cursor = anything ? 'pointer' : 'default';
  }

  function handleLeave() {
    if (!interactive) return;
    stateRef.current.hoveredChord = null;
    for (const band of spec.bands) {
      if (!stateRef.current.sticky[band.key]) onHover(band.key, null);
    }
    schedule();
  }

  function handleClick(event) {
    const engine = engineRef.current;
    if (!engine || !interactive) return;
    const hit = engine.pick(event.clientX, event.clientY, stateRef.current, event.pointerType);
    const state = stateRef.current;

    if (hit.chord != null) {
      const toggledOff = hit.chord === state.selectedChord;
      state.selectedChord = toggledOff ? null : hit.chord;
      onPick(toggledOff ? { ...hit, chord: null } : { ...hit, pair: engine.pairOf(hit.chord) });
    } else {
      state.selectedChord = null;
      onPick(hit);
    }
    schedule();
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`wheelCanvas${interactive ? '' : ' wheelCanvas--preview'}`}
        aria-hidden={interactive ? undefined : 'true'}
        aria-label={interactive ? ariaLabel : undefined}
        role={interactive ? 'img' : undefined}
        onPointerDown={handleMove}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        onPointerCancel={handleLeave}
        onClick={handleClick}
      />
      {ambientPulse && (
        <canvas ref={pulseCanvasRef} className="wheelPulseCanvas" aria-hidden="true" />
      )}
    </>
  );
}
