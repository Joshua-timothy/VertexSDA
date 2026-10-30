import { useEffect, useRef, useState, type FormEvent } from 'react';
import AnalysisResult from './components/AnalysisResult';
import TeamPicker, { type FieldState } from './components/TeamPicker';
import { analyse, type DrawAnalysis } from './lib/analysis';
import { fetchTeamForm, searchTeams } from './lib/espn';
import type { Team } from './lib/types';

const EMPTY_FIELD: FieldState = { query: '', team: null };

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong while building the analysis. Please try again.';
}

async function resolveTeam(field: FieldState): Promise<Team | null> {
  if (field.team) return field.team;
  const results = await searchTeams(field.query);
  return results[0] ?? null;
}

export default function App() {
  const [homeField, setHomeField] = useState<FieldState>(EMPTY_FIELD);
  const [awayField, setAwayField] = useState<FieldState>(EMPTY_FIELD);
  const [analysis, setAnalysis] = useState<DrawAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!analysis) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resultsRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [analysis]);

  function updateHome(next: FieldState) {
    setHomeField(next);
    setAnalysis(null);
    setError(null);
  }

  function updateAway(next: FieldState) {
    setAwayField(next);
    setAnalysis(null);
    setError(null);
  }

  function swapTeams() {
    setHomeField(awayField);
    setAwayField(homeField);
    setAnalysis(null);
    setError(null);
  }

  async function handleAnalyse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (!homeField.query.trim() || !awayField.query.trim()) {
      setError('Enter both a home team and an away team to run the analysis.');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const [homeTeam, awayTeam] = await Promise.all([
        resolveTeam(homeField),
        resolveTeam(awayField),
      ]);

      if (!homeTeam) {
        setError(`No team found for “${homeField.query.trim()}”. Pick one from the suggestions.`);
        return;
      }
      if (!awayTeam) {
        setError(`No team found for “${awayField.query.trim()}”. Pick one from the suggestions.`);
        return;
      }
      if (homeTeam.id === awayTeam.id) {
        setError('Choose two different teams — the same club cannot play itself.');
        return;
      }

      setHomeField({ query: homeTeam.name, team: homeTeam });
      setAwayField({ query: awayTeam.name, team: awayTeam });

      const [homeForm, awayForm] = await Promise.all([
        fetchTeamForm(homeTeam, 'home'),
        fetchTeamForm(awayTeam, 'away'),
      ]);

      setAnalysis(analyse(homeForm, awayForm));
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32">
                <path d="M6 10h20M6 22h20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                <circle cx="11" cy="16" r="2.4" fill="currentColor" />
                <circle cx="21" cy="16" r="2.4" fill="currentColor" />
              </svg>
            </span>
            <span className="brand-text">
              <strong>Symmetry</strong>
              <small>Draw Analyzer</small>
            </span>
          </div>
          <span className="live-pill">
            <span className="live-dot" aria-hidden="true" />
            Live ESPN data
          </span>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <p className="hero-eyebrow">Football draw model</p>
          <h1>
            Symmetry <span>Draw</span> Analyzer
          </h1>
          <p>
            Compare two teams and see exactly how their recent form becomes an expected-goals picture, a Poisson draw
            probability and one clear recommendation. Every number is shown.
          </p>
        </section>

        <form className="analyser-card" onSubmit={handleAnalyse} noValidate>
          <div className="fields">
            <TeamPicker
              side="home"
              label="Home team"
              placeholder="Search a club or national team"
              field={homeField}
              onChange={updateHome}
              disabled={loading}
            />

            <button
              type="button"
              className="swap-btn"
              onClick={swapTeams}
              disabled={loading}
              aria-label="Swap home and away teams"
              title="Swap teams"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M4 7h11m0 0-3-3m3 3-3 3M16 13H5m0 0 3-3m-3 3 3 3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <TeamPicker
              side="away"
              label="Away team"
              placeholder="Search a club or national team"
              field={awayField}
              onChange={updateAway}
              disabled={loading}
            />
          </div>

          <div className="form-footer">
            <p className="form-hint">
              Last 8 competitive matches per team · home form for the home side, away form for the away side.
            </p>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="spinner" aria-hidden="true" /> : null}
              {loading ? 'Analysing…' : 'Analyse draw'}
              {!loading ? (
                <svg viewBox="0 0 20 20" aria-hidden="true" className="btn-arrow">
                  <path
                    d="M4 10h11m0 0-4-4m4 4-4 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </button>
          </div>

          {error ? (
            <div className="notice" role="alert">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M10 6v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="10" cy="14" r="1" fill="currentColor" />
              </svg>
              <span>{error}</span>
            </div>
          ) : null}
        </form>

        {loading ? (
          <div className="loading-line" role="status">
            <span className="spinner" aria-hidden="true" />
            Fetching recent results and running the Poisson model…
          </div>
        ) : null}

        <div ref={resultsRef}>
          {analysis ? (
            <AnalysisResult analysis={analysis} />
          ) : !loading ? (
            <section className="empty-state" aria-label="How the model works">
              <div className="empty-card">
                <span>01</span>
                <strong>Recency-weighted form</strong>
                <p>Last 8 competitive matches. The newest four count 1.5×, the older four 1.0×.</p>
              </div>
              <div className="empty-card">
                <span>02</span>
                <strong>Expected goals</strong>
                <p>Each attack contributes 60% and the opponent&apos;s defence 40% to home and away λ.</p>
              </div>
              <div className="empty-card">
                <span>03</span>
                <strong>Poisson draw test</strong>
                <p>0-0, 1-1 and 2-2 are summed, then blended with symmetry and match total.</p>
              </div>
            </section>
          ) : null}
        </div>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <span>Live match data: ESPN public football API. No accounts, no database.</span>
          <span>Statistical analysis only — not betting advice.</span>
        </div>
      </footer>
    </div>
  );
}
