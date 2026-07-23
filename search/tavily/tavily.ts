#!/usr/bin/env bun
import { readFileSync } from 'fs';
import { resolve, dirname, isAbsolute } from 'path';

// 读取 .env 文件
const scriptDir = dirname(Bun.main);

function loadEnv() {
  try {
    const envPath = resolve(scriptDir, '.env');
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

// 封装原生的 Fetch 请求头
const fetchOptions = (bodyObj: any) => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TAVILY_API_KEY}`
  },
  body: JSON.stringify(bodyObj),
});

// ================== 1. Search (全量强力模式 - /search) ==================
interface SearchOptions {
  query: string;
  depth: "basic" | "advanced";
  topic?: "general" | "news" | "finance";
  timeRange?: string;
  days?: number;
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  country?: string;
  includeImages?: boolean;
  includeImageDescriptions?: boolean;
  savePath?: string;
}

async function runSearch(options: SearchOptions) {
  const depth = options.depth || 'basic';
  const maxResults = options.maxResults || 5;
  console.log(`\n🔍 正在使用 Tavily 进行${depth === 'advanced' ? '高级深度检索 (Advanced Search)' : '常规检索 (Search)'}: \x1b[36m${options.query}\x1b[0m`);

  if (options.topic) console.log(`   🏷️ 搜索分类: \x1b[33m${options.topic}\x1b[0m`);
  if (options.timeRange) console.log(`   ⏰ 时间范围: \x1b[33m${options.timeRange}\x1b[0m`);
  if (options.days) console.log(`   📅 近 ${options.days} 天内`);
  if (options.country) console.log(`   🌍 国家/地区筛选: \x1b[33m${options.country.toUpperCase()}\x1b[0m`);
  if (options.includeDomains && options.includeDomains.length > 0) {
    console.log(`   🌐 限定域名白名单: \x1b[32m${options.includeDomains.join(', ')}\x1b[0m`);
  }
  if (options.excludeDomains && options.excludeDomains.length > 0) {
    console.log(`   🚫 屏蔽域名黑名单: \x1b[31m${options.excludeDomains.join(', ')}\x1b[0m`);
  }
  console.log('');

  try {
    const payload: any = {
      query: options.query,
      search_depth: depth,
      include_answer: true,
      include_raw_content: depth === 'advanced',
      max_results: maxResults,
      auto_parameters: true,
    };

    if (options.topic) payload.topic = options.topic;
    if (options.timeRange) payload.time_range = options.timeRange;
    if (options.days) payload.days = options.days;
  if (options.country) {
    const normalizedCountry = options.country.toLowerCase() === 'cn' ? 'china' : (
      options.country.toLowerCase() === 'us' || options.country.toLowerCase() === 'usa' ? 'united states' : (
        options.country.toLowerCase() === 'uk' ? 'united kingdom' : options.country.toLowerCase()
      )
    );
    payload.country = normalizedCountry;
  }
    if (options.includeDomains && options.includeDomains.length > 0) payload.include_domains = options.includeDomains;
    if (options.excludeDomains && options.excludeDomains.length > 0) payload.exclude_domains = options.excludeDomains;
    if (options.includeImages) payload.include_images = true;
    if (options.includeImageDescriptions) payload.include_image_descriptions = true;

    const res = await fetch('https://api.tavily.com/search', fetchOptions(payload));
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    let fullMarkdownReport = `# Search Query: ${options.query}\n\n`;

    if (data.answer) {
      console.log(`\x1b[35m🤖 AI 智能总结:\x1b[0m\n---------------------------------\n${data.answer}\n---------------------------------\n`);
      fullMarkdownReport += `## AI Summary\n\n${data.answer}\n\n`;
    }

    if (data.images && data.images.length > 0) {
      console.log(`\x1b[36m🖼️ 相关图片 (${data.images.length} 张):\x1b[0m`);
      data.images.forEach((img: any) => {
        const url = typeof img === 'string' ? img : img.url;
        const desc = typeof img === 'object' && img.description ? ` (${img.description})` : '';
        console.log(`   • ${url}${desc}`);
      });
      console.log('');
    }

    console.log(`\x1b[33m📑 核心信源 (Top ${data.results?.length || 0}):\x1b[0m`);
    fullMarkdownReport += `## Search Results\n\n`;

    data.results?.forEach((r: any, i: number) => {
      console.log(`\x1b[32m[${i + 1}] ${r.title}\x1b[0m\n    🔗 ${r.url}`);
      console.log(`    📝 ${r.content}\n`);

      fullMarkdownReport += `### [${i + 1}] ${r.title}\n- URL: ${r.url}\n\n${r.content}\n\n`;
      if (r.raw_content) {
        fullMarkdownReport += `<details><summary>Raw Content</summary>\n\n${r.raw_content}\n\n</details>\n\n`;
      }
    });

    if (options.savePath) {
      const targetFile = isAbsolute(options.savePath)
        ? options.savePath
        : resolve(scriptDir, options.savePath);
      await Bun.write(targetFile, fullMarkdownReport);
      console.log(`\n💾 \x1b[32m全量搜索报告已保存至: ${targetFile}\x1b[0m\n`);
    }
  } catch (err: any) {
    console.error(`❌ 执行失败: ${err.message}`);
  }
}

// ================== 2. Extract (全量强力模式 - /extract) ==================
interface ExtractOptions {
  urls: string[];
  depth?: "basic" | "advanced";
  format?: "markdown" | "text";
  query?: string;
  chunksPerSource?: number;
  section?: string;
  match?: string;
  includeImages?: boolean;
  includeFavicon?: boolean;
  savePath?: string;
}

function extractSection(content: string, sectionName: string): string {
  const lines = content.split('\n');
  let capturing = false;
  let captureLevel = 0;
  const resultLines: string[] = [];
  const lowerName = sectionName.toLowerCase();

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (match) {
      const level = match[1].length;
      const title = match[2];
      if (title.toLowerCase().includes(lowerName)) {
        capturing = true;
        captureLevel = level;
        resultLines.push(line);
        continue;
      } else if (capturing && level <= captureLevel) {
        break;
      }
    }
    if (capturing) {
      resultLines.push(line);
    }
  }

  return resultLines.length > 0 ? resultLines.join('\n').trim() : "";
}

function extractMatches(content: string, keyword: string): string {
  const paragraphs = content.split(/\n\n+/);
  const matched = paragraphs.filter(p => p.toLowerCase().includes(keyword.toLowerCase()));
  return matched.join('\n\n---\n\n').trim();
}

async function runExtract(options: ExtractOptions) {
  const depth = options.depth || 'advanced';
  const format = options.format || 'markdown';
  console.log(`\n🔪 正在扒取网页正文 (${depth.toUpperCase()} 深度, ${format.toUpperCase()} 格式):`);
  options.urls.forEach(u => console.log(`   🔗 \x1b[36m${u}\x1b[0m`));
  if (options.query) {
    console.log(`   🎯 Tavily AI 定向抽取关键词: \x1b[33m"${options.query}"\x1b[0m (每源 ${options.chunksPerSource || 5} 切片)`);
  }
  if (options.section) {
    console.log(`   📌 本地指定切片章节标题: \x1b[35m"${options.section}"\x1b[0m`);
  }
  if (options.match) {
    console.log(`   🔍 本地包含关键词段落过滤: \x1b[32m"${options.match}"\x1b[0m`);
  }
  console.log('');

  try {
    const payload: any = {
      urls: options.urls,
      extract_depth: depth,
      format: format,
      include_images: !!options.includeImages,
      include_favicon: !!options.includeFavicon,
    };

    if (options.query) {
      payload.query = options.query;
      payload.chunks_per_source = options.chunksPerSource || 5;
    }

    const res = await fetch('https://api.tavily.com/extract', fetchOptions(payload));
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      console.log("⚠️ 未能从小标页面提取到任何正文。");
      return;
    }

    let fullMarkdownOutput = "";

    data.results.forEach((item: any, idx: number) => {
      console.log(`\x1b[32m[${idx + 1}/${data.results.length}] 目标 URL: ${item.url}\x1b[0m`);
      
      let content = item.raw_content?.trim() || "";
      const images = item.images || [];
      const favicon = item.favicon;

      if (favicon) {
        console.log(`   🌐 网站 Favicon: ${favicon}`);
      }

      if (options.section) {
        const sectionText = extractSection(content, options.section);
        if (sectionText) {
          content = sectionText;
          console.log(`   ✅ 成功截取章节 [${options.section}] (长度: ${content.length} 字符)`);
        } else {
          console.log(`   ⚠️ 未找到匹配的章节标题 [${options.section}]，保留原正文。`);
        }
      }

      if (options.match) {
        const matchedText = extractMatches(content, options.match);
        if (matchedText) {
          content = matchedText;
          console.log(`   ✅ 成功提取包含 [${options.match}] 的段落 (长度: ${content.length} 字符)`);
        } else {
          console.log(`   ⚠️ 未找到包含关键词 [${options.match}] 的段落，保留原正文。`);
        }
      }

      fullMarkdownOutput += `# Source: ${item.url}\n\n${content}\n\n`;

      if (images.length > 0) {
        console.log(`   🖼️ 提取到的关键图片 (${images.length} 张):`);
        images.forEach((img: string) => console.log(`      • ${img}`));
      }

      if (content) {
        console.log(`   📝 提取到最终正文长度: ${content.length} 字符`);
        if (content.length > 2000 && !options.savePath) {
          console.log(`\x1b[90m--- 📖 网页正文预览 (前 2000 字) ---\x1b[0m\n`);
          console.log(content.substring(0, 2000) + "\n\n...[内容较长，提示: 可追加 --save 或 -o 自动保存全量 Markdown 文件]...");
        } else {
          console.log(`\x1b[90m--- 📖 网页正文内容 ---\x1b[0m\n`);
          console.log(content);
        }
        console.log(`\n\x1b[90m--- 📖 结束 ---\x1b[0m\n`);
      } else {
        console.log("   ⚠️ 未能成功读取纯文本正文。\n");
      }
    });

    if (options.savePath) {
      const targetFile = isAbsolute(options.savePath)
        ? options.savePath
        : resolve(scriptDir, options.savePath);
      await Bun.write(targetFile, fullMarkdownOutput);
      console.log(`\n💾 \x1b[32m全量 Markdown 提取结果已保存至: ${targetFile}\x1b[0m\n`);
    }
  } catch (err: any) {
    console.error(`❌ 执行失败: ${err.message}`);
  }
}

// ================== 3. Crawl (全量强力模式 - /crawl) ==================
interface CrawlOptions {
  url: string;
  instructions?: string;
  maxDepth?: number;
  limit?: number;
  maxBreadth?: number;
  selectPaths?: string[];
  excludePaths?: string[];
  allowExternal?: boolean;
  extractDepth?: "basic" | "advanced";
  savePath?: string;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 80);
}

async function runCrawl(options: CrawlOptions) {
  console.log(`\n🕷️ 正在使用 Tavily 巡航爬取网站: \x1b[36m${options.url}\x1b[0m`);

  if (options.instructions) console.log(`   🧠 AI 导航爬取指令: \x1b[33m"${options.instructions}"\x1b[0m`);
  if (options.maxDepth) console.log(`   📏 最大深度: \x1b[33m${options.maxDepth} 层\x1b[0m`);
  if (options.limit) console.log(`   🔢 数量上限: \x1b[33m${options.limit} 页\x1b[0m`);
  if (options.selectPaths && options.selectPaths.length > 0) {
    console.log(`   ✅ 限定路径: \x1b[32m${options.selectPaths.join(', ')}\x1b[0m`);
  }
  if (options.excludePaths && options.excludePaths.length > 0) {
    console.log(`   🚫 排除路径: \x1b[31m${options.excludePaths.join(', ')}\x1b[0m`);
  }
  console.log('');

  try {
    const payload: any = {
      url: options.url,
      extract_depth: options.extractDepth || 'advanced',
      format: 'markdown',
    };

    if (options.instructions) payload.instructions = options.instructions;
    if (options.maxDepth) payload.max_depth = options.maxDepth;
    if (options.limit) payload.limit = options.limit;
    if (options.maxBreadth) payload.max_breadth = options.maxBreadth;
    if (options.selectPaths && options.selectPaths.length > 0) payload.select_paths = options.selectPaths;
    if (options.excludePaths && options.excludePaths.length > 0) payload.exclude_paths = options.excludePaths;
    if (options.allowExternal !== undefined) payload.allow_external = options.allowExternal;

    const res = await fetch('https://api.tavily.com/crawl', fetchOptions(payload));
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    const results = data.results || [];
    if (results.length === 0) {
      console.log("⚠️ 未能探测/爬取到任何页面。");
      return;
    }

    console.log(`✅ 成功巡航探测并爬取到 \x1b[32m${results.length}\x1b[0m 个页面:\n`);

    results.forEach((item: any, i: number) => {
      const pageUrl = typeof item === 'string' ? item : item.url;
      const title = item.title || item.url || `Page ${i + 1}`;
      const charCount = item.raw_content ? item.raw_content.length : (item.content ? item.content.length : 0);
      console.log(`  \x1b[32m[${i + 1}] ${title}\x1b[0m\n      🔗 ${pageUrl}${charCount ? ` (${charCount} 字符)` : ''}`);
    });
    console.log('');

    if (options.savePath) {
      const isSingleFile = options.savePath.endsWith('.md');

      if (isSingleFile) {
        let combinedMarkdown = `# Site Crawl: ${options.url}\n\n`;
        results.forEach((item: any, i: number) => {
          const pageUrl = item.url || options.url;
          const pageTitle = item.title || pageUrl;
          const content = item.raw_content || item.content || "";
          combinedMarkdown += `## [${i + 1}] ${pageTitle}\n- Source: ${pageUrl}\n\n${content}\n\n---\n\n`;
        });

        const targetFile = isAbsolute(options.savePath)
          ? options.savePath
          : resolve(scriptDir, options.savePath);
        await Bun.write(targetFile, combinedMarkdown);
        console.log(`💾 \x1b[32m整站合并 Markdown 文件已保存至: ${targetFile}\x1b[0m\n`);

      } else {
        const domainSlug = options.url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9.-]/g, '_');
        const targetDirName = options.savePath === '__AUTO__' 
          ? `crawl_${domainSlug}_${Date.now()}` 
          : options.savePath;

        const targetDir = isAbsolute(targetDirName) 
          ? targetDirName 
          : resolve(scriptDir, targetDirName);

        let savedCount = 0;
        for (let i = 0; i < results.length; i++) {
          const item = results[i];
          const pageUrl = item.url || options.url;
          const pageTitle = item.title || `page_${i + 1}`;
          const content = item.raw_content || item.content || "";
          
          if (!content) continue;

          const fileName = `${String(i + 1).padStart(2, '0')}_${sanitizeFilename(pageTitle)}.md`;
          const filePath = resolve(targetDir, fileName);
          
          const fileBody = `# ${pageTitle}\n- URL: ${pageUrl}\n\n${content}`;
          await Bun.write(filePath, fileBody);
          savedCount++;
        }

        console.log(`💾 \x1b[32m整站多文件知识库 (${savedCount} 个文件) 已成功生成并保存至目录:\x1b[0m`);
        console.log(`   📂 \x1b[36m${targetDir}\x1b[0m\n`);
      }
    }
  } catch (err: any) {
    console.error(`❌ 执行失败: ${err.message}`);
  }
}

// ================== 4. Map (全量强力模式 - /map) ==================
interface MapOptions {
  url: string;
  instructions?: string;
  maxDepth?: number;
  limit?: number;
  maxBreadth?: number;
  selectPaths?: string[];
  excludePaths?: string[];
  selectDomains?: string[];
  excludeDomains?: string[];
  allowExternal?: boolean;
  savePath?: string;
}

async function runMap(options: MapOptions) {
  console.log(`\n🗺️ 正在使用 Tavily 极速探测网站 Sitemap: \x1b[36m${options.url}\x1b[0m`);

  if (options.instructions) console.log(`   🧠 AI 探测指令: \x1b[33m"${options.instructions}"\x1b[0m`);
  if (options.maxDepth) console.log(`   📏 最大深度: \x1b[33m${options.maxDepth} 层\x1b[0m`);
  if (options.limit) console.log(`   🔢 数量上限: \x1b[33m${options.limit} 个 URL\x1b[0m`);
  if (options.selectPaths && options.selectPaths.length > 0) {
    console.log(`   ✅ 限定路径: \x1b[32m${options.selectPaths.join(', ')}\x1b[0m`);
  }
  if (options.excludePaths && options.excludePaths.length > 0) {
    console.log(`   🚫 排除路径: \x1b[31m${options.excludePaths.join(', ')}\x1b[0m`);
  }
  console.log('');

  try {
    const payload: any = {
      url: options.url,
    };

    if (options.instructions) payload.instructions = options.instructions;
    if (options.maxDepth) payload.max_depth = options.maxDepth;
    if (options.limit) payload.limit = options.limit;
    if (options.maxBreadth) payload.max_breadth = options.maxBreadth;
    if (options.selectPaths && options.selectPaths.length > 0) payload.select_paths = options.selectPaths;
    if (options.excludePaths && options.excludePaths.length > 0) payload.exclude_paths = options.excludePaths;
    if (options.selectDomains && options.selectDomains.length > 0) payload.select_domains = options.selectDomains;
    if (options.excludeDomains && options.excludeDomains.length > 0) payload.exclude_domains = options.excludeDomains;
    if (options.allowExternal !== undefined) payload.allow_external = options.allowExternal;

    const res = await fetch('https://api.tavily.com/map', fetchOptions(payload));
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    const results = data.results || [];
    if (results.length === 0) {
      console.log("⚠️ 未能探测到任何 URL 链接。");
      return;
    }

    console.log(`✅ 成功探测到 \x1b[32m${results.length}\x1b[0m 个 URL 链接:\n`);
    let markdownOutput = `# Site Map: ${options.url}\n\nTotal URLs Found: ${results.length}\n\n`;

    results.forEach((linkUrl: string, idx: number) => {
      console.log(`  \x1b[32m[${idx + 1}]\x1b[0m 🔗 ${linkUrl}`);
      markdownOutput += `- [${linkUrl}](${linkUrl})\n`;
    });
    console.log('');

    if (options.savePath) {
      const defaultName = `map_${options.url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9.-]/g, '_')}_${Date.now()}.md`;
      const fileName = options.savePath === '__AUTO__' ? defaultName : options.savePath;

      const targetFile = isAbsolute(fileName)
        ? fileName
        : resolve(scriptDir, fileName);

      await Bun.write(targetFile, markdownOutput);
      console.log(`💾 \x1b[32m站点 Sitemap 链接清单已成功保存至: ${targetFile}\x1b[0m\n`);
    }
  } catch (err: any) {
    console.error(`❌ 执行失败: ${err.message}`);
  }
}

// ================== 5. ResearchTask (官方原生自主 Deep Research - /research) ==================
interface ResearchTaskOptions {
  input: string;
  model?: "auto" | "pro" | "mini";
  citationFormat?: "numbered" | "mla" | "apa";
  includeDomains?: string[];
  savePath?: string;
}

async function runResearchTask(options: ResearchTaskOptions) {
  const model = options.model || 'auto';
  const citationFormat = options.citationFormat || 'numbered';

  console.log(`\n🧠 正在启动 Tavily 核心 AI 团队执行自主 ResearchTask 课题:`);
  console.log(`   🎯 研究课题: \x1b[36m"${options.input}"\x1b[0m`);
  console.log(`   🤖 Agent 模型规格: \x1b[33m${model.toUpperCase()}\x1b[0m`);
  console.log(`   📖 引用格式: \x1b[35m${citationFormat}\x1b[0m`);
  if (options.includeDomains && options.includeDomains.length > 0) {
    console.log(`   🌐 优先学术/权威站点: \x1b[32m${options.includeDomains.join(', ')}\x1b[0m`);
  }
  console.log('\n🚀 智能体团队已就位，正在进行多轮全网探索、数据交叉验证与综合撰写...\n');

  try {
    const payload: any = {
      input: options.input,
      model: model,
      citation_format: citationFormat,
    };

    if (options.includeDomains && options.includeDomains.length > 0) {
      payload.include_domains = options.includeDomains;
    }

    const initRes = await fetch('https://api.tavily.com/research', fetchOptions(payload));
    if (!initRes.ok) throw new Error(await initRes.text());
    const initData = await initRes.json();

    const requestId = initData.request_id;
    if (!requestId) {
      throw new Error("API 未能返回有效的 request_id");
    }

    let completedData: any = null;
    let pollCount = 0;

    while (true) {
      pollCount++;
      await Bun.sleep(3000);

      const statusRes = await fetch(`https://api.tavily.com/research/${requestId}`, {
        headers: {
          'Authorization': `Bearer ${TAVILY_API_KEY}`
        }
      });
      if (!statusRes.ok) throw new Error(await statusRes.text());
      const statusData = await statusRes.json();

      if (statusData.status === 'completed') {
        completedData = statusData;
        break;
      } else if (statusData.status === 'failed') {
        throw new Error(statusData.error || "ResearchTask 研究任务执行失败。");
      } else {
        process.stdout.write(`\r⏳ AI Agent 团队仍在深潜调研中... [耗时 ${(pollCount * 3)}s | 状态: ${statusData.status}]`);
      }
    }

    console.log(`\r✅ \x1b[32mResearchTask 深度课题调研完成！(总耗时 ${completedData.response_time || pollCount * 3}s)\x1b[0m\n`);

    const reportContent = completedData.content || "";
    const sources = completedData.sources || [];

    console.log(`\x1b[35m📜 --- Tavily ResearchTask 科研报告开始 ---\x1b[0m\n`);
    console.log(reportContent);
    console.log(`\n\x1b[35m📜 --- 科研报告结束 ---\x1b[0m\n`);

    if (sources.length > 0) {
      console.log(`\x1b[33m📚 参考学术/网页文献 (${sources.length} 篇):\x1b[0m`);
      sources.forEach((s: any, idx: number) => {
        const title = typeof s === 'string' ? s : (s.title || s.url);
        const url = typeof s === 'object' ? s.url : s;
        console.log(`   [${idx + 1}] ${title} -> ${url}`);
      });
      console.log('');
    }

    if (options.savePath) {
      const defaultName = `researchtask_${options.input.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}_${Date.now()}.md`;
      const fileName = options.savePath === '__AUTO__' ? defaultName : options.savePath;

      const targetFile = isAbsolute(fileName)
        ? fileName
        : resolve(scriptDir, fileName);

      let fullReportMarkdown = `# ResearchTask Report: ${options.input}\n\n`;
      fullReportMarkdown += reportContent + `\n\n## References\n\n`;
      sources.forEach((s: any, idx: number) => {
        const title = typeof s === 'string' ? s : (s.title || s.url);
        const url = typeof s === 'object' ? s.url : s;
        fullReportMarkdown += `[${idx + 1}] [${title}](${url})\n`;
      });

      await Bun.write(targetFile, fullReportMarkdown);
      console.log(`💾 \x1b[32m全量 ResearchTask 报告已成功保存至: ${targetFile}\x1b[0m\n`);
    }
  } catch (err: any) {
    console.error(`\n❌ 执行失败: ${err.message}`);
  }
}

// ================== 命令行参数解析与路由调度 ==================
function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0) return null;

  const cmd = args[0].toLowerCase();
  const restArgs = args.slice(1);

  if (cmd === 'extract') {
    const urls: string[] = [];
    let query: string | undefined = undefined;
    let section: string | undefined = undefined;
    let match: string | undefined = undefined;
    let depth: "basic" | "advanced" = "advanced";
    let format: "markdown" | "text" = "markdown";
    let chunksPerSource: number | undefined = undefined;
    let includeImages = false;
    let includeFavicon = false;
    let savePath: string | undefined = undefined;

    for (let i = 0; i < restArgs.length; i++) {
      const arg = restArgs[i];
      if (arg.startsWith('--query=')) {
        query = arg.substring(8);
      } else if (arg === '-q' && i + 1 < restArgs.length) {
        query = restArgs[++i];
      } else if (arg.startsWith('--section=')) {
        section = arg.substring(10);
      } else if (arg === '-s' && i + 1 < restArgs.length) {
        section = restArgs[++i];
      } else if (arg.startsWith('--match=')) {
        match = arg.substring(8);
      } else if (arg === '-m' && i + 1 < restArgs.length) {
        match = restArgs[++i];
      } else if (arg.startsWith('--format=')) {
        format = arg.substring(9) as any;
      } else if (arg === '--text') {
        format = 'text';
      } else if (arg.startsWith('--chunks=')) {
        chunksPerSource = parseInt(arg.substring(9), 10);
      } else if (arg.startsWith('--depth=')) {
        depth = arg.substring(8) as any;
      } else if (arg === '--basic') {
        depth = 'basic';
      } else if (arg === '--images') {
        includeImages = true;
      } else if (arg === '--favicon') {
        includeFavicon = true;
      } else if (arg.startsWith('--save=')) {
        savePath = arg.substring(7);
      } else if (arg === '-o' && i + 1 < restArgs.length) {
        savePath = restArgs[++i];
      } else if (arg === '--save') {
        savePath = `extract_${Date.now()}.md`;
      } else if (arg.startsWith('http://') || arg.startsWith('https://')) {
        urls.push(arg);
      }
    }

    return { command: 'extract', extractOptions: { urls, query, section, match, depth, format, chunksPerSource, includeImages, includeFavicon, savePath } };
  }

  if (cmd === 'search') {
    let depth: "basic" | "advanced" = "basic";
    let queryWords: string[] = [];
    let topic: "general" | "news" | "finance" | undefined = undefined;
    let timeRange: string | undefined = undefined;
    let days: number | undefined = undefined;
    let maxResults: number | undefined = undefined;
    let includeDomains: string[] = [];
    let excludeDomains: string[] = [];
    let country: string | undefined = undefined;
    let includeImages = false;
    let includeImageDescriptions = false;
    let savePath: string | undefined = undefined;

    for (let i = 0; i < restArgs.length; i++) {
      const arg = restArgs[i];
      if (arg === '--advanced') {
        depth = 'advanced';
      } else if (arg.startsWith('--depth=')) {
        depth = arg.substring(8) as any;
      } else if (arg.startsWith('--topic=')) {
        topic = arg.substring(8) as any;
      } else if (arg === '--news') {
        topic = 'news';
      } else if (arg === '--finance') {
        topic = 'finance';
      } else if (arg.startsWith('--time=')) {
        timeRange = arg.substring(7);
      } else if (arg === '-t' && i + 1 < restArgs.length) {
        timeRange = restArgs[++i];
      } else if (arg.startsWith('--days=')) {
        days = parseInt(arg.substring(7), 10);
      } else if (arg.startsWith('--max=')) {
        maxResults = parseInt(arg.substring(6), 10);
      } else if (arg === '-n' && i + 1 < restArgs.length) {
        maxResults = parseInt(restArgs[++i], 10);
      } else if (arg.startsWith('--site=')) {
        includeDomains = arg.substring(7).split(',').map(s => s.trim());
      } else if (arg.startsWith('--include-domains=')) {
        includeDomains = arg.substring(18).split(',').map(s => s.trim());
      } else if (arg.startsWith('--exclude-site=')) {
        excludeDomains = arg.substring(15).split(',').map(s => s.trim());
      } else if (arg.startsWith('--exclude-domains=')) {
        excludeDomains = arg.substring(18).split(',').map(s => s.trim());
      } else if (arg.startsWith('--country=')) {
        country = arg.substring(10);
      } else if (arg === '-c' && i + 1 < restArgs.length) {
        country = restArgs[++i];
      } else if (arg === '--images') {
        includeImages = true;
      } else if (arg === '--image-desc') {
        includeImages = true;
        includeImageDescriptions = true;
      } else if (arg.startsWith('--save=')) {
        savePath = arg.substring(7);
      } else if (arg === '-o' && i + 1 < restArgs.length) {
        savePath = restArgs[++i];
      } else if (arg === '--save') {
        savePath = `search_${Date.now()}.md`;
      } else {
        queryWords.push(arg);
      }
    }

    const query = queryWords.join(' ');
    return {
      command: 'search',
      searchOptions: {
        query,
        depth,
        topic,
        timeRange,
        days,
        maxResults,
        includeDomains,
        excludeDomains,
        country,
        includeImages,
        includeImageDescriptions,
        savePath
      }
    };
  }

  if (cmd === 'crawl') {
    let url = "";
    let instructions: string | undefined = undefined;
    let maxDepth: number | undefined = undefined;
    let limit: number | undefined = undefined;
    let maxBreadth: number | undefined = undefined;
    let selectPaths: string[] = [];
    let excludePaths: string[] = [];
    let allowExternal: boolean | undefined = undefined;
    let extractDepth: "basic" | "advanced" = "advanced";
    let savePath: string | undefined = undefined;

    for (let i = 0; i < restArgs.length; i++) {
      const arg = restArgs[i];
      if (arg.startsWith('--instructions=')) {
        instructions = arg.substring(15);
      } else if (arg === '-i' && i + 1 < restArgs.length) {
        instructions = restArgs[++i];
      } else if (arg.startsWith('--depth=')) {
        maxDepth = parseInt(arg.substring(8), 10);
      } else if (arg === '-d' && i + 1 < restArgs.length) {
        maxDepth = parseInt(restArgs[++i], 10);
      } else if (arg.startsWith('--limit=')) {
        limit = parseInt(arg.substring(8), 10);
      } else if (arg === '-l' && i + 1 < restArgs.length) {
        limit = parseInt(restArgs[++i], 10);
      } else if (arg.startsWith('--breadth=')) {
        maxBreadth = parseInt(arg.substring(10), 10);
      } else if (arg.startsWith('--include-paths=')) {
        selectPaths = arg.substring(16).split(',').map(s => s.trim());
      } else if (arg.startsWith('--exclude-paths=')) {
        excludePaths = arg.substring(16).split(',').map(s => s.trim());
      } else if (arg === '--external') {
        allowExternal = true;
      } else if (arg.startsWith('--save=')) {
        savePath = arg.substring(7);
      } else if (arg === '-o' && i + 1 < restArgs.length) {
        savePath = restArgs[++i];
      } else if (arg === '--save') {
        savePath = '__AUTO__';
      } else if (arg.startsWith('http://') || arg.startsWith('https://')) {
        url = arg;
      }
    }

    return {
      command: 'crawl',
      crawlOptions: {
        url,
        instructions,
        maxDepth,
        limit,
        maxBreadth,
        selectPaths,
        excludePaths,
        allowExternal,
        extractDepth,
        savePath
      }
    };
  }

  if (cmd === 'map') {
    let url = "";
    let instructions: string | undefined = undefined;
    let maxDepth: number | undefined = undefined;
    let limit: number | undefined = undefined;
    let maxBreadth: number | undefined = undefined;
    let selectPaths: string[] = [];
    let excludePaths: string[] = [];
    let selectDomains: string[] = [];
    let excludeDomains: string[] = [];
    let allowExternal: boolean | undefined = undefined;
    let savePath: string | undefined = undefined;

    for (let i = 0; i < restArgs.length; i++) {
      const arg = restArgs[i];
      if (arg.startsWith('--instructions=')) {
        instructions = arg.substring(15);
      } else if (arg === '-i' && i + 1 < restArgs.length) {
        instructions = restArgs[++i];
      } else if (arg.startsWith('--depth=')) {
        maxDepth = parseInt(arg.substring(8), 10);
      } else if (arg === '-d' && i + 1 < restArgs.length) {
        maxDepth = parseInt(restArgs[++i], 10);
      } else if (arg.startsWith('--limit=')) {
        limit = parseInt(arg.substring(8), 10);
      } else if (arg === '-l' && i + 1 < restArgs.length) {
        limit = parseInt(restArgs[++i], 10);
      } else if (arg.startsWith('--breadth=')) {
        maxBreadth = parseInt(arg.substring(10), 10);
      } else if (arg.startsWith('--include-paths=')) {
        selectPaths = arg.substring(16).split(',').map(s => s.trim());
      } else if (arg.startsWith('--exclude-paths=')) {
        excludePaths = arg.substring(16).split(',').map(s => s.trim());
      } else if (arg.startsWith('--site=')) {
        selectDomains = arg.substring(7).split(',').map(s => s.trim());
      } else if (arg.startsWith('--include-domains=')) {
        selectDomains = arg.substring(18).split(',').map(s => s.trim());
      } else if (arg.startsWith('--exclude-site=')) {
        excludeDomains = arg.substring(15).split(',').map(s => s.trim());
      } else if (arg.startsWith('--exclude-domains=')) {
        excludeDomains = arg.substring(18).split(',').map(s => s.trim());
      } else if (arg === '--external') {
        allowExternal = true;
      } else if (arg.startsWith('--save=')) {
        savePath = arg.substring(7);
      } else if (arg === '-o' && i + 1 < restArgs.length) {
        savePath = restArgs[++i];
      } else if (arg === '--save') {
        savePath = '__AUTO__';
      } else if (arg.startsWith('http://') || arg.startsWith('https://')) {
        url = arg;
      }
    }

    return {
      command: 'map',
      mapOptions: {
        url,
        instructions,
        maxDepth,
        limit,
        maxBreadth,
        selectPaths,
        excludePaths,
        selectDomains,
        excludeDomains,
        allowExternal,
        savePath
      }
    };
  }

  // 支持 researchtask、research、deepsearch 作为全量官方 /research 接口命令
  if (cmd === 'researchtask' || cmd === 'research' || cmd === 'deepsearch') {
    let inputWords: string[] = [];
    let model: "auto" | "pro" | "mini" | undefined = undefined;
    let citationFormat: "numbered" | "mla" | "apa" | undefined = undefined;
    let includeDomains: string[] = [];
    let savePath: string | undefined = undefined;

    for (let i = 0; i < restArgs.length; i++) {
      const arg = restArgs[i];
      if (arg.startsWith('--model=')) {
        model = arg.substring(8) as any;
      } else if (arg === '--pro') {
        model = 'pro';
      } else if (arg === '--mini') {
        model = 'mini';
      } else if (arg === '--auto') {
        model = 'auto';
      } else if (arg.startsWith('--citation=')) {
        citationFormat = arg.substring(11) as any;
      } else if (arg === '--mla') {
        citationFormat = 'mla';
      } else if (arg === '--apa') {
        citationFormat = 'apa';
      } else if (arg === '--numbered') {
        citationFormat = 'numbered';
      } else if (arg.startsWith('--site=')) {
        includeDomains = arg.substring(7).split(',').map(s => s.trim());
      } else if (arg.startsWith('--include-domains=')) {
        includeDomains = arg.substring(18).split(',').map(s => s.trim());
      } else if (arg.startsWith('--save=')) {
        savePath = arg.substring(7);
      } else if (arg === '-o' && i + 1 < restArgs.length) {
        savePath = restArgs[++i];
      } else if (arg === '--save') {
        savePath = '__AUTO__';
      } else {
        inputWords.push(arg);
      }
    }

    const input = inputWords.join(' ');
    return {
      command: 'researchtask',
      researchTaskOptions: {
        input,
        model,
        citationFormat,
        includeDomains,
        savePath
      }
    };
  }

  // 默认其他命令兼容模式
  return {
    command: cmd,
    queryOrUrl: restArgs.join(' ')
  };
}

const parsed = parseArgs();

if (!parsed) {
  console.error("❌ 请提供有效的命令。用法: bun tavily.ts <search|researchtask|extract|crawl|map> [选项] \"<参数>\"");
  process.exit(1);
}

switch (parsed.command) {
  case 'search':
    if (!parsed.searchOptions.query) {
      console.error("❌ 请提供搜索关键词。");
      process.exit(1);
    }
    runSearch(parsed.searchOptions);
    break;
  case 'extract':
    if (!parsed.extractOptions.urls || parsed.extractOptions.urls.length === 0) {
      console.error("❌ 请提供至少一个有效的 http:// 或 https:// 网址。");
      process.exit(1);
    }
    runExtract(parsed.extractOptions);
    break;
  case 'crawl':
    if (!parsed.crawlOptions.url) {
      console.error("❌ 请提供有效的 http:// 或 https:// 起始网址。");
      process.exit(1);
    }
    runCrawl(parsed.crawlOptions);
    break;
  case 'map':
    if (!parsed.mapOptions.url) {
      console.error("❌ 请提供有效的 http:// 或 https:// 起始网址。");
      process.exit(1);
    }
    runMap(parsed.mapOptions);
    break;
  case 'researchtask':
    if (!parsed.researchTaskOptions.input) {
      console.error("❌ 请提供 ResearchTask 深度研究课题描述。");
      process.exit(1);
    }
    runResearchTask(parsed.researchTaskOptions);
    break;
  default:
    console.error(`❌ 未知命令: ${parsed.command}`);
}
