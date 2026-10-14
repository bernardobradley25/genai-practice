# Reflow

Reflow is a prototype coaching experience for adult amateur athletes balancing running, recreational sport, and strength training.

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

## Test results

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
