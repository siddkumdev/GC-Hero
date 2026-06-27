import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No GEMINI_API_KEY");
  const ai = new GoogleGenAI({ apiKey });

  // List models that support embedContent.
  const pager = await ai.models.list();
  const embedders: string[] = [];
  for await (const m of pager) {
    const actions = (m as { supportedActions?: string[] }).supportedActions ?? [];
    if (actions.includes("embedContent")) embedders.push(m.name ?? "?");
  }
  console.log("Embedding-capable models:", embedders);

  for (const candidate of ["gemini-embedding-001", "text-embedding-004"]) {
    try {
      const e = await ai.models.embedContent({
        model: candidate,
        contents: "pothole on road",
      });
      console.log(`[embed/${candidate}] OK dims`, e.embeddings?.[0]?.values?.length);
    } catch (err) {
      console.log(`[embed/${candidate}] FAIL`, (err as Error).message.slice(0, 80));
    }
  }
}

main().catch((err) => {
  console.error("CHECK FAILED:", err?.message || err);
  process.exit(1);
});
