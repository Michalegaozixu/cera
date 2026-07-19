# 🌟 Ceramic Intelligence System: Academic Literature Crawler

A CLI-driven module designed to search, filter, and extract insights from over 250 million academic papers (powered by the **OpenAlex API**). It is highly optimized for vertical domains such as advanced ceramics, glass-ceramics, and material sciences.

100% Zero-Dependency.

## 🔑 1. Configure Polite Access (Recommended)

While the OpenAlex API is free and does not strictly require authentication, joining the **Polite Pool** yields faster responses and higher rate limits.

1. Create a `.env` file in this directory.
2. Add your email address:
   ```env
   POLITE_EMAIL=your_email@example.com
   ```

## 🚀 2. Usage

Navigate to the directory and execute the script via `bun`:

```bash
cd scripts/paper
```

### 🔍 Search Academic Papers (`search`)

Perform multi-dimensional searches combining keywords, specific journals, and publication years.

```bash
# Format: bun paper.ts search [options]

# Example A: Search for "zirconia sintering", sorted by citations descending, top 10
bun paper.ts search -q "zirconia sintering"

# Example B: Search for "glaze thermal expansion" specifically within top ceramic journals
bun paper.ts search -q "glaze thermal expansion" --ceramics

# Example C: Search for open-access papers on "advanced ceramics" in JACS (2020-2026)
bun paper.ts search -q "advanced ceramics" -j jacs -y 2020-2026 --oa
```

**Available Flags:**
* `-q, --query <keyword>`: Search query (e.g., `"alumina sintering"`).
* `-j, --journal <id>`: Filter by specific journal ID.
* `--ceramics`: Restrict search to a predefined list of top ceramic journals.
* `-y, --year <range>`: Publication year filter (e.g., `2024` or `2020-2026`).
* `--oa`: Filter for Open Access papers only.
* `-l, --limit <num>`: Max records to return (Default: 10).
* `-s, --sort <citations|year>`: Sort results by `citations` or `year` (Default: `citations`).

**Supported Journal IDs:**
| ID | Full Name | Domain |
| :--- | :--- | :--- |
| `jacs` | *Journal of the American Ceramic Society* | American Ceramics |
| `jecs` | *Journal of the European Ceramic Society* | European Ceramics |
| `ci` | *Ceramics International* | Ceramics General |
| `jac` | *Journal of Advanced Ceramics* | Advanced Ceramics |
| `jncs` | *Journal of Non-Crystalline Solids* | Glass/Non-Crystalline |
| `solgel` | *Journal of Sol-Gel Science and Technology* | Sol-Gel Processing |
| `acta` | *Acta Materialia* | Broad Materials Science |

### 📄 Deep Read & Abstract Reconstruction (`info`)

Extract detailed bibliographic cards and intelligently reconstruct obfuscated n-gram abstracts into fluent English paragraphs using a DOI or OpenAlex ID.

```bash
# Format: bun paper.ts info <DOI/ID> [--save [filename.md]]

# Example A: Read paper details in terminal
bun paper.ts info 10.1111/jace.19034

# Example B: Save detailed card and abstract to a local Markdown report
bun paper.ts info 10.1111/jace.19034 --save report.md
```

### 💾 1-Click PDF Download (`download`)

If a paper is Open Access, instantly download the full PDF to your local machine.

```bash
# Format: bun paper.ts download <DOI/ID> [-o filename.pdf]

# Example A: Download and auto-name based on title
bun paper.ts download W4316223405

# Example B: Download with custom filename
bun paper.ts download W4316223405 -o alumina_sintering_study.pdf
```
