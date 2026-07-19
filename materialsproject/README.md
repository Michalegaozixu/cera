# 🌟 Materials Project (MP) Data Retrieval & CIF Exporter

A specialized CLI tool designed for materials scientists, physicists, and ceramic engineers to interact directly with the Materials Project database. 

With simple terminal commands, you can instantly query tens of thousands of inorganic crystals for their **crystal structures, thermodynamic stability, band gaps, magnetism, elasticity, and piezoelectricity**. It also supports querying epitaxial film substrates and 1-click `.cif` 3D model exports. 100% Zero-Dependency.

## 🔑 1. Setup API Credentials (Free)

This tool requires an official Materials Project API Key.

1. **Register/Login**: Visit the [Materials Project Dashboard](https://materialsproject.org/dashboard) (GitHub login supported).
2. **Copy API Key**: Locate your API Key string on the dashboard.
3. **Configure `.env`**: Create a `.env` file in this directory and insert your key:

```env
MP_API_KEY=your_api_key_here
```
*(Note: `.env` is ignored by Git and will never be uploaded.)*

## 🚀 2. Usage

Navigate to the directory and execute the script via `bun`:

```bash
cd scripts/materialsproject
```

### 🔍 Combinatorial Materials Search (`search`)

Filter materials by any combination of elements, chemical formulas, band gaps, stability, and crystal systems.

```bash
# Format: bun mp.ts search [options]

# Example A: Search for materials containing Li, Fe, O with a band gap between 2.0-4.0 eV
bun mp.ts search -e Li,Fe,O -b 2.0-4.0

# Example B: Match the exact formula for Silicon Dioxide (SiO2) polymorphs
bun mp.ts search -f SiO2

# Example C: Find highly stable materials (e_above_hull < 0.05 eV/atom) in the cubic crystal system, limit 20
bun mp.ts search -s 0.05 -c cubic -l 20
```

**Available Flags:**
* `-e, --elements <list>`: Comma-separated elements (e.g., `Li,Fe,P,O`).
* `-f, --formula <formula>`: Exact chemical formula (e.g., `SiO2`).
* `-b, --bandgap <range>`: Band gap range in eV (e.g., `1.5-3.0`).
* `-s, --stability <max>`: Max `e_above_hull` energy in eV/atom (e.g., `0.05`).
* `-c, --crystal <system>`: Crystal system (e.g., `cubic`, `tetragonal`, `hexagonal`, `orthorhombic`, `monoclinic`, `triclinic`, `trigonal`).
* `-l, --limit <num>`: Max records to return (Default: 10).

### 📄 Fetch Detailed Material Property Cards (`info`)

Retrieve comprehensive computed properties (structural, thermodynamic, electronic, magnetic, elastic, dielectric) using a unique Material ID (e.g., `mp-149` for Silicon).

```bash
# Example: Fetch the full property card for Silicon
bun mp.ts info mp-149
```

### 💾 1-Click Export 3D Crystal Structures (`export-cif`)

Export a standard `.cif` file directly from the terminal for use in **VESTA**, **Mercury**, or other crystallographic software.

```bash
# Option A: Export directly while viewing info (Generates Formula_ID.cif)
bun mp.ts info mp-149 --export-cif

# Option B: Use the dedicated export command
bun mp.ts export-cif mp-149

# Option C: Export with a custom filename
bun mp.ts export-cif mp-149 custom_silicon.cif
```

### 🧫 Query Epitaxial Substrates (`substrates`)

For thin-film deposition researchers. Query computationally matched substrate materials, growth orientations, and interface lattice mismatch metrics for a given film.

```bash
# Example: Find optimal growth substrates for mp-149
bun mp.ts substrates mp-149
```

### 🔗 Atom Coordination & Bond Analysis (`bonds`)

Analyze local atomic coordination environments and bonding topologies.

```bash
# Example: Analyze the bonding network of mp-149
bun mp.ts bonds mp-149
```

## 💡 Advanced Tips

- **Save Output**: If a property card or search list is too long for the terminal, redirect it to a local text file:
  ```bash
  bun mp.ts info mp-149 > silicon_info.txt
  ```
