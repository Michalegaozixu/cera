# 🌟 EPO Patent Services (OPS) Retrieval Agent

A CLI-driven tool designed for materials researchers and technical engineers to instantly retrieve intellectual property intelligence from the European Patent Office (EPO). 

This tool allows you to search the global patent database and extract **bibliographics, abstracts, claims, and full technical descriptions** directly in your terminal. 100% Zero-Dependency.

## 🔑 1. Setup API Credentials (Free)

This tool utilizes the official EPO OPS API. You must configure your own keys (BYOK).

1. Register at the [EPO Developer Portal](https://developers.epo.org/).
2. Navigate to **"My Apps"** and create a new App to generate your **Consumer Key** and **Consumer Secret**.
3. Create a `.env` file in this directory and configure your credentials:

```env
EPO_CONSUMER_KEY=your_key_here
EPO_CONSUMER_SECRET=your_secret_here
```

## 🚀 2. Usage

Navigate to the directory and execute the script via `bun`:

```bash
cd scripts/EPOops
```

### 🔍 Search Patents (`search`)

Search for patents using the standard EPO CQL (Contextual Query Language) syntax. You can query by assignee, inventor, or technical keywords.

```bash
# Format: bun epoops.ts search "<CQL Query>" [Range]

# Example: Search for patents assigned to Apple (top 10 results by default)
bun epoops.ts search "pa=Apple"

# Example: Search for Apple patents, fetching results 1 through 5
bun epoops.ts search "pa=Apple" "1-5"

# Example: Search for patents where inventor is Tesla and title includes battery
bun epoops.ts search "in=Tesla and ti=battery"
```

**Common CQL Identifiers:**
| Field | Description | Example |
| :--- | :--- | :--- |
| `pa` | Applicant / Assignee | `pa=Toyota` |
| `in` | Inventor | `in=Tesla` |
| `ti` | Title keyword | `ti=ceramic` |
| `txt`| Full-text keyword | `txt=graphite` |

### 📄 Fetch Full Patent Document (`info`)

Once you obtain a patent DOCDB format number (e.g., `EP.4776160.A2`) from the search results, use the `info` command to extract its full claims and technical descriptions.

```bash
# Format: bun epoops.ts info "<Patent_Number>"

# Example: Extract full claims and description
bun epoops.ts info "EP.4776160.A2"
```

## 💡 Advanced Tips

- **Save Output**: Patent descriptions are lengthy. Redirect the terminal output to a text file for comfortable reading or LLM processing:
  ```bash
  bun epoops.ts info "EP.4776160.A2" > EP_patent.txt
  ```
- **Token Caching (Rate Limit Protection)**: The EPO enforces strict weekly bandwidth limits (e.g., 4GB). This script features a built-in **OAuth2 Token Caching mechanism**. It caches your access token locally (`.token_cache.json`) for 20 minutes, preventing redundant authentication requests and maximizing your API quota efficiency.
