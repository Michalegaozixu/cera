# 原料库全局可用关键词列表 (Material Keywords Reference)

在终端运行查询脚本时，当你通过 `material` 关键字触发原料库检索时，你可以输入以下维度的关键词（支持跨维度组合搜索）。
例如：`material clay USA`、`material Feldspar SiO2>60 Na2O>5`

> **注意：** 原料库包含 7300 多条全球原料数据，因数量过于庞大，本列表仅列举核心的大类标签、常见的化学方程式检索格式以及主要产地，帮助你快速圈定搜索范围。

---

## 1. 原料分类 (Subtypes)
你可以直接输入这些分类名称，筛选出特定的原料类型：

* **Primitive** (原始矿物/未加工原料) - *3719 条*
* **Frit** (熔块) - *792 条*
* **Clay** (粘土/陶土) - *723 条*
* **Feldspar** (长石) - *568 条*
* **Colorant** (色剂/发色金属) - *562 条*
* **Flux** (助熔剂) - *506 条*
* **Miscellaneous** (杂项) - *116 条*
* **Ash** (草木灰) - *111 条*
* **Silica** (石英/硅石) - *91 条*
* **Opacifier** (乳浊剂) - *76 条*
* **Alumina** (氧化铝) - *43 条*

## 2. 常见产地国家 (Top Countries)
许多原料通过产地或品牌命名，通过添加国家英文名可以过滤出特定产区的材料（以下列出数据量前 20 的国家）：

* France (法国)
* Argentina (阿根廷)
* United States / USA (美国)
* Spain (西班牙)
* Brazil (巴西)
* Germany (德国)
* Russia (俄罗斯)
* Netherlands (荷兰)
* Switzerland (瑞士)
* United Kingdom / UK (英国)
* India (印度)
* New Zealand (新西兰)
* Japan (日本)
* Belgium (比利时)
* Australia (澳大利亚)
* Canada (加拿大)
* Turkey (土耳其)
* China (中国)
* Colombia (哥伦比亚)
* Austria (奥地利)

## 3. 高级：化学成分精准过滤 (Chemistry Filters)
这是原料库最强大的功能。你可以输入任意氧化物的化学式，并通过 `>`, `<`, `=` 以及具体的数值，进行毫秒级的无限条件筛选。

**支持的常见氧化物 (Oxides)：**
`SiO2`, `Al2O3`, `Fe2O3`, `CaO`, `MgO`, `Na2O`, `K2O`, `TiO2`, `MnO`, `P2O5`, `CoO`, `CuO`, `B2O3`, `BaO`, `SrO`, `ZnO`, `ZrO2`, `LOI` 等。

**组合搜索范例：**
* **寻找高硅低铝的熔块**：`material Frit SiO2>60 Al2O3<5`
* **寻找几乎不含铁的高岭土**：`material kaolin Fe2O3<0.1`
* **寻找富含钠的长石**：`material Feldspar Na2O>8 K2O<3`
* **寻找含特殊微量元素的色剂**：`material Colorant MnO>10`

---

## 4. 实战指令秘籍 (Command Playbook)
只要在开头加上 `material`（或 `原料`），后面的内容你可以**随意排列组合**。引擎完全**不区分大小写**，并且支持**无限量**的叠加条件。

### 场景 A：无脑叠加化学条件（极限微调配方）
当你为了平替某种原料，对氧化物有着极其严苛的要求时：
* 🔍 `material kaolin sio2>45 al2o3>35 fe2o3<0.5 tio2<0.2`
  *(解释：在全球寻找一款名为“Kaolin”的高岭土，要求硅大于45、铝大于35，同时必须是极低铁和极低钛的高纯净级别。全小写输入即可！)*

* 🔍 `material frit b2o3>15 zno>5 p2o5>1`
  *(解释：寻找含硼超过15%、含锌超过5%，并且含有少量磷酸盐的复杂熔块。)*

### 场景 B：地域 + 分类 + 核心元素（采购/寻源神器）
当你希望从特定国家采购特定成分的矿物时：
* 🔍 `material France Feldspar k2o>10`
  *(解释：仅在“法国 (France)”出产的“长石 (Feldspar)”中，寻找钾含量 (K2O) 大于 10% 的优质钾长石。)*

* 🔍 `material Spain Clay CaO>10`
  *(解释：寻找西班牙 (Spain) 出产的高钙粘土 (Clay)。)*

### 场景 C：追踪稀有金属/发色剂
想找含特定金属的色剂或原始矿物？不需要知道全名，直接指定化学式大于0：
* 🔍 `material coo>5` 
  *(解释：直接从7300条数据里，把所有氧化钴 (CoO) 含量大于5%的原料全部揪出来。)*
* 🔍 `material colorant MnO>30`
  *(解释：在色剂类 (Colorant) 中，寻找锰 (MnO) 含量极高的品种。)*

### 场景 D：俗名与厂商品牌（模糊盲搜）
除了化学式，您也可以直接把厂家的型号或者矿名扔进去：
* 🔍 `material bentonite` (搜膨润土)
* 🔍 `material dolomite` (搜白云石)
* 🔍 `material minasolo` (搜带有 Minasolo 品牌的特定矿源)

---
**💡 终极提示 (Pro-tip):**
* 所有的关键词只需用**空格**隔开。
* 顺序毫不重要，`material sio2>60 clay` 和 `material clay sio2>60` 结果完全一样。
* 随时按下 `0` 键，即可将你精心筛选出来的绝版数据导出为 CSV，在 Excel 里做进一步的学术分析！
