# ceramicsay

"This is a set of tools for those who love ceramics."

## Overview

Welcome to `ceramicsay`. This repository houses a collection of highly specialized, zero-dependency, CLI-driven scripts designed for the advanced ceramics industry and research community. 

By integrating deep domain knowledge in materials science with modern AI-driven search, thermodynamic data retrieval, and global patent analysis, these tools act as your ultimate digital laboratory assistant.

## Environment & Prerequisites

This toolkit was developed and tested in a modern Linux (Ubuntu) environment. While both Node.js and Bun might be present in a typical development setup, **all scripts in this repository are designed to be executed exclusively using `bun`**.

- **Runtime Required**: [Bun](https://bun.sh/) (A fast, all-in-one JavaScript runtime).
- **Zero-Dependency Architecture**: There is no `package.json`, no `npm install`, and no `node_modules`. Every script relies entirely on Bun's native APIs and lightweight cloud CDNs. Simply clone and run.

## Toolkit Directory

Each module is self-contained. Please refer to the specific `README.md` inside each folder for detailed, no-nonsense usage tutorials.

| Module | Purpose |
|--------|---------|
| `draw/` | CLI-driven local web rendering for UMF formulation flowcharts (via Excalidraw). |
| `search/exa/` | Semantic search agent tailored for academic papers and deep technical blogs. |
| `search/tavily/` | Commercial fact-retrieval agent for news, market reports, and raw data extraction. |
| `materialsproject/` | Native connector for crystal structures and thermodynamic phase diagrams. |
| `paper/` | Automated crawler for scholarly articles, authors, and DOI references. |
| `chem/` | Lookup tool for precise chemical and physical properties (via PubChem). |
| `EPOops/` | Direct gateway to the European Patent Office for cracking global patent barriers. |
| `std/` | Global industrial manufacturing standard retriever. |
| `Composition Search CLI/` | Standalone terminal search engine for historical kiln formulations and chemicalcompositions, featuring anti-reverse encryption. |

## Quick Start

Navigate to any tool directory and execute the script directly using `bun`. You will need to configure your own API keys (BYOK) in your local `.env` file for modules that require external access.

```bash
cd search/exa
bun exa.ts search "Recent breakthroughs in solid-state ceramic electrolytes"
```

## Contributing & CLA (Contributor License Agreement)

We welcome community contributions! However, to protect the dual-licensing business model of this project, **all contributors must agree to a Contributor License Agreement (CLA)** before any Pull Request (PR) can be merged. 

By submitting code, you retain your authorship and get full credit as a contributor, but you irrevocably grant us the right to use, modify, and commercially re-license your contributions as part of our enterprise proprietary distributions.

## License & Commercial Use

This project is open-sourced under the **AGPL-3.0 License**.

This is a strict copyleft license. If you deploy these scripts as a publicly accessible Web service (SaaS) or integrate them into proprietary software, you **must** open-source your entire application.

**Commercial License available upon request.** Please contact me privately if your enterprise requires closed-source usage or an "All-Inclusive Premium Tier".

## Acknowledgements
- Formulation data utilized in the `Composition Search CLI` is derived and transformed from the open-source ceramic database [Glazy](https://glazy.org/) (by [Derek Philip Au](https://github.com/derekphilipau)). Special thanks to the Glazy community for their invaluable contributions to materials science.
