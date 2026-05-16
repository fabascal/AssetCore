import OpenAI from "openai";
import { env } from "../../config/env";

export type AgentIntent = "CREATE_TICKET" | "QUERY_STATUS" | "REPORT_FAILURE" | "UNKNOWN";

export type AgentAnalysis = {
  intent: AgentIntent;
  assetCode?: string;
  serialNumber?: string;
  summary: string;
};

const openai = env.openAiApiKey ? new OpenAI({ apiKey: env.openAiApiKey }) : null;

const assetCodeRegex = /\bAST-[A-Z0-9]+\b/i;
const serialRegex = /\bSN[-:A-Z0-9]{4,}\b/i;

const fallbackAnalysis = (text: string): AgentAnalysis => {
  const lower = text.toLowerCase();
  const assetCode = text.match(assetCodeRegex)?.[0]?.toUpperCase();
  const serialNumber = text.match(serialRegex)?.[0]?.toUpperCase();

  let intent: AgentIntent = "UNKNOWN";
  if (/(falla|no funciona|error|averia|incidente|daño|danado)/i.test(lower)) intent = "REPORT_FAILURE";
  if (/(crear ticket|abrir ticket|soporte|ayuda)/i.test(lower)) intent = "CREATE_TICKET";
  if (/(estado|seguimiento|como va|consulta)/i.test(lower)) intent = "QUERY_STATUS";

  return {
    intent,
    assetCode,
    serialNumber,
    summary: "Clasificacion por heuristica local",
  };
};

export const analyzeIncomingMessage = async (text: string): Promise<AgentAnalysis> => {
  if (!openai) {
    return fallbackAnalysis(text);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: env.openAiModel,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres Combuito, agente de ITAM/HelpDesk. Responde solo JSON con keys: intent, assetCode, serialNumber, summary. intent debe ser CREATE_TICKET|QUERY_STATUS|REPORT_FAILURE|UNKNOWN.",
        },
        { role: "user", content: text },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<AgentAnalysis>;

    return {
      intent: (parsed.intent as AgentIntent) ?? "UNKNOWN",
      assetCode: parsed.assetCode?.toUpperCase(),
      serialNumber: parsed.serialNumber?.toUpperCase(),
      summary: parsed.summary ?? "Sin resumen",
    };
  } catch (_error) {
    return fallbackAnalysis(text);
  }
};
