#!/usr/bin/env bun

const PUG_API = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";
const VIEW_API = "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound";

// 辅助函数：深度优先搜索 PubChem 的复杂 JSON 数据结构
function extractValues(data: any, targetHeading: string): string[] {
  let results: string[] = [];

  function traverse(obj: any) {
    if (Array.isArray(obj)) {
      obj.forEach(traverse);
    } else if (obj !== null && typeof obj === 'object') {
      if (obj.TOCHeading === targetHeading && obj.Information) {
        obj.Information.forEach((info: any) => {
          if (info.Value && info.Value.StringWithMarkup) {
            info.Value.StringWithMarkup.forEach((swm: any) => {
              if (swm.String) results.push(swm.String);
            });
          }
        });
      }
      // 继续向下递归
      if (obj.Section) traverse(obj.Section);
    }
  }

  traverse(data);
  return [...new Set(results)]; // 去重
}

// 1. 获取 CID (Compound ID)
async function getCID(query: string): Promise<number | null> {
  // 注意：PubChem 的 name 搜索对大小写不敏感，但建议使用标准英文
  const url = `${PUG_API}/compound/name/${encodeURIComponent(query)}/cids/JSON`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`CID Fetch Error: ${res.statusText}`);
  }
  const data = await res.json();
  return data.IdentifierList?.CID?.[0] || null;
}

// 2. 获取基础属性
async function fetchBasicProperties(cid: number) {
  const url = `${PUG_API}/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES/JSON`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Basic Properties Fetch Error: ${res.statusText}`);
  const data = await res.json();
  return data.PropertyTable?.Properties?.[0] || {};
}

// 3. 获取深度参数 (Pug View)
async function fetchDetailedData(cid: number) {
  const url = `${VIEW_API}/${cid}/JSON`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Detailed Data Fetch Error: ${res.statusText}`);
  const data = await res.json();
  return data.Record || {};
}

// ================= 命令处理逻辑 =================

async function commandInfo(query: string) {
  console.log(`\n🔍 正在检索原料: \x1b[36m${query}\x1b[0m ...\n`);
  
  const cid = await getCID(query);
  if (!cid) {
    console.log(`❌ 找不到匹配的化学物质，请尝试更换标准的英文名或化学式 (例如: Alumina, Yttrium oxide)`);
    return;
  }
  
  console.log(`✅ 匹配成功! (PubChem CID: \x1b[33m${cid}\x1b[0m)`);
  console.log(`⏳ 正在拉取理化参数卡片...\n`);

  const [basic, detailed] = await Promise.all([
    fetchBasicProperties(cid),
    fetchDetailedData(cid)
  ]);

  // 从复杂的详细 JSON 中提取我们关心的工程参数
  const casNumbers = extractValues(detailed, "CAS");
  const meltingPoints = extractValues(detailed, "Melting Point");
  const boilingPoints = extractValues(detailed, "Boiling Point");
  const densities = extractValues(detailed, "Density");

  console.log(`========================================================`);
  console.log(` 🏷️  核心信息 (Core Info)`);
  console.log(`========================================================`);
  console.log(`- IUPAC Name : ${basic.IUPACName || 'N/A'}`);
  console.log(`- 化学式     : \x1b[32m${basic.MolecularFormula || 'N/A'}\x1b[0m`);
  console.log(`- 分子量     : ${basic.MolecularWeight || 'N/A'} g/mol`);
  console.log(`- CAS 号     : \x1b[33m${casNumbers[0] || 'N/A'}\x1b[0m`);
  console.log(`- SMILES     : ${basic.CanonicalSMILES || 'N/A'}`);
  
  console.log(`\n========================================================`);
  console.log(` 🧪 理化性质 (Physical & Chemical Properties)`);
  console.log(`========================================================`);
  console.log(`- 熔点 (Melting Point) : \x1b[35m${meltingPoints.length > 0 ? meltingPoints[0] : 'N/A'}\x1b[0m`);
  console.log(`- 沸点 (Boiling Point) : ${boilingPoints.length > 0 ? boilingPoints[0] : 'N/A'}`);
  console.log(`- 密度 (Density)       : ${densities.length > 0 ? densities[0] : 'N/A'}`);
  
  if (meltingPoints.length > 1) {
    console.log(`  *(注: 数据库中包含多个来源的熔点数据，展示为最常引用的一项)*`);
  }
  console.log(`\n🌟 提示: 运行 \`bun chem.ts safety "${query}"\` 可以查看它的安全危险信息。\n`);
}

async function commandSafety(query: string) {
  console.log(`\n⚠️  正在检索 \x1b[36m${query}\x1b[0m 的安全数据...\n`);
  
  const cid = await getCID(query);
  if (!cid) {
    console.log(`❌ 找不到匹配的化学物质。`);
    return;
  }

  const detailed = await fetchDetailedData(cid);
  
  // 提取危险分类和信号词
  const signalWords = extractValues(detailed, "Signal");
  const hazards = extractValues(detailed, "GHS Hazard Statements");
  
  console.log(`✅ PubChem CID: \x1b[33m${cid}\x1b[0m`);
  console.log(`========================================================`);
  console.log(` ⚠️  安全与危险性警告 (Safety & Hazards)`);
  console.log(`========================================================`);
  
  if (signalWords.length > 0) {
    const word = signalWords[0].toUpperCase();
    const color = word === 'DANGER' ? '\x1b[31m' : '\x1b[33m'; // Danger标红，Warning标黄
    console.log(`- 信号词 (Signal Word) : ${color}[${word}]\x1b[0m`);
  } else {
    console.log(`- 信号词 (Signal Word) : 无特别警告 (或数据库未收录)`);
  }

  console.log(`\n- GHS 危险说明 (GHS Hazard Statements):`);
  if (hazards.length > 0) {
    hazards.forEach(h => {
      // 简单高亮一下危险代码 (如 H302)
      const formatted = h.replace(/(H\d{3}[a-zA-Z]*)/g, '\x1b[33m$1\x1b[0m');
      console.log(`  * ${formatted}`);
    });
  } else {
    console.log(`  * ✅ 暂无该物质的严重危险通报。`);
  }
  console.log(`\n========================================================\n`);
}


// ================= 命令行入口 =================

const args = process.argv.slice(2);
const command = args[0];
const query = args[1];

if (!command || !query) {
  console.log(`
🧪 PubChem 终端检索工具 (Ceramics & Materials)

用法:
  bun chem.ts <命令> "<原料名称>"

可用命令:
  info      获取化学品的基础属性、CAS号及核心物理参数 (如熔点、密度)
  safety    获取化学品的 GHS 危险警告和安全标志

示例:
  bun chem.ts info "Alumina"
  bun chem.ts safety "Barium carbonate"
  `);
  process.exit(0);
}

if (command === 'info') {
  commandInfo(query).catch(e => console.error(`\n❌ 执行失败: ${e.message}\n`));
} else if (command === 'safety') {
  commandSafety(query).catch(e => console.error(`\n❌ 执行失败: ${e.message}\n`));
} else {
  console.log(`❌ 未知的命令: ${command}`);
}
