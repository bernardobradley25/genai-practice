# Reflow

Reflow is a prototype coaching experience for adult amateur athletes balancing running, recreational sport, and strength training.

## First working slice

Open the Reflow Training Coach preview at the project root (`/`). The fictional athlete can talk with Reflow in their own words about a change. When they mention a missed workout and another activity, Reflow proactively compares their likely overall load and sport-specific stimulus, asks for missing activity details when needed, and offers practical options for the current week without waiting to be prompted. After recommending a specific plan, Reflow asks whether the athlete likes it. Saying yes prepares a “Reflow the week” button; the schedule changes only when the athlete clicks it. Brainstorming or hypothetical discussion never changes the week. The API and plan checks preserve the five run/sport-day limit and block conflicting run/sport days.

The chat is session-only: reloading or starting a new chat clears the conversation, and the sample week resets when the page reloads. Run the API and web workflows together during development:

```sh
pnpm --filter @workspace/api-server run dev
PORT=20368 BASE_PATH=/ pnpm --filter @workspace/reflow-coach run dev
```

## AI behavior

The AI coach uses Replit’s managed OpenAI integration to discuss changes in natural language, consider the current week and its constraints, ask for activity details that affect the comparison, and proactively estimate whether an unplanned activity is likely lower, similar, or higher impact than a missed workout. It distinguishes overall load and recovery from the specific training stimulus, then suggests week-specific options such as skipping make-up work, doing a partial session, or adding modest volume to a planned easy run when appropriate. After the athlete likes a specific recommendation, the coach prepares a validated change for review. The athlete must click “Reflow the week” to update the plan.

This prototype uses live AI, so responses can be inconsistent or wrong. Model use is billed through Replit credits. Messages go to Replit’s managed AI service but are not saved by this prototype. No reviewed training references are connected; Reflow must not be treated as medical, injury, or rehabilitation guidance. Use only the fictional profile and do not enter identifying or medical details.

## Test results

Live API checks cover the missed-run/soccer comparison, a follow-up with activity details and proactive options, Reflow confirmation, an adapted travel week with Surf, a separate soccer challenge, and an empty request. Separate automated checks cover plan-edit validation. They show the interaction works, not that the coaching is correct or useful to athletes.

| Test | Input or action | What happened | Result |
| --- | --- | --- | --- |
| Default comparison | Reported missing Tuesday's 35-minute easy run and playing 90 minutes of soccer without describing effort; then clarified that most of it was active, fairly hard, and stop-start. | The AI asked for activity details before assigning an impact rating. After clarification it compared overall load with easy-run stimulus, listed all remaining run/sport days, and offered no-make-up, partial-session, and existing-run options without waiting to be asked. It did not edit the plan. | Pass |
| Reflow confirmation | Said “I like this plan” after the coach asked whether a specific recommendation worked; also tried a “what if” alternative. | The positive agreement returned a validated `reflow_ready` event; the hypothetical returned no Reflow event. The client stages the button and updates the week only in its click handler. | Pass |
| Travel-week Reflow | Approved an adapted week with running, Surf, and bodyweight-only strength. | The API returned a validated five-session Reflow with Surf represented separately; the week remains unchanged until the button is clicked. | Pass |
| Challenge case | Described an 80-minute soccer match with hard sprints and walking, with uncertain overall intensity. | The AI treated soccer as a separate field load rather than an equivalent run and discussed uncertainty about the remaining week. | Pass |
| Invalid or empty case | Sent an empty chat body to the API. | The API returned 400 without calling the model. The chat send control is also disabled for an empty message. | Pass |
| Plan validation | Ran the scheduling logic with an allowed pending change, an overlapping session, an unknown session, and a completed workout. | The allowed change produces a revised week when committed; invalid or conflicting changes are blocked. | Pass |

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
