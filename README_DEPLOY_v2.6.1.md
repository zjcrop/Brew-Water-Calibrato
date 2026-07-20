# Brew-Water-Calibrato v2.6.1 完整增量部署包

本包基于`zjcrop/Brew-Water-Calibrato`当前2.5源码，一次性合并：

- TDS允许误差和低精度主显示；
- 每5L粉剂允许称量范围；
- 精确值小字备注；
- 全部预设的Mg/SO₄/碱度审核；
- 花香涩感修正；
- 等碱度K/Na再平衡；
- GitHub Pages工作流；
- Android 2.6.1 Debug APK工作流。

## 最简部署

1. 解压本包。
2. 上传全部文件到仓库根目录并覆盖同名文件。
3. 将Pages Source设为GitHub Actions。
4. 查看两个Actions工作流。
5. 下载`Brew-Water-Calibrato-v2.6.1-debug`构件。

详细步骤见`WORKFLOW_CONFIG_v2.6.1.md`。
