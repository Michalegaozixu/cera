#!/usr/bin/env bun
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join, isAbsolute } from 'path';

// 1. 读取同级目录下的 .env 文件
function loadEnv() {
  try {
    const envPath = resolve(dirname(Bun.main), '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) process.env[match[1]] = match[2].trim();
    });
  } catch (error) {}
}
loadEnv();

const EXA_API_KEY = process.env.EXA_API_KEY;
if (!EXA_API_KEY || EXA_API_KEY === 'your_exa_api_key_here') {
  console.error("❌ 错误：未找到有效的 EXA_API_KEY。请在 .env 中配置。");
  process.exit(1);
}

// 2. 通用 CLI 参数解析器
interface ParsedArgs {
  command: string;
  positionals: string[];
  options: Record<string, any>;
}

function parseArgs(args: string[]): ParsedArgs {
  if (args.length === 0) {
    console.error("❌ 错误：请指定命令。");
    process.exit(1);
  }

  const command = args[0].toLowerCase();
  const positionals: string[] = [];
  const options: Record<string, any> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        const key = arg.slice(2, eqIdx);
        const val = arg.slice(eqIdx + 1);
        options[key] = val;
      } else {
        const key = arg.slice(2);
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          options[key] = args[i + 1];
          i++;
        } else {
          options[key] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      const key = arg.slice(1);
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        options[key] = args[i + 1];
        i++;
      } else {
        options[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }

  return { command, positionals, options };
}

const { command, positionals, options } = parseArgs(process.argv.slice(2));

// 3. 通用 Fetch 配置
const fetchOptions = (bodyObj: any) => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${EXA_API_KEY}`,
    'x-api-key': EXA_API_KEY
  },
  body: JSON.stringify(bodyObj),
});

// 4. Markdown 文件保存辅助函数
function saveMarkdown(content: string, customPath?: string | boolean, defaultPrefix = 'exa_output') {
  let targetPath = '';
  if (typeof customPath === 'string' && customPath.trim().length > 0) {
    targetPath = customPath.trim();
  } else {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    targetPath = `./${defaultPrefix}_${timestamp}.md`;
  }

  const absPath = isAbsolute(targetPath) ? targetPath : join(process.cwd(), targetPath);
  const targetDir = dirname(absPath);
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(absPath, content, 'utf-8');
  console.log(`\n💾 报告已成功保存至: \x1b[32m${absPath}\x1b[0m`);
}

// 5. SSE (Server-Sent Events) 与流式响应读取函数
// 合并 text-delta / results / grounding / done / error，避免只保留最后一片碎片
interface StreamResult {
  text: string;
  data?: any;
}

function extractStreamDelta(chunk: any): string {
  const choiceDelta = chunk?.choices?.[0]?.delta?.content;
  if (typeof choiceDelta === 'string' && choiceDelta) return choiceDelta;
  // 官方 text-delta 事件顶层也可能带 delta
  if (typeof chunk?.delta === 'string' && chunk.delta) return chunk.delta;
  if (typeof chunk?.content === 'string' && chunk.content) return chunk.content;
  if (typeof chunk?.text === 'string' && chunk.text) return chunk.text;
  return '';
}

function applyStreamChunk(
  chunk: any,
  state: {
    fullContent: string;
    results?: any[];
    output?: any;
    grounding?: any[];
    requestId?: string;
    costDollars?: any;
    searchTime?: number;
  }
): string {
  if (!chunk || typeof chunk !== 'object') return state.fullContent;

  if (chunk.requestId) state.requestId = chunk.requestId;

  // error 事件：立即失败，避免静默吞掉
  if (chunk.type === 'error') {
    const msg = chunk.error?.message || chunk.message || JSON.stringify(chunk.error || chunk);
    throw new Error(`流式搜索错误: ${msg}`);
  }

  const writeDelta = (delta: string) => {
    if (!delta) return;
    process.stdout.write(delta);
    state.fullContent += delta;
  };

  switch (chunk.type) {
    case 'text-delta':
      writeDelta(extractStreamDelta(chunk));
      break;

    case 'results':
      if (Array.isArray(chunk.results)) state.results = chunk.results;
      break;

    case 'grounding':
      if (Array.isArray(chunk.grounding)) state.grounding = chunk.grounding;
      if (Array.isArray(chunk.citations) && state.output) {
        state.output = { ...state.output, citations: chunk.citations };
      }
      break;

    case 'done':
      if (chunk.output != null) state.output = chunk.output;
      if (chunk.costDollars != null) state.costDollars = chunk.costDollars;
      if (typeof chunk.searchTime === 'number') state.searchTime = chunk.searchTime;
      if (Array.isArray(chunk.results)) state.results = chunk.results;
      // 少数实现会在 done 里再推最后一截文字
      writeDelta(extractStreamDelta(chunk));
      break;

    case 'stream-reset':
      // 服务端要求重置流内容时清空已累计正文
      state.fullContent = '';
      break;

    default: {
      // 无 type：OpenAI 兼容 chunk，或非 SSE 的整包 JSON 兜底
      writeDelta(extractStreamDelta(chunk));
      if (Array.isArray(chunk.results)) state.results = chunk.results;
      if (chunk.output != null) state.output = chunk.output;
      if (Array.isArray(chunk.grounding)) state.grounding = chunk.grounding;
      if (chunk.costDollars != null) state.costDollars = chunk.costDollars;
      break;
    }
  }

  return state.fullContent;
}

function buildStreamData(state: {
  results?: any[];
  output?: any;
  grounding?: any[];
  requestId?: string;
  costDollars?: any;
  searchTime?: number;
}): any | undefined {
  const hasPayload =
    state.results != null ||
    state.output != null ||
    state.grounding != null ||
    state.costDollars != null;

  if (!hasPayload) return undefined;

  const data: any = {};
  if (state.requestId) data.requestId = state.requestId;
  if (state.results) data.results = state.results;
  if (state.output != null) {
    data.output = state.output;
  }
  // grounding 可能单独推送；合并进 output 方便后续统一展示
  if (state.grounding) {
    data.output = { ...(data.output || {}), grounding: state.grounding };
  }
  if (state.costDollars != null) data.costDollars = state.costDollars;
  if (typeof state.searchTime === 'number') data.searchTime = state.searchTime;
  return data;
}

async function readSSEStream(res: Response): Promise<StreamResult> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("无法读取响应流。");

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  const state: {
    fullContent: string;
    results?: any[];
    output?: any;
    grounding?: any[];
    requestId?: string;
    costDollars?: any;
    searchTime?: number;
  } = { fullContent: '' };

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let payloadStr = trimmed;
    if (trimmed.startsWith('data:')) {
      payloadStr = trimmed.slice(5).trimStart();
      if (payloadStr === '[DONE]') return;
    }

    try {
      const chunk = JSON.parse(payloadStr);
      applyStreamChunk(chunk, state);
    } catch {
      // 非 JSON 行忽略（注释行 :ping 等）
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) handleLine(line);
  }

  if (buffer.trim()) handleLine(buffer);

  return { text: state.fullContent, data: buildStreamData(state) };
}

// ================== 核心功能 1: search (语义搜索) ==================
async function runSearch() {
  const query = positionals.join(' ');
  if (!query) {
    console.error("❌ 错误：请提供搜索关键词或提示词。");
    process.exit(1);
  }

  const type = options.type || options.t || 'auto';
  const numResults = parseInt(options.num || options.n || options['num-results'] || '5', 10);
  const category = options.category || options.c;
  
  const siteStr = options.site || options['include-domains'];
  const includeDomains = siteStr ? siteStr.split(',').map((s: string) => s.trim()) : undefined;

  const excludeSiteStr = options['exclude-site'] || options['exclude-domains'];
  let excludeDomains = excludeSiteStr ? excludeSiteStr.split(',').map((s: string) => s.trim()) : undefined;

  const startPublishedDate = options['published-after'] || options['start-date'];
  const endPublishedDate = options['published-before'] || options['end-date'];

  // company 与 people 分类不支持 excludeDomains 及日期过滤
  if (category === 'company' || category === 'people') {
    excludeDomains = undefined;
  }

  // 构建 contents 请求配置
  const contentsPayload: any = {};
  if (options.highlights) {
    if (typeof options.highlights === 'string' && options.highlights !== 'true') {
      contentsPayload.highlights = { query: options.highlights };
    } else {
      contentsPayload.highlights = true;
    }
  }
  if (options.text) {
    const maxChars = parseInt(options['max-chars'] || '10000', 10);
    contentsPayload.text = { maxCharacters: maxChars, verbosity: 'compact' };
  }
  if (options.summary) {
    if (typeof options.summary === 'string' && options.summary !== 'true') {
      contentsPayload.summary = { query: options.summary };
    } else {
      contentsPayload.summary = true;
    }
  }
  if (options['max-age']) {
    contentsPayload.maxAgeHours = parseInt(options['max-age'], 10);
  }
  if (options['livecrawl-timeout']) {
    contentsPayload.livecrawlTimeout = parseInt(options['livecrawl-timeout'], 10);
  }
  if (options.text && (options['include-sections'] || options['exclude-sections'])) {
    if (typeof contentsPayload.text !== 'object') contentsPayload.text = { maxCharacters: parseInt(options['max-chars'] || '10000', 10) };
    if (options['include-sections']) contentsPayload.text.includeSections = options['include-sections'].split(',').map((s: string) => s.trim());
    if (options['exclude-sections']) contentsPayload.text.excludeSections = options['exclude-sections'].split(',').map((s: string) => s.trim());
  }
  
  // 默认如果没有提供任何 contents 限制，返回默认 highlights
  if (Object.keys(contentsPayload).length === 0) {
    contentsPayload.highlights = true;
  }

  const payload: any = {
    query,
    type,
    numResults,
    contents: contentsPayload
  };

  if (category) payload.category = category;
  if (includeDomains) payload.includeDomains = includeDomains;
  if (excludeDomains) payload.excludeDomains = excludeDomains;
  if (startPublishedDate && category !== 'company' && category !== 'people') payload.startPublishedDate = startPublishedDate;
  if (endPublishedDate && category !== 'company' && category !== 'people') payload.endPublishedDate = endPublishedDate;

  if (options.stream) {
    payload.stream = true;
  }

  if (options['system-prompt']) payload.systemPrompt = options['system-prompt'];
  if (options.schema) {
    try {
      if (typeof options.schema === 'string' && options.schema.endsWith('.json')) {
        const schemaPath = isAbsolute(options.schema) ? options.schema : join(process.cwd(), options.schema);
        payload.outputSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
      } else if (typeof options.schema === 'string') {
        payload.outputSchema = JSON.parse(options.schema);
      } else {
        payload.outputSchema = options.schema;
      }
    } catch (err: any) {
      console.error(`❌ 解析 outputSchema 失败: ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`\n🔍 正在使用 Exa 语义搜索: \x1b[36m${query}\x1b[0m`);
  console.log(`   🏷️ 模式: \x1b[33m${type}\x1b[0m | 数量: \x1b[33m${numResults}\x1b[0m${category ? ` | 分类: \x1b[33m${category}\x1b[0m` : ''}${payload.stream ? ' | ⚡ 流式模式' : ''}`);
  if (includeDomains) console.log(`   🌐 白名单域名: \x1b[32m${includeDomains.join(', ')}\x1b[0m`);
  if (excludeDomains) console.log(`   🚫 黑名单域名: \x1b[31m${excludeDomains.join(', ')}\x1b[0m`);
  console.log('');

  try {
    const res = await fetch('https://api.exa.ai/search', fetchOptions(payload));
    if (!res.ok) throw new Error(await res.text());

    let mdOutput = `# Exa 语义搜索报告\n\n- **搜索关键词**: \`${query}\`\n- **检索模式**: \`${type}\`\n- **生成时间**: ${new Date().toLocaleString()}\n\n---\n\n`;

    let data: any = null;
    let usedStream = false;
    let streamedText = '';

    if (payload.stream) {
      usedStream = true;
      console.log(`\x1b[35m💡 Exa 流式数据接收中:\x1b[0m\n`);
      const streamRes = await readSSEStream(res);
      streamedText = streamRes.text || '';
      if (streamedText) {
        console.log(`\n---------------------------------\n`);
        mdOutput += `## 💡 AI 流式合成解答\n\n${streamedText}\n\n---\n\n`;
      }
      data = streamRes.data;
    } else {
      data = await res.json();
    }

    if (data) {
      // 合成输出：流式已实时打印过纯文本时不再重复刷屏；对象 schema 仍完整打印一次
      if (data.output?.content != null) {
        const content = data.output.content;
        const isObject = typeof content === 'object';
        const synthesizedStr = isObject ? JSON.stringify(content, null, 2) : String(content);
        const alreadyShownAsStreamText = usedStream && !!streamedText && !isObject;

        if (!alreadyShownAsStreamText) {
          console.log(`\x1b[35m💡 Exa 合成/结构化解答:\x1b[0m\n`);
          console.log(synthesizedStr);
          console.log(`\n---------------------------------\n`);
        }

        // Markdown：流式文本段已写过则跳过重复；对象结果始终写入
        if (isObject) {
          mdOutput += `## 💡 AI 结构化总结\n\n\`\`\`json\n${synthesizedStr}\n\`\`\`\n\n---\n\n`;
        } else if (!usedStream || !streamedText) {
          mdOutput += `## 💡 AI 结构化总结\n\n${synthesizedStr}\n\n---\n\n`;
        }
      }

      // grounding：字段级引用与置信度（官方推荐使用内置 grounding，而非自造 citation 字段）
      const grounding = data.output?.grounding;
      if (Array.isArray(grounding) && grounding.length > 0) {
        console.log(`\x1b[36m📌 Grounding 溯源 (${grounding.length} 项):\x1b[0m`);
        mdOutput += `## 📌 Grounding 溯源\n\n`;
        grounding.forEach((g: any, i: number) => {
          const field = g.field || `(item ${i + 1})`;
          const confidence = g.confidence || 'n/a';
          const cites = (g.citations || [])
            .map((c: any) => (typeof c === 'string' ? c : c.title || c.url))
            .filter(Boolean);
          console.log(`    · ${field}  [置信度: ${confidence}]`);
          if (cites.length) console.log(`      来源: ${cites.slice(0, 3).join(' | ')}`);
          mdOutput += `### ${field}\n- **置信度**: ${confidence}\n`;
          if (cites.length) {
            mdOutput += `- **来源**:\n`;
            (g.citations || []).forEach((c: any) => {
              const url = typeof c === 'string' ? c : c.url;
              const title = typeof c === 'object' && c.title ? c.title : url;
              if (url) mdOutput += `  - [${title}](${url})\n`;
            });
          }
          mdOutput += `\n`;
        });
        console.log('');
        mdOutput += `---\n\n`;
      }

      console.log(`\x1b[33m🎯 匹配到的顶级信源 (${data.results?.length || 0} 条):\x1b[0m\n`);
      mdOutput += `## 🎯 搜索信源清单\n\n`;

      data.results?.forEach((r: any, i: number) => {
        console.log(`\x1b[32m[${i + 1}] ${r.title || '无标题'}\x1b[0m`);
        console.log(`    🔗 ${r.url}`);
        if (r.publishedDate) console.log(`    📅 发布日期: ${r.publishedDate}`);
        if (r.author) console.log(`    ✍️ 作者: ${r.author}`);

        mdOutput += `### ${i + 1}. [${r.title || '无标题'}](${r.url})\n`;
        if (r.publishedDate) mdOutput += `- **发布日期**: ${r.publishedDate}\n`;
        if (r.author) mdOutput += `- **作者**: ${r.author}\n`;
        mdOutput += `- **链接**: ${r.url}\n\n`;

        if (r.summary) {
          console.log(`    💡 摘要: ${r.summary.replace(/\s+/g, ' ').trim()}`);
          mdOutput += `**摘要**:\n> ${r.summary}\n\n`;
        }
        if (r.highlights && r.highlights.length > 0) {
          console.log(`    📝 核心高亮:`);
          mdOutput += `**核心高亮**:\n`;
          r.highlights.forEach((h: string) => {
            const cleanH = h.replace(/\s+/g, ' ').trim();
            console.log(`       - ${cleanH.substring(0, 150)}...`);
            mdOutput += `- ${cleanH}\n`;
          });
          console.log('');
          mdOutput += `\n`;
        }
        if (r.text) {
          console.log(`    📄 正文预览: ${r.text.replace(/\s+/g, ' ').trim().substring(0, 150)}...\n`);
          mdOutput += `**正文切片**:\n\`\`\`text\n${r.text.substring(0, 1000)}\n\`\`\`\n\n`;
        }
      });
    } else if (usedStream && !streamedText) {
      console.log('⚠️ 流式响应已结束，但未解析到可用结果。可去掉 --stream 重试，或补上 --schema 以启用合成输出。');
    }

    if (options.o || options.save) {
      saveMarkdown(mdOutput, options.o || options.save, 'exa_search');
    }
  } catch (err: any) {
    console.error(`❌ Search 执行失败: ${err.message}`);
    process.exit(1);
  }
}

// ================== 核心功能 2: similar / findsimilar (相似网页/论文匹配) ==================
async function runSimilar() {
  const url = positionals[0];
  if (!url) {
    console.error("❌ 错误：请提供目标 URL 链接。");
    process.exit(1);
  }

  const numResults = parseInt(options.num || options.n || options['num-results'] || '5', 10);
  const category = options.category || options.c;

  const siteStr = options.site || options['include-domains'];
  const includeDomains = siteStr ? siteStr.split(',').map((s: string) => s.trim()) : undefined;

  const excludeSiteStr = options['exclude-site'] || options['exclude-domains'];
  let excludeDomains = excludeSiteStr ? excludeSiteStr.split(',').map((s: string) => s.trim()) : undefined;

  if (category === 'company' || category === 'people') {
    excludeDomains = undefined;
  }

  const contentsPayload: any = {};
  if (options.highlights) contentsPayload.highlights = true;
  if (options.text) contentsPayload.text = { maxCharacters: parseInt(options['max-chars'] || '10000', 10) };
  if (options.summary) contentsPayload.summary = true;
  if (options['max-age']) contentsPayload.maxAgeHours = parseInt(options['max-age'], 10);
  if (Object.keys(contentsPayload).length === 0) contentsPayload.highlights = true;

  const payload: any = {
    url,
    numResults,
    contents: contentsPayload
  };

  if (category) payload.category = category;
  if (includeDomains) payload.includeDomains = includeDomains;
  if (excludeDomains) payload.excludeDomains = excludeDomains;

  console.log(`\n🔗 正在使用 Exa 查找相似网页/文献: \x1b[36m${url}\x1b[0m\n`);

  try {
    const res = await fetch('https://api.exa.ai/findSimilar', fetchOptions(payload));
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    let mdOutput = `# Exa 相似网页与文献匹配报告\n\n- **种子 URL**: \`${url}\`\n- **生成时间**: ${new Date().toLocaleString()}\n\n---\n\n## 🎯 语义高度相似的顶级信源\n\n`;

    console.log(`\x1b[33m🎯 找到语义高度相似的顶级信源 (${data.results?.length || 0} 条):\x1b[0m\n`);

    data.results?.forEach((r: any, i: number) => {
      console.log(`\x1b[32m[${i + 1}] ${r.title || '无标题'}\x1b[0m\n    🔗 ${r.url}`);
      mdOutput += `### ${i + 1}. [${r.title || '无标题'}](${r.url})\n- **链接**: ${r.url}\n\n`;

      if (r.summary) {
        console.log(`    💡 摘要: ${r.summary.replace(/\s+/g, ' ').trim()}`);
        mdOutput += `**摘要**:\n> ${r.summary}\n\n`;
      }
      if (r.highlights && r.highlights.length > 0) {
        console.log(`    📝 核心高亮:`);
        mdOutput += `**核心高亮**:\n`;
        r.highlights.forEach((h: string) => {
          const cleanH = h.replace(/\s+/g, ' ').trim();
          console.log(`       - ${cleanH.substring(0, 150)}...`);
          mdOutput += `- ${cleanH}\n`;
        });
        console.log('');
        mdOutput += `\n`;
      }
    });

    if (options.o || options.save) {
      saveMarkdown(mdOutput, options.o || options.save, 'exa_similar');
    }
  } catch (err: any) {
    console.error(`❌ FindSimilar 执行失败: ${err.message}`);
    process.exit(1);
  }
}

// ================== 核心功能 3: contents (多网址精准正文/摘要/切片提取) ==================
async function runContents() {
  if (positionals.length === 0) {
    console.error("❌ 错误：请提供至少一个网页 URL 链接。");
    process.exit(1);
  }

  const urls = positionals.flatMap(u => u.split(',')).map(u => u.trim()).filter(Boolean);
  console.log(`\n📄 正在使用 Exa Contents 提取网页正文 (${urls.length} 个链接)...\n`);

  const payload: any = {
    urls
  };

  if (options.text) {
    const maxChars = parseInt(options['max-chars'] || '20000', 10);
    payload.text = { maxCharacters: maxChars, verbosity: 'compact' };
  }
  if (options.highlights) {
    if (typeof options.highlights === 'string' && options.highlights !== 'true') {
      payload.highlights = { query: options.highlights };
    } else {
      payload.highlights = true;
    }
  }
  if (options.summary) {
    if (typeof options.summary === 'string' && options.summary !== 'true') {
      payload.summary = { query: options.summary };
    } else {
      payload.summary = true;
    }
  }
  if (options['max-age']) {
    payload.maxAgeHours = parseInt(options['max-age'], 10);
  }
  if (options['livecrawl-timeout']) {
    payload.livecrawlTimeout = parseInt(options['livecrawl-timeout'], 10);
  }
  if (options.subpages) {
    payload.subpages = parseInt(options.subpages, 10);
  }
  if (options['subpage-target']) {
    payload.subpageTarget = options['subpage-target'];
  }
  if (options.text && (options['include-sections'] || options['exclude-sections'])) {
    if (typeof payload.text !== 'object') payload.text = { maxCharacters: parseInt(options['max-chars'] || '20000', 10) };
    if (options['include-sections']) payload.text.includeSections = options['include-sections'].split(',').map((s: string) => s.trim());
    if (options['exclude-sections']) payload.text.excludeSections = options['exclude-sections'].split(',').map((s: string) => s.trim());
  }

  // 默认提取 text
  if (!payload.text && !payload.highlights && !payload.summary) {
    payload.text = { maxCharacters: 20000, verbosity: 'compact' };
  }

  try {
    const res = await fetch('https://api.exa.ai/contents', fetchOptions(payload));
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    // 检查 statuses：官方文档强调 HTTP 200 不代表所有 URL 都成功
    if (Array.isArray(data.statuses)) {
      const failed = data.statuses.filter((s: any) => s.status !== 'success');
      if (failed.length > 0) {
        console.log(`\x1b[33m⚠️ 部分 URL 提取失败 (${failed.length}/${data.statuses.length}):\x1b[0m`);
        failed.forEach((s: any) => {
          console.log(`   ❌ ${s.id} → ${s.status}${s.error ? ': ' + s.error : ''}`);
        });
        console.log('');
      }
    }

    let mdOutput = `# Exa 网页正文提取报告\n\n- **目标链接数**: ${urls.length}\n- **生成时间**: ${new Date().toLocaleString()}\n\n---\n\n`;

    data.results?.forEach((r: any, i: number) => {
      console.log(`\x1b[32m[${i + 1}] ${r.title || r.url}\x1b[0m`);
      console.log(`    🔗 ${r.url}`);

      mdOutput += `## ${i + 1}. [${r.title || r.url}](${r.url})\n\n`;

      if (r.summary) {
        console.log(`    💡 摘要: ${r.summary.replace(/\s+/g, ' ').trim()}`);
        mdOutput += `### 💡 AI 摘要\n> ${r.summary}\n\n`;
      }

      if (r.highlights && r.highlights.length > 0) {
        console.log(`    📝 核心高亮:`);
        mdOutput += `### 📝 核心高亮\n`;
        r.highlights.forEach((h: string) => {
          console.log(`       - ${h.replace(/\s+/g, ' ').trim().substring(0, 150)}...`);
          mdOutput += `- ${h}\n`;
        });
        mdOutput += `\n`;
      }

      if (r.text) {
        const textContent = r.text.trim();
        console.log(`\n\x1b[90m--- 📖 网页正文开始 (${r.url}) ---\x1b[0m`);
        console.log(textContent.length > 2000 ? textContent.substring(0, 2000) + "\n\n...[已截断显示，保存文件查看全量]..." : textContent);
        console.log(`\x1b[90m--- 📖 网页正文结束 ---\x1b[0m\n`);

        mdOutput += `### 📖 网页正文\n\n\`\`\`markdown\n${textContent}\n\`\`\`\n\n`;
      }
    });

    if (options.o || options.save) {
      saveMarkdown(mdOutput, options.o || options.save, 'exa_contents');
    }
  } catch (err: any) {
    console.error(`❌ Contents 执行失败: ${err.message}`);
    process.exit(1);
  }
}

// ================== 核心功能 4: answer (生成式 AI 问答) ==================
async function runAnswer() {
  const query = positionals.join(' ');
  if (!query) {
    console.error("❌ 错误：请提供具体问题。");
    process.exit(1);
  }

  const siteStr = options.site || options['include-domains'];
  const includeDomains = siteStr ? siteStr.split(',').map((s: string) => s.trim()) : undefined;

  const payload: any = {
    query,
    text: true
  };

  if (includeDomains) payload.includeDomains = includeDomains;
  if (options.stream) payload.stream = true;
  if (options['system-prompt']) payload.systemPrompt = options['system-prompt'];
  if (options.schema) {
    try {
      if (typeof options.schema === 'string' && options.schema.endsWith('.json')) {
        const schemaPath = isAbsolute(options.schema) ? options.schema : join(process.cwd(), options.schema);
        payload.outputSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
      } else if (typeof options.schema === 'string') {
        payload.outputSchema = JSON.parse(options.schema);
      } else {
        payload.outputSchema = options.schema;
      }
    } catch (err: any) {
      console.error(`❌ 解析 outputSchema 失败: ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`\n🤖 正在使用 Exa Answer 生成解答: \x1b[36m${query}\x1b[0m${payload.stream ? ' | ⚡ 流式模式' : ''}\n`);

  try {
    const res = await fetch('https://api.exa.ai/answer', fetchOptions(payload));
    if (!res.ok) throw new Error(await res.text());

    let mdOutput = `# Exa 智能问答报告\n\n- **提问**: \`${query}\`\n- **生成时间**: ${new Date().toLocaleString()}\n\n---\n\n`;
    let answerText = '';
    let citations: any[] = [];

    if (payload.stream) {
      console.log(`\x1b[35m💡 Exa AI 流式回答:\x1b[0m\n---------------------------------`);
      const streamRes = await readSSEStream(res);
      answerText = streamRes.text || '';
      console.log(`\n---------------------------------\n`);
      // 流式响应中 citations 可能在 data 中
      if (streamRes.data?.citations) citations = streamRes.data.citations;
      if (streamRes.data?.results) citations = streamRes.data.results;
    } else {
      const data = await res.json();
      answerText = data.answer || '';
      citations = data.citations || [];

      console.log(`\x1b[35m💡 Exa AI 回答:\x1b[0m\n---------------------------------`);
      console.log(answerText);
      console.log(`---------------------------------\n`);
    }

    mdOutput += `## 💡 AI 生成解答\n\n${answerText}\n\n---\n\n## 📑 参考信源与出处\n\n`;

    if (citations.length > 0) {
      console.log(`\x1b[33m📑 参考信源出处:\x1b[0m`);
      citations.forEach((cite: any, i: number) => {
        const url = typeof cite === 'string' ? cite : cite.url;
        const title = typeof cite === 'object' && cite.title ? cite.title : url;
        console.log(`[${i + 1}] ${title}`);
        if (url) console.log(`    🔗 ${url}`);

        mdOutput += `${i + 1}. [${title}](${url})\n`;
      });
    }

    if (options.o || options.save) {
      saveMarkdown(mdOutput, options.o || options.save, 'exa_answer');
    }
  } catch (err: any) {
    console.error(`❌ Answer 执行失败: ${err.message}`);
    process.exit(1);
  }
}

// 6. 命令路由
switch (command) {
  case 'search':
    runSearch();
    break;
  case 'similar':
  case 'findsimilar':
    runSimilar();
    break;
  case 'contents':
    runContents();
    break;
  case 'answer':
    runAnswer();
    break;
  default:
    console.error(`❌ 错误：未知命令 "${command}"。`);
    process.exit(1);
}
