# PubChem 终端检索工具 (Chem) 使用指南

本脚本利用 **PubChem PUG REST API**，专为材料科学家、陶瓷工程师及科研人员设计，可在终端快速检索化学原料、无机氧化物及化合物的物理化学属性与 GHS 实验室安全数据（MSDS）。

100% 零依赖、无需 API Key，结果在终端以响应式横向网格表格优雅呈现。

---

## 2 个核心功能总表

| 功能命令 | 名称 | 适用场景说明 |
| :--- | :--- | :--- |
| `info` | 理化属性检索 | 获取化学品的 IUPAC 名称、化学式（含数字下标）、分子量、CAS 号、SMILES、熔点、沸点与密度数据。支持名称与化学式直接检索。 |
| `safety` | GHS 安全数据 | 查看化学品的 GHS 危险等级信号词（如 DANGER / WARNING）及高亮提示的 GHS 危险说明（H 代码通报）。 |

---

## 准备工作

本脚本无需配置 API Key，零依赖运行。请确保本地已安装 [Bun](https://bun.sh/) 运行时，在脚本所在目录下直接运行即可：

```bash
cd scripts/chem
```

---

## 各核心功能命令行详解

### 一、info

用于检索化合物或无机氧化物的基础理化参数。

#### 1. 基础英文名称检索
直接输入化合物的标准英文名称，快速获取核心信息与理化性质。
```bash
bun chem.ts info "Oxygen"
bun chem.ts info "Ethanol"
bun chem.ts info "Aspirin"
```

#### 2. 化学式 / 氧化物直接检索
支持直接输入化学式（如氧化物 `Al2O3`、`SiO2`、`Fe2O3` 等），脚本会自动识别 CID 并将化学式转换为标准角标（如 `Al₂O₃`）：
```bash
bun chem.ts info "Al2O3"   # 氧化铝
bun chem.ts info "SiO2"    # 二氧化硅 / 石英
bun chem.ts info "Fe2O3"   # 氧化铁
```

#### 3. 陶瓷与材料常见原料检索示例
针对陶瓷与材料工程中常用的基础原料：
```bash
bun chem.ts info "TiO2"          # 钛白粉 / 氧化钛
bun chem.ts info "ZrO2"          # 氧化锆
bun chem.ts info "BaCO3"         # 碳酸钡
bun chem.ts info "Yttrium oxide" # 氧化钇
```

---

### 二、safety

用于实验室安全管理，快速查阅化学品的 GHS 危险等级与危险说明（MSDS/GHS）。

#### 1. 基础安全数据查询
查询化学品的危险等级信号词（`DANGER` / `WARNING`）及具体的 GHS 危险说明。
```bash
bun chem.ts safety "Oxygen"
bun chem.ts safety "Barium carbonate"
```

#### 2. 强酸强碱与危险品安全通报
针对腐蚀性、毒性或强危险品，脚本高亮显示对应的 H 代码通报（如 H314、H290 等）：
```bash
bun chem.ts safety "Sulfuric acid"
bun chem.ts safety "Hydrofluoric acid"
```

---

## 技术特性与设计亮点

1. **PubChem API 实时直连**：直接聚合美国国家医学图书馆（NIH）PubChem 权威数据库，实时获取最新数据。
2. **化学式数字下标化**：自动将输入的化学式数字转化为标准角标（如 `Al2O3` → `Al₂O₃`，`C9H8O4` → `C₉H₈O₄`）。
3. **ANSI 单元格自适应折行**：单元格内部具备 ANSI 感知的多行自动折行算法，无论文本多长（如多段密度数据或长 GHS 说明），表格线框永远不溢出断线。
4. **终端响应式居中卡片**：结合 Terminal 窗口列数自动进行全局居中对齐与边距自适应，带来极佳的终端视效体验。
