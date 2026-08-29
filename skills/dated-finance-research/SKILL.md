---
name: dated-finance-research
description: "Use when asked to explain a financial or market move over a dated window (FX, rates, central-bank action, intervention) with sourced, dated prints and verbose 'thought process' prose — or to write a Golden Response / Critical Elements for a finance Studio task. Seen across the yen trace cluster."
---

# Dated finance research and write-up

## Premise

When the task is "explain the movement in X over the last N months," the correct loop is
always the same: gather real dated prints from primary sources first, then write verbose
finance-professional prose that leads with the answer and attributes every number. The
traces ran this repeatedly on the Japanese yen (mid-May → mid-Aug 2026) and on the Enki FR
golden-and-grade task. Do not re-derive it; reuse it.

## Steps that worked

1. **Establish the actual window before writing.** State the calendar span explicitly
   (e.g. "mid-May 2026 through Saturday 15 August 2026") so the sources you pull are in
   scope.
2. **Search for dated prints, do not assume levels.** Open with web searches for the asset
   and window; treat search results as leads, not facts.
3. **When search returns only URLs and titles (no body), fetch the pages directly.** The
   traces repeatedly hit this: 2026-dated sources surfaced as titles, so the agent fetched
   article bodies to extract actual dated prints before writing a word.
4. **Go official/primary first, then major outlets, then aggregators.** Ministry/Treasury,
   central bank, original wire before downstream commentary. The Enki variant makes this
   an explicit ordering rule.
5. **Reconcile conflicting vendor figures against the official statement.** The traces
   found intervention-scale figures of $34B / $50B / $59B / $96B across vendors and resolved
   them by locating the official MOF/Treasury statements and the exact trigger level.
6. **Attribute every number; never invent a level.** Where only a zone is known, say it is
   a zone and do not dress it up as a tick. With no terminal in front of you, say so up
   front. Do not invent a trigger print, a ministry total, or a single close across vendors.
7. **Show arithmetic when a percent or net is derived**, with every input on the page.
8. **Write the prose as a thought process**, not a calculator-press list: Key Concept,
   interlocking practice tasks, every arithmetic line, then the trap. Lead with the answer;
   put inline titled hyperlinks on load-bearing claims; add a short disclaimer only when a
   vendor or unpublished official print matters.

## The Enki golden-and-grade variant

When the task is a Studio golden/grade rather than a bare explainer, produce in this order
and do not grade before the Golden is written:

1. **Research log** — every URL visited, split into used-and-cited (numbered, titled links)
   vs visited-not-used (raw URLs, numbering continues); note paywalls.
2. **Golden Response** — finance-professional length, lead with the answer, period or clock
   sections, inline titled hyperlinks on load-bearing claims.
3. **Critical Elements** — assertions the finished answer must contain (a figure, date,
   quote, comparison, conclusion), each already present in the Golden; not method items
   like "search" or "do not average."
4. **A/B grades** — six 1/3/5 scores (4 and 2 for in-between): Factual accuracy, Grounding,
   Source quality, Thoroughness, Relevance, Clarity; then overall preference 1–7 with 3–5
   drivers. Only after the Golden and both responses exist.
5. **Auto QC fixes** — the smallest change that clears the flag; prefer rewriting an
   evidence box or adding one Golden sentence over padding.

## Failure modes seen in the traces

- **Search returns URLs/titles but no content** → fetch the pages directly and extract the
  bodies before writing.
- **Conflicting scale figures across vendors** → do not pick one. Intervention totals are
  published by the MOF on a monthly lag, so on the day there is usually no official number
  to reconcile against: attribute the vendor estimates, note the lag, and use the wire that
  carries the official statement verbatim instead of hunting for an unpublished total.
- **Inventing a level or trigger print** → the traces carry the hard rule "do not invent
  levels"; describe zones, attribute numbers, and say "missing" where a number is absent.
- **Answering a nearby essay instead of the prompt** → read the exact questions back and hit
  each; if the prompt says "through the day," name which calendar day is the dealing day vs
  the confirmation day.
- **Grading A/B before the Golden exists** → refuse; the order is Golden first, then grades.
