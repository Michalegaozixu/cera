# Tavily 使用指南

脚本具备 5 个核心功能，获取的结果默认在终端展示；支持把结果导出为markdown文件或文件夹文件形式。默认都会保存在脚本所在的当前目录下。

---

## 5 个核心功能总表

| 功能命令 | 名称 | 适用场景说明 |
| :--- | :--- | :--- |
| `search` | 全网智能搜索 | 快速回答日常问题、查找新闻资讯、限定指定网站搜索资料等。 |
| `researchtask` | 论文级课题调研 | 针对复杂的大课题（如学术研究、行业分析），让云端 AI 团队进行多轮探索并输出完整报告。 |
| `extract` | 网页正文提取与切片 | 网页正文抽取与切片（自动剥离广告、导航栏与弹窗）。 |
| `map` | 网站地图网址扫描 | 快速扫描网站内部包含的所有网页链接，生成目录结构树。 |
| `crawl` | 网站资料打包 | 批量爬取网站页面，打包生成合并电子书或多文件 Markdown 知识库文件夹。 |

---

## 准备工作

在运行任何命令前，请确保脚本所在目录下的 `.env` 文件中配置了有效的 Tavily 密钥：

```env
TAVILY_API_KEY=你的 API key
```

---

## 各核心功能命令行详解

### 一、search

用于日常检索。返回结果数量默认 5 条。

#### 1. 基础搜索
直接输入搜索关键词，快速获取 AI 总结和核心信源摘要。
```bash
bun tavily.ts search "家庭用餐具设计趋势"
```

#### 2. 高级深度检索
追加 `--advanced` 选项，不仅返回摘要，还会抓取并附带前几条核心网页的全量原文内容。
```bash
bun tavily.ts search --advanced "家庭用餐具设计趋势"
```

#### 3. 分类过滤搜索
使用 `--news` / `--finance` 限定搜索分类（如新闻、金融）。
```bash
bun tavily.ts search --news "陶瓷博览会"
bun tavily.ts search --finance "陶瓷餐具"
```

#### 4. 时间范围限定
使用 `-t` 选项过滤时间范围（可选 `day` 一天内、`week` 一周内、`month` 一月内、`year` 一年内）。
```bash
bun tavily.ts search -t week "陶瓷餐具"
```

#### 5. 最近 N 天内发布的内容
使用 `--days` 选项直接指定检索最近多少天内发布的信息。
```bash
bun tavily.ts search --days=3 "陶瓷餐具"
```

#### 6. 域名白名单（指定去某几个网站搜）
使用 `--site` 选项指定只在特定的域名范围中进行检索，支持 1 个或多个域名，多个域名用逗号分隔。
```bash
bun tavily.ts search --site=goodsite1.org,goodsite2.org "钾长石"
```

#### 7. 域名黑名单（屏蔽特定的垃圾/营销网站）
使用 `--exclude-site` 选项屏蔽不想看到的网站。支持 1 个或多个域名，多个域名用逗号分隔。
```bash
bun tavily.ts search --exclude-site=badsite1.com,badsite2.com "陶瓷烧结工艺"
```

#### 8. 控制返回结果条数
使用 `-n` 指定返回的搜索信源数量（支持范围 1 至 20 条，默认 5 条，消耗的 API 额度/金额是完全一样的）。
```bash
bun tavily.ts search -n 10 "石墨烯导热性能数据"
```

#### 9. 检索相关图片及说明
追加 `--images` 和 `--image-desc`，脚本会同时返回“文本内容”和“图片的链接和文字说明”。
```bash
bun tavily.ts search --images --image-desc "莫来石晶体结构"
```

#### 10. 将搜索报告保存为 Markdown 文件
使用 `-o` 选项将搜索结果及全量网页原文保存为本地 Markdown 文件。
```bash
bun tavily.ts search --save "陶瓷餐具流行趋势" #会得到名为时间戳的 md 格式文件
bun tavily.ts search -o 陶瓷餐具流行趋势.md "陶瓷餐具流行趋势" #会得到名为 陶瓷餐具流行趋势 的 md 格式文件
bun tavily.ts search -o ./报告/陶瓷餐具流行趋势.md "陶瓷餐具流行趋势" #会在当前目录下的 报告 文件夹下得到名为 陶瓷餐具流行趋势 的 md 格式文件
```

#### 11. 国家/地区限定筛选
使用 `--country` 或 `-c` 选项限定指定国家/地区检索（支持 `cn` 中国、`us` 美国、`uk` 英国、`jp` 日本等简码，或完整国家英文名称）。
```bash
bun tavily.ts search -c cn "家庭用餐具设计趋势"
bun tavily.ts search --country=us "tableware design trends"
```

---

### 二、researchtask

针对复杂的学术课题或深度行业调研。调度云端 AI 团队进行多轮全网探索，输出带有规范引用的报告。默认模型规格为 auto，参考文献格式默认数字角标。

说明：`researchtask` 包含两个等价的快捷别名 `research` 和 `deepsearch`，效果完全相同。

#### 1. 基础课题调研
提交一个研究课题，AI 团队会自动开展多轮深入调研。
```bash
bun tavily.ts researchtask "氧化铝陶瓷3D打印工艺突破与商业化瓶颈"
```

#### 2. 指定 AI 模型规格
使用 `--model`（支持 `--pro` / `--mini` / `--auto`）选择 Agent 模型规格。
```bash
bun tavily.ts researchtask "氧化铝陶瓷3D打印工艺" #不指定则是auto
bun tavily.ts researchtask --pro "氧化铝陶瓷3D打印工艺"
bun tavily.ts researchtask --mini "氧化铝陶瓷3D打印工艺"
```

#### 3. 设置学术文献引用格式
使用 `--citation`（支持 `--apa` / `--mla` / `--numbered`）设置参考文献的引用格式。
```bash
bun tavily.ts researchtask "氧化铝陶瓷3D打印工艺" #不指定则是数字角标[1][2]格式
bun tavily.ts researchtask --numbered "氧化铝陶瓷3D打印工艺" #数字角标[1][2]格式
bun tavily.ts researchtask --apa "氧化铝陶瓷3D打印工艺" #APA国际学术论文格式
bun tavily.ts researchtask --mla "氧化铝陶瓷3D打印工艺" #MLA人文社科格式
```

#### 4. 限定权威学术站点白名单
使用 `--site` 选项指定 AI 团队优先检索的权威学术数据源。支持 1 个或多个域名，多个域名用逗号分隔。
```bash
bun tavily.ts researchtask --site=sciencedirect.com,osti.gov "Mullite ceramic sintering"
```

#### 5. 将调研报告保存为 Markdown 文件
使用 `-o` 或 `--save` 选项将生成的全量科研报告及参考文献目录保存到本地文件。
```bash
bun tavily.ts researchtask --save "莫来石陶瓷烧结" #会得到名为时间戳的 md 格式文件
bun tavily.ts researchtask -o 莫来石烧结报告.md "莫来石陶瓷烧结" #会得到名为 莫来石烧结报告 的 md 格式文件
bun tavily.ts researchtask -o ./报告/莫来石烧结报告.md "莫来石陶瓷烧结" #会在当前目录下的 报告 文件夹下得到名为 莫来石烧结报告 的 md 格式文件
```

---

### 三、extract

用于提取网页里的干净内容，自动剥离广告、导航栏与弹窗。输出格式默认 Markdown，提取深度默认 advanced。

#### 1. 基础网页正文抓取
输入 1 个或多个网页链接，提取网页正文 Markdown 内容。
```bash
bun tavily.ts extract "https://en.wikipedia.org/wiki/Aluminium_oxide"
bun tavily.ts extract "https://en.wikipedia.org/wiki/Aluminium_oxide" "https://en.wikipedia.org/wiki/Mullite"
```

#### 2. 指定提取深度
提取深度默认是高级模式（自动渲染动态网页与复杂表格）。如果想用基础模式，追加 `--basic` 选项。
```bash
bun tavily.ts extract "https://en.wikipedia.org/wiki/Aluminium_oxide" #不指定则是高级模式
bun tavily.ts extract --basic "https://en.wikipedia.org/wiki/Aluminium_oxide" #基础模式
```

#### 3. 指定输出格式
提取内容默认输出为 Markdown 格式。如果只需要纯文本正文，追加 `--text` 选项。
```bash
bun tavily.ts extract "https://en.wikipedia.org/wiki/Aluminium_oxide" #Markdown 格式
bun tavily.ts extract --text "https://en.wikipedia.org/wiki/Aluminium_oxide" #纯文本格式
```

#### 4. AI 定向抽词与切片重排
使用 `-q` 关注特定重点，使用 `--chunks` 指定提取的切片数量。
```bash
bun tavily.ts extract -q "β-Al2O3" --chunks=5 "https://en.wikipedia.org/wiki/Aluminium_oxide"
```

#### 5. 章节切片提取
使用 `-s` 指定章节标题名称，脚本会自动截取该章节下的段落，忽略无关内容。
```bash
bun tavily.ts extract -s "History" "https://en.wikipedia.org/wiki/Aluminium_oxide"
```

#### 6. 段落关键词过滤
使用 `-m` 指定关键词，脚本只提取包含该关键词的段落。
```bash
bun tavily.ts extract -m "Aluminium" "https://en.wikipedia.org/wiki/Aluminium_oxide"
```

#### 7. 提取网页关联图片与网站图标
使用 `--images` / `--favicon` 提取网页中的图片链接或网站图标。
```bash
bun tavily.ts extract --images "https://en.wikipedia.org/wiki/Aluminium_oxide" #仅提取网页关联图片链接
bun tavily.ts extract --favicon "https://en.wikipedia.org/wiki/Aluminium_oxide" #仅提取网站图标 (Favicon)
bun tavily.ts extract --images --favicon "https://en.wikipedia.org/wiki/Aluminium_oxide" #同时提取图片与网站图标
```

#### 8. 将提取正文保存为 Markdown 文件
使用 `-o` 或 `--save` 选项将提取的正文保存为本地文件。
```bash
bun tavily.ts extract --save "https://en.wikipedia.org/wiki/Aluminium_oxide" #会得到名为时间戳的 md 格式文件
bun tavily.ts extract -o 氧化铝.md "https://en.wikipedia.org/wiki/Aluminium_oxide" #会得到名为 氧化铝 的 md 格式文件
bun tavily.ts extract -o ./报告/氧化铝正文.md "https://en.wikipedia.org/wiki/Aluminium_oxide" #会在当前目录下的 报告 文件夹下得到名为 氧化铝正文 的 md 格式文件
```

---

### 四、map

用于快速扫描网站内部包含的所有网页 URL 链接，生成目录结构树，不抓取正文。

#### 1. 基础网址扫描
输入网站根网址，扫描获取其内部包含的网页链接。有些网页包含超多链接，谨慎使用。可参考 2。
```bash
bun tavily.ts map "https://www.good.com"
```

#### 2. 限制扫描的 URL 数量上限
使用 `-l` 限制返回的网址总数。
```bash
bun tavily.ts map -l 20 "https://www.good.com"
```

#### 3. 限制最大跳转深度
使用 `-d` 限制扫描时的层级跳转深度。
```bash
bun tavily.ts map -d 2 "https://www.good.com"
```

#### 4. AI 指令筛选网址
使用 `-i` 输入提示词，让 AI 只挑选符合要求的网址链接。
```bash
bun tavily.ts map -i "只筛选关于产品介绍的链接" "https://www.good.com"
```

#### 5. 路径正则包含与排除
使用 `--include-paths` 指定正则包含白名单，使用 `--exclude-paths` 指定正则排除黑名单。
```bash
bun tavily.ts map --include-paths="/product/.*" --exclude-paths="/news/.*" "https://www.good.com"
```

#### 6. 域名限定与外链开关
使用 `--site` 限定域名范围，支持 1 个或多个域名，追加 `--external` 允许扫描包含的外链。
```bash
bun tavily.ts map --site=www.good.com --external "https://www.good.com"
```

#### 7. 将网址清单保存为 Markdown 文件
使用 `-o` 或 `--save` 将网址目录树保存为 Markdown 文件。
```bash
bun tavily.ts map -l 50 --save "https://www.good.com" #会得到名为时间戳的 md 格式文件
bun tavily.ts map -l 50 -o 网站网址清单.md "https://www.good.com" #会得到名为 网站网址清单 的 md 格式文件
bun tavily.ts map -l 50 -o ./报告/网站网址清单.md "https://www.good.com" #会在当前目录下的 报告 文件夹下得到名为 网站网址清单 的 md 格式文件
```

---

### 五、crawl

crawl（巡航爬取）的核心本质和设计目的，就是专门用来 批量抓取“多个”网页的内容。支持生成包含独立 Markdown 文件的多文件知识库文件夹，或者打包合并为单个 Markdown 电子书。

#### 1. 自动打包生成多文件独立知识库文件夹（默认模式）
使用 `--save` 选项，脚本会自动爬取网站页面并在同级目录下生成一个文件夹（一页保存为一个独立 .md 文件）。配合 `-l 10` 可以限制最多只抓取 10 个页面。
```bash
bun tavily.ts crawl --save -l 10 "https://www.good.com" #限制最多爬取10个页面，自动创建包含10个md文件的知识库文件夹
```

#### 2. 自定义知识库文件夹名称
使用 `-o <文件夹路径>` 指定保存的目录名称。
```bash
bun tavily.ts crawl -o ./陶瓷 -l 10 "https://www.good.com" #生成名为 陶瓷 的知识库文件夹
```

#### 3. 打包合并为单个 Markdown 电子书
使用 `-o <文件名.md>` 选项，只要文件名以 `.md` 结尾，脚本就会把所有抓取到的网页自动按顺序拼装为一本单文件 Markdown 电子书。
```bash
bun tavily.ts crawl -o 文档电子书.md -l 10 "https://www.good.com" #生成 文档电子书.md
bun tavily.ts crawl -o ./报告/文档电子书.md -l 10 "https://www.good.com" #会在当前目录下的 报告 文件夹下得到电子书文件
```

#### 4. AI 导航爬取方向
使用 `-i` 让 AI 智能决策爬取路径，只爬取相关主题的网页。
```bash
bun tavily.ts crawl -i "只爬取关于产品介绍的页面" -l 5 --save "https://www.good.com"
```

#### 5. 限制最大跳转深度与总抓取页数
使用 `-d` 限制跳转深度，使用 `-l` 限制总抓取页数。
```bash
bun tavily.ts crawl -d 2 -l 15 --save "https://www.good.com"
```

#### 6. 路径正则包含与排除
使用 `--include-paths` 和 `--exclude-paths` 对爬取页面路径进行精细化过滤。
```bash
bun tavily.ts crawl --include-paths="/product/.*" --exclude-paths="/news/.*" -l 10 --save "https://www.good.com"
```
