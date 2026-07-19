#!/usr/bin/env bun
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';

// 读取 .env 文件
function loadEnv() {
  try {
    const envPath = resolve(dirname(Bun.main), '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        process.env[match[1]] = match[2].trim();
      }
    });
  } catch (error) {
    // 忽略文件不存在错误
  }
}

loadEnv();

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

if (!TAVILY_API_KEY || TAVILY_API_KEY === 'your_tavily_api_key_here') {
  console.error("❌ 错误：未找到有效的 TAVILY_API_KEY。");
  process.exit(1);
}

// 帮助文档
if (process.argv.length < 3) {
  console.log(`
🚀 Cera-CLI 超强 AI 搜索引擎 (Tavily 四大引擎)

用法:
  bun tavily.ts <命令> "<参数>"

命令:
  search   [关键词]  常规全网搜索，附带 AI 摘要
  extract  [网址]    强行扒取并清洗指定网页的纯正文 (适合读长文)
  crawl    [网址]    爬取指定域名下的子链接
  research [关键词]  执行高级深度的科研级搜索 (Advanced Depth)

示例:
  bun tavily.ts search "SpaceX 星舰陶瓷瓦"
  bun tavily.ts extract "https://en.wikipedia.org/wiki/Mullite"
  bun tavily.ts crawl "https://spacex.com"
  bun tavily.ts research "Alumina ceramic 3d printing latest breakthrough"
  `);
  process.exit(0);
}

const command = process.argv[2].toLowerCase();
const argValue = process.argv.slice(3).join(' ');

if (!argValue) {
  console.error("❌ 请输入关键词或网址。");
  process.exit(1);
}

// 封装原生的 Fetch 请求头
const fetchOptions = (bodyObj: any) => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TAVILY_API_KEY}`
  },
  body: JSON.stringify(bodyObj),
});

// ================== 1. Search & Research ==================
async function runSearch(query: string, depth: "basic" | "advanced") {
  console.log(`\n🔍 正在使用 Tavily 进行${depth === 'advanced' ? '深度调研 (Research)' : '检索 (Search)'}: \x1b[36m${query}\x1b[0m\n`);

  try {
    const res = await fetch('https://api.tavily.com/search', fetchOptions({
      query: query,
      search_depth: depth,
      include_answer: true,
      include_raw_content: depth === 'advanced', // 深度调研时把正文也拉下来
      max_results: 5,
    }));

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    if (data.answer) {
      console.log(`\x1b[35m🤖 AI 总结:\x1b[0m\n---------------------------------\n${data.answer}\n---------------------------------\n`);
    }

    console.log(`\x1b[33m📑 核心信源:\x1b[0m`);
    data.results.forEach((r: any, i: number) => {
      console.log(`\x1b[32m[${i + 1}] ${r.title}\x1b[0m\n    🔗 ${r.url}`);
      console.log(`    📝 ${r.content}\n`);
    });
  } catch (err: any) {
    console.error(`❌ 执行失败: ${err.message}`);
  }
}

// ================== 2. Extract ==================
async function runExtract(url: string) {
  console.log(`\n🔪 正在扒取并清洗网页正文: \x1b[36m${url}\x1b[0m\n`);
  try {
    const res = await fetch('https://api.tavily.com/extract', fetchOptions({
      urls: [url]
    }));
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const result = data.results[0];

    if (result && result.raw_content) {
      console.log(`\x1b[90m--- 📖 网页纯正文开始 ---\x1b[0m\n`);
      // 简单截断防止撑爆终端，实际使用可全量输出或存文件
      const content = result.raw_content.trim();
      console.log(content.length > 3000 ? content.substring(0, 3000) + "\n\n...[内容过长，已截断]..." : content);
      console.log(`\n\x1b[90m--- 📖 网页纯正文结束 ---\x1b[0m\n`);
    } else {
      console.log("⚠️ 提取失败，该网页可能阻止了爬虫或无纯文本正文。");
    }
  } catch (err: any) {
    console.error(`❌ 执行失败: ${err.message}`);
  }
}

// ================== 3. Crawl ==================
async function runCrawl(url: string) {
  console.log(`\n🕷️ 正在爬取域名下的所有链接: \x1b[36m${url}\x1b[0m\n`);
  try {
    const res = await fetch('https://api.tavily.com/crawl', fetchOptions({
      url: url
    }));
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    
    console.log(`✅ 成功探测到以下路径:\n`);
    data.results?.forEach((r: any, i: number) => {
      console.log(`  🔗 ${r}`);
    });
    if (!data.results || data.results.length === 0) {
      console.log("⚠️ 未爬取到任何子链接。");
    }
    console.log('');
  } catch (err: any) {
    console.error(`❌ 执行失败: ${err.message}`);
  }
}


// ================== 路由调度 ==================
switch (command) {
  case 'search':
    runSearch(argValue, 'basic');
    break;
  case 'research':
    runSearch(argValue, 'advanced');
    break;
  case 'extract':
    runExtract(argValue);
    break;
  case 'crawl':
    runCrawl(argValue);
    break;
  default:
    console.error(`❌ 未知命令: ${command}`);
}
