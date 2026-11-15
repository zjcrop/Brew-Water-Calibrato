# 萃离｜Coffee & Tea Water Calibrator 2.8.0

面向咖啡与茶冲泡的RO水复矿、配方计算及操作核验工具。

- 网页版本：2.8；Android版本：2.8.0，versionCode 20800。
- 统一化学计量核心：1.1.0；跨项目water-formulation/1.0契约继续保留。
- 保留咖啡与茶、半有机与无机盐、风味预算、预混母粉及配方水模式。
- 新增准确配比联动、独立调量、批次纯度、常见水合盐、称量顺序、量化后离子复核和实时提示。

详见 [升级说明](docs/RELEASE_v2.8.md) 与 [研究依据和验证边界](docs/SCIENCE_AND_VALIDATION_v2.8.md)。原2.7茶类研究和2.6.1审核保留作历史记录。

## 运行与验证

需要Node.js 22以上，执行npm ci后：

- npm run check：语法、算术、求解、数据提取、量化、微调和称量回归。
- npm run prepare:web：构建同源网页、核心与校验数据包。
- npm run preview：打开本地HTTP服务，浏览器访问 http://127.0.0.1:8768/ 。
- npm run test:browser：需要Playwright；支持PLAYWRIGHT_MODULE_PATH与BROWSER_EXECUTABLE环境变量。

本版使用本地ES模块，通过HTTP或Android加载；不要直接以file协议打开index.html。

## 发布

GitHub Pages与Android工作流均会校验共享核心。Android工作流版本为2.8.0；只在实际构建成功后提供APK，不将网页验证等同设备测试。仓库本地变更不会自动更新已发布网站或用户手机。

## 计算边界

GH与碳酸盐碱度贡献分别计算；含有机盐时不将理论贡献当成完整滴定碱度。不从TDS反推pH，不提供缺少平衡数据的真实结合率或沉淀率。豆型参数与风险筛查是对照起点，需实液与杯测验证。

## ⚠️ 跨项目稳定数据格式（后续开发强制规则）

Brew-Water-Calibrato 是水质与复矿数据提供方。跨项目传递的业务水质对象只依赖字段、类型、单位和语义，不依赖网页、Android 或核心算法版本。传输层可保留独立协议元数据，但不得把应用版本当作业务格式。

与其他项目交换时使用 water 对象：

| 字段 | 含义 | 单位/约束 |
|---|---|---|
| profileId、source | 水型与水源/配方来源 | 稳定标识或文本 |
| recipeVolumeL | 配制或使用体积 | L |
| tdsMgL | TDS/总溶解固体 | mg/L；不得反推 pH |
| pH、pHSource | 酸碱度及来源 | 无量纲；标注实测或计算来源 |
| calciumMgL、magnesiumMgL、sodiumMgL | 钙、镁、钠 | mg/L |
| bicarbonateMgL | 碳酸氢根 | mg/L |
| alkalinityMgLAsCaCO3 | 总碱度 | mg/L as CaCO₃ |
| chlorideMgL、freeChlorineMgL、ironMgL | 氯离子、游离氯、铁 | mg/L，注明测定对象 |

字段缺失表示未提供，不表示零；未知值不得用零填充。TDS、pH、游离氯和铁的测量边界必须保留来源说明。

本项目负责水质测量、复矿计算、风险评估及证据边界，不把内部配方模型或数据库表直接当成跨项目接口。不得用 TDS 或 HCO₃⁻ 静默推导 pH，也不得声称母粉配方消除源水中的游离氯或铁。

只允许新增字段；禁止复用字段改变含义。字段改名必须在适配层双读并规范化输出。任何浓度、体积或 pH 类型错误必须显式拒绝。
