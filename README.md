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

<div align="center">
  <p>Built with ❤️ for <b>Vibe2Ship</b>.</p>
</div>
