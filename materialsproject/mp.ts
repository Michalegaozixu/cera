import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Define paths
const ENV_PATH = join(import.meta.dirname, ".env");

// Load .env file from the script directory manually
if (existsSync(ENV_PATH)) {
  const envContent = readFileSync(ENV_PATH, "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index !== -1) {
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      process.env[key] = value.replace(/^['"]|['"]$/g, "");
    }
  }
}

const API_KEY = process.env.MP_API_KEY || "";
const BASE_URL = "https://api.materialsproject.org";

// Color codes for premium terminal layout
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  underline: "\x1b[4m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m"
};

// Main function
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    return;
  }

  const command = args[0].toLowerCase();
  
  if (command !== "search" && command !== "info" && command !== "substrates" && command !== "bonds" && command !== "export-cif") {
    console.error(`${colors.red}Error: Unknown command "${command}"${colors.reset}\n`);
    printUsage();
    process.exit(1);
  }

  if (!API_KEY || API_KEY === "your_api_key_here") {
    console.error(`${colors.red}${colors.bold}Error: MP_API_KEY is not configured!${colors.reset}`);
    console.error(`Please open the config file to set your Materials Project API Key:`);
    console.error(`  ${colors.underline}${ENV_PATH}${colors.reset}\n`);
    console.error(`Get a free key from: https://materialsproject.org/dashboard`);
    process.exit(1);
  }

  const parsed = parseArgs(args.slice(1));

  try {
    switch (command) {
      case "search":
        await handleSearch(parsed);
        break;
      case "info":
        await handleInfo(parsed);
        break;
      case "substrates":
        await handleSubstrates(parsed);
        break;
      case "bonds":
        await handleBonds(parsed);
        break;
      case "export-cif":
        await handleExportCif(parsed);
        break;
    }
  } catch (error: any) {
    console.error(`${colors.red}Error executing command: ${error.message || error}${colors.reset}`);
  }
}

// Print usage manual
function printUsage() {
  console.log(`${colors.bold}${colors.cyan}================================================================================`);
  console.log(`               Materials Project (MP) 数据检索与分析工具 (TS CLI)`);
  console.log(`================================================================================${colors.reset}`);
  console.log(`使用方法:`);
  console.log(`  bun mp.ts <命令> [参数/选项]\n`);
  console.log(`命令列表:`);
  console.log(`  ${colors.bold}search${colors.reset}       多条件搜索材料列表`);
  console.log(`  ${colors.bold}info${colors.reset}         查询指定材料 ID 的详细物理化学性质卡片`);
  console.log(`  ${colors.bold}export-cif${colors.reset}   一键导出指定材料的晶体结构为标准 .cif 文件`);
  console.log(`  ${colors.bold}substrates${colors.reset}   查询适合用作外延生长的薄膜/衬底匹配数据`);
  console.log(`  ${colors.bold}bonds${colors.reset}        查询晶体内原子的化学键合和配位数信息\n`);
  
  console.log(`命令详解与示例:\n`);
  
  console.log(`1. ${colors.cyan}search (搜索)${colors.reset}`);
  console.log(`   选项:`);
  console.log(`     -e, --elements <元素列表>   逗号分隔的元素组合 (如 "Li,Fe,O")`);
  console.log(`     -f, --formula <化学式>       精确匹配化学式 (如 "Fe2O3")`);
  console.log(`     -b, --bandgap <范围>        带隙范围 (如 "0.5-2.0"，单位 eV)`);
  console.log(`     -s, --stability <最大值>     最大能量高于包络线值 (如 "0.08"，单位 eV/atom)`);
  console.log(`     -c, --crystal <晶系>        晶体系统 (如 "cubic", "tetragonal", "hexagonal" 等)`);
  console.log(`     -l, --limit <数量>          限制返回条数 (默认 10)`);
  console.log(`   示例:`);
  console.log(`     bun mp.ts search -e Li,Fe,P,O -b 2.0-4.0 -s 0.05`);
  console.log(`     bun mp.ts search -f SiO2\n`);
  
  console.log(`2. ${colors.cyan}info (详情)${colors.reset}`);
  console.log(`   参数: <material_id> (如 mp-149)`);
  console.log(`   选项:`);
  console.log(`     --export-cif [文件路径]     查看详情的同时，将晶体结构导出为 CIF 文件`);
  console.log(`   示例:`);
  console.log(`     bun mp.ts info mp-149`);
  console.log(`     bun mp.ts info mp-149 --export-cif\n`);
  
  console.log(`3. ${colors.cyan}export-cif (导出结构)${colors.reset}`);
  console.log(`   参数: <material_id> [文件名]`);
  console.log(`   示例:`);
  console.log(`     bun mp.ts export-cif mp-149`);
  console.log(`     bun mp.ts export-cif mp-149 silicon.cif\n`);
  
  console.log(`4. ${colors.cyan}substrates (衬底匹配)${colors.reset}`);
  console.log(`   参数: <material_id>`);
  console.log(`   示例:`);
  console.log(`     bun mp.ts substrates mp-149\n`);

  console.log(`5. ${colors.cyan}bonds (化学键分析)${colors.reset}`);
  console.log(`   参数: <material_id>`);
  console.log(`   示例:`);
  console.log(`     bun mp.ts bonds mp-149\n`);
}

// Basic argument parser
function parseArgs(args: string[]) {
  const result: { positional: string[]; options: Record<string, string | boolean> } = {
    positional: [],
    options: {}
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("-")) {
      const name = arg.replace(/^-+/, "");
      const nextVal = args[i + 1];
      if (nextVal && !nextVal.startsWith("-")) {
        result.options[name] = nextVal;
        i++;
      } else {
        result.options[name] = true;
      }
    } else {
      result.positional.push(arg);
    }
  }
  return result;
}

// Helper to check options by long and short name
function getOpt(parsed: any, longName: string, shortName?: string): any {
  if (parsed.options[longName] !== undefined) return parsed.options[longName];
  if (shortName && parsed.options[shortName] !== undefined) return parsed.options[shortName];
  return undefined;
}

// Print title wrapper
function printTitle(title: string) {
  console.log(`\n${colors.bold}${colors.cyan}=== ${title} ===${colors.reset}`);
}

// Strip ANSI codes for text width calculation
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

// Pad string based on visible length (ignores ANSI codes)
function padString(str: string, width: number): string {
  const visibleLength = stripAnsi(str).length;
  const paddingLength = Math.max(0, width - visibleLength);
  return str + " ".repeat(paddingLength);
}

// Draw formatted table in console
function printTable(headers: string[], rows: string[][]) {
  if (rows.length === 0) return;
  const widths = headers.map((h, i) => {
    return Math.max(h.length, ...rows.map(r => stripAnsi(r[i] || "").length));
  });

  const headerLine = headers.map((h, i) => padString(h, widths[i])).join(" | ");
  console.log(`${colors.bold}${colors.gray}${headerLine}${colors.reset}`);
  console.log(widths.map(w => "-".repeat(w)).join("-|-"));

  for (const row of rows) {
    const line = row.map((val, i) => padString(val, widths[i])).join(" | ");
    console.log(line);
  }
  console.log();
}

// Capitalize crystal system string
function formatCrystalSystem(sys: string): string {
  if (!sys) return sys;
  const s = sys.trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Fetch generic API endpoint helper
async function fetchEndpoint(endpoint: string, params: Record<string, string>) {
  const urlParams = new URLSearchParams(params);
  const url = `${BASE_URL}${endpoint}?${urlParams.toString()}`;
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "X-API-KEY": API_KEY
      }
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("API Key is invalid or expired.");
      }
      return null;
    }

    const json = await response.json() as any;
    return json?.data || null;
  } catch (error: any) {
    throw new Error(`Failed to request ${endpoint}: ${error.message}`);
  }
}

// Generate standard CIF text from structure JSON
function generateCIF(formula: string, structure: any, spacegroupName?: string, spacegroupNumber?: number): string {
  if (!structure || !structure.lattice || !structure.sites) {
    throw new Error("Invalid structure data format.");
  }
  
  const { lattice, sites } = structure;
  let cif = `data_${formula.replace(/\s+/g, "")}\n`;
  cif += `# Created with Materials Project TS CLI Tool\n`;
  cif += `_audit_creation_method         'Materials Project TS CLI Tool'\n`;
  cif += `_cell_length_a                 ${lattice.a.toFixed(5)}\n`;
  cif += `_cell_length_b                 ${lattice.b.toFixed(5)}\n`;
  cif += `_cell_length_c                 ${lattice.c.toFixed(5)}\n`;
  cif += `_cell_angle_alpha              ${lattice.alpha.toFixed(3)}\n`;
  cif += `_cell_angle_beta               ${lattice.beta.toFixed(3)}\n`;
  cif += `_cell_angle_gamma              ${lattice.gamma.toFixed(3)}\n`;
  cif += `_cell_volume                   ${lattice.volume.toFixed(3)}\n`;

  if (spacegroupName) {
    cif += `_symmetry_space_group_name_H-M '${spacegroupName}'\n`;
  }
  if (spacegroupNumber) {
    cif += `_symmetry_Int_Tables_number    ${spacegroupNumber}\n`;
  }

  cif += `\nloop_\n`;
  cif += `  _symmetry_equiv_pos_as_xyz\n`;
  cif += `  'x, y, z'\n\n`;

  cif += `loop_\n`;
  cif += `  _atom_site_label\n`;
  cif += `  _atom_site_type_symbol\n`;
  cif += `  _atom_site_fract_x\n`;
  cif += `  _atom_site_fract_y\n`;
  cif += `  _atom_site_fract_z\n`;
  cif += `  _atom_site_occupancy\n`;

  const elementCounts: Record<string, number> = {};
  for (const site of sites) {
    const spec = site.species?.[0];
    const element = spec?.element || "X";
    elementCounts[element] = (elementCounts[element] || 0) + 1;
    const label = `${element}${elementCounts[element]}`;
    const x = site.abc[0].toFixed(5);
    const y = site.abc[1].toFixed(5);
    const z = site.abc[2].toFixed(5);
    const occupancy = (spec?.occu || 1).toFixed(3);
    cif += `  ${label.padEnd(8)} ${element.padEnd(5)} ${x.padStart(8)} ${y.padStart(8)} ${z.padStart(8)} ${occupancy.padStart(6)}\n`;
  }

  return cif;
}

// -------------------------------------------------------------
// 1. Command handler: search
// -------------------------------------------------------------
async function handleSearch(parsed: any) {
  const elements = getOpt(parsed, "elements", "e");
  const formula = getOpt(parsed, "formula", "f");
  const bandgap = getOpt(parsed, "bandgap", "b");
  const stability = getOpt(parsed, "stability", "s");
  const crystal = getOpt(parsed, "crystal", "c");
  const limit = getOpt(parsed, "limit", "l") || "10";

  if (!elements && !formula && !bandgap && !stability && !crystal) {
    console.error(`${colors.red}Error: You must specify at least one filter option for search (e.g. -e, -f, -b, -s, -c).${colors.reset}`);
    console.log(`Example: bun mp.ts search -e Si,O -b 1.0-2.5`);
    return;
  }

  const params: Record<string, string> = {
    _limit: String(limit),
    _fields: "material_id,formula_pretty,symmetry,band_gap,e_above_hull,is_stable"
  };

  if (elements) params.elements = String(elements);
  if (formula) params.formula = String(formula);
  if (crystal) params.crystal_system = formatCrystalSystem(String(crystal));

  if (bandgap) {
    const parts = String(bandgap).split("-");
    if (parts.length === 2) {
      params.band_gap_min = parts[0];
      params.band_gap_max = parts[1];
    } else {
      params.band_gap_min = parts[0];
      params.band_gap_max = parts[0];
    }
  }

  if (stability) {
    params.e_above_hull_max = String(stability);
    params.e_above_hull_min = "0.0";
  }

  console.log(`${colors.gray}Searching Materials Project API...${colors.reset}`);
  const data = await fetchEndpoint("/materials/summary/", params);

  if (!data || data.length === 0) {
    console.log(`${colors.yellow}No materials matching the query were found.${colors.reset}`);
    return;
  }

  printTitle(`SEARCH RESULTS (${data.length} materials found)`);

  const headers = ["Material ID", "Formula", "Crystal System", "Space Group", "Band Gap", "Energy Above Hull", "Stability"];
  const rows = data.map((d: any) => {
    const id = colors.yellow + d.material_id + colors.reset;
    const form = colors.bold + d.formula_pretty + colors.reset;
    const sys = d.symmetry?.crystal_system || "N/A";
    const sg = d.symmetry?.symbol ? `${d.symmetry.symbol} (${d.symmetry.number || ""})` : "N/A";
    const gap = typeof d.band_gap === "number" ? `${d.band_gap.toFixed(3)} eV` : "N/A";
    const stability = typeof d.e_above_hull === "number" ? `${d.e_above_hull.toFixed(4)} eV/atom` : "N/A";
    const status = d.is_stable
      ? `${colors.green}Stable${colors.reset}`
      : `${colors.red}Unstable${colors.reset}`;

    return [id, form, sys, sg, gap, stability, status];
  });

  printTable(headers, rows);
}

// -------------------------------------------------------------
// 2. Command handler: info
// -------------------------------------------------------------
async function handleInfo(parsed: any) {
  if (parsed.positional.length === 0) {
    console.error(`${colors.red}Error: Missing material_id argument.${colors.reset}`);
    console.log(`Example: bun mp.ts info mp-149`);
    return;
  }

  const materialId = parsed.positional[0].trim();
  console.log(`${colors.gray}Fetching material summary for ${materialId}...${colors.reset}`);
  
  const summaryFields = "material_id,formula_pretty,symmetry,band_gap,is_gap_direct,e_above_hull,is_stable,formation_energy_per_atom,volume,density,nelements,nsites,magnetism,structure";
  const summaries = await fetchEndpoint("/materials/summary/", {
    material_ids: materialId,
    _fields: summaryFields
  });

  if (!summaries || summaries.length === 0) {
    console.error(`${colors.red}Error: Material ${materialId} not found in Materials Project.${colors.reset}`);
    return;
  }

  const doc = summaries[0];

  // Fetch optional sub-data
  console.log(`${colors.gray}Fetching elasticity, dielectric, and piezoelectric properties...${colors.reset}`);
  const [elasticData, dielectricData, piezoData] = await Promise.all([
    fetchEndpoint("/materials/elasticity/", { material_ids: materialId, _fields: "bulk_modulus,shear_modulus,universal_anisotropy" }).catch(() => null),
    fetchEndpoint("/materials/dielectric/", { material_ids: materialId, _fields: "total_dielectric,e_electronic,e_ionic,n" }).catch(() => null),
    fetchEndpoint("/materials/piezoelectric/", { material_ids: materialId, _fields: "e_ij_max" }).catch(() => null)
  ]);

  const elasticDoc = elasticData && elasticData.length > 0 ? elasticData[0] : null;
  const dielectricDoc = dielectricData && dielectricData.length > 0 ? dielectricData[0] : null;
  const piezoDoc = piezoData && piezoData.length > 0 ? piezoData[0] : null;

  // Print Material Card
  console.log(`\n${colors.bold}${colors.cyan}================================================================================`);
  console.log(`                 MATERIAL CARD: ${doc.material_id} (${doc.formula_pretty})`);
  console.log(`================================================================================${colors.reset}`);
  
  // Section 1: Crystal Structure
  console.log(`${colors.bold}${colors.magenta}[1] CRYSTAL STRUCTURE & SYMMETRY${colors.reset}`);
  console.log(`  Pretty Formula      : ${colors.bold}${doc.formula_pretty}${colors.reset}`);
  console.log(`  Crystal System      : ${doc.symmetry?.crystal_system || "N/A"}`);
  console.log(`  Space Group Symbol  : ${doc.symmetry?.symbol || "N/A"}`);
  console.log(`  Space Group Number  : ${doc.symmetry?.number || "N/A"}`);
  console.log(`  Point Group         : ${doc.symmetry?.point_group || "N/A"}`);
  console.log(`  Unit Cell Volume    : ${doc.volume ? doc.volume.toFixed(2) + " Å³" : "N/A"}`);
  console.log(`  Density             : ${doc.density ? doc.density.toFixed(2) + " g/cm³" : "N/A"}`);
  console.log(`  Number of Sites     : ${doc.nsites || "N/A"}`);
  console.log(`  Number of Elements  : ${doc.nelements || "N/A"}`);

  // Section 2: Thermodynamics
  console.log(`\n${colors.bold}${colors.magenta}[2] THERMODYNAMICS & STABILITY${colors.reset}`);
  const stabilityStatus = doc.is_stable
    ? `${colors.green}${colors.bold}Stable (on Convex Hull)${colors.reset}`
    : `${colors.red}${colors.bold}Unstable${colors.reset}`;
  console.log(`  Stability Status    : ${stabilityStatus}`);
  console.log(`  Energy Above Hull   : ${typeof doc.e_above_hull === "number" ? doc.e_above_hull.toFixed(4) + " eV/atom" : "N/A"}`);
  console.log(`  Formation Energy    : ${typeof doc.formation_energy_per_atom === "number" ? doc.formation_energy_per_atom.toFixed(4) + " eV/atom" : "N/A"}`);

  // Section 3: Electronic Structure
  console.log(`\n${colors.bold}${colors.magenta}[3] ELECTRONIC PROPERTIES${colors.reset}`);
  console.log(`  Band Gap            : ${typeof doc.band_gap === "number" ? doc.band_gap.toFixed(3) + " eV" : "N/A"}`);
  console.log(`  Band Gap Type       : ${doc.is_gap_direct ? "Direct" : "Indirect"}`);

  // Section 4: Magnetism
  console.log(`\n${colors.bold}${colors.magenta}[4] MAGNETIC PROPERTIES${colors.reset}`);
  console.log(`  Magnetic Ordering   : ${doc.magnetism?.ordering || "NM"}`);
  console.log(`  Total Magnetization : ${typeof doc.magnetism?.total_magnetization === "number" ? doc.magnetism.total_magnetization.toFixed(2) + " μB" : "0.00"}`);

  // Section 5: Mechanical (Elasticity)
  console.log(`\n${colors.bold}${colors.magenta}[5] MECHANICAL & ELASTIC PROPERTIES${colors.reset}`);
  if (elasticDoc) {
    const bulkVrh = elasticDoc.bulk_modulus?.vrh ?? elasticDoc.bulk_modulus;
    const shearVrh = elasticDoc.shear_modulus?.vrh ?? elasticDoc.shear_modulus;
    console.log(`  Bulk Modulus (VRH)  : ${typeof bulkVrh === "number" ? bulkVrh.toFixed(1) + " GPa" : "N/A"}`);
    console.log(`  Shear Modulus (VRH) : ${typeof shearVrh === "number" ? shearVrh.toFixed(1) + " GPa" : "N/A"}`);
    console.log(`  Elastic Anisotropy  : ${typeof elasticDoc.universal_anisotropy === "number" ? elasticDoc.universal_anisotropy.toFixed(2) : "N/A"}`);
  } else {
    console.log(`  ${colors.gray}(No elastic calculation data available for this material)${colors.reset}`);
  }

  // Section 6: Dielectric & Piezoelectric
  console.log(`\n${colors.bold}${colors.magenta}[6] DIELECTRIC & PIEZOELECTRIC PROPERTIES${colors.reset}`);
  if (dielectricDoc) {
    const epsTotal = dielectricDoc.total_dielectric?.vrh_average ?? dielectricDoc.total_dielectric;
    const epsElec = dielectricDoc.e_electronic?.vrh_average ?? dielectricDoc.e_electronic;
    const epsIonic = dielectricDoc.e_ionic?.vrh_average ?? dielectricDoc.e_ionic;
    console.log(`  Total Dielectric    : ${typeof epsTotal === "number" ? epsTotal.toFixed(2) : "N/A"}`);
    console.log(`  Electronic Contrib  : ${typeof epsElec === "number" ? epsElec.toFixed(2) : "N/A"}`);
    console.log(`  Ionic Contribution  : ${typeof epsIonic === "number" ? epsIonic.toFixed(2) : "N/A"}`);
    console.log(`  Refractive Index (n): ${typeof dielectricDoc.n === "number" ? dielectricDoc.n.toFixed(2) : "N/A"}`);
  } else {
    console.log(`  ${colors.gray}(No dielectric calculation data available for this material)${colors.reset}`);
  }
  if (piezoDoc) {
    console.log(`  Max Piezo Coefficient: ${typeof piezoDoc.e_ij_max === "number" ? piezoDoc.e_ij_max.toFixed(2) + " C/m²" : "N/A"}`);
  }

  console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

  // Handle Export CIF trigger via --export-cif flag inside info command
  const exportFlag = getOpt(parsed, "export-cif");
  if (exportFlag) {
    let filename = "";
    if (typeof exportFlag === "string") {
      filename = exportFlag;
    } else {
      filename = `${doc.formula_pretty}_${doc.material_id}.cif`;
    }
    await performCifExport(doc, filename);
  }
}

// Helper to write CIF file to disk
async function performCifExport(doc: any, filename: string) {
  try {
    if (!doc.structure) {
      console.error(`${colors.red}Error: No structure data available to export CIF.${colors.reset}`);
      return;
    }
    const cifContent = generateCIF(doc.formula_pretty, doc.structure, doc.symmetry?.symbol, doc.symmetry?.number);
    writeFileSync(filename, cifContent, "utf8");
    console.log(`${colors.green}${colors.bold}[Success] Crystal structure exported successfully to: ${filename}${colors.reset}\n`);
  } catch (error: any) {
    console.error(`${colors.red}Failed to export CIF: ${error.message}${colors.reset}`);
  }
}

// -------------------------------------------------------------
// 3. Command handler: export-cif
// -------------------------------------------------------------
async function handleExportCif(parsed: any) {
  if (parsed.positional.length === 0) {
    console.error(`${colors.red}Error: Missing material_id argument.${colors.reset}`);
    console.log(`Example: bun mp.ts export-cif mp-149 [filename]`);
    return;
  }

  const materialId = parsed.positional[0].trim();
  let filename = parsed.positional[1]?.trim() || "";

  console.log(`${colors.gray}Fetching structure for ${materialId}...${colors.reset}`);
  const summaries = await fetchEndpoint("/materials/summary/", {
    material_ids: materialId,
    _fields: "material_id,formula_pretty,symmetry,structure"
  });

  if (!summaries || summaries.length === 0) {
    console.error(`${colors.red}Error: Material ${materialId} not found in Materials Project.${colors.reset}`);
    return;
  }

  const doc = summaries[0];
  if (!filename) {
    filename = `${doc.formula_pretty}_${doc.material_id}.cif`;
  }

  await performCifExport(doc, filename);
}

// -------------------------------------------------------------
// 4. Command handler: substrates
// -------------------------------------------------------------
async function handleSubstrates(parsed: any) {
  if (parsed.positional.length === 0) {
    console.error(`${colors.red}Error: Missing material_id argument.${colors.reset}`);
    console.log(`Example: bun mp.ts substrates mp-149`);
    return;
  }

  const materialId = parsed.positional[0].trim();
  console.log(`${colors.gray}Fetching substrates for film ${materialId}...${colors.reset}`);

  // Fetch substrates
  const subData = await fetchEndpoint("/materials/substrates/", {
    film_id: materialId,
    _limit: "20"
  });

  if (!subData || subData.length === 0) {
    console.log(`${colors.yellow}No matching substrate data found for film ${materialId}.${colors.reset}`);
    return;
  }

  printTitle(`EPITAXIAL SUBSTRATES FOR FILM: ${materialId}`);

  // Sort substrates by elastic energy (if available) or area mismatch
  const sortedSubs = subData.sort((a: any, b: any) => {
    const energyA = a.elastic_energy ?? a.energy ?? 9999;
    const energyB = b.elastic_energy ?? b.energy ?? 9999;
    return energyA - energyB;
  });

  const headers = ["Substrate ID", "Substrate Formula", "Film Orient", "Sub Orient", "Area Mismatch (%)", "Elastic Energy (meV/Å²)"];
  const rows = sortedSubs.map((s: any) => {
    const areaMismatch = s.area_mismatch ?? s.misfit ?? s.area ?? "N/A";
    const energy = s.elastic_energy ?? s.energy ?? "N/A";

    const areaStr = typeof areaMismatch === "number" ? (areaMismatch * 100).toFixed(2) : String(areaMismatch);
    const energyStr = typeof energy === "number" ? energy.toFixed(2) : String(energy);

    return [
      colors.yellow + s.sub_id + colors.reset,
      colors.bold + (s.sub_form ?? s.sub_formula ?? "N/A") + colors.reset,
      s.film_orient ? `(${s.film_orient.join(" ")})` : "N/A",
      s.sub_orient ? `(${s.sub_orient.join(" ")})` : "N/A",
      areaStr,
      energyStr
    ];
  });

  printTable(headers, rows);
}

// -------------------------------------------------------------
// 5. Command handler: bonds
// -------------------------------------------------------------
async function handleBonds(parsed: any) {
  if (parsed.positional.length === 0) {
    console.error(`${colors.red}Error: Missing material_id argument.${colors.reset}`);
    console.log(`Example: bun mp.ts bonds mp-149`);
    return;
  }

  const materialId = parsed.positional[0].trim();
  console.log(`${colors.gray}Fetching bonding data for ${materialId}...${colors.reset}`);

  const bondsData = await fetchEndpoint("/materials/bonds/", {
    material_ids: materialId
  });

  if (!bondsData || bondsData.length === 0) {
    console.log(`${colors.yellow}No chemical bonding data found for material ${materialId}.${colors.reset}`);
    return;
  }

  const doc = bondsData[0];
  printTitle(`BONDING & COORDINATION NETWORK: ${materialId}`);

  // Display bonding properties
  console.log(`${colors.bold}${colors.magenta}[Bonding Method & Graph Summary]${colors.reset}`);
  console.log(`  Calculation Method  : ${doc.method || "pymatgen near-neighbor strategy"}`);
  console.log(`  Last Updated        : ${doc.last_updated || "N/A"}`);
  console.log(`  Number of Bonds     : ${doc.bonds ? doc.bonds.length : "N/A"}`);

  // Display coordination numbers if present
  if (doc.coordination_environments) {
    console.log(`\n${colors.bold}${colors.magenta}[Coordination Environments]${colors.reset}`);
    console.log(JSON.stringify(doc.coordination_environments, null, 2));
  } else if (doc.coordination_numbers) {
    console.log(`\n${colors.bold}${colors.magenta}[Coordination Numbers]${colors.reset}`);
    for (const [atomIdx, cn] of Object.entries(doc.coordination_numbers)) {
      console.log(`  Atom Index ${atomIdx} : CN = ${cn}`);
    }
  }

  // Display standard bond length parameters if available
  if (doc.bond_lengths) {
    console.log(`\n${colors.bold}${colors.magenta}[Bond Lengths (Selected Representative Bonds)]${colors.reset}`);
    for (const [pair, length] of Object.entries(doc.bond_lengths)) {
      console.log(`  Bond Pair ${pair} : ${typeof length === "number" ? length.toFixed(3) + " Å" : length}`);
    }
  }

  // General fall back check: print keys and structures to avoid empty output
  const excludedKeys = ["material_id", "last_updated", "method", "coordination_environments", "coordination_numbers", "bond_lengths"];
  const extraKeys = Object.keys(doc).filter(k => !excludedKeys.includes(k));
  
  if (extraKeys.length > 0) {
    console.log(`\n${colors.bold}${colors.magenta}[Other Bonding Attributes]${colors.reset}`);
    for (const key of extraKeys) {
      console.log(`  ${colors.bold}${key}${colors.reset}:`);
      console.log(JSON.stringify(doc[key], null, 2));
    }
  }
}

// Execute main process
main();
