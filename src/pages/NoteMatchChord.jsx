import { useMemo, useState, useEffect } from 'react';
import { chord as d3chord, ribbon as d3ribbon } from 'd3-chord';

/**
 * Chord diagram for a single perfume in Note Match.
 * Uses only CC0 Note Match seed data to compute associations.
 * 
 * Lighter than PerfumeChord - no taxonomy bands, just note associations.
 */

const SIZE = 420;
const RIBBON_R = 120;
const NOTE_BAND = { inner: 130, width: 10 };
const LABEL_R = 148;
const EXPONENT = 0.45;

/**
 * Compute pair matrix for a perfume from Note Match seed data.
 * Returns how many perfumes in the seed share each pair of notes.
 */
function computePairMatrix(perfume, allPerfumes) {
  const notes = perfume.notes;
  const n = notes.length;
  
  // Count how many perfumes share each pair of notes
  const counts = Array.from({ length: n }, () => new Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const note1 = notes[i];
      const note2 = notes[j];
      
      // Count perfumes that have both notes
      let pairCount = 0;
      for (const p of allPerfumes) {
        const pNotes = new Set(p.notes);
        if (pNotes.has(note1) && pNotes.has(note2)) {
          pairCount++;
        }
      }
      
      counts[i][j] = pairCount;
      counts[j][i] = pairCount;
    }
  }
  
  return counts;
}

/**
 * Build chord data from pair matrix.
 */
function buildChordData(perfume, pairMatrix) {
  const n = perfume.notes.length;
  
  // Build weighted matrix (using power scale to make small values visible)
  const weights = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const count = pairMatrix[i][j];
      const value = count > 0 ? Math.pow(count, EXPONENT) : 0;
      weights[i][j] = value;
      weights[j][i] = value;
    }
  }
  
  // Generate chord layout
  const chords = d3chord()
    .padAngle(0.04)
    .sortSubgroups((a, b) => b - a)(weights);
  
  return {
    chords,
    ribbon: d3ribbon().radius(RIBBON_R),
    pairMatrix
  };
}

/**
 * Simple color hash for notes (consistent but arbitrary).
 */
function noteColor(note) {
  let hash = 0;
  for (let i = 0; i < note.length; i++) {
    hash = note.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 45%, 50%)`;
}

export default function NoteMatchChord({ perfume, allPerfumes }) {
  const [hover, setHover] = useState(null);
  
  // Memoize the chord data computation
  const chordData = useMemo(() => {
    if (!perfume || !allPerfumes || perfume.notes.length < 4) {
      return null;
    }
    
    const pairMatrix = computePairMatrix(perfume, allPerfumes);
    return buildChordData(perfume, pairMatrix);
  }, [perfume, allPerfumes]);
  
  if (!chordData) {
    return (
      <div className="noteChordEmpty">
        <p>Not enough note data to show associations.</p>
        <p className="noteChordEmptyDetail">
          Chord diagrams require at least 4 notes with association data.
        </p>
      </div>
    );
  }
  
  const { chords, ribbon, pairMatrix } = chordData;
  const notes = perfume.notes;
  
  // Helper to get note label position
  const labelPosition = (angle) => {
    const x = Math.cos(angle - Math.PI / 2) * LABEL_R;
    const y = Math.sin(angle - Math.PI / 2) * LABEL_R;
    return { x, y, angle };
  };
  
  return (
    <div className="noteChord">
      <svg 
        viewBox={`${-SIZE/2} ${-SIZE/2} ${SIZE} ${SIZE}`}
        className="noteChordSvg"
        role="img"
        aria-label={`Note association chord diagram for ${perfume.name}`}
      >
        {/* Note arcs */}
        <g className="noteChordArcs">
          {chords.groups.map((group, i) => {
            const startAngle = group.startAngle;
            const endAngle = group.endAngle;
            const midAngle = (startAngle + endAngle) / 2;
            
            // Arc path
            const innerR = NOTE_BAND.inner;
            const outerR = NOTE_BAND.inner + NOTE_BAND.width;
            const arcPath = `
              M ${Math.cos(startAngle - Math.PI/2) * innerR},${Math.sin(startAngle - Math.PI/2) * innerR}
              A ${innerR},${innerR} 0 ${endAngle - startAngle > Math.PI ? 1 : 0} 1 
                ${Math.cos(endAngle - Math.PI/2) * innerR},${Math.sin(endAngle - Math.PI/2) * innerR}
              L ${Math.cos(endAngle - Math.PI/2) * outerR},${Math.sin(endAngle - Math.PI/2) * outerR}
              A ${outerR},${outerR} 0 ${endAngle - startAngle > Math.PI ? 1 : 0} 0 
                ${Math.cos(startAngle - Math.PI/2) * outerR},${Math.sin(startAngle - Math.PI/2) * outerR}
              Z
            `;
            
            const color = noteColor(notes[i]);
            const isHovered = hover?.type === 'note' && hover?.index === i;
            
            return (
              <g key={i}>
                <path
                  d={arcPath}
                  fill={color}
                  opacity={isHovered ? 1 : 0.7}
                  onMouseEnter={() => setHover({ type: 'note', index: i })}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: 'pointer', transition: 'opacity 120ms' }}
                />
                {/* Label */}
                <text
                  x={labelPosition(midAngle).x}
                  y={labelPosition(midAngle).y}
                  textAnchor={Math.abs(midAngle) < Math.PI / 2 ? 'start' : 'end'}
                  dominantBaseline="middle"
                  className="noteChordLabel"
                  transform={`rotate(${(midAngle * 180 / Math.PI) + (Math.abs(midAngle) < Math.PI / 2 ? 0 : 180)}, ${labelPosition(midAngle).x}, ${labelPosition(midAngle).y})`}
                >
                  {notes[i]}
                </text>
              </g>
            );
          })}
        </g>
        
        {/* Ribbons (connections) */}
        <g className="noteChordRibbons">
          {chords.map((chord, i) => {
            if (chord.source.value === 0) return null;
            
            const sourceNote = notes[chord.source.index];
            const targetNote = notes[chord.target.index];
            const count = pairMatrix[chord.source.index][chord.target.index];
            
            const isHovered = hover?.type === 'chord' && hover?.index === i;
            
            return (
              <path
                key={i}
                d={ribbon(chord)}
                fill={noteColor(sourceNote)}
                opacity={isHovered ? 0.8 : 0.15}
                onMouseEnter={() => setHover({ type: 'chord', index: i, sourceNote, targetNote, count })}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: 'pointer', transition: 'opacity 120ms' }}
              />
            );
          })}
        </g>
        
        {/* Center readout */}
        {hover?.type === 'chord' && (
          <g className="noteChordReadout">
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              className="noteChordReadoutMain"
              y="-15"
            >
              {hover.sourceNote} × {hover.targetNote}
            </text>
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              className="noteChordReadoutCount"
              y="5"
            >
              {hover.count} {hover.count === 1 ? 'perfume' : 'perfumes'}
            </text>
          </g>
        )}
        {hover?.type === 'note' && (
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            className="noteChordReadoutMain"
          >
            {notes[hover.index]}
          </text>
        )}
      </svg>
      
      <p className="noteChordCaption">
        Hover over ribbons to see how many perfumes share each pair of notes
        (from {allPerfumes.length} CC0 perfumes).
      </p>
    </div>
  );
}
