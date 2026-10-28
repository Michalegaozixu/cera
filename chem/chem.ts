#!/usr/bin/env bun

const PUG_API  = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";
const VIEW_API = "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound";

// ─── 数据提取：深度优先搜索 PubChem JSON ──────────────────
function extractValues(data: any, targetHeading: string): string[] {
  const results: string[] = [];
  function traverse(obj: any) {
    if (Array.isArray(obj)) { obj.forEach(traverse); return; }
    if (obj !== null && typeof obj === "object") {
      if (obj.Information) {
        for (const info of obj.Information) {
          if (obj.TOCHeading === targetHeading || info.Name === targetHeading) {
            if (info.Value?.StringWithMarkup) {
              for (const swm of info.Value.StringWithMarkup) {
                if (swm.String) results.push(swm.String);
              }
            }
          }
        }
      }
      if (obj.Section) traverse(obj.Section);
    }
  }
  traverse(data);
  return [...new Set(results)];
}

// ─── API 调用 ─────────────────────────────────────────────
async function getCID(query: string): Promise<number | null> {
  const res = await fetch(
    `${PUG_API}/compound/name/${encodeURIComponent(query)}/cids/JSON`
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return (await res.json()).IdentifierList?.CID?.[0] ?? null;
}

async function fetchBasicProperties(cid: number) {
  const res = await fetch(
    `${PUG_API}/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES,ConnectivitySMILES,IsomericSMILES/JSON`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return (await res.json()).PropertyTable?.Properties?.[0] ?? {};
}

async function fetchDetailedData(cid: number) {
  const res = await fetch(`${VIEW_API}/${cid}/JSON`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return (await res.json()).Record ?? {};
}

// ─── ANSI 颜色常量 ────────────────────────────────────────
const A = {
  r  : "\x1b[0m",   // reset
  b  : "\x1b[1m",   // bold
  d  : "\x1b[2m",   // dim
  gr : "\x1b[90m",  // gray
  cy : "\x1b[96m",  // bright cyan
  ye : "\x1b[93m",  // bright yellow
  gn : "\x1b[92m",  // bright green
  mg : "\x1b[95m",  // bright magenta
  rd : "\x1b[91m",  // bright red
  wh : "\x1b[97m",  // bright white
};

// 去除 ANSI 转义以计算真实视觉宽度
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

// ─── CJK / Unicode 视觉宽度与角标转换 ────────────────────
function getStrWidth(str: string): number {
  let len = 0;
  const stripped = stripAnsi(str);
  for (const ch of stripped) {
    const cp = ch.codePointAt(0)!;
    const wide =
      (cp >= 0x1100 && cp <= 0x115F) || // Hangul Jamo
      (cp >= 0x2E80 && cp <= 0x9FFF) || // CJK 部首、統一漢字
      (cp >= 0xAC00 && cp <= 0xD7AF) || // 韩文音节
      (cp >= 0xF900 && cp <= 0xFAFF) || // CJK 兼容汉字
      (cp >= 0xFF01 && cp <= 0xFF60) || // 全角 ASCII
      (cp >= 0xFFE0 && cp <= 0xFFE6);   // 全角符号
    len += wide ? 2 : 1;
  }
  return len;
}

function padStr(str: string, length: number): string {
  const len = getStrWidth(str);
  const padding = length - len;
  return padding > 0 ? str + " ".repeat(padding) : str;
}

function toSubscript(str: string): string {
  const subs: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', 
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
  };
  return str.replace(/[0-9]/g, m => subs[m] || m);
}

// 多行 ANSI 自动折行
function wrapTextWithAnsi(raw: string, maxW: number): string[] {
  if (!raw) return ["—"];
  if (getStrWidth(raw) <= maxW) return [raw];

  interface Token {
    type: "ansi" | "space" | "word";
    text: string;
    vw: number;
  }

  const tokens: Token[] = [];
  const regex = /(\x1b\[[0-9;]*m)|(\s+)|([^\s\x1b]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    if (match[1]) {
      tokens.push({ type: "ansi", text: match[1], vw: 0 });
    } else if (match[2]) {
      const text = match[2].includes("\n") ? match[2] : " ";
      tokens.push({ type: "space", text, vw: text.length });
    } else if (match[3]) {
      tokens.push({ type: "word", text: match[3], vw: getStrWidth(match[3]) });
    }
  }

  const lines: string[] = [];
  let curLine = "";
  let curW = 0;
  let activeAnsi = "";

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    if (tok.type === "ansi") {
      if (tok.text === A.r) {
        activeAnsi = "";
      } else {
        activeAnsi += tok.text;
      }
      curLine += tok.text;
      continue;
    }

    if (tok.type === "space") {
      if (tok.text.includes("\n")) {
        if (activeAnsi) curLine += A.r;
        lines.push(curLine);
        curLine = activeAnsi;
        curW = 0;
        continue;
      }
      if (curW > 0 && curW + tok.vw <= maxW) {
        curLine += tok.text;
        curW += tok.vw;
      }
      continue;
    }

    if (tok.type === "word") {
      if (tok.vw > maxW) {
        if (curW > 0) {
          if (activeAnsi) curLine += A.r;
          lines.push(curLine);
          curLine = activeAnsi;
          curW = 0;
        }
        for (const ch of tok.text) {
          const cw = getStrWidth(ch);
          if (curW + cw > maxW) {
            if (activeAnsi) curLine += A.r;
            lines.push(curLine);
            curLine = activeAnsi + ch;
            curW = cw;
          } else {
            curLine += ch;
            curW += cw;
          }
        }
      } else {
        if (curW + tok.vw > maxW) {
          if (curLine.endsWith(" ")) {
            curLine = curLine.slice(0, -1);
          }
          if (activeAnsi) curLine += A.r;
          lines.push(curLine);
          curLine = activeAnsi + tok.text;
          curW = tok.vw;
        } else {
          curLine += tok.text;
          curW += tok.vw;
        }
      }
    }
  }

  if (curW > 0 || curLine) {
    if (curLine.endsWith(" ")) {
      curLine = curLine.slice(0, -1);
    }
    if (activeAnsi && !curLine.endsWith(A.r)) curLine += A.r;
    lines.push(curLine);
  }

  return lines.length > 0 ? lines : ["—"];
}

// 单行状态提示
function status(msg: string): void {
  process.stdout.write(`  ${msg}\r`);
}
function clearStatus(): void {
  process.stdout.write(" ".repeat(72) + "\r");
}

function out(s = ""): void { console.log(s); }

// ─── 横向表格生成器（支持多行单元格换行，防溢出断线）────
function getHorizontalTableLinesWrapped(
  headers: string[],
  rows: string[][],
  maxTableWidth: number = 84,
  valueColor: string = A.gn,
  borderColor: string = A.gn
): string[] {
  const numCols = headers.length;
  const minWidths = headers.map(h => Math.max(getStrWidth(h), 4));

  const idealWidths = headers.map((h, colIdx) => {
    let maxW = getStrWidth(h);
    for (const row of rows) {
      if (row[colIdx]) {
        maxW = Math.max(maxW, getStrWidth(row[colIdx]));
      }
    }
    return Math.max(maxW, 4);
  });

  const totalIdeal = idealWidths.reduce((a, b) => a + b, 0) + (numCols - 1) * 3 + 4;
  let colWidths: number[] = [];

  if (totalIdeal <= maxTableWidth) {
    colWidths = idealWidths;
  } else {
    const separatorsW = (numCols - 1) * 3 + 4;
    const availW = Math.max(numCols * 6, maxTableWidth - separatorsW);
    const sumIdeal = idealWidths.reduce((a, b) => a + b, 0);

    colWidths = idealWidths.map((w, idx) => {
      const prop = Math.floor((w / sumIdeal) * availW);
      return Math.max(minWidths[idx], prop);
    });
  }

  const top = `${borderColor}╭─` + colWidths.map(w => "─".repeat(w)).join("─┬─") + `─╮${A.r}`;
  const mid = `${borderColor}├─` + colWidths.map(w => "─".repeat(w)).join("─┼─") + `─┤${A.r}`;
  const bot = `${borderColor}╰─` + colWidths.map(w => "─".repeat(w)).join("─┴─") + `─╯${A.r}`;

  const hLine = `${borderColor}│${A.r} ` + headers.map((h, i) => `${borderColor}${padStr(h, colWidths[i])}${A.r}`).join(` ${borderColor}│${A.r} `) + ` ${borderColor}│${A.r}`;

  const result = [top, hLine, mid];

  rows.forEach((row, rIdx) => {
    if (rIdx > 0) result.push(mid);

    const cellLines: string[][] = headers.map((_, colIdx) => {
      return wrapTextWithAnsi(row[colIdx] || "-", colWidths[colIdx]);
    });

    const maxRowLines = Math.max(...cellLines.map(lines => lines.length), 1);

    for (let lineIdx = 0; lineIdx < maxRowLines; lineIdx++) {
      const lineCells = headers.map((_, colIdx) => {
        const cellText = cellLines[colIdx][lineIdx] || "";
        return `${valueColor}${padStr(cellText, colWidths[colIdx])}${A.r}`;
      });
      result.push(`${borderColor}│${A.r} ` + lineCells.join(` ${borderColor}│${A.r} `) + ` ${borderColor}│${A.r}`);
    }
  });

  result.push(bot);
  return result;
}

// ─── 卡片渲染器（参照 CompositionSearchCli UI 风格）─────
function printCardWithTables(titleRaw: string, tableBlocks: string[][]) {
  const allContentLines = tableBlocks.flat();
  let maxInnerWidth = Math.max(...allContentLines.map(line => getStrWidth(line)), getStrWidth(titleRaw));

  const termWidth = process.stdout.columns || 80;
  // 确保卡片不会超出终端宽度导致换行断线
  const maxAllowedInner = Math.max(40, termWidth - 8);
  if (maxInnerWidth > maxAllowedInner) {
    maxInnerWidth = maxAllowedInner;
  }
  if (maxInnerWidth < 76) {
    maxInnerWidth = 76;
  }

  const boxTotalWidth = maxInnerWidth + 4;
  const outerMargin = Math.max(0, Math.floor((termWidth - boxTotalWidth) / 2));
  const omStr = " ".repeat(outerMargin);

  const printInnerLine = (line: string, rawWidth: number) => {
    const padding = maxInnerWidth - rawWidth;
    const lPad = Math.floor(padding / 2);
    const rPad = padding - lPad;
    console.log(`${omStr}${A.gr}│${A.r} ${" ".repeat(lPad)}${line}${" ".repeat(rPad)} ${A.gr}│${A.r}`);
  };

  const tLen = getStrWidth(titleRaw);
  const dashCount = maxInnerWidth + 2 - tLen;
  const lDash = Math.floor(dashCount / 2);
  const rDash = dashCount - lDash;

  console.log();
  console.log(`${omStr}${A.gr}╭${"─".repeat(lDash)}${A.gn}${titleRaw}${A.gr}${"─".repeat(rDash)}╮${A.r}`);

  console.log(`${omStr}${A.gr}│${A.r} ${" ".repeat(maxInnerWidth)} ${A.gr}│${A.r}`);

  tableBlocks.forEach((block, bIdx) => {
    if (bIdx > 0) {
      console.log(`${omStr}${A.gr}│${A.r} ${" ".repeat(maxInnerWidth)} ${A.gr}│${A.r}`);
    }
    block.forEach(line => printInnerLine(line, getStrWidth(line)));
  });

  console.log(`${omStr}${A.gr}│${A.r} ${" ".repeat(maxInnerWidth)} ${A.gr}│${A.r}`);
  console.log(`${omStr}${A.gr}╰${"─".repeat(maxInnerWidth + 2)}╯${A.r}`);
  console.log();
}

// ─── 命令：info ───────────────────────────────────────────
async function commandInfo(query: string) {
  status(`${A.cy}◌${A.r}  正在查询 ${A.b}${query}${A.r} ...`);

  const cid = await getCID(query);
  if (!cid) {
    clearStatus();
    out(`\n  ${A.rd}✗${A.r}  未找到匹配的化合物: "${query}"\n`);
    return;
  }

  status(`${A.gn}✓${A.r}  CID ${cid} · 正在拉取数据...`);

  const [basic, detailed] = await Promise.all([
    fetchBasicProperties(cid),
    fetchDetailedData(cid),
  ]);

  const casNumbers    = extractValues(detailed, "CAS");
  const meltingPoints = extractValues(detailed, "Melting Point");
  const boilingPoints = extractValues(detailed, "Boiling Point");
  const densities     = extractValues(detailed, "Density");

  clearStatus();

  const titleRaw = ` 结果: ${query} (CID ${cid}) `;
  const termWidth = process.stdout.columns || 80;
  const maxTableWidth = Math.max(64, Math.min(84, termWidth - 12));

  const coreHeaders = ['IUPAC Name', '化学式', '分子量', 'CAS 号', 'SMILES'];
  const coreRow = [
    basic.IUPACName || '-',
    toSubscript(basic.MolecularFormula || '-'),
    basic.MolecularWeight ? `${basic.MolecularWeight} g/mol` : '-',
    casNumbers[0] || '-',
    basic.CanonicalSMILES ?? basic.ConnectivitySMILES ?? basic.IsomericSMILES ?? '-'
  ];

  const coreTable = getHorizontalTableLinesWrapped(coreHeaders, [coreRow], maxTableWidth, A.gn, A.gn);

  const propHeaders = ['熔点', '沸点', '密度'];
  const propRow = [
    meltingPoints[0] || '-',
    boilingPoints[0] || '-',
    densities[0] || '-'
  ];

  const propTable = getHorizontalTableLinesWrapped(propHeaders, [propRow], maxTableWidth, A.gn, A.gn);

  printCardWithTables(titleRaw, [coreTable, propTable]);
}

// ─── 命令：safety ─────────────────────────────────────────
async function commandSafety(query: string) {
  status(`${A.cy}◌${A.r}  正在查询 ${A.b}${query}${A.r} 的安全数据 ...`);

  const cid = await getCID(query);
  if (!cid) {
    clearStatus();
    out(`\n  ${A.rd}✗${A.r}  未找到匹配的化合物: "${query}"\n`);
    return;
  }

  status(`${A.gn}✓${A.r}  CID ${cid} · 正在拉取安全数据...`);

  const detailed    = await fetchDetailedData(cid);
  const signalWords = extractValues(detailed, "Signal");
  const hazards     = extractValues(detailed, "GHS Hazard Statements");

  clearStatus();

  const titleRaw = ` 安全数据: ${query} (CID ${cid}) `;
  const termWidth = process.stdout.columns || 80;
  const maxTableWidth = Math.max(64, Math.min(84, termWidth - 12));

  const word = signalWords[0]?.toUpperCase();
  const signalFmt =
    word === "DANGER"  ? `${A.rd}${A.b}● DANGER${A.r}` :
    word === "WARNING" ? `${A.ye}${A.b}● WARNING${A.r}` :
    word               ? `${A.ye}${A.b}● ${word}${A.r}` :
                         `${A.gr}无特别警告${A.r}`;

  const dangerTable = getHorizontalTableLinesWrapped(['信号词 / Signal'], [[signalFmt]], maxTableWidth, A.gn, A.gn);

  const hazardRows = hazards.length > 0
    ? hazards.map(h => [h.replace(/(H\d{3}[a-zA-Z]*)/g, `${A.ye}$1${A.r}`)])
    : [[`${A.gn}✓  暂无严重危险通报${A.r}`]];

  const hazardTable = getHorizontalTableLinesWrapped(['GHS 危险说明 / Hazard Statements'], hazardRows, maxTableWidth, A.gn, A.gn);

  printCardWithTables(titleRaw, [dangerTable, hazardTable]);
}

// ─── 命令行入口 ───────────────────────────────────────────
const args    = process.argv.slice(2);
const command = args[0];
const query   = args[1];

if (!command || !query) {
  out(`\n  ${A.rd}✗${A.r}  用法: bun chem.ts <info|safety> "<化合物名称>"\n`);
  process.exit(1);
}

if (command === "info") {
  commandInfo(query).catch(e =>
    out(`\n  ${A.rd}✗${A.r}  执行失败: ${e.message}\n`)
  );
} else if (command === "safety") {
  commandSafety(query).catch(e =>
    out(`\n  ${A.rd}✗${A.r}  执行失败: ${e.message}\n`)
  );
} else {
  out(`\n  ${A.rd}✗${A.r}  未知命令: ${A.b}${command}${A.r}\n`);
}
