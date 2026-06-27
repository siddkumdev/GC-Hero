import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import SearchView from "@/components/civic/SearchView";

export const dynamic = "force-dynamic";

// F2 — natural-language search. Gemini parses intent (server-side); our code filters our data.
export default async function SearchPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <SearchView />;
}
