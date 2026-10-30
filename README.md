# Symmetry Draw Analyzer

A complete, client-side web app that turns recent football form into a transparent draw recommendation. Enter a home team and an away team, press **Analyse draw**, and every intermediate number is displayed: the eight matches used, recency weights, weighted averages, expected goals (λ), symmetry, low-total score, Poisson draw probabilities and the final combined score.

No accounts, no authentication, no database. Live match data comes from ESPN's public football API, so it works immediately with no API key.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

## How the analysis works

### 1. Data retrieval

- Fetches the team's completed competitive matches from ESPN, covering the current season and the two previous seasons.
- Uses **home form for the home team** and **away form for the away team**. Neutral-venue fixtures (cup finals, tournaments) are not counted as home or away form. If fewer than eight fixtures at that venue exist, the remaining places are filled with the most recent matches from other venues and each row is marked `other venue` or `neutral venue`.
- Friendlies and pre-season invitationals are excluded, as are matches without a final score.
- The eight selected matches are ordered newest first and displayed with date, competition, opponent, home/away, scoreline, result and weight.

### 2. Weighted averages

Each team's eight matches get recency weights:

| Match position | Weight |
| --- | --- |
| Most recent 4 | 1.5 each |
| Older 4 | 1.0 each |

```
weighted goals = Σ(goals in match × match weight)
average goals  = weighted goals ÷ total weight (10.00 for eight matches)
```

Both average goals scored and average goals conceded are calculated this way.

### 3. Expected goals

```
Home λ = (Home attack average × 0.6) + (Away defence average × 0.4)
Away λ = (Away attack average × 0.6) + (Home defence average × 0.4)
Match total = Home λ + Away λ
```

Every substitution is shown in the app.

### 4. Draw strength components

```
Symmetry score  = 1 − min(1, |Home λ − Away λ| ÷ 0.25)
Low-total score = 1 − min(1, (Match total − 1.80) ÷ 1.00)
Draw probability = P(0-0) + P(1-1) + P(2-2)
```

The Poisson probability for a scoreline uses `P(k; λ) = e^−λ · λ^k / k!` separately for each side and multiplies the two.

The low-total component is clamped to `0.00–1.00`; a very low projected total cannot score above 1.00.

### 5. Combined score and verdict

```
Combined score = (Symmetry × 0.40) + (Low-total × 0.30) + (Draw probability × 0.30)
```

- **Strong draw candidate:** Combined ≥ 0.72 **and** Draw probability ≥ 33%
- **Borderline:** Combined from 0.58 to 0.71 (and any score ≥ 0.72 that misses the 33% probability bar)
- **No:** Combined < 0.58

The app shows the formula substitutions, both threshold checks and a plain-English explanation for the result.

## Data source and limits

- Match data is fetched directly from `site.api.espn.com` in the browser. ESPN's public endpoints require no key and send permissive CORS headers.
- Because this is a public, unofficial endpoint, team lookup or schedules can occasionally be unavailable. The app reports those failures and lets you retry.
- Team search hides women's, youth and reserve sides to keep club names unambiguous.
- If a team has fewer than eight qualifying matches on record, the app analyses the matches it has and shows the reduced sample and total weight.
- Penalty shootouts are displayed but do not change the recorded 90-minute scoreline used in the model.
- Displayed numbers are rounded, and the model uses those rounded values for the later steps; this keeps every shown formula consistent.
- The output is statistical analysis, not betting advice.

## Stack

- React 18 + TypeScript
- Vite 6
- Hand-written responsive CSS (no UI framework)
- All calculations run locally in the browser; the only network requests are team search and match schedules.

## Project layout

```
index.html
src/
  App.tsx                 app shell, form flow, loading and error states
  main.tsx                React entry point
  styles.css              full responsive design system
  components/
    TeamPicker.tsx        accessible team autocomplete
    AnalysisResult.tsx    verdict and all five analysis steps
  lib/
    analysis.ts           weighting, expected goals, Poisson, verdict
    espn.ts               team search and match retrieval
    format.ts             date/number formatting helpers
    types.ts              shared domain types
```
