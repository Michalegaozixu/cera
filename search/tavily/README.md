# 🔍 Tavily Search Agent

A zero-dependency CLI interface for the Tavily API, optimized for AI-driven commercial and factual research.

## 🔑 1. Setup API Credentials

Configure your API key in the local `.env` file:
```env
TAVILY_API_KEY=your_api_key_here
```

## 🚀 2. Usage

Navigate to the directory and execute via `bun`:

### 🔍 Quick Search (`search`)
Rapid retrieval of factual data with AI-curated summaries.
```bash
bun tavily.ts search "2026 global ceramic export tariff changes"
```

### 🧠 Deep Research (`research`)
Triggers the Advanced Research engine for in-depth analysis (consumes more API credits).
```bash
bun tavily.ts research "Alumina ceramic 3d printing latest breakthrough"
```

### 📄 Content Extraction (`extract`)
Extract clean, pure text from noisy web pages or long-form articles.
```bash
bun tavily.ts extract "https://en.wikipedia.org/wiki/Mullite"
```

### 🕸️ Site Crawler (`crawl`)
Discover and map all valid sub-pages under a specific domain (e.g., analyzing a competitor's website).
```bash
bun tavily.ts crawl "https://spacex.com"
```
