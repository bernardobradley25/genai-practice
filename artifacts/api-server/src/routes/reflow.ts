import { Router, type IRouter } from "express";
import { ReflowChatBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const dayNames: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const consensusPlanTool = {
  type: "function" as const,
  function: {
    name: "apply_consensus_plan_changes",
    description:
      "Return the exact schedule changes only after the athlete explicitly confirms a specific option in chat. The client immediately applies this update, so never call while exploring, comparing, or before consent.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        impact: {
          type: "string",
          description: "A concise explanation of the trade-off and why this fits the athlete's constraints.",
        },
        changes: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              sessionId: {
                type: "string",
                enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
              },
              day: {
                type: "string",
                enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
              },
              time: { type: "string" },
              title: { type: "string" },
              detail: { type: "string" },
              status: { type: "string", enum: ["planned", "moved", "missed", "rest"] },
            },
            required: ["sessionId", "day", "time", "title", "detail", "status"],
            additionalProperties: false,
          },
        },
      },
      required: ["impact", "changes"],
      additionalProperties: false,
    },
  },
};

function validateProposal(
  value: unknown,
  week: Array<{
    id: string;
    day: string;
    shortDay: string;
    sport: string;
    title: string;
    detail: string;
    time: string;
    status: string;
  }>,
): { impact: string; changes: Array<{ sessionId: string; day: string; time: string; title: string; detail: string; status: string }> } | null {
  if (!value || typeof value !== "object") return null;
  const proposal = value as Record<string, unknown>;
  if (typeof proposal.impact !== "string" || proposal.impact.length > 700) return null;
  if (!Array.isArray(proposal.changes) || proposal.changes.length < 1 || proposal.changes.length > 3) return null;

  const changes: Array<{ sessionId: string; day: string; time: string; title: string; detail: string; status: string }> = [];
  const changedIds = new Set<string>();
  for (const rawChange of proposal.changes) {
    if (!rawChange || typeof rawChange !== "object") return null;
    const change = rawChange as Record<string, unknown>;
    if (
      typeof change.sessionId !== "string" ||
      typeof change.day !== "string" ||
      typeof change.time !== "string" ||
      typeof change.title !== "string" ||
      typeof change.detail !== "string" ||
      typeof change.status !== "string"
    ) return null;

    const session = week.find((item) => item.id === change.sessionId);
    if (
      !session ||
      session.status === "done" ||
      changedIds.has(session.id) ||
      !Object.values(dayNames).includes(change.day) ||
      !["planned", "moved", "missed", "rest"].includes(change.status) ||
      change.time.length > 40 ||
      change.title.length > 80 ||
      change.detail.length > 120
    ) return null;

    changedIds.add(session.id);
    changes.push({
      sessionId: session.id,
      day: change.day,
      time: change.time,
      title: change.title,
      detail: change.detail,
      status: change.status,
    });
  }

  const revisedWeek = week.map((session) => {
    const change = changes.find((item) => item.sessionId === session.id);
    if (!change) return session;
    const shortDay = Object.entries(dayNames).find(([, name]) => name === change.day)?.[0];
    return {
      ...session,
      day: change.day,
      shortDay: shortDay?.toUpperCase() ?? session.shortDay,
      time: change.time,
      title: change.title,
      detail: change.detail,
      status: change.status,
    };
  });
  const runFieldDays = revisedWeek
    .filter((session) => ["Run", "Soccer"].includes(session.sport) && !["missed", "rest"].includes(session.status))
    .map((session) => session.day);
  if (new Set(runFieldDays).size !== runFieldDays.length || runFieldDays.length > 5) return null;

  return { impact: proposal.impact, changes };
}

function hasExplicitPlanConsent(messages: Array<{ role: string; content: string }>): boolean {
  const latest = messages.at(-1);
  if (!latest || latest.role !== "user") return false;

  const text = latest.content.trim().toLowerCase();
  if (!text || /\b(maybe|perhaps|not sure|what if|i wonder|explore|compare|explain|wait|hold on|not yet|hold off|before i decide)\b/i.test(text)) {
    return false;
  }

  const directEdit = /^(?:(?:please|can you|could you|let'?s)\s+)?(?:apply|make|update|change|move|replace|switch|add|shorten|extend|skip|mark|set)\b/i;
  const statedEdit = /^(?:i want you to|i want to|i'd like you to|i'd like to)\s+(?:apply|make|update|change|move|replace|switch|add|shorten|extend|skip|mark|set)\b/i;
  if (directEdit.test(text) || (statedEdit.test(text) && /\b(?:that|it|recommended|first|second|third|monday|tuesday|wednesday|thursday|friday|saturday|sunday|easy run|steady run|long run|soccer)\b/i.test(text))) return true;

  const explicitChoice = /^(?:yes|yeah|yep|sure|okay|ok|go ahead|do it|do that|let'?s do it|let'?s do that|that works|sounds good|i agree|i approve|i choose|i'll go with|i will go with|let'?s go with|i'll take|i will take|let'?s take|take the (?:first|second|third) option)\b/i;
  if (!explicitChoice.test(text)) return false;

  const previousAssistant = messages
    .slice(0, -1)
    .reverse()
    .find((message) => message.role === "assistant")?.content ?? "";
  return /\b(?:should i|shall i|would you like me to|do you want me to|want me to)\b.{0,120}\b(?:update|apply|change|move|replace|shorten|extend|make|set|put)\b/i.test(previousAssistant);
}

const systemPrompt = `You are Reflow, a thoughtful AI training-coach conversation partner for adult amateur athletes balancing endurance sport, recreational sport, strength, and real-life constraints.

This is a collaborative conversation, not a questionnaire or a menu of canned cases. Respond to the athlete's actual words, take initiative in the analysis, and carry useful context forward. Ask the smallest set of nonredundant questions needed to understand an activity; more than one question in a turn is fine when several details matter. Group related questions naturally and explain why the answer changes the estimate. Do not ask the athlete to decide whether an activity "replaced" a workout when they have already described both the missed session and the extra activity; help them evaluate that together.

The current fictional sample athlete is an adult amateur training for a comfortable 10K. The weekly limit is no more than five run/field days. Use the current week sent with the conversation as the plan, but treat the athlete's explicit report that a session was missed, moved, or completed as the factual history for your analysis. A conversational assessment does not update the plan shown in the app; only an in-chat-confirmed update does. Do not assume soccer is equivalent to a run, that a missed workout must be made up, or that more training is automatically better. Account for all sports and recovery in the same week. Before stating a weekly run/field-day count, enumerate the distinct actual and remaining planned activity days; do not count a reported missed workout as completed or omit another planned sport. If you cannot confidently reconcile the days, leave out the count. Be clear about assumptions, trade-offs, and uncertainty. There are no reviewed training references connected, so do not invent research, citations, or precise training-load calculations.

When an athlete mentions a missed planned workout and another activity from the same day or period, use the missed workout as the natural comparison target unless there is genuine ambiguity. Do not ask which session the activity replaced just because they have not decided whether it counts as a replacement. If details that could change the comparison are missing, ask for them before giving a firm lower/similar/higher rating or a best-fit recommendation. Ask about relevant facts such as active time versus total elapsed time, perceived effort, and whether movement was continuous or stop-start; use details already given and group related questions naturally. Until those details are clear, do not assign a categorical impact or recommend a schedule change based on duration alone. Briefly tell the athlete what information is missing and why; avoid giving a full options list before the comparison is ready.

Once there is enough context, proactively compare the activity with the missed workout without waiting for the athlete to request options. State whether its likely overall training/recovery impact is lower, roughly similar, or higher, and distinguish that from the specific stimulus (for example, stop-start soccer load versus continuous easy-run aerobic work). Do not claim exact equivalence or convert sports into precise miles without enough data.

Then offer two or three concrete, week-specific paths and their trade-offs without waiting for another prompt. Compare: no make-up; a partial/half version; and, if the athlete wants to retain some volume, adding it to a suitable existing easy run rather than creating another session. Address these choices directly instead of omitting one. For a partial version, name a day and explain whether it would replace or shorten that day's planned session. For an add-on, name the best candidate existing run and whether you recommend extending it; if no day is suitable, explain why and identify the closest lower-risk alternative instead of stopping at "don't add it." When a missed session has a stated duration, make the half-session option concrete (for example, half of a 35-minute easy run is about 17–18 minutes); do not invent a mile conversion or exact distance without the athlete's pace or distance context. Recommend the best fit for the stated goal and current week. Protect easy/hard spacing, long-run recovery, other sports, the five run/field-day cap, and the athlete's stated constraints.

Keep replies concise but allow enough room to explain a comparison and options (usually under 220 words). Use bullets when they make trade-offs easier to compare. Do not keep asking questions once the relevant details are known; move to the estimate and options. Do not certify that a schedule will achieve a goal or that a change is safe, and do not turn incomplete self-reported activity into a confident prescription.

Keep exploratory options in the conversation. Recommend a best-fit option, summarize the exact change, and ask plainly, "Would you like me to update Week at a glance with this change?" Do not call the apply_consensus_plan_changes tool for brainstorming, hypotheticals, or an ambiguous "yes" after several options. Call it only after the athlete clearly confirms the exact option in chat (or directly requests a specific edit); the update is applied immediately, with no second approval button. If the athlete is still weighing options, ask which they choose and leave the week unchanged. After a successful update, state what changed. When moving a run or field session to an occupied day, include an appropriate change to the existing session too. Preserve completed sessions. The app checks the five run/field-day cap and conflicting run/field days before applying an update.

Stay within general planning support. Do not diagnose or advise on injury, rehabilitation, medication, or medical conditions; for those, say this prototype cannot guide the decision and suggest a qualified professional. Keep replies clear, conversational, and concise without sounding like a form or checklist.`;

router.post("/reflow/chat", async (req, res): Promise<void> => {
  const parsed = ReflowChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Send a message and the current sample training week." });
    return;
  }

  const { messages, week } = parsed.data;
  if (messages.at(-1)?.role !== "user") {
    res.status(400).json({ error: "The latest message must be from you." });
    return;
  }
  const hasPlanConsent = hasExplicitPlanConsent(messages);

  const planContext = week.map((session) =>
    `${session.day}: ${session.sport} — ${session.title}; ${session.detail}; ${session.time}; status: ${session.status}`,
  ).join("\n");
  const chatMessages = [
    {
      role: "system" as const,
      content: `${systemPrompt}\n\nCurrent plan:\n${planContext}`,
    },
    ...messages.map(({ role, content }) => ({ role, content })),
  ];

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.6-terra",
      max_completion_tokens: 8192,
      reasoning_effort: "none",
      messages: chatMessages,
      ...(hasPlanConsent
        ? {
            tools: [consensusPlanTool],
            tool_choice: "auto" as const,
            parallel_tool_calls: false,
          }
        : {}),
      stream: true,
    });

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    let assistantText = "";
    let functionName = "";
    let functionArguments = "";
    let planUpdateSent = false;
    let planUpdateFailed = false;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (typeof delta?.content === "string") {
        assistantText += delta.content;
        res.write(`data: ${JSON.stringify({ type: "delta", content: delta.content })}\n\n`);
      }
      for (const toolCall of delta?.tool_calls ?? []) {
        if (toolCall.function?.name) functionName += toolCall.function.name;
        if (toolCall.function?.arguments) functionArguments += toolCall.function.arguments;
      }
    }

    if (functionName === "apply_consensus_plan_changes" && hasPlanConsent) {
      try {
        const update = validateProposal(JSON.parse(functionArguments), week);
        if (update) {
          res.write(`data: ${JSON.stringify({ type: "plan_update", update })}\n\n`);
          planUpdateSent = true;
        } else {
          planUpdateFailed = true;
          req.log.warn("AI consensus plan update failed schedule validation");
        }
      } catch {
        planUpdateFailed = true;
        req.log.warn("AI consensus plan update could not be parsed");
      }
    } else if (functionName === "apply_consensus_plan_changes") {
      req.log.warn("Blocked AI plan update without explicit athlete confirmation");
    }

    if (planUpdateFailed) {
      res.write(`data: ${JSON.stringify({ type: "error", message: "I couldn’t safely apply that change. Your week is unchanged; tell me which specific option you want to use." })}\n\n`);
      res.end();
      return;
    }

    if (!assistantText.trim() && !planUpdateSent) {
      const content = functionName === "apply_consensus_plan_changes"
        ? "I’ll leave Week at a glance unchanged until you confirm which specific option you want."
        : "I couldn’t form a useful reply just now. Your plan hasn’t changed—could you try that again?";
      res.write(`data: ${JSON.stringify({ type: "delta", content })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (error) {
    req.log.error({ err: error }, "Reflow chat request failed");
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: "error", message: "I couldn’t reach the coaching service. Your plan has not changed. Please try again." })}\n\n`);
      res.end();
      return;
    }
    res.status(503).json({ error: "The coaching service is unavailable right now. Your plan has not changed." });
  }
});

export default router;
