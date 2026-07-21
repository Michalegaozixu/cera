import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import { ENCRYPTED_DATA, DATA_KEY } from './encrypted_data';

interface CeraItem {
    id: number;
    identity: {
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
    chemistry?: Record<string, number | string>;
    _searchString?: string;
}

// Simple XOR decryption
const encryptedStr = Buffer.from(ENCRYPTED_DATA, 'base64').toString('utf-8');
let decryptedJson = "";
for (let i = 0; i < encryptedStr.length; i++) {
    decryptedJson += String.fromCharCode(encryptedStr.charCodeAt(i) ^ DATA_KEY.charCodeAt(i % DATA_KEY.length));
}
const rawData = JSON.parse(decryptedJson);

// 预处理数据：提取所有需要被搜索的文本维度
const allData: CeraItem[] = (rawData as CeraItem[]).map((item) => {
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

    // 将所有维度的字符拼接在一起转换为小写，用于全局模糊检索
    const searchString = searchableTerms.join(' ').toLowerCase();

    return {
        ...item,
        _searchString: searchString
    };
});

let currentResults: CeraItem[] = [...allData];

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
    
    // 内侧表格整体使用亮绿色 \x1b[92m
    const top = '\x1b[92m╭─' + colWidths.map(w => '─'.repeat(w)).join('─┬─') + '─╮\x1b[0m';
    const mid = '\x1b[92m├─' + colWidths.map(w => '─'.repeat(w)).join('─┼─') + '─┤\x1b[0m';
    const bot = '\x1b[92m╰─' + colWidths.map(w => '─'.repeat(w)).join('─┴─') + '─╯\x1b[0m';
    
    // 表头和内容也都强制用亮绿色
    const hLine = '\x1b[92m│\x1b[0m ' + headers.map((h, i) => `\x1b[92m${padStr(h, colWidths[i])}\x1b[0m`).join(' \x1b[92m│\x1b[0m ') + ' \x1b[92m│\x1b[0m';
    const vLine = '\x1b[92m│\x1b[0m ' + values.map((v, i) => `${valueColor}${padStr(v, colWidths[i])}\x1b[0m`).join(' \x1b[92m│\x1b[0m ') + ' \x1b[92m│\x1b[0m';
    
    return [top, hLine, mid, vLine, bot];
}

function printCardWithTables(item: CeraItem, index: number) {
    const iden = item.identity || {};
    const props = item.properties || {};
    const chem = item.chemistry || {};

    const nameZh = iden.name_zh || '';
    const nameEn = iden.name_en ? `(${iden.name_en})` : '';
    const titleRaw = ` 结果 ${index}: ${nameZh} ${nameEn} `;

    const kiln = iden.historical_kiln || '-';
    const surface = props.surface_zh ? `${props.surface_zh} (${props.surface_en})` : '-';
    const trans = props.transparency_zh ? `${props.transparency_zh} (${props.transparency_en})` : '-';
    const subtype = props.subtype_zh ? `${props.subtype_zh} (${props.subtype_en})` : '-';
    const atmos = (props.atmospheres_zh || []).length > 0 ? props.atmospheres_zh!.join(', ') : '-';
    
    const baseLines = getHorizontalTableLines(
        ['窑口', '类型', '质感', '透明度', '气氛'],
        [kiln, subtype, surface, trans, atmos],
        '\x1b[92m'
    );

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

    // 如果标题比表格还宽，扩展边框宽度
    if (tLen > maxInnerWidth) {
        maxInnerWidth = tLen;
    }

    const termWidth = process.stdout.columns || 80;
    const boxTotalWidth = maxInnerWidth + 4; // 2 spaces left/right inside, plus borders
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

    // 绘制嵌入标题的顶部边框
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
    console.log(); // 留个空行
}

function printResults(results: CeraItem[]) {
    if (results.length === 0) {
        console.log(" 没有找到匹配的数据，请尝试其他关键词。\n");
        return;
    }
    
    console.log(); // Add a single newline instead of the banner

    const maxPrint = results.length;
    for (let i = 0; i < Math.min(results.length, maxPrint); i++) {
        printCardWithTables(results[i], i + 1);
    }
}

function exportToCSV(results: CeraItem[]) {
    if (results.length === 0) {
        console.log("\n⚠️ 当前没有数据可导出。\n");
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
        "ID", "Name_ZH", "Name_EN", "Historical_Kiln", 
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

        const baseData = [
            r.id || '',
            iden.name_zh || '',
            iden.name_en || '',
            iden.historical_kiln || '',
            props.subtype_zh || '',
            props.subtype_en || '',
            props.surface_zh || '',
            props.surface_en || '',
            props.transparency_zh || '',
            props.transparency_en || '',
            (props.atmospheres_zh || []).join(';') || '',
            (props.atmospheres_en || []).join(';') || ''
        ].map(v => `"${String(v).replace(/"/g, '""')}"`);

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
    const filename = `analysis_${timestamp}.csv`;
    
    // 如果是打包后的二进制文件，优先保存到程序所在的文件夹；如果是开发环境，保存到当前运行目录
    const isCompiled = !process.execPath.endsWith('bun') && !process.execPath.endsWith('bun.exe');
    const outDir = isCompiled ? path.dirname(process.execPath) : process.cwd();
    const outputPath = path.join(outDir, filename);
    
    fs.writeFileSync(outputPath, BOM + header + rows.join('\n'), 'utf-8');
    
    console.log(`\n\x1b[32m✅ 成功导出 ${results.length} 条数据到 ${outputPath}\x1b[0m\n`);
}

function promptUser() {
    rl.setPrompt(`\x1b[90m[当前命中 \x1b[92m${currentResults.length}\x1b[90m 条] 输入字母\x1b[92mq\x1b[90m回车退出程序、输入数字\x1b[92m0\x1b[90m回车另存为csv文件 > \x1b[0m`);
    rl.prompt();
}

function printHelpCard() {
    const termWidth = process.stdout.columns || 80;
    const line1 = '输入字、词后回车查看结果，支持中英文混合';
    const line2 = `数据库共计${allData.length}条，涵盖釉料配方、坯料配方、测温锥配方、窑口种类等。`;
    const titleRaw = ` help `;
    
    const gray = '\x1b[90m';
    const reset = '\x1b[0m';
    
    const maxInnerWidth = Math.max(getStrWidth(line1), getStrWidth(line2));
    const boxTotalWidth = maxInnerWidth + 4;
    const outerMargin = Math.max(0, Math.floor((termWidth - boxTotalWidth) / 2));
    const omStr = ' '.repeat(outerMargin);
    
    const tLen = getStrWidth(titleRaw);
    const dashCount = maxInnerWidth + 2 - tLen;
    const lDash = Math.floor(dashCount / 2);
    const rDash = dashCount - lDash;
    
    console.log();
    console.log(`${omStr}${gray}╭${'─'.repeat(lDash)}${titleRaw}${'─'.repeat(rDash)}╮${reset}`);
    
    const printInnerLine = (line: string, rawWidth: number) => {
        const padding = maxInnerWidth - rawWidth;
        const lPad = Math.floor(padding / 2);
        const rPad = padding - lPad;
        console.log(`${omStr}${gray}│${reset} ${' '.repeat(lPad)}${line}${' '.repeat(rPad)} ${gray}│${reset}`);
    };
    
    console.log(`${omStr}${gray}│${reset} ${' '.repeat(maxInnerWidth)} ${gray}│${reset}`);
    printInnerLine(line1, getStrWidth(line1));
    printInnerLine(line2, getStrWidth(line2));
    console.log(`${omStr}${gray}│${reset} ${' '.repeat(maxInnerWidth)} ${gray}│${reset}`);
    
    console.log(`${omStr}${gray}╰${'─'.repeat(maxInnerWidth + 2)}╯${reset}`);
    console.log();
}

printHelpCard();

// 初始打印全量提示，但不展开全量列表
promptUser();

rl.on('line', (line) => {
    const input = line.trim();
    const lowerInput = input.toLowerCase();

    if (lowerInput === 'q' || lowerInput === 'quit' || lowerInput === 'exit') {
        console.log("已退出");
        process.exit(0);
    } else if (input === '0') {
        exportToCSV(currentResults);
    } else if (input !== '') {
        currentResults = allData.filter(item => item._searchString && item._searchString.includes(lowerInput));
        console.log(`\n\x1b[90m全局检索: "${input}" 共找到 ${currentResults.length} 条结果\x1b[0m\n`);
        
        printResults(currentResults);
    }

    promptUser();
}).on('close', () => {
    console.log('\n已退出');
    process.exit(0);
});
