# 🎨 Cera Draw (Excalidraw CLI-to-Web Renderer)

A highly lightweight Proof of Concept (PoC) demonstrating how CLI scripts can seamlessly render dynamic, high-fidelity UI dashboards. 

This script parses local ceramic formulation data (JSON) and instantly generates an elegant hand-drawn visualization flowchart locally. **100% Zero-Dependency and Zero Local Packages.**

## ✨ Core Features
1. **Zero Node Modules**: No local frontend dependencies. All rendering logic relies on CDN injection.
2. **Dynamic CDN Injection**: Constructs an HTML template in-memory and dynamically fetches the world-class `Excalidraw` rendering engine via `<script src="https://unpkg.com/...">`.
3. **Local Micro-Server**: Utilizes `Bun.serve` to spin up a local static server instantly, ensuring proprietary formulation data never leaves your machine.
4. **Auto-Launch**: Automatically invokes macOS/Windows system commands to open your default browser, creating a frictionless "terminal-to-browser" experience.

## 🚀 Usage

Ensure you have [Bun](https://bun.sh/) installed.

```bash
cd scripts/draw

# Render the default sample celadon glaze recipe
bun draw.ts recipe.json

# Render your custom JSON recipe
bun draw.ts /path/to/your-recipe.json
```
*(Press `Ctrl+C` in the terminal to destroy the local server and clear memory).*

## 📄 JSON Data Structure
The script accepts a standard JSON file representing a ceramic recipe and its UMF (Unity Molecular Formula):
```json
{
  "name": "Kaolin Celadon Glaze",
  "temperature": "1280°C - 1300°C",
  "ingredients": [
    { "name": "Potassium Feldspar", "percent": 40 },
    { "name": "Quartz", "percent": 30 }
  ],
  "umf": {
    "R2O": "0.300",
    "RO": "0.700",
    "Al2O3": "0.450",
    "SiO2": "3.800"
  }
}
```


