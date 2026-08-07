# [在线访问：萃离｜咖啡与茶冲泡调水](https://zjcrop.github.io/Brew-Water-Calibrato/)

> GitHub Pages：<https://zjcrop.github.io/Brew-Water-Calibrato/>

# 萃离｜Coffee & Tea Water Calibrator

面向咖啡与茶冲泡的RO水复矿、配方计算和水质风险评估工具。

## 当前版本

- 网页版本：**2.7**
- Android版本：**2.7.0**
- Android包名：`com.zjcrop.brewwater`
- 发布方式：从永久版2.6.1迁移，迁移后源码直接保留咖啡与茶双模式。

## v2.7核心更新

### 咖啡／茶双模式

- 保留原有全部咖啡预设、K/Na再平衡、TDS操作控制带和干涩风险模型。
- 新增饮品类型切换，茶模式不会混入咖啡预设列表。
- 茶模式默认使用低剂量无机盐复矿；半有机盐保留为实验路径，不宣称为研究资料直接推荐。

### 六类茶叶针对性配方

- 绿茶：TDS 30–80 ppm，pH 6.5–7.0。
- 白茶：TDS 50–100 ppm，pH 6.5–7.0。
- 清香型乌龙：TDS 30–80 ppm，pH 6.5–7.0。
- 浓香／重焙乌龙：TDS 70–120 ppm，pH 6.8–7.2。
- 红茶：TDS 80–150 ppm，pH 6.8–7.5。
- 黑茶／熟普洱：TDS 100–200 ppm，pH 7.0–7.5。

### 茶类专用评估

- 实测源水pH；
- 游离氯；
- 铁离子；
- 茶膜／茶垢风险；
- 冷后浑风险；
- 香气压制风险；
- 按茶类输出水质建议、化学逻辑和感官风险。

## 重要技术边界

- pH不能由TDS或HCO₃⁻可靠反推，因此必须实测。
- TDS笔是电导换算，不使用固定的“电导率=某TDS”关系。
- 游离氯和铁来自源水，不能通过母粉配方消除。
- 资料中的铁离子`<2 ppm`不应解释为理想目标；茶多酚体系中应尽可能低。
- 不同茶类的Ca、Mg、HCO₃⁻中心值属于工程落地参数，TDS和pH边界来自研究汇总。

## 部署

上传本扩展包到仓库根目录，运行一次：

```text
Permanent migrate Brew Water v2.7
```

迁移工作流会更新`index.html`、`package.json`、`package-lock.json`和Android版本，然后删除自身。

Pages设置：

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

Android构件：

```text
Brew-Water-Calibrato-v2.7.0-debug
```

## 资料

- `TEA_WATER_AUDIT_v2.7.md`：茶类配方设计和证据边界。
- `WORKFLOW_CONFIG_v2.7.md`：永久迁移、Pages和Android工作流。

## ⚠️ 跨项目稳定数据格式（后续开发强制规则）

Brew-Water-Calibrato 是水质与复矿数据提供方。跨项目传递的业务水质对象只依赖字段、类型、单位和语义，不依赖网页、Android 或核心算法版本。传输层可保留独立协议元数据，但不得把应用版本当作业务格式。

与其他项目交换时使用 water 对象：

| 字段 | 含义 | 单位/约束 |
|---|---|---|
| source | 水源或配方来源 | 稳定标识或文本 |
| volume_l | 配制或使用体积 | L |
| tds_mg_l | TDS/总溶解固体 | mg/L；不得反推 pH |
| ph | 酸碱度 | 无量纲，标注实测或计算来源 |
| ca_mg_l、mg_mg_l、na_mg_l | 钙、镁、钠 | mg/L |
| hco3_mg_l | 碳酸氢根 | mg/L |
| alkalinity_mg_l_as_caco3 | 总碱度 | mg/L as CaCO₃ |
| cl_mg_l、fe_mg_l | 氯、铁 | mg/L，注明测定对象 |

字段缺失表示未提供，不表示零；未知值不得用零填充。TDS、pH、游离氯和铁的测量边界必须保留来源说明。

本项目负责水质测量、复矿计算、风险评估及证据边界，不把内部配方模型或数据库表直接当成跨项目接口。不得用 TDS 或 HCO₃⁻ 静默推导 pH，也不得声称母粉配方消除源水中的游离氯或铁。

只允许新增字段；禁止复用字段改变含义。字段改名必须在适配层双读并规范化输出。任何浓度、体积或 pH 类型错误必须显式拒绝。
