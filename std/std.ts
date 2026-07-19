#!/usr/bin/env bun
import { exec } from "child_process";
import * as readline from "readline";

// 辅助函数：根据不同的操作系统自动打开浏览器
function openBrowser(url: string) {
  const platform = process.platform;
  let command = "";
  if (platform === "darwin") command = `open "${url}"`;
  else if (platform === "win32") command = `start "" "${url}"`;
  else command = `xdg-open "${url}"`;

  exec(command, (err) => {
    // 失败时静默
  });
}

// 辅助函数：终端交互式菜单
async function showMenuAndSelect(options: string[]): Promise<number> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let selectedIndex = 0;
    const linesToClear = options.length + 2; // 提示行 + 空行 + 选项数

    const render = (firstTime = false) => {
      if (!firstTime) {
        // 清除之前打印的菜单，实现原地刷新的动画效果
        readline.moveCursor(process.stdout, 0, -linesToClear);
      }
      console.log("请使用上下方向键 \x1b[33m[↑ / ↓]\x1b[0m 选择要检索的网站，\x1b[32m[回车]\x1b[0m 确认：\n");
      options.forEach((opt, idx) => {
        if (idx === selectedIndex) {
          console.log(`  \x1b[36m👉 ${opt}\x1b[0m`);
        } else {
          console.log(`     ${opt}`);
        }
      });
    };

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    const onKeypress = (str: string, key: any) => {
      if (key.ctrl && key.name === "c") {
        process.exit(0);
      }
      if (key.name === "up") {
        selectedIndex = (selectedIndex - 1 + options.length) % options.length;
        render();
      } else if (key.name === "down") {
        selectedIndex = (selectedIndex + 1) % options.length;
        render();
      } else if (key.name === "return") {
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.removeListener("keypress", onKeypress);
        rl.close();
        resolve(selectedIndex);
      }
    };

    process.stdin.on("keypress", onKeypress);
    render(true);
  });
}

async function searchStandards(query: string, autoSelectIndex: number = -1) {
  const encodedQuery = encodeURIComponent(query);

  const targets = [
    { name: "🇨🇳 中国国标 (GB总库)", url: `https://std.samr.gov.cn/search/std?q=${encodedQuery}` },
    { name: "🇨🇳 中国国标 (全文阅读)", url: `https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p1=0&p.p90=ur_basic_info&p.p2=${encodedQuery}` },
    { name: "🌐 国际标准 (ISO)", url: `https://www.iso.org/search.html?q=${encodedQuery}` },
    { name: "🇺🇸 美国材料标准 (ASTM)", url: `https://www.astm.org/search/fullsite-search.html?query=${encodedQuery}` },
    { name: "🇺🇸 美国国家标准 (ANSI)", url: `https://webstore.ansi.org/Search/Find?keyword=${encodedQuery}` },
    { name: "🇪🇺 欧洲标准 (BSI/EN)", url: `https://knowledge.bsigroup.com/search?query=${encodedQuery}` },
    { name: "🇯🇵 日本工业标准 (JIS)", url: `https://webdesk.jsa.or.jp/books/W11M0270/index/?b_search_keyword=${encodedQuery}` },
  ];

  const menuOptions = [
    ...targets.map((t, i) => `[${i + 1}] ${t.name}`),
    `[8] 🚀 全部打开 (Open All)`
  ];

  let selected = autoSelectIndex;
  
  // 如果没有指定有效参数，进入交互式界面
  if (selected < 0 || selected > targets.length) {
    console.log(`\n🔍 正在为你检索标准: \x1b[36m${query}\x1b[0m\n`);
    selected = await showMenuAndSelect(menuOptions);
  }

  console.log(`\n========================================================`);
  
  let toOpen = [];
  if (selected === targets.length) { // 选了第8项：全部打开
    console.log(` 🌐 准备同时唤起 ${targets.length} 个平台的浏览器检索...`);
    toOpen = targets;
  } else {
    console.log(` 🌐 准备唤起: \x1b[32m${targets[selected].name}\x1b[0m`);
    toOpen = [targets[selected]];
  }
  
  console.log(`========================================================\n`);

  toOpen.forEach((target, index) => {
    console.log(`🔗 ${target.url}`);
    // 加一点延时防止浏览器短时间弹太多标签卡死
    setTimeout(() => { openBrowser(target.url); }, index * 300);
  });

  console.log(`\n✅ 搞定！浏览器已唤起。如果未自动打开，请按住 Ctrl 并点击上方链接。\n`);
}

// ================= 命令行参数解析 =================
const args = process.argv.slice(2);
let command = "";
let query = "";
let autoSelectIndex = -1;

for (const arg of args) {
  if (!command && arg === "search") {
    command = arg;
    continue;
  }
  
  if (arg.startsWith("--")) {
    const opt = arg.slice(2);
    if (opt === "all" || opt === "8") {
      autoSelectIndex = 7; // 对应第8项 (索引7)
    } else {
      const num = parseInt(opt);
      if (!isNaN(num) && num >= 1 && num <= 7) {
        autoSelectIndex = num - 1; // 转换为索引
      }
    }
  } else if (!query) {
    query = arg;
  }
}

if (command !== "search" || !query) {
  console.log(`
📜 工业与材料标准搜索器 (Standards Search)

用法:
  bun std.ts search "<标准关键词>" [选项]

选项:
  --1 至 --7   直接打开对应的单个平台 (无需交互)
  --8 或 --all 直接全部打开所有 7 个平台
  (不填选项)   进入 TUI 交互式菜单，使用上下方向键动态选择

示例:
  bun std.ts search "陶瓷 抗折强度"        (进入交互式菜单)
  bun std.ts search "Alumina" --1          (直接打开中国 GB 总库)
  bun std.ts search "玻璃" --8             (一键打开全部 7 个平台)
  `);
  process.exit(0);
}

searchStandards(query, autoSelectIndex);
