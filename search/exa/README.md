# 🧠 Exa Semantic Search Agent

If Tavily is a "fact consumer," Exa is the "librarian who understands semantics."
This zero-dependency CLI tool leverages the Exa API to uncover deep technical blogs, niche academic papers, and high-quality web resources using semantic neural search.

## 🔑 1. Setup API Credentials

Configure your API key in the local `.env` file:
```env
EXA_API_KEY=your_api_key_here
```

## 🚀 2. Usage

Navigate to the directory and execute via `bun`:

### 🔍 Semantic Search (`search`)
Search using natural language intent rather than exact keywords.
```bash
bun exa.ts search "Here is an excellent, hardcore technical article regarding the fracture toughness of alumina ceramics:"
```

### 💡 Answer Generation (`answer`)
Ask a direct question and receive an AI-generated answer complete with verifiable citations.
```bash
bun exa.ts answer "What is the hardest ceramic material known to mankind?"
```

### 📄 Content Extraction (`contents`)
Extract clean markdown content from any specific URL.
```bash
bun exa.ts contents "https://exa.ai/docs"
```
