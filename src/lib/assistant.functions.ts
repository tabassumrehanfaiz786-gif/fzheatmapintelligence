import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SYSTEM = `You are the research assistant inside Fz Heat Map Intelligence (FZ HMI), a cryptocurrency order-book research platform founded by Faizan Rehan.
Rules: Use only the context data provided plus general market-microstructure knowledge. Never invent numbers. Always report sample sizes and missing data.
Never say manipulation, spoofing or fraud is proven; use "potential indicator". Offer alternative explanations (market-making, risk limits, latency, inventory).
"Possible relocation" events do NOT identify the same order or participant. Treat Liquidity Destination Theory as a hypothesis.
You give no trading advice and no price predictions. Be concise and use plain markdown.`;

const Input = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).min(1).max(30),
  context: z.string().max(20000),
});

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { error: "AI is not configured." };
    const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false, reasoning: { effort: "low" },
        instructions: `${SYSTEM}\n\nCONTEXT DATA:\n${data.context || "(none selected)"}`,
        input: data.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (r.status === 429) return { error: "Too many requests right now — please wait a moment." };
    if (r.status === 402) return { error: "AI credits are exhausted for this workspace." };
    if (!r.ok || !r.body) return { error: `AI request failed (${r.status}).` };
    // Consume the SSE stream and assemble the final text.
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = "", reply = "";
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        const d = l.slice(5).trim(); if (!d || d === "[DONE]") continue;
        try { const e = JSON.parse(d) as { type?: string; delta?: string }; if (e.type === "response.output_text.delta" && e.delta) reply += e.delta; } catch { /* ignore partial */ }
      }
    }
    return { reply };
  });
