import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { searchTeams } from '../lib/espn';
import type { Team } from '../lib/types';

export interface FieldState {
  query: string;
  team: Team | null;
}

interface Props {
  side: 'home' | 'away';
  label: string;
  placeholder: string;
  field: FieldState;
  onChange: (next: FieldState) => void;
  disabled?: boolean;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

export default function TeamPicker({ side, label, placeholder, field, onChange, disabled }: Props) {
  const inputId = useId();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<Team[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const query = field.query.trim();
    if (field.team || query.length < 2) {
      setResults([]);
      setOpen(false);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const teams = await searchTeams(query);
        if (cancelled) return;
        setResults(teams);
        setFailed(false);
        setOpen(true);
        setActive(0);
      } catch {
        if (cancelled) return;
        setResults([]);
        setFailed(true);
        setOpen(true);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [field.query, field.team]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function choose(team: Team) {
    onChange({ query: team.name, team });
    setResults([]);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) {
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && results.length > 0) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      const team = results[active];
      if (team) {
        event.preventDefault();
        choose(team);
      }
    }
  }

  return (
    <div className={`field field-${side}`} ref={wrapRef}>
      <div className="field-head">
        <label htmlFor={inputId}>{label}</label>
        <span className={`venue-pill venue-pill-${side}`}>{side === 'home' ? 'Home form' : 'Away form'}</span>
      </div>

      <div className={`input-shell ${open ? 'input-shell-open' : ''}`}>
        {field.team?.logo ? (
          <img className="input-crest" src={field.team.logo} alt="" width={28} height={28} />
        ) : field.team ? (
          <span className="crest-fallback">{initials(field.team.name)}</span>
        ) : (
          <svg className="input-icon" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="m13.5 13.5 3.2 3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        )}

        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${results[active].id}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={field.query}
          disabled={disabled}
          onChange={(event) => onChange({ query: event.target.value, team: null })}
          onFocus={() => {
            if (!field.team && results.length > 0) setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />

        {searching ? <span className="spinner spinner-small" aria-hidden="true" /> : null}
      </div>

      {open ? (
        <div className="team-menu" id={listId} role="listbox" aria-label={`${label} search results`}>
          {searching && results.length === 0 ? <p className="menu-note">Searching teams…</p> : null}
          {!searching && failed ? (
            <p className="menu-note">Team search is unavailable right now. Check your connection and try again.</p>
          ) : null}
          {!searching && !failed && results.length === 0 ? (
            <p className="menu-note">No teams found. Try the full club name, e.g. “Manchester United”.</p>
          ) : null}

          {results.map((team, index) => (
            <button
              key={team.id}
              type="button"
              role="option"
              id={`${listId}-${team.id}`}
              aria-selected={index === active}
              className={`team-option ${index === active ? 'team-option-active' : ''}`}
              onClick={() => choose(team)}
            >
              {team.logo ? (
                <img src={team.logo} alt="" width={26} height={26} />
              ) : (
                <span className="crest-fallback crest-fallback-small">{initials(team.name)}</span>
              )}
              <span className="team-option-text">
                <strong>{team.name}</strong>
                <small>{team.leagueLabel}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
