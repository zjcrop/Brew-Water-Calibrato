# [在线访问：萃离｜咖啡冲煮调水](https://zjcrop.github.io/Brew-Water-Calibrato/)

> GitHub Pages：<https://zjcrop.github.io/Brew-Water-Calibrato/>

# 萃离｜Brew Water Calibrator

面向手冲咖啡的配水计算与配方审核工具。项目以 RO 水复矿为基础，支持无机盐、半有机盐、硅添加路径、豆种定向预设、风味微调、离子负载评估、TDS 估算、沉淀风险和 Android 封装。

## 当前版本

- 网页版本：**2.6.1**
- Android 版本：**2.6.1**
- Android 包名：`com.zjcrop.brewwater`
- GitHub Pages 入口：`index.html`
- 发布方式：源码永久写入，不再依赖构建阶段临时补丁

## v2.6.1 更新内容

### TDS 与操作精度

- TDS 主值按 **5 ppm** 步进显示，避免无意义的过高精度。
- 动态给出 **±5～9 ppm** 的日常操作控制带。
- 以低对比小字保留 **0.1 ppm** 模型精确值，仅供复核。
- 明确区分“工程操作控制带”和“实验室测量不确定度”。

### 每 5 L 粉剂称量

- 推荐称量值保留到 **0.01 g**。
- 同时显示允许称量范围。
- 以小字保留 **0.001 g** 模型精确值。
- 称量范围综合 TDS 估算偏差、总粉量和沉淀负载。

### 花香与涩感审核

- 下调花香端过高的 Mg 目标和 MgSO₄ 驱动。
- 提高花香方案的最低缓冲边界。
- 半有机体系降低 MgSO₄ 权重，提高乳酸镁权重。
- 将原“硫酸根干涩”升级为“干涩／收敛综合风险”，综合考虑 SO₄²⁻、Mg²⁺、二价离子空载率和低碱度。

### K/Na 等碱度再平衡

- 适度减少 KHCO₃ 承担的缓冲当量。
- 等当量增加 NaHCO₃，**不降低 HCO₃⁻总量**。
- 默认 K⁺约控制在 **6～9 mg/L**，Na⁺约控制在 **4～9 mg/L**。
- 分别显示缓冲当量比例和按 mg/L 计算的质量比例，避免混用两个口径。

### 部署与构建

- `index.html` 永久写入 2.6.1。
- GitHub Pages 工作流直接部署仓库当前源码。
- Android 工作流直接验证 2.6.1 并生成 Debug APK。
- APK 构件名称：`Brew-Water-Calibrato-v2.6.1-debug`。

## 主要功能

- 豆种／处理风格定向水质预设；
- 花香、甜感、酸质、抑苦／抑涩风味预算；
- 无机盐与半有机盐配方；
- Ca²⁺、Mg²⁺、Na⁺、K⁺及主要阴离子负载；
- 碱度、总硬度、结合负载、空载率和沉淀负载；
- 质量折算 TDS 与电导等效 TDS；
- K/Na 缓冲分配；
- 水垢、浑浊、盐感、碱感、干涩及硅路径风险；
- GitHub Pages 网页端和 Capacitor Android 应用。

## 仓库结构

```text
Brew-Water-Calibrato/
├─ index.html
├─ assets/
├─ android/
├─ scripts/prepare-web.mjs
├─ package.json
├─ package-lock.json
├─ capacitor.config.json
├─ FORMULA_AUDIT_v2.6.1.md
├─ WORKFLOW_CONFIG_v2.6.1.md
└─ .github/workflows/
   ├─ deploy-pages.yml
   └─ build-android-debug.yml
```

## 永久迁移

首次从 2.5 升级时，上传本包后运行一次：

```text
Permanent migrate Brew Water v2.6.1
```

该工作流会：

1. 校验原始 2.5 基线；
2. 永久修改 `index.html`；
3. 同步更新 `package.json`、`package-lock.json` 和 Android 版本；
4. 提交到 `main`；
5. 从仓库中删除一次性迁移工作流自身。

迁移成功后，Pages 和 APK 工作流直接使用永久源码，不再执行临时补丁。

## GitHub Pages

工作流：

```text
.github/workflows/deploy-pages.yml
```

仓库设置：

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

## Android APK

工作流：

```text
.github/workflows/build-android-debug.yml
```

构建环境：

- Node.js 22.16.0
- Java 21
- Android SDK 36
- Capacitor 8.4.2

构建成功后下载：

```text
Brew-Water-Calibrato-v2.6.1-debug
```

解压后得到：

```text
Brew-Water-Calibrato-v2.6.1-debug.apk
```

当前为 Debug APK，适合真机测试和功能验证，不等同于固定签名的正式发行包。

## 本地运行

```bash
python -m http.server 8000
```

访问：

```text
http://localhost:8000
```

## 技术与使用边界

- TDS 笔通常由电导率换算，不直接测量盐类总质量。
- TDS、结合负载、沉淀风险和感官风险属于工程估算，不等同于实验室检测或人体感官阈值。
- 原料化学式、水合状态、纯度、吸湿情况及批次 COA 会影响实际称量结果。
- 饮用配方原料必须独立核验食品用途合规性。
- 涩感还受研磨、水温、萃取时间、流速、搅动、滤杯结构及咖啡豆本身影响。

## 版本资料

- [配方与显示联合审核](FORMULA_AUDIT_v2.6.1.md)
- [工作流配置与部署说明](WORKFLOW_CONFIG_v2.6.1.md)
