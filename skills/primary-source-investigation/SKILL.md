---
name: primary-source-investigation
description: "Use when asked to find out who or what something 'really' is, or to research beyond search snippets — investigate via primary sources (EDGAR, GitHub API, patent text, official statements) and separate independently-verifiable facts from self-reported or claimed ones. Seen on the who-is-Christian-Cooper task and the Buhler patent extraction."
---

# Primary-source investigation

## Premise

"Can you do actual research and not a web search?" is a signal to leave search snippets
behind and dig primary sources directly, then separate what is independently verifiable
from what is only claimed. The traces did this on a person lookup (Christian H. Cooper) and
on patent/quantitative extraction (Buhler/Aurigema patents). The distinction between
verifiable and self-reported is the answer.

## Steps that worked

1. **Set up a plan and run several independent probes in parallel.** SEC/EDGAR filings,
   GitHub API, Wikipedia revision history, patent records (Google Patents / USPTO), official
   statements and original wires.
2. **Prefer primary, fetched text over snippets.** Download the patent HTML/PDF and parse
   the description (the traces extracted a 104 KB patent description); fetch official
   statement pages and wire pages directly rather than relying on search titles.
3. **Separate the verifiable core from the self-reported or claimed.** Explicitly mark what
   is independently verifiable vs self-reported, patent claims, talk claims, simulation
   output, and replicated evidence. This separation is the deliverable.
4. **Never invent a missing number.** If a value is not in the source, say "missing." The
   traces carried "do not invent values" as a hard constraint on patent tables.
5. **Disambiguate namesakes before reporting.** The person lookup split Christian Cooper
   (Central Park birder) from Christian H. Cooper (derivatives trader) on the middle initial.
6. **Read reputation signals out of the primary artifacts, not just their text.** For a
   person: pull the Wikipedia revision history and flag single-purpose accounts and a
   `{{connected contributor}}` tag (COI). On GitHub, count the fork ratio and inspect commit
   authorship (agent/bot accounts, open-and-self-merge PRs) to judge how much is original
   versus agent-driven.

## Failure modes seen in the traces

- **web_search gives only snippets/URLs** → fetch the primary pages and parse full text.
- **Confusing a namesake** → check the middle initial / distinguishing field and split the
  entries.
- **Treating a vendor or talk claim as established fact** → label claims vs replicated
  evidence and keep them in separate sections.
- **Inventing a figure to fill a gap** → state "missing" and move on; the report must still
  be self-contained without fabricated numbers.
