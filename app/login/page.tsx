import { loginAction } from "./actions";

// Server-rendered login form posting to a server action. No client JS required.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sp = await searchParams;

  return (
    <form action={loginAction} className="cv-elevated p-6 flex flex-col gap-4 mt-2 w-full lg:max-w-md lg:mx-auto">
      <div className="flex flex-col gap-1">
        <span className="cv-eyebrow">GCHeros</span>
        <h1 className="text-2xl">Sign in</h1>
        <p className="text-sm" style={{ color: "var(--c-muted)" }}>
          Enter an email to attribute your reports. Try demo@gcheros.app.
        </p>
      </div>
      <label
        className="flex flex-col gap-1.5 text-sm"
        style={{ color: "var(--c-muted)" }}
      >
        Email
        <input
          name="email"
          type="email"
          required
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="cv-field"
          placeholder="you@example.com"
        />
      </label>
      <label
        className="flex flex-col gap-1.5 text-sm"
        style={{ color: "var(--c-muted)" }}
      >
        Display name (optional, set on first sign-in)
        <input
          name="name"
          type="text"
          className="cv-field"
          placeholder="Jane Citizen"
        />
      </label>
      {sp.next && <input type="hidden" name="next" value={sp.next} />}
      {sp.error && (
        <p
          role="alert"
          className="text-sm font-medium"
          style={{ color: "var(--c-high)" }}
        >
          Please enter a valid email address.
        </p>
      )}
      <button type="submit" className="cv-btn cv-btn-primary py-3">
        Sign in
      </button>
    </form>
  );
}
