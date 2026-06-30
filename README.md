<div align="center">
  <h1>🚀 GCHeros</h1>
  <p><strong>Empowering Citizens, One Report at a Time.</strong></p>
  
  [![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
  [![Gemini AI](https://img.shields.io/badge/Google-Gemini_AI-blue?logo=google)](https://ai.google.dev/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
  [![Vibe2Ship](https://img.shields.io/badge/Hackathon-Vibe2Ship-FF6B6B)](#)
</div>

---

## 🌟 Overview
**GCHeros** is a phone-first Progressive Web App (PWA) designed to report and track hyperlocal civic issues—such as potholes, water leaks, broken streetlights, and garbage dumps. 

Instead of filling out tedious forms, a citizen just snaps a photo. **Google Gemini** acts as the perception layer to understand the image, validate the issue, and draft a formal complaint. Our robust system layer handles the rest: geographical clustering, deduplication, real-time mapping, and an analytics dashboard.

*Built for the Vibe2Ship Hackathon (Coding Ninjas x Google for Developers).*

---

## ✨ Features
- 📸 **AI-Powered Reporting**: Snap a photo; Gemini extracts the issue, severity, and drafts the report.
- 🗺️ **Live Civic Map**: Visualize all reported issues in your area with Leaflet & OpenStreetMap.
- 🔄 **Smart Deduplication**: Automatically clusters duplicate reports of the same issue to avoid spamming authorities.
- 📱 **Progressive Web App**: Installable on iOS/Android for a native app feel.
- 📊 **Real-time Dashboard**: Track the status and resolution of community issues at a glance.

---

## 🛠️ Tech Stack
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router) + TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **AI / Vision**: [`@google/genai`](https://www.npmjs.com/package/@google/genai)
- **Database**: Firebase (Firestore Admin SDK)
- **Maps**: Leaflet + React-Leaflet
- **Deployment**: Google Cloud

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/your-username/gcheros.git
cd gcheros
npm install
```

### 2. Environment Setup
Copy the `.env.example` file to create your local `.env`.
```bash
cp .env.example .env
```
Add your `GEMINI_API_KEY` to the `.env` file (this remains server-side only for security). Add Firebase credentials if testing the DB.

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Note:** Sign in with `demo@gcheros.app` to explore the dashboard. Submitting a new photo requires a valid Gemini API key.

---

## 🧠 Architecture Overview
GCHeros separates concerns cleanly:
1. **Perception Layer (Gemini)**: Processes images, extracts structured JSON data using fixed schemas, and computes text embeddings for semantic search.
2. **System Layer**: Manages the UI, clustering logic, session state, and database interactions securely on the server.

*For detailed architectural decisions and feature registry, see the `.memory/` folder in the repository.*

---

## 🌐 Browser Compatibility

GCHeros has been **tested and verified on Google Chrome** (and Chromium-based browsers such as Microsoft Edge and Brave).

**Known issues with non-Chromium browsers:**
- **Firefox**: The animated background and `backdrop-filter` effects cause rendering jank. A `[data-ff]` CSS flag is in place to partially mitigate this, but some visual glitches remain.
- **Safari / WebKit**: PWA install behaviour and certain CSS features may not behave as expected.

> **Recommendation**: Use Google Chrome for the best experience. Non-Chromium browser support is a planned future improvement.

---

## 🔮 Future Scope

The v1 release focuses on the core citizen-reporting flow. Planned future enhancements include:

| Area | Description |
|------|-------------|
| **Non-Chromium Browser Support** | Full compatibility with Firefox and Safari — fixing animation jank, backdrop-filter, and WebKit PWA quirks. |
| **Video Reporting** | Allow citizens to record short clips; the backend samples frames and runs each through the existing image-analysis pipeline. |
| **Real Municipal API Integration** | Replace simulated department routing and status updates with live integrations to municipal systems. |
| **Push Notifications** | Notify citizens when their reported issue changes status (acknowledged → in-progress → resolved). |
| **Visual Deduplication (CLIP / DINOv2)** | GPU-based image-similarity dedup as a complement to the current text-embedding cosine similarity, catching visually identical photos of the same pothole. |
| **Gamification & Impact Dashboards** | Citizen badges, streak tracking, neighbourhood leaderboards, and a predictive heatmap for upcoming civic failures. |
| **EXIF Geolocation Fallback** | Parse GPS coordinates from photo EXIF data as a fallback when browser geolocation is denied. |
| **Multi-language Support** | Localised UI and Gemini complaint drafts in regional languages. |
| **Offline Reporting Queue** | Queue reports locally when offline and submit automatically when connectivity is restored, leveraging the PWA service worker. |

---

<div align="center">
  <p>Built with ❤️ for <b>Vibe2Ship</b>.</p>
</div>
