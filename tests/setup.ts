// Global test setup: mock Next.js server-only imports so they don't crash in Vitest.
// The "server-only" package throws if imported outside a server context; in tests
// we want to import server modules directly, so we stub it out here.
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
