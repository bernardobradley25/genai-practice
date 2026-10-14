# Reflow

Reflow is a prototype coaching experience for adult amateur athletes balancing running, recreational sport, and strength training.

## First working slice

Open the Reflow Training Coach preview at the project root (`/`). The fictional athlete can talk with Reflow in their own words about a change. When they mention a missed workout and another activity, Reflow proactively compares their likely overall load and sport-specific stimulus, asks for missing activity details when needed, and offers practical options for the current week without waiting to be prompted. If the athlete chooses a specific schedule change, Reflow shows a reviewable proposal; the plan changes only after the athlete accepts it. The API and plan checks preserve the five run/field-day limit and block conflicting run/field sessions.

The chat is session-only: reloading or starting a new chat clears the conversation, and the sample week resets when the page reloads. Run the API and web workflows together during development:

```sh
pnpm --filter @workspace/api-server run dev
PORT=20368 BASE_PATH=/ pnpm --filter @workspace/reflow-coach run dev
```

## AI behavior

The AI coach uses Replit’s managed OpenAI integration to discuss changes in natural language, consider the current week and its constraints, ask for activity details that affect the comparison, and proactively estimate whether an unplanned activity is likely lower, similar, or higher impact than a missed workout. It distinguishes overall load and recovery from the specific training stimulus, then suggests week-specific options such as skipping make-up work, doing a partial session, or adding modest volume to a planned easy run when appropriate. When the athlete chooses a schedule edit, the model may return a structured proposal for review. The API validates that proposal; only the athlete’s acceptance updates the sample week.

This prototype uses live AI, so responses can be inconsistent or wrong. Model use is billed through Replit credits. Messages go to Replit’s managed AI service but are not saved by this prototype. No reviewed training references are connected; Reflow must not be treated as medical, injury, or rehabilitation guidance. Use only the fictional profile and do not enter identifying or medical details.

## Test results

Live API checks cover the missed-run/soccer comparison, a follow-up with activity details and proactive options, a separate soccer challenge, and an empty request. Separate automated checks cover plan-edit validation. They show the interaction works, not that the coaching is correct or useful to athletes.

| Test | Input or action | What happened | Result |
| --- | --- | --- | --- |
| Default comparison | Reported missing Tuesday's 35-minute easy run and playing 90 minutes of soccer without describing effort; then clarified that most of it was active, fairly hard, and stop-start. | The AI asked for activity details before assigning an impact rating. After clarification it compared overall load with easy-run stimulus, listed all remaining run/field days, and offered no-make-up, partial-session, and existing-run options without waiting to be asked. It did not edit the plan. | Pass |
| Chosen plan option | Chose a specific schedule change after discussing its trade-offs. | The AI returned a reviewable proposal and did not edit the week automatically. | Pass |
| Challenge case | Described an 80-minute soccer match with hard sprints and walking, with uncertain overall intensity. | The AI treated soccer as a separate field load rather than an equivalent run and discussed uncertainty about the remaining week. | Pass |
| Invalid or empty case | Sent an empty chat body to the API. | The API returned 400 without calling the model. The chat send control is also disabled for an empty message. | Pass |
| Plan controls | Applied an allowed proposal and tried overlapping sessions, an unknown session, and editing a completed session. | The allowed proposal updates the sample week; invalid or conflicting proposals are blocked. | Pass |

Run the automated plan checks and typecheck with:

```sh
pnpm --filter @workspace/reflow-coach run test:logic
pnpm --filter @workspace/reflow-coach run typecheck
```

## Known limitations

- The plan is a single fictional week and there are no accounts or saved plans; conversation and changes are lost when the app is reset or reloaded.
- The model has no reviewed training-reference set, and no athlete testing has established that its suggestions are accurate or useful.
- This prototype does not assess injuries, rehabilitation, medical conditions, or detailed recovery data; do not use it for those decisions.

## Safety and scope

The sample athlete is fictional. AI responses are generated live and may be wrong; the athlete reviews every proposed plan change. This prototype does not store conversation history and is not medical, injury, rehabilitation, or nutrition guidance.
