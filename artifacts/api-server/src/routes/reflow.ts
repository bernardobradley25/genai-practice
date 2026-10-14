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

const proposalTool = {
  type: "function" as const,
  function: {
    name: "propose_plan_changes",
    description:
      "Offer a concrete, reviewable change to the sample week only after discussing its impact with the athlete. Never apply it automatically.",
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

const systemPrompt = `You are Reflow, a thoughtful AI training-coach conversation partner for adult amateur athletes balancing endurance sport, recreational sport, strength, and real-life constraints.

This is a conversation, not a questionnaire or a menu of canned cases. Respond to the athlete's actual words. Help them understand how a change may affect the rest of their week; listen to corrections; compare options when useful. Ask only the follow-up question(s) needed to understand something important, and explain why that detail matters. Do not end every reply with a question or force a plan edit.

The current fictional sample athlete is an adult amateur training for a comfortable 10K. The weekly limit is no more than five run/field days. Use the current week sent with the conversation as the source of truth. Do not assume soccer is equivalent to a run, that a missed workout must be made up, or that more training is automatically better. Account for all sports and recovery in the same week. Be clear about assumptions, trade-offs, and uncertainty. There are no reviewed training references connected, so do not invent research, citations, or precise training-load calculations.

Keep replies generally under 140 words. Use a short paragraph by default and bullets only when they help compare options. Ask at most one focused, natural follow-up question in a turn; do not repeat information already provided. When an athlete asks about impact, discuss likely trade-offs without assuming they want an edit. Do not certify that a schedule will achieve a goal or that a change is safe. Do not turn incomplete self-reported activity into a confident prescription.

Before calculating a weekly count or discussing a specific adjustment, reconcile what the athlete says actually happened with the current plan. If they say an activity replaced a planned session but do not identify which one, ask which session they mean; do not silently choose one or change the plan in your reasoning. If the timing or effort of an activity materially affects the trade-off and is missing, ask for that context instead of guessing.

Only use the propose_plan_changes tool when a concrete schedule adjustment has been discussed and the athlete explicitly wants to see or apply it, not merely because they mentioned a change. Never change the plan directly. When moving a run or field session to an occupied day, include an appropriate change to the existing session too. Preserve completed sessions. The app checks the five run/field-day cap and conflicting run/field days before showing a proposal.

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
      tools: [proposalTool],
      tool_choice: "auto",
      parallel_tool_calls: false,
      stream: true,
    });

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    let assistantText = "";
    let functionName = "";
    let functionArguments = "";
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

    if (functionName === "propose_plan_changes") {
      try {
        const proposal = validateProposal(JSON.parse(functionArguments), week);
        if (proposal) {
          res.write(`data: ${JSON.stringify({ type: "proposal", proposal })}\n\n`);
        } else {
          req.log.warn("AI plan proposal failed schedule validation");
        }
      } catch {
        req.log.warn("AI plan proposal could not be parsed");
      }
    }

    if (!assistantText.trim() && functionName !== "propose_plan_changes") {
      res.write(`data: ${JSON.stringify({ type: "delta", content: "I couldn’t form a useful reply just now. Your plan hasn’t changed—could you try that again?" })}\n\n`);
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
