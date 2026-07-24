# paper.ts 使用指南

脚本具备 6 个核心功能命令，基于 OpenAlex 免费开放数据库（2.7 亿+ 学术文献），专为陶瓷、材料科学等垂直领域深度优化。获取的结果默认在终端以高颜值表格/可视化柱状图展示；`info` 命令支持把单篇或批量文献卡片导出为 Markdown 报告文件。

---

## 6 个核心功能总表

| 功能命令 | 别名 (Aliases) | 名称 | 适用场景说明 |
| :--- | :--- | :--- | :--- |
| `search` | — | 多维度文献检索 | 通过关键词在全库或陶瓷核心期刊中搜索文献，支持引用追踪（cites）、主题（topic）、机构（inst）、国家（country）、语言（lang）、批量 DOI、年份、被引数、OA 等多维过滤。 |
| `group` | `stats` | 聚合统计与趋势分析 | 对符合条件的文献按年份、国家、文献类型、期刊、主题、语言等维度做聚合统计，生成终端可视化分布柱状图。 |
| `topics` | `topic` | 主题体系主动查询 | 在 OpenAlex AI 主题树体系中搜索主题关键词，获取精准 Topic ID（如 `T10132`）及发文量统计。 |
| `inst` | `institution`, `institutions` | 机构数据库主动查询 | 在 OpenAlex 机构库中搜索大学/科研院所名称，获取机构 ID（如 `I105991555`）及国家与产出数据。 |
| `info` | — | 单篇/批量文献精读 | 支持传入单个或多个 DOI / OpenAlex ID（以空格、管道符或逗号分隔），获取文献完整精读卡片并可导出 MD 报告。 |
| `download` | — | OA 全文 PDF 下载 | 一键下载开放获取（Open Access）文献的免费 PDF 原文到本地。 |

---

## 准备工作

在脚本所在目录下创建 `.env` 文件，填入免费 API Key：

```env
OPENALEX_API_KEY=你的 API Key
```

免费申请地址：<https://openalex.org/settings/api>

不填也可以运行，但请求速率会受限。

---

## 参数完整速查表 (Full Options Reference)

### 1. `search` 与 `group` 通用过滤选项

| 长选项 | 短选项 | 类型 / 格式 | 示例 | 功能说明 |
| :--- | :--- | :--- | :--- | :--- |
| `--query` | `-q` | 字符串 | `-q "alumina sintering"` | 检索关键词（匹配标题与摘要） |
| `--journal` | `-j` | 快捷键 | `-j jacs` | 限定特定陶瓷核心期刊（见下方期刊表） |
| `--ceramics` | — | 开关 | `--ceramics` | 限定在预设的 7 本陶瓷/材料核心期刊中检索 |
| `--year` | `-y` | 单年或范围 | `-y 2024` 或 `-y 2020-2026` | 限定出版年份 |
| `--oa` | — | 开关 | `--oa` | 只看开放获取（Open Access）免费全文文献 |
| `--type` | `-t` | 字符串 | `-t review` 或 `-t article` | 限定文献类型（见下方类型表） |
| `--lang` | `--language` | 语言代码 | `--lang en` 或 `--lang zh` | 过滤文献语言 |
| `--country` | `-c` | 国家代码 | `-c CN` 或 `-c US` | 限定作者机构所在国家/地区 |
| `--inst` | — | 机构 ID | `--inst I105991555` | 限定特定科研机构（OpenAlex Inst ID） |
| `--topic` | — | 主题 ID | `--topic T10132` | 限定 OpenAlex Topic 分类体系 |
| `--cites` | — | Work ID / DOI | `--cites W2741809807` | 引用追踪（找引用了该论文的后续文章） |
| `--doi` | — | DOI 列表 | `--doi "doi1\|doi2"` | 批量 DOI 匹配过滤 |
| `--cited-min`| — | 数字 | `--cited-min 50` | 被引次数下限过滤 |
| `--limit` | `-l` | 数字 | `-l 20` | 每页返回条数（默认 10，最大 100） |
| `--page` | `-p` | 数字 | `-p 2` | 翻页浏览（配合 `-l` 使用） |
| `--sort` | `-s` | `citations` \| `year` | `-s year` | 排序规则：默认按被引数降序，`year` 为最新优先 |

### 2. `group` 专有选项

| 选项 | 允许值 / 快捷别名 | 默认值 | 示例 | 功能说明 |
| :--- | :--- | :--- | :--- | :--- |
| `--by` | `year`, `country`, `type`, `oa`, `journal`, `topic`, `lang`, `inst` | `publication_year` | `--by country` | 聚合统计维度 |

---

## 各核心功能命令行详解

### 一、search（多维度文献检索）

用于多维度批量检索文献列表。返回结果数量默认 10 条，最大 100 条。

#### 1. 基础关键词搜索
```bash
bun paper.ts search -q "alumina sintering"
```

#### 2. 限定陶瓷核心期刊检索 (`--ceramics` / `-j`)
追加 `--ceramics` 限定预设的 7 本陶瓷核心期刊；或使用 `-j` 指定单本期刊代号（如 `jacs`, `jecs`, `ci`, `jac` 等）。
```bash
bun paper.ts search -q "glaze thermal expansion" --ceramics
bun paper.ts search -q "solid state sintering" -j jacs
```

#### 3. 引用关系追踪 (`--cites`) — 找"引用了这篇论文的文章"
传入某篇经典论文的 OpenAlex ID（如 `W2741809807`）或 DOI（如 `10.1111/jace.19034`），追踪其后续学术影响力。
```bash
bun paper.ts search --cites W2741809807 -s year
bun paper.ts search --cites 10.1111/jace.19034 --lang en
```

#### 4. 精准 Topic 主题过滤 (`--topic`)
使用 `topics` 命令查出 Topic ID 后，使用 `--topic` 进行精准主题领域过滤。
```bash
bun paper.ts search --topic T10132 -y 2022-2026
```

#### 5. 机构与国家过滤 (`--inst` / `-c`, `--country`)
限定特定国家或特定科研机构（如景德镇陶瓷大学 `I105991555`）的学术产出。
```bash
bun paper.ts search -q "zirconia" --country CN       # 只看中国机构发表
bun paper.ts search --inst I105991555 -t article      # 只看景德镇陶瓷大学发表的研究论文
```

#### 6. 语言过滤 (`--lang`)
过滤特定语言文献，避免混入非目标语种文献。
```bash
bun paper.ts search -q "ceramic matrix composite" --lang en
```

#### 7. 批量 DOI 精准查询 (`--doi`)
使用管道符 `|` 或逗号分隔多个 DOI 批量检索文献列表。
```bash
bun paper.ts search --doi "10.1111/jace.19034|10.1016/j.jeurceramsoc.2021.01.001"
```

#### 8. 年份、OA、文献类型与被引数过滤
```bash
bun paper.ts search -q "zirconia" -y 2020-2026 --oa -t review --cited-min 30
```

#### 9. 控制每页条数与翻页 (`-l` / `-p`)
```bash
bun paper.ts search -q "zirconia toughening" -l 20 -p 2
```

#### 10. 改变排序习惯 (`-s`)
默认按被引次数降序排列；使用 `-s year` 改为按发表年份降序（最新优先）。
```bash
bun paper.ts search -q "ceramic coating" -s year
```

---

### 二、group（聚合统计与趋势分析）

对符合条件的文献按不同维度做聚合统计，返回数量分布及百分比，并生成终端 ASCII 柱状图，非常适合分析领域发文趋势与机构/国家竞争力。

#### 1. 领域发文年份趋势分析（`--by year`）
```bash
bun paper.ts group -q "sintering alumina" --by year
```

#### 2. 国家/地区产出分布统计（`--by country`）
```bash
bun paper.ts group -q "ceramic coating" --by country
```

#### 3. 文献类型分布（`--by type`）与 OA 状态统计（`--by oa`）
```bash
bun paper.ts group -q "transparent ceramics" --by type
bun paper.ts group -q "solid oxide fuel cell" --by oa
```

#### 4. 在特定主题或期刊中组合统计
```bash
bun paper.ts group --topic T10132 --by country
bun paper.ts group --ceramics -y 2020-2026 --by type
bun paper.ts group -q "porcelain" --by lang
```

---

### 三、topics（主题体系主动查询）

在 OpenAlex AI 主题树中主动搜索关键词，查找主题代码 (Topic ID)、所属领域 (Field / Subfield) 及全库累计发文量。支持用 `-l` 指定返回结果数。

```bash
bun paper.ts topics "sintering"
bun paper.ts topics "porcelain" -l 20
```

---

### 四、inst（机构数据库主动查询）

在 OpenAlex 机构库中主动搜索大学、科研院所或企业名称，查找机构 ID (Inst ID)、国家代号及学术产出总数。支持用 `-l` 指定返回结果数。

```bash
bun paper.ts inst "Jingdezhen"
bun paper.ts inst "Tsinghua University" -l 20
```

---

### 五、info（单篇与批量文献精读）

通过 DOI 或 OpenAlex ID 获取单篇或批量文献的完整信息卡片：作者及机构、来源期刊、发表日期、被引次数、OA 状态、PDF 直链、AI 主题分类和重构摘要。

#### 1. 单篇文献精读
```bash
bun paper.ts info 10.1111/jace.19034
bun paper.ts info W4316223405
```

#### 2. 批量 DOI / ID 精读（支持管道符或多个参数）
一次性获取多篇文献卡片，并生成汇总表格。
```bash
bun paper.ts info 10.1111/jace.19034 10.1016/j.jeurceramsoc.2021.01.001
bun paper.ts info "10.1111/jace.19034|10.1016/j.jeurceramsoc.2021.01.001"
```

#### 3. 导出文献报告为 Markdown 文件
使用 `--save` 将单篇或批量文献卡片与完整摘要导出到本地 `.md` 文件。不指定文件名时自动生成合理文件名。
```bash
bun paper.ts info W4316223405 --save
bun paper.ts info 10.1111/jace.19034 10.1016/j.jeurceramsoc.2021.01.001 --save ceramic_papers.md
```

---

### 六、download（OA 全文 PDF 下载）

一键下载开放获取（OA）文献的 PDF 全文到本地。自动提取完整 PDF 直链并下载。

```bash
bun paper.ts download W4319030111
bun paper.ts download 10.1111/jace.19034 -o laser_ceramics.pdf
```

---

### 七、查看帮助信息

随时可以在终端输入以下命令查看命令帮助菜单：

```bash
bun paper.ts help
bun paper.ts -h
bun paper.ts --help
```

---

## 期刊代号对照表（`-j` 选项）

| 代号 | 期刊全名 | 领域 |
| :--- | :--- | :--- |
| `jacs` | Journal of the American Ceramic Society | 美国陶瓷 |
| `jecs` | Journal of the European Ceramic Society | 欧洲陶瓷 |
| `ci` | Ceramics International | 陶瓷综合 |
| `jac` | Journal of Advanced Ceramics | 先进陶瓷 |
| `jncs` | Journal of Non-Crystalline Solids | 玻璃/非晶 |
| `solgel` | Journal of Sol-Gel Science and Technology | 溶胶凝胶 |
| `acta` | Acta Materialia | 材料科学（含陶瓷机理） |

---

## 文献类型表（`-t` 选项）

| 值 | 含义 |
| :--- | :--- |
| `article` | 期刊研究论文（最常用） |
| `review` | 综述 |
| `book-chapter` | 书章 |
| `preprint` | 预印本（arXiv 等） |
| `dataset` | 数据集 |
| `dissertation` | 博士论文 |
| `book` | 专著 |
