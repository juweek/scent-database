import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Loading, ErrorState } from '../components/Status';
import './note-match.css';

// Lazy-load the chord diagram component
const NoteMatchChord = lazy(() => import('./NoteMatchChord'));

/**
 * Note Match: find similar perfumes by comparing their listed notes.
 * Uses only CC0 data (Wikidata + manual seed).
 */
export default function NoteMatchPage() {
  const [index, setIndex] = useState(null);
  const [seed, setSeed] = useState(null);
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [expandedMatchId, setExpandedMatchId] = useState(null);

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        const [indexRes, seedRes, matchesRes] = await Promise.all([
          fetch('/data/note-match/index.json'),
          fetch('/data/note-match/seed.json'),
          fetch('/data/note-match/matches.json')
        ]);

        if (!indexRes.ok || !seedRes.ok || !matchesRes.ok) {
          throw new Error('Failed to load data');
        }

        const indexData = await indexRes.json();
        const seedData = await seedRes.json();
        const matchesData = await matchesRes.json();

        setIndex(indexData);
        setSeed(seedData);
        setMatches(matchesData);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Get selected perfume
  const selectedPerfume = useMemo(() => {
    if (!selectedId || !seed) return null;
    return seed.fragrances.find(f => f.id === selectedId);
  }, [selectedId, seed]);

  // Get matches for selected perfume
  const perfumeMatches = useMemo(() => {
    if (!selectedId || !matches) return [];
    return matches.matches[selectedId] || [];
  }, [selectedId, matches]);

  // Filter perfumes by search
  const filteredPerfumes = useMemo(() => {
    if (!index || !searchQuery.trim()) return index?.index || [];
    const query = searchQuery.toLowerCase().trim();
    return index.index.filter(p => p.search_text.includes(query));
  }, [index, searchQuery]);

  // Example picks for empty state
  const examplePicks = useMemo(() => {
    if (!index) return [];
    const picks = ['Chanel No. 5', 'Acqua di Gio', 'Angel'];
    return index.index.filter(p => picks.some(pick => p.name.includes(pick))).slice(0, 3);
  }, [index]);

  if (loading) {
    return <Loading label="Loading Note Match…" />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  const getBandLabel = (band) => {
    switch (band) {
      case 'very_similar': return 'Very similar notes';
      case 'similar': return 'Similar notes';
      case 'some_overlap': return 'Some note overlap';
      default: return 'Low overlap';
    }
  };

  const handleSelectPerfume = (id) => {
    setSelectedId(id);
    setSearching(false);
    setSearchQuery('');
  };

  const handleStartSearch = () => {
    setSearching(true);
    setSelectedId(null);
  };

  const handleClear = () => {
    setSelectedId(null);
    setSearching(false);
    setSearchQuery('');
    setExpandedMatchId(null);
  };
  
  const toggleMatchExpand = (matchId) => {
    setExpandedMatchId(prev => prev === matchId ? null : matchId);
  };
  
  // Get the expanded match perfume data
  const expandedMatchPerfume = useMemo(() => {
    if (!expandedMatchId || !seed) return null;
    return seed.fragrances.find(f => f.id === expandedMatchId);
  }, [expandedMatchId, seed]);

  return (
    <div className="noteMatchPage">
      <header className="noteMatchHeader">
        <h1>Note Match</h1>
        <p className="noteMatchSubtitle">
          Find similar scents by comparing their listed notes. 
          Based on {index?.total_perfumes || 0} scents with open note data.
        </p>
        <div className="noteMatchDisclaimer">
          Note match percentages are based on listed notes, not a smell test. 
          Source: CC0 data from Wikidata and public domain perfume notes.
        </div>
      </header>

      {/* Empty State */}
      {!selectedId && !searching && (
        <div className="noteMatchEmpty">
          <div className="noteMatchEmptyContent">
            <h2>Pick a scent to find similar ones</h2>
            <p className="noteMatchCoverage">
              {index?.total_perfumes || 0} scents with open note data • {index?.perfumes_with_matches || 0} with matches
            </p>
            <button 
              className="noteMatchButton noteMatchButtonPrimary"
              onClick={handleStartSearch}
            >
              Search for a scent
            </button>
            {examplePicks.length > 0 && (
              <div className="noteMatchExamples">
                <p>Or try these examples:</p>
                <div className="noteMatchExampleList">
                  {examplePicks.map(pick => (
                    <button
                      key={pick.id}
                      className="noteMatchExampleButton"
                      onClick={() => handleSelectPerfume(pick.id)}
                    >
                      <div className="noteMatchExampleName">{pick.name}</div>
                      <div className="noteMatchExampleBrand">{pick.brand}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search State */}
      {searching && !selectedId && (
        <div className="noteMatchSearch">
          <div className="noteMatchSearchHeader">
            <input
              type="text"
              className="noteMatchSearchInput"
              placeholder="Search by name or brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <button 
              className="noteMatchButton noteMatchButtonSecondary"
              onClick={handleClear}
            >
              Cancel
            </button>
          </div>
          <div className="noteMatchSearchResults">
            {filteredPerfumes.length === 0 ? (
              <p className="noteMatchNoResults">No matching scents found</p>
            ) : (
              <div className="noteMatchResultList">
                {filteredPerfumes.slice(0, 50).map(perfume => (
                  <button
                    key={perfume.id}
                    className="noteMatchResultItem"
                    onClick={() => handleSelectPerfume(perfume.id)}
                  >
                    <div className="noteMatchResultName">{perfume.name}</div>
                    <div className="noteMatchResultBrand">{perfume.brand}</div>
                    <div className="noteMatchResultMeta">
                      {perfume.note_count} notes
                      {perfume.has_matches && ` • ${perfume.match_count} matches`}
                    </div>
                  </button>
                ))}
                {filteredPerfumes.length > 50 && (
                  <p className="noteMatchMoreResults">
                    Showing first 50 of {filteredPerfumes.length} results
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result State */}
      {selectedPerfume && (
        <div className="noteMatchResult">
          <div className="noteMatchResultHeader">
            <div className="noteMatchResultHeaderContent">
              <h2>{selectedPerfume.name}</h2>
              <p className="noteMatchResultBrand">{selectedPerfume.brand}</p>
              <div className="noteMatchNotes">
                {selectedPerfume.notes.map(note => (
                  <span key={note} className="noteMatchNote">{note}</span>
                ))}
              </div>
              {selectedPerfume.notes.length < 4 && (
                <div className="noteMatchLowData">
                  Low data: fewer than 4 notes listed
                </div>
              )}
            </div>
            <button 
              className="noteMatchButton noteMatchButtonSecondary"
              onClick={handleClear}
            >
              Pick another
            </button>
          </div>

          {perfumeMatches.length === 0 ? (
            <div className="noteMatchNoMatches">
              <h3>No similar scents found</h3>
              <p>We don't have open note data for scents with similar notes to this one yet.</p>
            </div>
          ) : (
            <div className="noteMatchMatches">
              <h3>Similar scents ({perfumeMatches.length})</h3>
              <div className="noteMatchMatchList">
                {perfumeMatches.map(match => (
                  <div key={match.id} className="noteMatchMatchCard">
                    <div className="noteMatchMatchHeader">
                      <div className="noteMatchMatchTitle">
                        <div className="noteMatchMatchName">{match.name}</div>
                        <div className="noteMatchMatchBrand">{match.brand}</div>
                      </div>
                      <div className="noteMatchMatchScore">
                        <div className="noteMatchMatchPercentage" title="Based on listed notes, not a smell test">
                          {match.match_percentage}%
                        </div>
                        <div className="noteMatchMatchLabel">{getBandLabel(match.match_band)}</div>
                      </div>
                    </div>
                    <div className="noteMatchMatchBar">
                      <div 
                        className={`noteMatchMatchBarFill noteMatchMatchBar-${match.match_band}`}
                        style={{ width: `${match.match_percentage}%` }}
                      />
                    </div>
                    <div className="noteMatchMatchShared">
                      <span className="noteMatchMatchSharedLabel">
                        Shares {match.shared_count} of {selectedPerfume.notes.length} notes:
                      </span>
                      <div className="noteMatchSharedNotes">
                        {match.shared_notes.map(note => (
                          <span key={note} className="noteMatchSharedNote">{note}</span>
                        ))}
                      </div>
                    </div>
                    
                    {/* Chord diagram toggle */}
                    <button 
                      className="noteMatchChordToggle"
                      onClick={() => toggleMatchExpand(match.id)}
                      aria-expanded={expandedMatchId === match.id}
                    >
                      {expandedMatchId === match.id ? 'Hide' : 'Show'} note associations
                    </button>
                    
                    {/* Lazy-loaded chord diagram */}
                    {expandedMatchId === match.id && (
                      <div className="noteMatchChordContainer">
                        <Suspense fallback={<div className="noteMatchChordLoading">Loading chord diagram...</div>}>
                          <NoteMatchChord 
                            perfume={expandedMatchPerfume}
                            allPerfumes={seed.fragrances}
                          />
                        </Suspense>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
