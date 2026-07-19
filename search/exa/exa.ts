#!/usr/bin/env bun
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';

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

if (process.argv.length < 3) {
  console.log(`
🚀 Cera-CLI 语义检索引擎 (Exa 驱动)

用法:
  bun exa.ts <命令> "<参数>"

命令:
  search   [语意]    通过自然语言描述，寻找全网最匹配的高质量链接
  contents [网址]    清洗提取指定网页的纯正文
  answer   [问题]    让 Exa 搜索全网并由其内部 AI 直接生成精准回答

示例:
  bun exa.ts search "这是一个关于陶瓷 3D 打印技术的硬核实验室主页："
  bun exa.ts contents "https://example.com"
  bun exa.ts answer "目前工业界最成熟的碳化硅陶瓷烧结温度是多少？"
  `);
  process.exit(0);
}

const command = process.argv[2].toLowerCase();
const argValue = process.argv.slice(3).join(' ');

if (!argValue) {
  console.error("❌ 请输入参数。");
  process.exit(1);
}

const fetchOptions = (bodyObj: any) => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': EXA_API_KEY // Exa 使用 x-api-key 头
  },
  body: JSON.stringify(bodyObj),
});

async function runSearch(query: string) {
  console.log(`\n🔍 正在使用 Exa 语义搜索: \x1b[36m${query}\x1b[0m\n`);
  try {
    const res = await fetch('https://api.exa.ai/search', fetchOptions({
      query: query,
      numResults: 5,
      useAutoprompt: true, // 开启自动优化提示词
      contents: { text: { maxCharacters: 1000 } } // 搜索时顺带抓取摘要
    }));
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    
    console.log(`\x1b[33m🎯 语义匹配到的顶级信源:\x1b[0m`);
    data.results?.forEach((r: any, i: number) => {
      console.log(`\x1b[32m[${i + 1}] ${r.title}\x1b[0m\n    🔗 ${r.url}`);
      if (r.text) {
        console.log(`    📝 ${r.text.replace(/\s+/g, ' ').trim().substring(0, 200)}...\n`);
      }
    });
  } catch (err: any) {
    console.error(`❌ 执行失败: ${err.message}`);
  }
}

async function runContents(url: string) {
  console.log(`\n📄 正在使用 Exa Contents 提取正文: \x1b[36m${url}\x1b[0m\n`);
  try {
    const res = await fetch('https://api.exa.ai/contents', fetchOptions({
      urls: [url],
      text: true // 获取纯文本
    }));
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const result = data.results[0];

    if (result && result.text) {
      console.log(`\x1b[90m--- 📖 网页纯正文开始 ---\x1b[0m\n`);
      const content = result.text.trim();
      console.log(content.length > 3000 ? content.substring(0, 3000) + "\n\n...[内容过长，已截断]..." : content);
      console.log(`\n\x1b[90m--- 📖 网页纯正文结束 ---\x1b[0m\n`);
    } else {
      console.log("⚠️ 提取失败。");
    }
  } catch (err: any) {
    console.error(`❌ 执行失败: ${err.message}`);
  }
}

async function runAnswer(query: string) {
  console.log(`\n🤖 正在使用 Exa Answer 生成式回答: \x1b[36m${query}\x1b[0m\n`);
  try {
    const res = await fetch('https://api.exa.ai/answer', fetchOptions({
      query: query,
      text: true
    }));
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    console.log(`\x1b[35m💡 Exa AI 回答:\x1b[0m\n---------------------------------`);
    console.log(data.answer);
    console.log(`---------------------------------\n`);

    console.log(`\x1b[33m📑 参考信源:\x1b[0m`);
    data.citations?.forEach((cite: any, i: number) => {
      const url = cite.url || cite;
      const title = cite.title ? cite.title : url;
      console.log(`[${i+1}] ${title}`);
      if (cite.url) console.log(`    🔗 ${cite.url}`);
    });
  } catch (err: any) {
    console.error(`❌ 执行失败: ${err.message}`);
  }
}

switch (command) {
  case 'search':
    runSearch(argValue);
    break;
  case 'contents':
    runContents(argValue);
    break;
  case 'answer':
    runAnswer(argValue);
    break;
  default:
    console.error(`❌ 未知命令: ${command}`);
}
