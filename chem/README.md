# 🧪 PubChem Retrieval Agent (Chem)

A CLI-driven tool utilizing the **PubChem PUG REST API**. Designed for materials scientists, ceramic engineers, and R&D professionals to rapidly fetch the physical properties and safety data (MSDS/GHS) of raw chemical materials directly in the terminal.

No API Key required. 100% Free and Zero-Dependency.

## 🚀 Usage

Navigate to the directory and execute the script via `bun`:

```bash
cd scripts/chem
```

### 1. 🔍 Fetch Chemical Properties (`info`)

Retrieve core physical parameters including CID, CAS Number, Molecular Weight, Melting Point, Boiling Point, and Density. *(Note: Standard English names or strict chemical formulas yield the best results).*

```bash
# Format: bun chem.ts info "<Chemical_Name>"

# Example: Query Alumina
bun chem.ts info "Alumina"

# Example: Query Yttrium oxide
bun chem.ts info "Yttrium oxide"
```

### 2. ⚠️ Fetch Safety & GHS Warnings (`safety`)

Retrieve GHS hazard classifications and handling advisories for safe laboratory and manufacturing practices.

```bash
# Format: bun chem.ts safety "<Chemical_Name>"

# Example: Query Barium carbonate safety warnings
bun chem.ts safety "Barium carbonate"
```

## 💡 Technical Notes
- Real-time data aggregation directly from the NIH PubChem database.
- A `404` error implies an unregistered identifier. Use strict IUPAC names as fallbacks.
- The PubChem API enforces a dynamic rate limit (~5 requests/second). No authentication is required, but please avoid aggressive automated polling.
