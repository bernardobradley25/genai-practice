# Reflow

Reflow is a prototype coaching experience for adult amateur athletes balancing running, recreational sport, and strength training.

## First working slice

Open the Reflow Training Coach preview at the project root (`/`). The fictional athlete can talk with Reflow in their own words about a change, ask follow-up questions, and discuss how it might affect the whole week. If the athlete asks for a specific schedule change, Reflow can show an optional proposal; the plan changes only after the athlete accepts it. The API and plan checks preserve the five run/field-day limit and block conflicting run/field sessions.

The chat is session-only: reloading or starting a new chat clears the conversation, and the sample week resets when the page reloads. Run the API and web workflows together during development:

```sh
pnpm --filter @workspace/api-server run dev
PORT=20368 BASE_PATH=/ pnpm --filter @workspace/reflow-coach run dev
```

## AI behavior

The AI coach uses Replit’s managed OpenAI integration to discuss changes in natural language, consider the current week and its constraints, ask for important missing context, and explain likely effects and trade-offs. When the athlete explicitly wants a schedule edit, the model may return a structured proposal for review. The API validates that proposal; only the athlete’s acceptance updates the sample week.

This prototype uses live AI, so responses can be inconsistent or wrong. Model use is billed through Replit credits. Messages go to Replit’s managed AI service but are not saved by this prototype. No reviewed training references are connected; Reflow must not be treated as medical, injury, or rehabilitation guidance. Use only the fictional profile and do not enter identifying or medical details.

## Test results

Three live API checks cover a typical multi-turn conversation, a soccer challenge, and an empty request. Separate automated checks cover plan-edit validation. They show the interaction works, not that the coaching is correct or useful to athletes.

| Test | Input or action | What happened | Result |
| --- | --- | --- | --- |
| Typical case | Asked about a missed Tuesday easy run, an open Thursday evening, and an already-planned Thursday steady run. Then discussed the trade-off before asking for a proposal. | The AI explained the double-run conflict, continued from prior chat context, and returned a proposal that replaces the steady run; it did not edit the week automatically. | Pass |
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
