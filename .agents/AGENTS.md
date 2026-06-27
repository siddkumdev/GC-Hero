# Project Rules

- When making any code changes in this workspace, always ensure you deploy the changes to Google Cloud Run by running the necessary `gcloud builds submit` and `gcloud run deploy` commands (or `scripts/deploy.sh`), unless explicitly told otherwise by the user.

- **Navigation:** The Back button in detail views should be dynamic (using `useRouter().back()` with a fallback path) rather than hardcoded, so users return to their previous context (e.g., the map).
- **Branding:** The project name is "GCHeros" (not "GHero" or "Community Hero").
- **UI/UX on Desktop:** Avoid showing camera/photo-capture buttons on desktop layouts, as they are only practical on mobile. When hiding elements responsively on custom components (like `.cv-btn`), wrap them in a utility container (e.g., `<div className="lg:hidden">`) to avoid CSS specificity conflicts.
- **Features:** Keep features focused on citizen empowerment (like the 1-Click Escalation email tool). Avoid adding gimmicky or overly complex authority-facing tools unless explicitly requested.
- **AI Integration:** The project uses `@google/genai` (Google AI Studio) for Gemini features, which utilizes the free tier and does not consume Google Cloud Free Trial credits.
