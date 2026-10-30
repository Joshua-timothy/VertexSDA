import type { Match, TeamForm } from './types';

export type Verdict = 'strong' | 'borderline' | 'no';

export interface AverageBlock {
  weightedTotal: number;
  average: number;
}

export interface WeightedAverages {
  weightTotal: number;
  played: number;
  scored: AverageBlock;
  conceded: AverageBlock;
}

export interface DrawAnalysis {
  homeForm: TeamForm;
  awayForm: TeamForm;
  home: WeightedAverages;
  away: WeightedAverages;
  lambdaHome: number;
  lambdaAway: number;
  matchTotal: number;
  symmetry: { gap: number; ratio: number; score: number };
  lowTotal: { difference: number; ratio: number; raw: number; score: number; clamped: boolean };
  draw: { p00: number; p11: number; p22: number; total: number; percent: number };
  combined: { symmetryPart: number; lowTotalPart: number; drawPart: number; score: number };
  verdict: Verdict;
  checks: { score: boolean; probability: boolean };
  explanation: string;
}

export const THRESHOLDS = {
  weightRecent: 1.5,
  weightOlder: 1,
  attackWeight: 0.6,
  defenceWeight: 0.4,
  symmetryScale: 0.25,
  totalBaseline: 1.8,
  totalScale: 1,
  symmetryContribution: 0.4,
  lowTotalContribution: 0.3,
  drawContribution: 0.3,
  strongScore: 0.72,
  strongProbability: 0.33,
  borderlineScore: 0.58,
} as const;

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function poisson(goals: number, lambda: number): number {
  let factorial = 1;
  for (let i = 2; i <= goals; i += 1) factorial *= i;
  return (Math.exp(-lambda) * lambda ** goals) / factorial;
}

function weightedAverages(matches: Match[]): WeightedAverages {
  const weightTotal = matches.reduce((sum, match) => sum + match.weight, 0);
  const safeTotal = weightTotal > 0 ? weightTotal : 1;
  const scoredTotal = matches.reduce((sum, match) => sum + match.goalsFor * match.weight, 0);
  const concededTotal = matches.reduce((sum, match) => sum + match.goalsAgainst * match.weight, 0);

  return {
    weightTotal: round(weightTotal, 2),
    played: matches.length,
    scored: {
      weightedTotal: round(scoredTotal, 2),
      average: round(scoredTotal / safeTotal, 2),
    },
    conceded: {
      weightedTotal: round(concededTotal, 2),
      average: round(concededTotal / safeTotal, 2),
    },
  };
}

export function analyse(homeForm: TeamForm, awayForm: TeamForm): DrawAnalysis {
  const home = weightedAverages(homeForm.matches);
  const away = weightedAverages(awayForm.matches);

  const lambdaHome = round(
    home.scored.average * THRESHOLDS.attackWeight +
      away.conceded.average * THRESHOLDS.defenceWeight,
    2,
  );
  const lambdaAway = round(
    away.scored.average * THRESHOLDS.attackWeight +
      home.conceded.average * THRESHOLDS.defenceWeight,
    2,
  );
  const matchTotal = round(lambdaHome + lambdaAway, 2);

  const gap = round(Math.abs(lambdaHome - lambdaAway), 2);
  const symmetryRatio = gap / THRESHOLDS.symmetryScale;
  const symmetryScore = round(1 - Math.min(1, symmetryRatio), 2);

  const difference = round(matchTotal - THRESHOLDS.totalBaseline, 2);
  const lowTotalRatio = difference / THRESHOLDS.totalScale;
  const lowTotalRaw = 1 - Math.min(1, lowTotalRatio);
  const lowTotalScore = round(Math.min(1, Math.max(0, lowTotalRaw)), 2);

  const p00 = poisson(0, lambdaHome) * poisson(0, lambdaAway);
  const p11 = poisson(1, lambdaHome) * poisson(1, lambdaAway);
  const p22 = poisson(2, lambdaHome) * poisson(2, lambdaAway);
  const drawTotal = p00 + p11 + p22;

  const symmetryPart = symmetryScore * THRESHOLDS.symmetryContribution;
  const lowTotalPart = lowTotalScore * THRESHOLDS.lowTotalContribution;
  const drawPart = round(drawTotal, 3) * THRESHOLDS.drawContribution;
  const combinedScore = round(symmetryPart + lowTotalPart + drawPart, 3);
  const drawPercent = round(drawTotal * 100, 1);

  // Compare the probability as displayed (one decimal) so the shown number and the
  // threshold marker can never appear to disagree.
  const checks = {
    score: combinedScore >= THRESHOLDS.strongScore,
    probability: drawPercent >= THRESHOLDS.strongProbability * 100,
  };
  const verdict: Verdict =
    checks.score && checks.probability
      ? 'strong'
      : combinedScore >= THRESHOLDS.borderlineScore
        ? 'borderline'
        : 'no';

  return {
    homeForm,
    awayForm,
    home,
    away,
    lambdaHome,
    lambdaAway,
    matchTotal,
    symmetry: { gap, ratio: round(symmetryRatio, 3), score: symmetryScore },
    lowTotal: {
      difference,
      ratio: round(lowTotalRatio, 3),
      raw: round(lowTotalRaw, 3),
      score: lowTotalScore,
      clamped: lowTotalRaw > 1 || lowTotalRaw < 0,
    },
    draw: { p00, p11, p22, total: drawTotal, percent: drawPercent },
    combined: {
      symmetryPart: round(symmetryPart, 3),
      lowTotalPart: round(lowTotalPart, 3),
      drawPart: round(drawPart, 3),
      score: combinedScore,
    },
    verdict,
    checks,
    explanation: explain(verdict, {
      lambdaHome,
      lambdaAway,
      matchTotal,
      symmetryScore,
      lowTotalScore,
      drawPercent,
      combinedScore,
      checks,
    }),
  };
}

function explain(
  verdict: Verdict,
  data: {
    lambdaHome: number;
    lambdaAway: number;
    matchTotal: number;
    symmetryScore: number;
    lowTotalScore: number;
    drawPercent: number;
    combinedScore: number;
    checks: { score: boolean; probability: boolean };
  },
): string {
  const {
    lambdaHome,
    lambdaAway,
    matchTotal,
    symmetryScore,
    lowTotalScore,
    drawPercent,
    combinedScore,
    checks,
  } = data;
  const pair = `${lambdaHome.toFixed(2)} vs ${lambdaAway.toFixed(2)}`;

  if (verdict === 'strong') {
    return `The two expected-goal figures are tightly matched at ${pair}, which keeps symmetry high at ${symmetryScore.toFixed(
      2,
    )}. A match total of ${matchTotal.toFixed(
      2,
    )} goals leaves the low-total component at ${lowTotalScore.toFixed(
      2,
    )}, and the Poisson model puts ${drawPercent.toFixed(
      1,
    )}% on 0-0, 1-1 or 2-2. The combined score of ${combinedScore.toFixed(
      3,
    )} clears 0.72 and the draw probability clears 33%, so this is the model's strongest draw profile.`;
  }

  if (verdict === 'borderline') {
    const reason = checks.score
      ? `the Poisson draw cluster is only ${drawPercent.toFixed(
          1,
        )}%, short of the 33% requirement for a strong call`
      : `the combined score of ${combinedScore.toFixed(
          3,
        )} is in the 0.58–0.71 band rather than above 0.72`;
    return `This fixture leans draw-ish but does not fully qualify: ${reason}. Symmetry is ${symmetryScore.toFixed(
      2,
    )} and the low-total component is ${lowTotalScore.toFixed(
      2,
    )} on a projected ${matchTotal.toFixed(
      2,
    )} goals. Treat it as a soft lean, not a strong draw signal.`;
  }

  return `This does not fit the draw profile. The expected-goal gap (${pair}) and a projected ${matchTotal.toFixed(
    2,
  )} goals produce symmetry ${symmetryScore.toFixed(
    2,
  )}, low-total ${lowTotalScore.toFixed(2)} and a ${drawPercent.toFixed(
    1,
  )}% Poisson chance of 0-0, 1-1 or 2-2. That combines to ${combinedScore.toFixed(
    3,
  )}, below the 0.58 threshold, so the model advises no.`;
}
