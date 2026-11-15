# 萃离2.8.1：单次加热与LuckyBean用水记录

Android版本2.8.1，versionCode20801，包名com.zjcrop.brewwater。

[下载Android APK](https://github.com/zjcrop/Brew-Water-Calibrato/releases/download/v2.8.1/Brew-Water-Calibrato-v2.8.1.apk) · [网页版](https://zjcrop.github.io/Brew-Water-Calibrato/)

本次公开版本同时包含2.8计算引擎升级、盐量联动/独立微调、批次纯度与水合盐核算、称量顺序、亲水SiO₂名义量、单次加热建议；首页海报保留底部、裁去多余空白，“关于”入口改为“声明”。

范围：新配水单次加热至本次冲煮温度后使用。保留2.8.0的配方、称量、硅粉、微调联动与化学计量修正。

## 行为

- 方案页增加单次加热折叠项：设备、最高温度、可选蒸发损失、可见沉积；可录入同方法前后GH和总碱度。
- 仅成对实测给差值，不用投料计算结果冒充加热前实测，也不把GH差单独转成钙损失。
- 蒸发倍率只在“无反应的保守溶质”假设下展示；热后Ca/Mg/HCO₃、起析温度、pH和LSI保持未知。
- 没有设置60/80/90/100°C的通用失效阈值，不自动修改LuckyBean冲煮温度和时间。
- 新增water JSON下载：稳定水质字段按原单位保留，增加concentrationBasis和heatingAssessment。未测总碱度/TDS/pH保持null；导出体积为实际配方水量，母粉模式为5L取用基准。
- 热史或体积输入不合法时清除旧结果并禁用导出；本模块不作意式锅炉结垢/腐蚀合规判定。
- Android使用系统文件保存对话框导出JSON，写入成功、用户取消和失败分别提示；网页继续使用浏览器下载。

## 验证

2026-11-15：77项Node测试通过，包含10项导出路径、UTF-8大小、并发及失败边界回归；项目子路径下移动/桌面浏览器验证13组行为通过，无模块404、无未捕获异常。真实输入验证单次93/100°C不改名义离子，蒸发5%只给1/0.95参考，错误输入禁用旧记录导出，JSON实际下载内容核对通过。首页短屏、底部署名及声明按钮已另行检查；Android导出的成功、取消、写入失败已做网页端桥接模拟，不等同于真机SAF测试。

研究及待做实液矩阵见[单次加热资料](https://github.com/zjcrop/Brew-Water-Calibrato/blob/main/docs/THERMAL_WATER_GUIDANCE.md)。这些是代码、数据边界和界面验证；未进行实液加热、测定、杯测或Android真机测试。LuckyBean消费者端的本机适配单独记录，本次发布不自动升级LuckyBean。

## Android安装

发布工作流使用固定私钥构建release APK，验证签名及包内关键资源，并提供SHA-256校验文件。本版开始启用固定发布证书；旧版若为其他证书的调试包，Android可能拒绝直接覆盖，需先记录或备份设置后卸载旧版安装。后续正式版使用同一证书。

## 运行

Node.js22以上，使用npm ci、npm run check、npm run prepare:web、npm run preview。浏览器测试见scripts/browser-smoke.mjs。Android由GitHub Actions的JDK21/SDK36环境构建，本机未配置Android SDK。
