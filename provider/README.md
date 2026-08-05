# Brew-Water-Calibrato Provider Layer

该目录把独立调水应用转换为 LuckyBean 和 BrewProfiles 可稳定消费的数据与纯计算提供方，同时不复制第二份盐类或水型数据库。

## 单一数据闭环

- 盐类 `MAT`、离子摩尔质量 `IONM`、目标水型 `PROFILE` 由独立应用统一维护；
- 每次构建从 `index.html` 静态抽取上述常量，不执行页面脚本；
- 抽取结果经过化学结构校验并生成版本化数据包；
- 独立应用、Android包、GitHub Pages和外部消费者均打包同一 `water-engine.mjs` 与同一数据包；
- 数据或核心改变后，提供方工作流自动生成 Manifest、SHA-256和发布物。

## 计算边界

核心提供：

- 盐质量到离子 mg/L 的化学计量换算；
- 原料纯度修正；
- 电荷平衡诊断；
- 非负约束配方求解；
- 天平分辨率量化及允许区间；
- 配方残差、假设和风险警告。

核心不伪造：

- 电导率仪意义上的实测TDS；
- 缺少碳酸平衡、CO2、温度和活度信息时的pH；
- 低溶解度盐完全溶解或不会沉淀的实验事实。

## 构建验证

```bash
npm test
npm run check
npm run prepare:web
```
