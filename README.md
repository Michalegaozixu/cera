# ceramicsay

"Welcome to cera. This is a repository of tools for those who love ceramics."

## Environment & Prerequisites

These tools were developed and tested in modern Linux (Ubuntu) environment and macOS, **All tools in this repository are designed to be executed exclusively using `bun`**.

First thing first, install **Bun**:

Open your Terminal app, input the following command to check if **Bun** already exists:
```bash
bun -v
```

If it doesn't exist, input the following command to install **Bun**:

For macOS & Linux:
```bash
curl -fsSL https://bun.sh/install | bash
```

For Windows:
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

After installation, check if it is installed correctly. Input the following command to check:
```bash
bun -v
```

Second thing is to clone this repository (or download the ZIP file) to your local machine. Navigate to the tool directory you want to use in your terminal, and input (for example on macOS):
```bash
git clone https://github.com/Michalegaozixu/cera.git
cd cera/chem
bun chem.ts info "Alumina"
```

Then push 'Enter', done.

[Bun](https://bun.sh/) (A fast, all-in-one JavaScript runtime).

## Tools Directory

Each tool is self-contained. Please refer to the specific `README.md` inside each folder for detailed usage tutorials.

| Tool | Purpose |
|--------|---------|
| `draw/` | CLI-driven local web rendering for UMF formulation flowcharts (via Excalidraw). |
| `search/exa/` | Semantic search agent tailored for academic papers and deep technical blogs. |
| `search/tavily/` | Commercial fact-retrieval agent for news, market reports, and raw data extraction. |
| `materialsproject/` | Native connector for crystal structures and thermodynamic phase diagrams. |
| `paper/` | Automated crawler for scholarly articles, authors, and DOI references. |
| `chem/` | Lookup tool for precise chemical and physical properties (via PubChem). |
| `EPOops/` | Direct gateway to the European Patent Office for cracking global patent barriers. |
| `std/` | Global industrial manufacturing standard retriever. |
| `Composition Search CLI/` | Standalone terminal search engine for historical kiln formulations and chemicalcompositions. |

## Contributing & CLA (Contributor License Agreement)

We welcome community contributions! However, to protect the dual-licensing business model of this project, **all contributors must agree to a Contributor License Agreement (CLA)** before any Pull Request (PR) can be merged. 

By submitting code, you retain your authorship and get full credit as a contributor, but you irrevocably grant us the right to use, modify, and commercially re-license your contributions as part of our enterprise proprietary distributions.

## License & Commercial Use

This project is open-sourced under the **AGPL-3.0 License**.

This is a strict copyleft license. If you deploy these scripts as a publicly accessible Web service (SaaS) or integrate them into proprietary software, you **must** open-source your entire application.

**Commercial License available upon request.** Please contact me privately if your enterprise requires closed-source usage or an "All-Inclusive Premium Tier".

## Acknowledgements
- Formulation data utilized in the `Composition Search CLI` is derived and transformed from the open-source ceramic database [Glazy](https://glazy.org/) (by [Derek Philip Au](https://github.com/derekphilipau)). Special thanks to the Glazy community for their invaluable contributions to materials science.
