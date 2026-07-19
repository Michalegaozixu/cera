import { readFileSync } from "fs";
import { exec } from "child_process";

// 1. 获取传入的配方文件
const args = process.argv.slice(2);
const recipePath = args[0] || "recipe.json";

let recipeData: any;
try {
  const content = readFileSync(recipePath, "utf-8");
  recipeData = JSON.parse(content);
  console.log(`✅ 成功读取配方: ${recipeData.name}`);
} catch (err: any) {
  console.error(`❌ 无法读取配方文件 ${recipePath}: ${err.message}`);
  process.exit(1);
}

// 2. 将配方数据转换为 Excalidraw 元素 (手绘风格排版算法)
const elements = [];

// 标题
elements.push({
  id: "title",
  type: "text",
  x: 250,
  y: 60,
  text: `🏺 配方可视化: ${recipeData.name}`,
  fontSize: 36,
  strokeColor: "#2b8a3e", // 墨绿色
});

elements.push({
  id: "subtitle",
  type: "text",
  x: 320,
  y: 110,
  text: `烧成温度: ${recipeData.temperature}`,
  fontSize: 20,
  strokeColor: "#868e96",
});

// 左侧：原料卡片背景
elements.push({
  id: "ing_bg",
  type: "rectangle",
  x: 100,
  y: 180,
  width: 320,
  height: 350,
  backgroundColor: "#eebefa",
  strokeColor: "#b197fc",
  fillStyle: "solid",
  roughness: 1, // 手绘粗糙度
});

elements.push({
  type: "text",
  x: 120,
  y: 200,
  text: "📋 原始配方成分 (Wt%)",
  fontSize: 24,
  strokeColor: "#1864ab",
});

// 遍历原料
recipeData.ingredients?.forEach((ing: any, idx: number) => {
  elements.push({
    type: "text",
    x: 130,
    y: 250 + idx * 40,
    text: `• ${ing.name} : ${ing.percent}%`,
    fontSize: 20,
  });
});

// 中间：连线与转化箭头
elements.push({
  id: "arrow_1",
  type: "arrow",
  x: 430,
  y: 350,
  points: [[0, 0], [140, 0]],
  strokeColor: "#868e96",
  strokeWidth: 2,
  roughness: 2,
});
elements.push({
  type: "text",
  x: 450,
  y: 310,
  text: "UMF 换算引擎",
  fontSize: 16,
  strokeColor: "#d9480f",
});

// 右侧：UMF 卡片背景
elements.push({
  id: "umf_bg",
  type: "rectangle",
  x: 580,
  y: 180,
  width: 320,
  height: 350,
  backgroundColor: "#d0ebff",
  strokeColor: "#74c0fc",
  fillStyle: "solid",
  roughness: 1,
});

elements.push({
  type: "text",
  x: 600,
  y: 200,
  text: "🔬 统一分子式 (UMF)",
  fontSize: 24,
  strokeColor: "#0b7285",
});

// 遍历 UMF
let umfIdx = 0;
for (const [key, value] of Object.entries(recipeData.umf || {})) {
  elements.push({
    type: "text",
    x: 610,
    y: 250 + umfIdx * 45,
    text: `  [${key}] : ${value}`,
    fontSize: 20,
  });
  umfIdx++;
}

// 3. 构建包含 Excalidraw CDN 的静态 HTML 模板
const htmlTemplate = `
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>Cera - 陶瓷配方可视化</title>
    <style>
      body, html { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; background: #fdfdfd; font-family: sans-serif; }
      #app { width: 100%; height: 100%; }
      #loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px; color: #868e96; }
    </style>
    <!-- 引入 React 18 -->
    <script src="https://unpkg.com/react@18.2.0/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js"></script>
    <!-- 引入 Excalidraw (强锁版本 0.17.6) -->
    <script src="https://unpkg.com/@excalidraw/excalidraw@0.17.6/dist/excalidraw.production.min.js"></script>
  </head>
  <body>
    <div id="loading">✨ 正在从云端拉取画板，请稍候...</div>
    <div id="app"></div>
    <script>
      // 注入从服务器传递过来的 JSON 数据
      const injectedElements = ${JSON.stringify(elements)};

      // 等待 Excalidraw 加载完成
      window.onload = () => {
        document.getElementById('loading').style.display = 'none';
        
        const App = () => {
          return React.createElement(
            React.Fragment,
            null,
            React.createElement(ExcalidrawLib.Excalidraw, {
              initialData: {
                elements: injectedElements,
                appState: { viewBackgroundColor: "#fdfdfd" }
              }
            })
          );
        };

        const root = ReactDOM.createRoot(document.getElementById("app"));
        root.render(React.createElement(App));
      };
    </script>
  </body>
</html>
`;

// 4. 启动 Bun 微型服务器
const port = 3300;
Bun.serve({
  port: port,
  fetch(req) {
    return new Response(htmlTemplate, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
});

console.log(`\x1b[36m🚀 极速本地微服务已启动 -> http://localhost:${port}\x1b[0m`);
console.log(`\x1b[32m✨ 正在静默唤醒 Safari/系统默认浏览器...\x1b[0m`);

// 5. 自动拉起系统默认浏览器
const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
exec(`${command} http://localhost:${port}`);

console.log(`\x1b[90m(提示: 浏览器已弹开。欣赏完毕后，按 Ctrl+C 即可销毁本地服务器)\x1b[0m`);
