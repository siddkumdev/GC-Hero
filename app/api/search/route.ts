import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { parseSearchQuery, GeminiOverloadedError } from "@/lib/gemini";
import { searchClusters } from "@/lib/search";
import { searchFilterSchema, type SearchFilter, type SearchResponseDTO } from "@/lib/types";

export const runtime = "nodejs";

// F2 — natural-language search. Two modes through ONE endpoint:
//  - { q }      → Gemini parses intent into a filter, then we filter our data.
//  - { filter } → no Gemini; we just re-run the (edited) filter. Used when a chip is removed,
//                 so removing a facet never re-spends a Gemini call.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const q = typeof body?.q === "string" ? body.q.trim() : "";

  let filter: SearchFilter;

  if (body?.filter !== undefined) {
    // Filter mode (chip edit): validate the client-supplied filter, no Gemini.
    const parsed = searchFilterSchema.safeParse(body.filter);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid filter." }, { status: 400 });
    }
    filter = parsed.data;
  } else if (q) {
    // Parse mode: Gemini turns the query into a structured filter.
    const today = new Date().toISOString().slice(0, 10);
    try {
      filter = await parseSearchQuery(q, today);
    } catch (err) {
      if (err instanceof GeminiOverloadedError) {
        return NextResponse.json({ error: err.message, retryable: true }, { status: 503 });
      }
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Couldn't parse the search." },
        { status: 502 },
      );
    }
  } else {
    return NextResponse.json({ error: "Empty search." }, { status: 400 });
  }

  const results = await searchClusters(filter);
  const payload: SearchResponseDTO = { filter, results };
  return NextResponse.json(payload, { status: 200 });
}
