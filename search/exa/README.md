# Exa 使用指南

本脚本基于 Exa API 打造，专门用于**神经网络语义检索**、**学术文献/相似网页匹配**、**网页干净正文与摘要抽取**及**AI 智能问答**。获取的结果默认在终端展示，同时支持导出为干净规范的 Markdown 文件。

---

## 4 个核心功能总表

| 功能命令 | 名称 | 适用场景说明 |
| :--- | :--- | :--- |
| `search` | 语义/神经网络检索 | 通过自然语言意图描述全网高价值资料，支持指定学术论文、企业、新闻等分类及深度推理。 |
| `similar` | 相似网页/论文匹配 | 给定 1 个种子 URL，在全网搜索语义高度相似的顶级网页或学术论文。 |
| `contents` | 多网址正文/摘要提取 | 针对已知 URL 批量抽取纯正文 Markdown、AI 摘要及精准关键词切片。 |
| `answer` | 生成式语义问答 | 针对具体科学问题生成带严格信源出处与脚标引用的 AI 解答。 |

---

## 准备工作

在运行任何命令前，请确保脚本所在目录下的 `.env` 文件中配置了有效的 Exa 密钥：

```env
EXA_API_KEY=你的 Exa API Key
```

---

## 各核心功能命令行详解

### 一、search (语义与神经网络检索)

支持自然语言深度意图检索，默认返回 5 条结果。

#### 1. 基础语义搜索
直接输入自然语言描述或问题：
```bash
bun exa.ts search "氧化铝陶瓷3D打印工艺突破与商业化"
```

#### 2. 指定检索模式 (Speed & Latency Profile)
追加 `--type` (支持 `auto` 默认、`fast` 极速、`instant` 实时、`deep` 深度推理、`deep-reasoning` 最大推理)：
```bash
bun exa.ts search --type=deep "莫来石晶体结构在高温条件下的相变机制"
bun exa.ts search --type=fast "碳化硅陶瓷烧结温度"
```

#### 3. 开启 AI 实时流式回答 (Server-Sent Events)
追加 `--stream` 参数，开启打字机式的流式实时回答输出：
```bash
bun exa.ts search --stream --type=deep "影响氧化铝陶瓷透光性的关键因素"
```

#### 4. 垂直领域分类过滤
追加 `--category` 或 `-c` 限定检索分类（支持 `publication` 学术论文/期刊、`company` 企业、`news` 新闻、`personal site` 个人博客等）：
```bash
bun exa.ts search -c publication "Alumina ceramic sintering density"
bun exa.ts search -c company "先进结构陶瓷制造企业"
```

#### 5. 控制返回信源条数
追加 `-n` 或 `--num` 指定返回条数（1-100 条）：
```bash
bun exa.ts search -n 10 "锆英石微粉在釉料中的应用"
```

#### 6. 域名白名单与黑名单
追加 `--site` 限定域名，或追加 `--exclude-site` 屏蔽特定网站（多个域名用逗号分隔）：
```bash
bun exa.ts search --site=sciencedirect.com,springer.com "Mullite ceramics"
bun exa.ts search --exclude-site=badblog.com "陶瓷热导率测试"
```

#### 7. 发布时间筛选
使用 `--published-after` 或 `--published-before` 限定时间段 (格式 YYYY-MM-DD)：
```bash
bun exa.ts search --published-after=2024-01-01 "碳化硅陶瓷 3D 打印"
```
*(注：`company` 和 `people` 分类不支持日期过滤和黑名单)*

#### 8. 提取模式控制 (Highlights / Text / Summary)
选择返回切片高亮（`--highlights`）、纯正文（`--text`）或 AI 摘要（`--summary`）：
```bash
bun exa.ts search --highlights "氮化硅陶瓷抗折强度数据"
bun exa.ts search --summary "氧化锆增韧陶瓷机理"
bun exa.ts search --text --max-chars=5000 "莫来石耐火材料"
```

#### 9. 实时抓取超时控制
追加 `--livecrawl-timeout` 设置实时爬取超时（单位毫秒），适用于响应较慢的学术网站：
```bash
bun exa.ts search --text --livecrawl-timeout=10000 "陶瓷材料热导率"
```

#### 10. 正文区域精细过滤
配合 `--text` 使用 `--include-sections` 或 `--exclude-sections` 指定只提取/排除页面特定区域（如 `body`、`header`、`footer`，逗号分隔）：
```bash
bun exa.ts search --text --exclude-sections=header,footer "氧化锆陶瓷性能参数"
```

#### 11. AI 结构化总结与 Grounding 溯源 (`--schema`)
追加 `--schema` 传递 JSON Schema 字符串或 `.json` 结构文件，让 Exa 输出 AI 结构化总结，并带上字段级的 Grounding 溯源与置信度标记：
```bash
bun exa.ts search --schema '{"type":"object","properties":{"summary":{"type":"string"}},"required":["summary"]}' "碳化硅陶瓷烧结温度"
```

#### 12. 保存搜索报告为 Markdown 文件
追加 `-o <文件名.md>` 或 `--save` 导出 Markdown 报告：
```bash
bun exa.ts search --save "氧化铝陶瓷烧结"
bun exa.ts search -o 氧化铝报告.md "氧化铝陶瓷烧结"
bun exa.ts search -o ./scratch/氧化铝报告.md "氧化铝陶瓷烧结"
```

---

### 二、similar / findsimilar (相似网页/论文匹配)

输入一个种子网页或学术论文链接，Exa 会在全网寻找语义高度接近的关联资源。

#### 1. 基础相似匹配
输入目标 URL：
```bash
bun exa.ts similar "https://en.wikipedia.org/wiki/Aluminium_oxide"
```

#### 2. 指定学术论文分类与数量
```bash
bun exa.ts similar -c publication -n 10 "https://doi.org/10.1016/j.ceramint.2023.01.001"
```

#### 3. 导出报告为 Markdown 文件
```bash
bun exa.ts similar -o 相似论文推荐.md "https://en.wikipedia.org/wiki/Aluminium_oxide"
```

---

### 三、contents (网页正文与切片提取)

针对已知的一个或多个 URL 链接，精准提取 Markdown 格式正文、AI 摘要或切片。

#### 1. 基础网页正文提取
输入 1 个或多个链接：
```bash
bun exa.ts contents "https://en.wikipedia.org/wiki/Aluminium_oxide"
```

#### 2. 提取 AI 摘要与高亮切片
```bash
bun exa.ts contents --summary --highlights "https://en.wikipedia.org/wiki/Aluminium_oxide"
```

#### 3. 实时强制重新抓取 (Bypass Cache)
追加 `--max-age 0` 忽略缓存，强制获取实时最新网页内容：
```bash
bun exa.ts contents --max-age 0 "https://example.com/news"
```

#### 4. 实时抓取超时控制
追加 `--livecrawl-timeout` 设置超时上限（单位毫秒），避免慢速网站阻塞整个请求：
```bash
bun exa.ts contents --max-age 0 --livecrawl-timeout=15000 "https://example.com/slow-page"
```

#### 5. 正文区域精细过滤
配合 `--text` 使用 `--include-sections` 或 `--exclude-sections` 只提取页面指定区域：
```bash
bun exa.ts contents --text --exclude-sections=header,footer "https://en.wikipedia.org/wiki/Aluminium_oxide"
```

> **注意**：Contents 端点会自动检查每个 URL 的提取状态。若部分 URL 抓取失败（如超时或不可访问），终端会显示 ⚠️ 警告并列出失败详情，不会静默跳过。

#### 6. 导出为 Markdown 文件
```bash
bun exa.ts contents -o 网页正文.md "https://en.wikipedia.org/wiki/Aluminium_oxide"
```

---

### 四、answer (生成式 AI 问答)

针对科学或物理化学问题，由 Exa 结合全网检索结果直接生成回答，并附带规范的引用脚标与信源清单。

#### 1. 基础问答
```bash
bun exa.ts answer "纯α-氧化铝陶瓷的理论密度是多少？"
```

#### 2. 开启 AI 实时流式回答
追加 `--stream` 参数，开启打字机式的流式实时回答输出：
```bash
bun exa.ts answer --stream "影响氧化铝陶瓷透光性的关键因素有哪些？"
```

#### 3. 限定权威域名范围问答
```bash
bun exa.ts answer --site=nist.gov,matweb.com "氮化硅陶瓷的高温抗弯强度是多少？"
```

#### 4. 指定角色提示词 (`--system-prompt`)
追加 `--system-prompt` 设定 AI 回答的角色和行为偏好：
```bash
bun exa.ts answer --system-prompt="你是陶瓷材料专家，回答时优先引用学术文献" "氧化锆增韧氧化铝的最佳配比"
```

#### 5. AI 结构化问答 (`--schema`)
追加 `--schema` 传递 JSON Schema，让 Exa 输出结构化的问答结果：
```bash
bun exa.ts answer --schema '{"type":"object","properties":{"answer":{"type":"string"},"confidence":{"type":"string"}},"required":["answer"]}' "碳化硅陶瓷的莫氏硬度"
```

#### 6. 导出问答报告为 Markdown 文件
```bash
bun exa.ts answer -o 氧化铝理论密度问答.md "纯α-氧化铝陶瓷的理论密度是多少？"
```
