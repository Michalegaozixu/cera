import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import { ENCRYPTED_DATA, DATA_KEY } from './encrypted_data';
import { ENCRYPTED_MATERIALS, MATERIAL_KEY } from './encrypted_materials';

interface CeraItem {
    type: 'analysis' | 'material';
    id: number;
    // Analysis fields
    identity?: {
        name_en?: string;
        name_zh?: string;
        historical_kiln?: string;
    };
    properties?: {
        subtype_zh?: string;
        subtype_en?: string;
        surface_zh?: string;
        surface_en?: string;
        transparency_zh?: string;
        transparency_en?: string;
        atmospheres_zh?: string[];
        atmospheres_en?: string[];
    };
    // Material fields
    name?: string;
    subtype?: string;
    other_names?: string;
    country?: string;
    
    chemistry?: Record<string, number | string>;
    _searchString?: string;
}

// Simple XOR decryption for Analysis
const encAnalysisStr = Buffer.from(ENCRYPTED_DATA, 'base64').toString('utf-8');
let decAnalysisJson = "";
for (let i = 0; i < encAnalysisStr.length; i++) {
    decAnalysisJson += String.fromCharCode(encAnalysisStr.charCodeAt(i) ^ DATA_KEY.charCodeAt(i % DATA_KEY.length));
}
const rawAnalysisData = JSON.parse(decAnalysisJson);

// Simple XOR decryption for Materials
const encMaterialStr = Buffer.from(ENCRYPTED_MATERIALS, 'base64').toString('utf-8');
let decMaterialJson = "";
for (let i = 0; i < encMaterialStr.length; i++) {
    decMaterialJson += String.fromCharCode(encMaterialStr.charCodeAt(i) ^ MATERIAL_KEY.charCodeAt(i % MATERIAL_KEY.length));
}
const rawMaterialData = JSON.parse(decMaterialJson);

const allAnalysis: CeraItem[] = (rawAnalysisData as any[]).map((item) => {
    const iden = item.identity || {};
    const props = item.properties || {};

    const searchableTerms = [
        iden.name_zh, iden.name_en, iden.historical_kiln,
        props.subtype_zh, props.subtype_en,
        props.surface_zh, props.surface_en,
        props.transparency_zh, props.transparency_en,
        ...(props.atmospheres_zh || []),
        ...(props.atmospheres_en || [])
    ].filter(Boolean);

    return {
        ...item,
        type: 'analysis',
        _searchString: searchableTerms.join(' ').toLowerCase()
    };
});

const allMaterials: CeraItem[] = (rawMaterialData as any[]).map((item) => {
    const searchableTerms = [
        item.name, item.subtype, item.other_names, item.country
    ].filter(Boolean);

    return {
        ...item,
        type: 'material',
        _searchString: searchableTerms.join(' ').toLowerCase()
    };
});

let currentResults: CeraItem[] = [...allAnalysis];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function getStrWidth(str: string): number {
    let len = 0;
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (
            (code >= 0x4e00 && code <= 0x9fa5) || // CJK Unified
            (code >= 0x3400 && code <= 0x4dbf) || // CJK Ext A
            (code >= 0x3000 && code <= 0x303f) || // CJK Symbols and Punctuation (、，。等)
            (code >= 0xff01 && code <= 0xff60) || // Fullwidth char
            (code >= 0xe000 && code <= 0xf8ff)    // Private Use Area
        ) {
            len += 2;
        } else {
            len += 1;
        }
    }
    return len;
}

function padStr(str: string, length: number): string {
    const len = getStrWidth(str);
    const padding = length - len;
    return padding > 0 ? str + ' '.repeat(padding) : str;
}

function toSubscript(str: string): string {
    const subs: Record<string, string> = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', 
        '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
    };
    return str.replace(/[0-9]/g, m => subs[m] || m);
}

function stripAnsi(str: string): string {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function getHorizontalTableLines(headers: string[], values: string[], valueColor: string = '\x1b[92m'): string[] {
    const colWidths = headers.map((h, i) => Math.max(getStrWidth(stripAnsi(h)), getStrWidth(stripAnsi(values[i])), 4));
    
    const top = '\x1b[92m╭─' + colWidths.map(w => '─'.repeat(w)).join('─┬─') + '─╮\x1b[0m';
    const mid = '\x1b[92m├─' + colWidths.map(w => '─'.repeat(w)).join('─┼─') + '─┤\x1b[0m';
    const bot = '\x1b[92m╰─' + colWidths.map(w => '─'.repeat(w)).join('─┴─') + '─╯\x1b[0m';
    
    const hLine = '\x1b[92m│\x1b[0m ' + headers.map((h, i) => `\x1b[92m${padStr(h, colWidths[i])}\x1b[0m`).join(' \x1b[92m│\x1b[0m ') + ' \x1b[92m│\x1b[0m';
    const vLine = '\x1b[92m│\x1b[0m ' + values.map((v, i) => `${valueColor}${padStr(v, colWidths[i])}\x1b[0m`).join(' \x1b[92m│\x1b[0m ') + ' \x1b[92m│\x1b[0m';
    
    return [top, hLine, mid, vLine, bot];
}

function printCardWithTables(item: CeraItem, index: number) {
    const isMaterial = item.type === 'material';
    const chem = item.chemistry || {};
    
    let titleRaw = ` Result ${index} `;
    let baseLines: string[] = [];

    if (isMaterial) {
        const name = item.name || '-';
        const otherNames = item.other_names ? (item.other_names.length > 30 ? item.other_names.substring(0, 30) + '...' : item.other_names) : '-';
        const subtype = item.subtype || '-';
        const country = item.country || '-';

        baseLines = getHorizontalTableLines(
            ['Name', 'Other Names', 'Subtype', 'Country'],
            [name, otherNames, subtype, country],
            '\x1b[92m'
        );
    } else {
        const iden = item.identity || {};
        const props = item.properties || {};
        const nameZh = iden.name_zh || '';
        const nameEn = iden.name_en ? `(${iden.name_en})` : '';
        titleRaw = ` 结果 ${index}: ${nameZh} ${nameEn} `;

        const kiln = iden.historical_kiln || '-';
        const surface = props.surface_zh ? `${props.surface_zh} (${props.surface_en})` : '-';
        const trans = props.transparency_zh ? `${props.transparency_zh} (${props.transparency_en})` : '-';
        const subtype = props.subtype_zh ? `${props.subtype_zh} (${props.subtype_en})` : '-';
        const atmos = (props.atmospheres_zh || []).length > 0 ? props.atmospheres_zh!.join(', ') : '-';
        
        baseLines = getHorizontalTableLines(
            ['窑口', '类型', '质感', '透明度', '气氛'],
            [kiln, subtype, surface, trans, atmos],
            '\x1b[92m'
        );
    }

    let chemLines: string[] = [];
    const chemEntries = Object.entries(chem);
    if (chemEntries.length > 0) {
        chemLines = getHorizontalTableLines(
            chemEntries.map(e => toSubscript(e[0])),
            chemEntries.map(e => String(e[1])),
            '\x1b[92m'
        );
    } else {
        chemLines = ["(无化学成分数据)"];
    }

    const allContentLines = [...baseLines, ...chemLines];
    let maxInnerWidth = Math.max(...allContentLines.map(line => getStrWidth(stripAnsi(line))));
    const tLen = getStrWidth(titleRaw);

    if (tLen > maxInnerWidth) {
        maxInnerWidth = tLen;
    }
    
    // Force a minimum width so narrow cards (like Material) don't look awkwardly left-aligned on wide screens
    if (maxInnerWidth < 96) {
        maxInnerWidth = 96;
    }

    const termWidth = process.stdout.columns || 100;
    const boxTotalWidth = maxInnerWidth + 4;
    const outerMargin = Math.max(0, Math.floor((termWidth - boxTotalWidth) / 2));
    const omStr = ' '.repeat(outerMargin);
    const gray = '\x1b[90m';
    const reset = '\x1b[0m';

    const printInnerLine = (line: string, rawWidth: number) => {
        const padding = maxInnerWidth - rawWidth;
        const lPad = Math.floor(padding / 2);
        const rPad = padding - lPad;
        console.log(`${omStr}${gray}│${reset} ${' '.repeat(lPad)}${line}${' '.repeat(rPad)} ${gray}│${reset}`);
    };

    const dashCount = maxInnerWidth + 2 - tLen;
    const lDash = Math.floor(dashCount / 2);
    const rDash = dashCount - lDash;
    console.log(`${omStr}${gray}╭${'─'.repeat(lDash)}${titleRaw}${'─'.repeat(rDash)}╮${reset}`);
    
    console.log(`${omStr}${gray}│${reset} ${' '.repeat(maxInnerWidth)} ${gray}│${reset}`);
    baseLines.forEach(line => printInnerLine(line, getStrWidth(stripAnsi(line))));
    console.log(`${omStr}${gray}│${reset} ${' '.repeat(maxInnerWidth)} ${gray}│${reset}`);
    chemLines.forEach(line => printInnerLine(line, getStrWidth(stripAnsi(line))));
    console.log(`${omStr}${gray}│${reset} ${' '.repeat(maxInnerWidth)} ${gray}│${reset}`);
    
    console.log(`${omStr}${gray}╰${'─'.repeat(maxInnerWidth + 2)}╯${reset}`);
    console.log(); 
}

function printResults(results: CeraItem[]) {
    if (results.length === 0) {
        console.log(" 未找到匹配数据 (No results found). 请尝试其他关键词或放宽条件 (Please try different keywords or relax conditions).\n");
        return;
    }
    
    console.log(); 

    const maxPrint = results.length;
    for (let i = 0; i < Math.min(results.length, maxPrint); i++) {
        printCardWithTables(results[i], i + 1);
    }
}

function exportToCSV(results: CeraItem[]) {
    if (results.length === 0) {
        console.log("\n⚠️ 当前没有数据可导出 (No data available to export).\n");
        return;
    }

    const chemKeys = new Set<string>();
    results.forEach(item => {
        if (item.chemistry) {
            Object.keys(item.chemistry).forEach(k => chemKeys.add(k));
        }
    });

    let chemHeaders = Array.from(chemKeys);
    if (chemHeaders.includes('LOI')) {
        chemHeaders = chemHeaders.filter(k => k !== 'LOI');
        chemHeaders.push('LOI');
    }
    const headers = [
        "Type", "ID", "Name_ZH", "Name_EN/Other", "Historical_Kiln/Country", 
        "Subtype_ZH", "Subtype_EN", 
        "Surface_ZH", "Surface_EN", 
        "Transparency_ZH", "Transparency_EN", 
        "Atmospheres_ZH", "Atmospheres_EN",
        ...chemHeaders
    ];

    const rows = results.map(r => {
        const iden = r.identity || {};
        const props = r.properties || {};
        const chem = r.chemistry || {};

        let baseData: string[];
        if (r.type === 'material') {
            baseData = [
                'material', r.id || '', r.name || '', r.other_names || '', r.country || '',
                r.subtype || '', '', '', '', '', '', '', ''
            ].map(v => `"${String(v).replace(/"/g, '""')}"`);
        } else {
            baseData = [
                'analysis', r.id || '', iden.name_zh || '', iden.name_en || '', iden.historical_kiln || '',
                props.subtype_zh || '', props.subtype_en || '', props.surface_zh || '', props.surface_en || '',
                props.transparency_zh || '', props.transparency_en || '',
                (props.atmospheres_zh || []).join(';') || '', (props.atmospheres_en || []).join(';') || ''
            ].map(v => `"${String(v).replace(/"/g, '""')}"`);
        }

        const chemData = chemHeaders.map(k => {
            const val = chem[k];
            return val !== undefined ? val : '';
        });

        return [...baseData, ...chemData].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const header = headers.join(',') + '\n';
    const BOM = '\ufeff';
    
    const now = new Date();
    const yyyy = now.getFullYear();
    const MM = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const HH = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const ss = now.getSeconds().toString().padStart(2, '0');
    
    const timestamp = `${yyyy}${MM}${dd}_${HH}${mm}${ss}`;
    const filename = `composition_search_${timestamp}.csv`;
    
    const isCompiled = !process.execPath.endsWith('bun') && !process.execPath.endsWith('bun.exe');
    const outDir = isCompiled ? path.dirname(process.execPath) : process.cwd();
    const outputPath = path.join(outDir, filename);
    
    fs.writeFileSync(outputPath, BOM + header + rows.join('\n'), 'utf-8');
    
    console.log(`\n\x1b[32m✅ 成功导出 (Successfully exported) ${results.length} 条数据到 (to) ${outputPath}\x1b[0m\n`);
}

function promptUser() {
    rl.setPrompt(`\x1b[90m输入 \x1b[92mq\x1b[90m 退出 (Quit) / 输入 \x1b[92m0\x1b[90m 导出 (Export) > \x1b[0m`);
    rl.prompt();
}

function printHelpCard() {
    const termWidth = process.stdout.columns || 80;
    const line1 = `配方数据: ${allAnalysis.length} 条 | 原料数据: ${allMaterials.length} 条`;
    const line2 = '使用方法如下：';
    const line3 = '1、输入关键字、词后，回车即可获取配方数据';
    const line4 = '2、切换至英文输入法，输入material 氧化物名称>数字或material 多个氧化物与数字之间的关系，';
    const line5 = '   回车后即可获取原料数据。例如：material SiO2>80 或 material Fe2O3>5 Al2O3<55';
    
    const en1 = `Recipes: ${allAnalysis.length} | Materials: ${allMaterials.length}`;
    const en2 = 'Instructions:';
    const en3 = '1. Enter keywords and press Enter to search the recipes.';
    const en4 = "2. Type 'material' followed by oxide conditions to search the materials.";
    const en5 = "   Example: material SiO2>80 or material Fe2O3>5 Al2O3<55";
    
    const titleRaw = ` composition search cli `;
    
    const gray = '\x1b[90m';
    const reset = '\x1b[0m';
    
    let maxInnerWidth = Math.max(
        getStrWidth(line1), getStrWidth(line2), getStrWidth(line3), getStrWidth(line4), getStrWidth(line5),
        getStrWidth(en1), getStrWidth(en2), getStrWidth(en3), getStrWidth(en4), getStrWidth(en5)
    );
    
    // Force minimum width for consistency
    if (maxInnerWidth < 100) {
        maxInnerWidth = 100;
    }
    
    const boxTotalWidth = maxInnerWidth + 4;
    const outerMargin = Math.max(0, Math.floor((termWidth - boxTotalWidth) / 2));
    const omStr = ' '.repeat(outerMargin);
    
    const tLen = getStrWidth(titleRaw);
    const dashCount = maxInnerWidth + 2 - tLen;
    const lDash = Math.floor(dashCount / 2);
    const rDash = dashCount - lDash;
    
    console.log();
    console.log(`${omStr}${gray}╭${'─'.repeat(lDash)}\x1b[92m${titleRaw}\x1b[90m${'─'.repeat(rDash)}╮${reset}`);
    
    const printInnerLine = (line: string, rawWidth: number) => {
        const padding = maxInnerWidth - rawWidth;
        const lPad = Math.floor(padding / 2);
        const rPad = padding - lPad;
        console.log(`${omStr}${gray}│${reset} ${' '.repeat(lPad)}${line}${' '.repeat(rPad)} ${gray}│${reset}`);
    };
    
    console.log(`${omStr}${gray}│${reset} ${' '.repeat(maxInnerWidth)} ${gray}│${reset}`);
    printInnerLine(line1, getStrWidth(line1));
    console.log(`${omStr}${gray}│${reset} ${' '.repeat(maxInnerWidth)} ${gray}│${reset}`);
    printInnerLine(line2, getStrWidth(line2));
    printInnerLine(line3, getStrWidth(line3));
    printInnerLine(line4, getStrWidth(line4));
    printInnerLine(line5, getStrWidth(line5));
    console.log(`${omStr}${gray}│${reset} ${' '.repeat(maxInnerWidth)} ${gray}│${reset}`);
    
    const dashInner = '─'.repeat(maxInnerWidth);
    console.log(`${omStr}${gray}│ ${dashInner} │${reset}`);
    
    console.log(`${omStr}${gray}│${reset} ${' '.repeat(maxInnerWidth)} ${gray}│${reset}`);
    printInnerLine(en1, getStrWidth(en1));
    console.log(`${omStr}${gray}│${reset} ${' '.repeat(maxInnerWidth)} ${gray}│${reset}`);
    printInnerLine(en2, getStrWidth(en2));
    printInnerLine(en3, getStrWidth(en3));
    printInnerLine(en4, getStrWidth(en4));
    printInnerLine(en5, getStrWidth(en5));
    console.log(`${omStr}${gray}│${reset} ${' '.repeat(maxInnerWidth)} ${gray}│${reset}`);
    
    console.log(`${omStr}${gray}╰${'─'.repeat(maxInnerWidth + 2)}╯${reset}`);
    console.log();
}

printHelpCard();
promptUser();

rl.on('line', (line) => {
    const input = line.trim();
    const lowerInput = input.toLowerCase();

    if (lowerInput === 'q' || lowerInput === 'quit' || lowerInput === 'exit') {
        console.log("已退出 (Exited)");
        process.exit(0);
    } else if (input === '0') {
        exportToCSV(currentResults);
    } else if (input !== '') {
        const isMaterial = lowerInput.includes('material') || input.includes('原料');
        let targetData = isMaterial ? allMaterials : allAnalysis;
        
        let queryStr = input.replace(/material/gi, '').replace(/原料/g, '').trim();
        
        const conditions: { oxide: string, op: string, val: number }[] = [];
        const conditionRegex = /([A-Za-z0-9_]+)\s*([><=]+)\s*([0-9.]+)/g;
        
        let match;
        while ((match = conditionRegex.exec(queryStr)) !== null) {
            conditions.push({
                oxide: match[1],
                op: match[2],
                val: parseFloat(match[3])
            });
        }
        
        // 移除已经提取的条件，剩下的全是纯粹的模糊匹配关键词
        queryStr = queryStr.replace(conditionRegex, '').trim();
        const keywords = queryStr.split(/\s+/).filter(Boolean).map(k => k.toLowerCase());

        currentResults = targetData.filter(item => {
            if (keywords.length > 0) {
                const searchString = item._searchString || '';
                const matchesKeywords = keywords.every(kw => searchString.includes(kw));
                if (!matchesKeywords) return false;
            }
            if (conditions.length > 0) {
                const chem = item.chemistry || {};
                for (const cond of conditions) {
                    // Normalize case to match oxides like SiO2
                    const actualKey = Object.keys(chem).find(k => k.toLowerCase() === cond.oxide.toLowerCase());
                    const chemVal = actualKey ? Number(chem[actualKey]) : NaN;
                    
                    if (isNaN(chemVal)) return false; 
                    if (cond.op === '>') {
                        if (!(chemVal > cond.val)) return false;
                    } else if (cond.op === '<') {
                        if (!(chemVal < cond.val)) return false;
                    } else if (cond.op === '=') {
                        if (!(chemVal === cond.val)) return false;
                    } else if (cond.op === '>=') {
                        if (!(chemVal >= cond.val)) return false;
                    } else if (cond.op === '<=') {
                        if (!(chemVal <= cond.val)) return false;
                    }
                }
            }
            return true;
        });

        const modeStr = isMaterial ? "原料库 / Materials" : "配方库 / Recipes";
        console.log(`\n\x1b[90m[${modeStr}] 检索 (Search): "${input}" 命中 (Found): \x1b[92m${currentResults.length}\x1b[90m 条结果 (results)\x1b[0m\n`);
        
        printResults(currentResults);
    }

    promptUser();
}).on('close', () => {
    console.log('\n已退出 (Exited)');
    process.exit(0);
});
