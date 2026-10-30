import type { ReactNode } from 'react';
import { THRESHOLDS, type DrawAnalysis, type Verdict } from '../lib/analysis';
import { dateParts, fixed, percent, retrievedAt } from '../lib/format';
import type { Match, TeamForm } from '../lib/types';

const VERDICT_COPY: Record<Verdict, { label: string; short: string; sub: string }> = {
  strong: {
    label: 'Strong draw candidate',
    short: 'Strong',
    sub: 'Both strong thresholds are met.',
  },
  borderline: {
    label: 'Borderline draw candidate',
    short: 'Borderline',
    sub: 'A lean, not a strong signal.',
  },
  no: {
    label: 'No — not a draw candidate',
    short: 'No',
    sub: 'The model does not support a draw.',
  },
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function TeamCrest({ form, size = 30 }: { form: TeamForm; size?: number }) {
  if (form.team.logo) {
    return <img className="crest" src={form.team.logo} alt="" width={size} height={size} />;
  }
  return (
    <span className="crest crest-fallback" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(form.team.name)}
    </span>
  );
}

function Panel({
  step,
  title,
  note,
  children,
}: {
  step: string;
  title: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel" aria-label={`Step ${step}: ${title}`}>
      <header className="section-head">
        <span className="step-badge">{step}</span>
        <div>
          <h2>{title}</h2>
          {note ? <p>{note}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function MatchRow({ match }: { match: Match }) {
  const date = dateParts(match.date);
  return (
    <li className="match-row">
      <span className="match-date">
        {date.day} {date.month}
        <em>{date.year}</em>
      </span>
      <div className="match-body">
        <div className="match-line">
          <span
            className={`venue-tag venue-tag-${match.neutral ? 'neutral' : match.isHome ? 'home' : 'away'}`}
            title={match.neutral ? 'Neutral venue' : match.isHome ? 'Home' : 'Away'}
          >
            {match.neutral ? 'N' : match.isHome ? 'H' : 'A'}
          </span>
          <span className="match-opponent">{match.opponent}</span>
          <span className="match-score">
            {match.goalsFor}–{match.goalsAgainst}
          </span>
          <span className={`outcome outcome-${match.outcome}`} title={
            match.outcome === 'W' ? 'Won' : match.outcome === 'D' ? 'Drawn' : 'Lost'
          }>
            {match.outcome}
          </span>
        </div>
        <div className="match-meta">
          <span>{match.competition}</span>
          <span className={`weight-chip ${match.weight === THRESHOLDS.weightRecent ? 'weight-recent' : ''}`}>
            {match.weight.toFixed(1)}× weight
          </span>
          {match.neutral ? <span className="fill-chip neutral-chip">neutral venue</span> : null}
          {!match.venuePreferred && !match.neutral ? <span className="fill-chip">other venue</span> : null}
          {match.shootout ? (
            <span className="pens-chip">
              pens {match.shootout.for}–{match.shootout.against}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function FormCard({ form }: { form: TeamForm }) {
  const venue = form.venue === 'home' ? 'home' : 'away';
  return (
    <div className="form-card">
      <div className="form-card-head">
        <TeamCrest form={form} />
        <div className="form-card-id">
          <h3>{form.team.name}</h3>
          <p>
            {venue === 'home' ? 'Home form' : 'Away form'} · last {form.matches.length} competitive
          </p>
        </div>
        <span className="form-count">
          {form.venueMatchCount}/{form.matches.length} {venue}
        </span>
      </div>

      <ul className="match-list">
        {form.matches.map((match) => (
          <MatchRow key={match.eventId} match={match} />
        ))}
      </ul>

      {form.filledMatchCount > 0 ? (
        <p className="form-note">
          Only {form.venueMatchCount} true {venue} fixtures were available, so {form.filledMatchCount} recent{' '}
          {form.filledMatchCount === 1 ? 'match from another venue fills' : 'matches from other venues fill'} the
          last-8 sample.
        </p>
      ) : null}
    </div>
  );
}

function AverageCard({ form, average }: { form: TeamForm; average: DrawAnalysis['home'] }) {
  return (
    <div className="avg-card">
      <div className="avg-head">
        <TeamCrest form={form} size={28} />
        <div>
          <h3>{form.team.name}</h3>
          <p>
            {form.venue === 'home' ? 'Home' : 'Away'} form · {average.played} matches
          </p>
        </div>
      </div>

      <p className="avg-weight">
        Total weight <strong>{fixed(average.weightTotal)}</strong> · newest four at 1.5×, older four at 1.0×
      </p>

      <div className="avg-row">
        <span className="avg-label">Weighted goals scored</span>
        <strong className="avg-value">{fixed(average.scored.weightedTotal)}</strong>
      </div>
      <div className="avg-row avg-row-emphasis">
        <span className="avg-label">
          Average goals scored
          <small>
            {fixed(average.scored.weightedTotal)} ÷ {fixed(average.weightTotal)} = {fixed(average.scored.average)}
          </small>
        </span>
        <strong className="avg-value">{fixed(average.scored.average)}</strong>
      </div>

      <div className="avg-row">
        <span className="avg-label">Weighted goals conceded</span>
        <strong className="avg-value">{fixed(average.conceded.weightedTotal)}</strong>
      </div>
      <div className="avg-row avg-row-emphasis">
        <span className="avg-label">
          Average goals conceded
          <small>
            {fixed(average.conceded.weightedTotal)} ÷ {fixed(average.weightTotal)} ={' '}
            {fixed(average.conceded.average)}
          </small>
        </span>
        <strong className="avg-value">{fixed(average.conceded.average)}</strong>
      </div>
    </div>
  );
}

function ComponentCard({
  title,
  weight,
  score,
  precision = 2,
  formula,
  children,
  extra,
}: {
  title: string;
  weight: string;
  score: number;
  precision?: number;
  formula: ReactNode;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="component-card">
      <div className="component-head">
        <span className="component-title">{title}</span>
        <span className="component-weight">{weight}</span>
      </div>
      <strong className="component-score">{fixed(score, precision)}</strong>
      <div className="mini-bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, Math.max(0, score * 100))}%` }} />
      </div>
      <div className="component-formula">{formula}</div>
      <p>{children}</p>
      {extra}
    </div>
  );
}

function CheckRow({ pass, label, value }: { pass: boolean; label: string; value: string }) {
  return (
    <div className={`check ${pass ? 'check-pass' : 'check-fail'}`}>
      <span className="check-icon" aria-hidden="true">
        {pass ? '✓' : '✕'}
      </span>
      <span className="check-label">{label}</span>
      <strong className="check-value">{value}</strong>
    </div>
  );
}

export default function AnalysisResult({ analysis }: { analysis: DrawAnalysis }) {
  const { homeForm, awayForm, home, away, symmetry, lowTotal, draw, combined } = analysis;
  const verdict = VERDICT_COPY[analysis.verdict];
  const homeLambda = fixed(analysis.lambdaHome);
  const awayLambda = fixed(analysis.lambdaAway);
  const total = fixed(analysis.matchTotal);
  const homeAttack = fixed(home.scored.average);
  const awayDefence = fixed(away.conceded.average);
  const awayAttack = fixed(away.scored.average);
  const homeDefence = fixed(home.conceded.average);
  const homeAttackPart = fixed(home.scored.average * THRESHOLDS.attackWeight);
  const awayDefencePart = fixed(away.conceded.average * THRESHOLDS.defenceWeight);
  const awayAttackPart = fixed(away.scored.average * THRESHOLDS.attackWeight);
  const homeDefencePart = fixed(home.conceded.average * THRESHOLDS.defenceWeight);

  const fetchedAt = [homeForm.fetchedAt, awayForm.fetchedAt].sort()[0] ?? '';

  return (
    <div className="results" id="analysis" aria-live="polite">
      <section className={`verdict verdict-${analysis.verdict}`} aria-label="Final recommendation">
        <div className="verdict-top">
          <div className="verdict-main">
            <p className="verdict-eyebrow">
              {homeForm.team.name} <span>vs</span> {awayForm.team.name}
            </p>
            <h2>{verdict.label}</h2>
            <p className="verdict-copy">{analysis.explanation}</p>
          </div>
          <div className="verdict-score">
            <span className="verdict-score-value">{fixed(combined.score, 3)}</span>
            <span className="verdict-score-label">Combined score</span>
            <span className="verdict-score-sub">{verdict.sub}</span>
          </div>
        </div>

        <div className="meter" aria-hidden="true">
          <div className="meter-track">
            <span className="meter-zone meter-no" style={{ width: '58%' }} />
            <span className="meter-zone meter-border" style={{ width: '14%' }} />
            <span className="meter-zone meter-strong" style={{ width: '28%' }} />
            <span
              className="meter-pin"
              style={{ left: `${Math.min(100, Math.max(0, combined.score * 100))}%` }}
            />
          </div>
          <div className="meter-caption">
            <span>0.00 no</span>
            <span>0.58 borderline</span>
            <span>0.72 strong</span>
            <span>1.00</span>
          </div>
        </div>

        <div className="verdict-stats">
          <div>
            <span>Draw probability</span>
            <strong>{fixed(draw.percent, 1)}%</strong>
          </div>
          <div>
            <span>Match total λ</span>
            <strong>{total}</strong>
          </div>
          <div>
            <span>{homeForm.team.name} λ</span>
            <strong>{homeLambda}</strong>
          </div>
          <div>
            <span>{awayForm.team.name} λ</span>
            <strong>{awayLambda}</strong>
          </div>
        </div>
      </section>

      <Panel
        step="1"
        title="Data retrieval"
        note={`Last 8 competitive matches each · home form for ${homeForm.team.name}, away form for ${awayForm.team.name}. Friendlies are excluded.`}
      >
        <div className="form-grid">
          <FormCard form={homeForm} />
          <FormCard form={awayForm} />
        </div>
      </Panel>

      <Panel
        step="2"
        title="Weighted averages"
        note="The four most recent matches are weighted 1.5× and the next four 1.0×. Each average is the weighted goals total divided by the total weight."
      >
        <div className="avg-grid">
          <AverageCard form={homeForm} average={home} />
          <AverageCard form={awayForm} average={away} />
        </div>
        <p className="inline-note">
          Weighted total = Σ(goals × weight). Total weight applied: {fixed(home.weightTotal)} for{' '}
          {homeForm.team.name} and {fixed(away.weightTotal)} for {awayForm.team.name}.
        </p>
      </Panel>

      <Panel step="3" title="Expected goals (λ)" note="Attack is weighted 60%, the opponent's defence 40%.">
        <div className="calc-grid">
          <div className="calc">
            <h3>{homeForm.team.name} · home λ</h3>
            <p className="calc-label">Home attack avg × 0.6 + Away defence avg × 0.4</p>
            <p className="calc-line">
              ({homeAttack} × 0.6) + ({awayDefence} × 0.4)
            </p>
            <p className="calc-line">
              = {homeAttackPart} + {awayDefencePart}
            </p>
            <div className="calc-result">
              {homeLambda}
              <span>λ home</span>
            </div>
          </div>

          <div className="calc">
            <h3>{awayForm.team.name} · away λ</h3>
            <p className="calc-label">Away attack avg × 0.6 + Home defence avg × 0.4</p>
            <p className="calc-line">
              ({awayAttack} × 0.6) + ({homeDefence} × 0.4)
            </p>
            <p className="calc-line">
              = {awayAttackPart} + {homeDefencePart}
            </p>
            <div className="calc-result">
              {awayLambda}
              <span>λ away</span>
            </div>
          </div>
        </div>

        <div className="total-strip">
          <span>Match total</span>
          <strong>
            {homeLambda} + {awayLambda} = {total}
          </strong>
        </div>
      </Panel>

      <Panel
        step="4"
        title="Draw strength components"
        note="Each component is scored between 0 and 1 before weighting."
      >
        <div className="components">
          <ComponentCard
            title="Symmetry score"
            weight="40% weight"
            score={symmetry.score}
            formula={
              <>
                <div>1 − min(1, |{homeLambda} − {awayLambda}| ÷ 0.25)</div>
                <div>= 1 − min(1, {fixed(symmetry.gap)} ÷ 0.25)</div>
                <div>= {fixed(symmetry.score)}</div>
              </>
            }
          >
            Closer expected-goal figures mean a higher symmetry score. A gap of {fixed(symmetry.gap)} goals gives{' '}
            {fixed(symmetry.score)}.
          </ComponentCard>

          <ComponentCard
            title="Low-total score"
            weight="30% weight"
            score={lowTotal.score}
            formula={
              <>
                <div>1 − min(1, ({total} − 1.80) ÷ 1.00)</div>
                <div>= 1 − min(1, {fixed(lowTotal.difference)} ÷ 1.00)</div>
                <div>= {fixed(lowTotal.raw, 3)}</div>
              </>
            }
          >
            {lowTotal.clamped
              ? `A projected total below 1.80 goals would score above 1.00, so the component is held at ${fixed(
                  lowTotal.score,
                )}.`
              : `A projected ${total} goals is ${fixed(
                  Math.abs(lowTotal.difference),
                )} ${lowTotal.difference >= 0 ? 'above' : 'below'} the 1.80 baseline.`}
          </ComponentCard>

          <ComponentCard
            title="Draw probability"
            weight="30% weight"
            score={draw.total}
            precision={3}
            formula={
              <>
                <div>P(0-0) + P(1-1) + P(2-2)</div>
                <div>= {fixed(draw.p00, 3)} + {fixed(draw.p11, 3)} + {fixed(draw.p22, 3)}</div>
                <div>= {fixed(draw.total, 3)}</div>
              </>
            }
            extra={
              <div className="poisson-list">
                <span>
                  P(0-0) <b>{fixed(draw.p00, 4)}</b>
                </span>
                <span>
                  P(1-1) <b>{fixed(draw.p11, 4)}</b>
                </span>
                <span>
                  P(2-2) <b>{fixed(draw.p22, 4)}</b>
                </span>
                <span className="poisson-total">
                  Total <b>{percent(draw.total, 1)}</b>
                </span>
              </div>
            }
          >
            Poisson probability that the match lands on 0-0, 1-1 or 2-2, using {homeLambda} and {awayLambda} as the
            two scoring rates.
          </ComponentCard>
        </div>
      </Panel>

      <Panel
        step="5"
        title="Final recommendation"
        note="Combined score = 40% symmetry + 30% low total + 30% draw probability."
      >
        <div className="final-formula">
          <div className="final-formula-row">
            <span>Symmetry</span>
            <code>
              {fixed(symmetry.score)} × 0.40 = {fixed(combined.symmetryPart, 3)}
            </code>
          </div>
          <div className="final-formula-row">
            <span>Low total</span>
            <code>
              {fixed(lowTotal.score)} × 0.30 = {fixed(combined.lowTotalPart, 3)}
            </code>
          </div>
          <div className="final-formula-row">
            <span>Draw probability</span>
            <code>
              {fixed(draw.total, 3)} × 0.30 = {fixed(combined.drawPart, 3)}
            </code>
          </div>
          <div className="final-formula-total">
            <span>Combined score</span>
            <strong>{fixed(combined.score, 3)}</strong>
          </div>
        </div>

        <div className="check-list">
          <CheckRow
            pass={analysis.checks.score}
            label={`Combined score ≥ ${THRESHOLDS.strongScore.toFixed(2)}`}
            value={fixed(combined.score, 3)}
          />
          <CheckRow
            pass={analysis.checks.probability}
            label={`Draw probability ≥ ${(THRESHOLDS.strongProbability * 100).toFixed(0)}%`}
            value={percent(draw.total, 1)}
          />
          <div className={`verdict-line verdict-line-${analysis.verdict}`}>
            <span>Result</span>
            <strong>{verdict.label}</strong>
          </div>
        </div>

        <p className="inline-note">
          A strong call needs both bars: a combined score of at least 0.72 and a draw probability of at least 33%.
          0.58–0.71 is borderline; below 0.58 is a no.
        </p>
      </Panel>

      <p className="source-note">
        Match data from ESPN&apos;s public football API, retrieved {retrievedAt(fetchedAt)}. Friendlies excluded;
        penalties do not change the recorded scoreline. This is a statistical analysis, not betting advice.
      </p>
    </div>
  );
}
