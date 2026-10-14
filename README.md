# Reflow

Reflow is a prototype coaching experience for adult amateur athletes balancing running, recreational sport, and strength training.

## First working slice

Open the Reflow Training Coach preview at the project root (`/`). The sample athlete can describe a schedule change, review a prewritten suggestion, and decide whether to apply it. Try the three example prompts to explore a missed run, soccer replacing a run, and a request to make up every missed session.

For local development from this repository:

```sh
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/reflow-coach run dev
```

## AI behavior

The future AI coach is intended to ask follow-up questions, consider the athlete’s whole week and availability, explain trade-offs and uncertainty, and propose changes for the athlete to review.

In this prototype, responses are simulated. A small keyword matcher selects prewritten replies; there is no live AI model, database, or saved user data. The soccer example asks for duration and perceived effort before showing its response. It does not treat soccer as an equivalent run. All changes remain under the athlete’s control.

## Quick test results

These checks cover the deterministic scenario logic used by the prototype. They are not a validation of coaching quality or training outcomes.

| Test | Input or action | What happened | Result |
| --- | --- | --- | --- |
| Typical case | “I missed Tuesday’s easy run. I have a free recovery slot Thursday evening.” | The scenario produces a Thursday 6:30 PM easy-run move, marks Tuesday as missed, and leaves the original sample unchanged until acceptance. | Pass |
| Challenge case | “Soccer replaced my Thursday run.” | The flow asks for time on the field and perceived effort; it does not infer that soccer replaces the run. | Pass |
| Invalid or empty case | Submit blank input, or enter `0` minutes for soccer. | Blank input stays in the starting flow with a prompt; invalid duration is rejected. | Pass |
| Constraint pushback | “I missed two sessions and want to make up every one this week.” | The scenario routes to a prewritten explanation that there is no compatible extra slot and offers two choices without adding sessions. | Pass |

Run the checks with:

```sh
pnpm --filter @workspace/reflow-coach run test:logic
```

## Known limitations

- Responses use keyword matching and fixed text, so natural-language understanding, clarifying dialogue, and recommendations are not powered by AI.
- The plan is a single fictional sample week; changes reset when the page reloads, and there are no personal accounts or saved plans.
- Training suggestions have not been reviewed or medically validated. The prototype does not evaluate injuries, recovery data, or evidence-based training references.

## Safety and scope

The sample athlete is fictional. Coach replies are labeled as simulated, and this prototype is a planning exercise—not medical, injury, rehabilitation, or nutrition guidance.
