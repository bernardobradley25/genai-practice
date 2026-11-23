# Reflow

Reflow is a prototype coaching experience for adult amateur athletes balancing running, recreational sport, and strength training.

## Prototype revision November 23 2026

**Reviewer links:** [Live prototype](https://reflow-training-coach.replit.app) · [GitHub source](https://github.com/bernardobradley25/genai-practice)

**Release status:** The initial revision in [PR #1](https://github.com/bernardobradley25/genai-practice/pull/1) was published and verified on November 23, 2026. The public-demo polish below has passed local checks and is prepared for deployment. Publication evidence is recorded separately after live verification.

### Feedback and response

Three anonymous Canvas reviewers reported that they could not access the README, GitHub link, or prototype. The app URL was in MVP Attempt 1, GitHub in Attempt 2, and Attempt 3 contained only “The readme include the 3 cases.” The latest attempt lacked the links; this is consistent with the reviewers’ comments. No usability or coaching-quality conclusions can be drawn from those inaccessible reviews.

The revision puts instructions and repository links inside the app, adds sample prompts, and prepares a single submission containing both links, the evaluation, and AI disclosure.

### Public demo polish

The release scope is a polished public demonstration using Jordan’s fictional sample week. It does not collect accounts or save personal training plans.

- Reuses the approved smoke-test identity: official open-loop Reflow logo, white canvas, military olive actions, berry running/strength, and gold recreational sport. Fraunces headings and DM Sans text are served locally, with font licenses included.
- Presents seven chronological days and groups moved sessions under their actual day. A strength session moved from Friday to Wednesday appears with Wednesday soccer, in time order, while Friday becomes empty.
- Adds **Undo last change**, **Stop reply**, preserved drafts after failures, bounded waiting, and cancellation on reset. Stops do not accidentally resubmit the same message.
- Calculates the proposal’s run/sport-day total and lists the days in application code; strength is tracked separately. The model receives stable session IDs, current calendar facts, and whether earlier proposals were applied, dismissed, or became outdated.
- Improves mobile review cards, readable chat, keyboard skip navigation and focus, page zoom, and in-context fictional-data guidance. The footer stays in normal document flow.
- Adds a per-process limit of 100 AI requests/hour and three concurrent calls, a 45-second upstream deadline, no automatic model retry, and input size checks. Stops release capacity. These are bounded-demo controls, not a durable account-wide spending cap: restarts and multiple instances reset/multiply the allowance.

### What changed

- One shared validator now runs on the server before a proposal is offered and in the browser before it is applied.
- Overlaps are blocked for all sports, including strength. Partial overlaps count; back-to-back sessions are permitted. Duration ranges reserve their upper bound.
- Active sessions require a valid clock time and a positive duration expressed in minutes. Sessions crossing midnight are rejected. Missed/rest entries can retain non-active labels.
- Proposal cards compare original and proposed sessions. “Keep current week” dismisses a proposal. An older proposal is disabled after the week changes.
- Completed sessions, the five run/sport-day cap, and explicit approval before applying a change remain protected.

### Revision test results

Verification date: November 23, 2026. **29 logic tests and 11 API integration tests passed (40 total).** Project type checking, frontend build, and API build passed. Browser checks used the revised frontend and actual API with a deterministic local OpenAI-compatible fixture. They did not call a live model or use Replit credits. The original deployed app was tested with live AI before revision. Post-publication checks also exercised the revised live AI app; see [the live verification record](revision-evidence/live-checks.txt).

| Test | Input or action | Observed result | Result |
| --- | --- | --- | --- |
| Typical change | Miss Tuesday’s run; replace Thursday’s steady run with 35 minutes easy at 6:30 PM | Original/proposed values appeared; the week stayed unchanged until “Reflow the week,” then updated | Pass, local browser/API and revised live AI |
| Challenge case | Move strength onto Wednesday soccer at 7:15 PM | Original deployment accepted the conflict. Revised API returned a specific overlap error without a proposal; the week stayed unchanged | Fixed, baseline/local checks and revised live AI refusal |
| Invalid time | Propose 25:99 PM or an empty active start time | Validator rejected both; API integration rejected 25:99 PM | Pass, logic/API |
| Invalid duration | Propose zero minutes, negative minutes, missing duration, or a reversed range | Rejected; API integration rejected zero minutes | Pass, logic/API |
| User rejects | Click “Keep current week” | Proposal dismissed; current week unchanged | Pass, local and live browser |
| Outdated proposal | Prepare two proposals and apply one | Remaining proposal disabled with an explanation that the week changed | Pass, local browser |
| Incomplete soccer description | Ask whether unspecified soccer replaces Tuesday’s run | Original live coach asked about active minutes, effort, and stop-start play before recommending a change | Pass, original and revised live AI |
| Empty input and service failure | Send empty API content; simulate unavailable AI | API returned 400 for empty input and 503 with unchanged-plan message for service failure; blank browser send was disabled | Pass, API/browser |
| Existing protections | Attempt to alter completed work, exceed the cap, duplicate edits, or use unknown session IDs | Rejected; existing travel and valid schedule tests still passed | Pass, logic |

The polish checks also verified chronological day grouping, exact proposal day totals, dismissed-proposal context, apply/undo on a 320px screen, immediate Stop recovery and retry, reset during an unfinished reply, and no horizontal overflow at 320px, 390px, and 1366px. Keyboard skip navigation focused the coach heading. The API concurrency test confirmed a fourth call receives 429 with Retry-After and cancellation restores capacity. See [the polish verification record](revision-evidence/polish-checks.txt). Earlier logs remain as historical evidence.

Raw test logs and screenshots are in [revision-evidence](revision-evidence). Reproduce with:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/reflow-coach run test:logic
pnpm run typecheck
PORT=20368 BASE_PATH=/ pnpm --filter @workspace/reflow-coach run build
pnpm --filter @workspace/api-server run build
# Terminal 1: local fixtures only; no real model or credentials
node scripts/revision-test-server.mjs
# Terminal 2:
node --experimental-strip-types --test scripts/revision-api.test.mjs
```

### Short demonstration

1. Open the revised build. Choose “Missed run” and send the prompt.
2. Discuss the plan, then agree to a specific change. Review the original/proposed comparison.
3. Choose “Keep current week” to show that rejection preserves the plan. Request a fresh proposal and click “Reflow the week” to apply it. Try “Undo last change” to restore the previous calendar.
4. Reset the week. Try “Scheduling conflict.” The coach should request a feasible alternative; even if it produces an invalid tool call, the validator rejects it.

### AI use disclosure for this revision

The product concept and intended coaching flow came from Bernardo Moreira’s prior work. For this revision, Bernardo asked Codex to investigate the feedback, fix the identified issues, and prepare the submission. Codex inspected Canvas attempts and anonymous comments, reviewed the repository, tested the original live app, implemented the shared validator and interface changes, authored and ran regression tests, checked the revised browser flow, and drafted the README, report, and disclosure. Codex also compared the broader Reflow project and smoke-test design, implemented the public-demo polish, and ran responsive, cancellation, and capacity checks. This was substantial AI assistance with implementation, testing, and writing; it was not limited to editing wording. After Bernardo authorized the Replit account, Codex merged and published the tested revision and performed live verification. The reported checks are AI-assisted verification, not independent human evaluation. Bernardo remains responsible for reviewing the package before submission.

Representative requests were to find the feedback independently, fix Reflow’s scheduling issues, and prepare the revision with test results and AI disclosure. Testing used a fictional athlete. The original app uses Replit’s managed OpenAI integration for live conversation; the revised local integration tests used scripted model responses against the actual application code. These fixtures verify application behavior, not coaching accuracy or fitness outcomes.

### Remaining limitations

This is one fictional week with no accounts or saved plans. Durations must start with minutes (for example, “35 min”); overnight sessions and multiple run/sport sessions on one day remain unsupported. User availability and training intensity are discussed by the AI but are not represented as fully enforceable scheduling constraints. There is no reviewed training-reference set, medical validation, or fresh independent user evaluation. Live checks revealed one generated explanation that said four activity days while listing three. The deterministic calendar correctly showed three. The polish now displays a calculated day total and named days on every valid proposal and supplies those current facts to the model; generated prose can still contain arithmetic errors. The live scenario checks do not establish coaching accuracy.

## MVP: what it does

The Reflow MVP is a live, conversational training coach for adapting one fictional athlete’s weekly plan when life changes. It helps the athlete talk through missed sessions, unexpected activities, or upcoming travel; asks follow-up questions about effort, schedule, and available activities; and suggests a week-specific adjustment that considers training stimulus and overall impact.

The plan appears as cards in “This week, at a glance.” The coach can prepare a proposed schedule change, but it does not change the week just because the athlete is brainstorming or says they like the idea. The athlete must click **Reflow the week** to apply the reviewed proposal. The plan checks protect completed workouts, prevent conflicting run/sport sessions, and enforce the five run/sport-day limit.

## How to use the MVP

1. Open the [live Reflow Training Coach](https://reflow-training-coach.replit.app). The screen shows the sample week and the Reflow chat.
2. Tell Reflow what changed or what you are planning. For example: “I missed Tuesday’s run but played soccer for 90 minutes,” or “I’ll be traveling next week and can surf, swim, and do bodyweight strength.”
3. Answer Reflow’s follow-up questions about effort, timing, and what activities or equipment are available. You can discuss alternatives and ask how each option may affect the rest of the week.
4. Review the specific weekly plan Reflow recommends. Exploring a “what if” does not update the schedule.
5. When you agree with a specific plan, Reflow stages a **Reflow the week** button. Click it to update the week cards; until then, the sample schedule remains unchanged.

The chat is session-only: starting a new chat clears the conversation, and reloading the page resets the sample week. To run the API and web workflows during development:

```sh
pnpm --filter @workspace/api-server run dev
PORT=20368 BASE_PATH=/ pnpm --filter @workspace/reflow-coach run dev
```

## AI behavior

The AI coach uses Replit’s managed OpenAI integration to discuss changes in natural language, consider the current week and its constraints, ask for activity details that affect the comparison, and proactively estimate whether an unplanned activity is likely lower, similar, or higher impact than a missed workout. It distinguishes overall load and recovery from the specific training stimulus, then suggests week-specific options such as skipping make-up work, doing a partial session, or adding modest volume to a planned easy run when appropriate. After the athlete likes a specific recommendation, the coach prepares a validated change for review. The athlete must click “Reflow the week” to update the plan.

This prototype uses live AI, so responses can be inconsistent or wrong. Model use is billed through Replit credits. Messages go to Replit’s managed AI service but are not saved by this prototype. No reviewed training references are connected; Reflow must not be treated as medical, injury, or rehabilitation guidance. Use only the fictional profile and do not enter identifying or medical details.

## Original MVP test results

I tested the user-facing flow in Replit with three scenarios. These results describe whether the experience worked for me; they do not establish that the coaching recommendations are correct.

| Test | Input or action | What happened | Result |
| --- | --- | --- | --- |
| Typical case | I missed Tuesday's run but completed a 90-minute soccer match. I also tried a more complex run/soccer schedule change, including running Wednesday instead of the planned soccer session. | Reflow updated the week consistently. The cards reflected the changed schedule, and the “Reflow the week” button applied the proposed changes. | Pass |
| Challenge case | I planned ahead for a week of travel with no usual runs, workouts, or soccer. I could surf, do bodyweight strength, and possibly swim; I answered the coach's questions and chose how many days to surf. | Reflow asked follow-up questions about the available activities and schedule, then built a plan around my answers. It considered how to limit the loss of aerobic and anaerobic training stimulus and the overall effect on the week. | Pass |
| Invalid or empty case | I submitted a blank chat message. | The app did not accept or send the blank input, so no response was generated. | Pass |

Run the automated plan checks and typecheck with:

```sh
pnpm --filter @workspace/reflow-coach run test:logic
pnpm --filter @workspace/reflow-coach run typecheck
```

## Known limitations

- The plan is a single fictional week and there are no accounts or saved plans; conversation and changes are lost when the app is reset or reloaded.
- The model has no reviewed training-reference set, and broader athlete testing has not established that its suggestions are accurate or useful.
- This prototype does not assess injuries, rehabilitation, medical conditions, or detailed recovery data; do not use it for those decisions.

## Safety and scope

The sample athlete is fictional. AI responses are generated live and may be wrong; the athlete reviews every proposed plan change. This prototype does not store conversation history and is not medical, injury, rehabilitation, or nutrition guidance.
