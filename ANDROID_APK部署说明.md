# 萃离 Android APK 自动构建说明（2.4）

## 这次更新包含什么

- APP 图标：已改为水滴图形。
- 首页视觉：已改为新版“萃离 / BrewIon”起始页面海报。
- 关于页面：加入小红书与个人微信二维码，仅嵌入二维码并附文字说明。
- Android 工程：已直接包含在仓库包中，GitHub Actions 会基于该工程同步网页资源并编译 APK。

## 你现在要做什么

1. 下载并解压本压缩包。
2. 将内部全部文件和文件夹上传覆盖到仓库 `zjcrop/Brew-Water-Calibrato` 的 `main` 分支根目录。
3. 提交后，进入 GitHub 仓库的 `Actions` 页面。
4. 找到工作流 **Build Android Debug APK**。
5. 等待它完成；成功后在该运行页面底部 `Artifacts` 区域下载 `Brew-Water-Calibrato-v2.4.0-debug`。
6. 解压 artifact 后即可得到 APK 文件。

## 当前构建特征

- 应用名称：萃离
- Android 包名：com.zjcrop.brewwater
- 版本号：2.4.0
- 输出：Debug APK
- 适用：真机测试、界面验证、功能联调

## 说明

当前仍为 Debug APK，不适合作为长期正式更新包。待这一步跑通后，下一步再继续做固定签名的 Release APK / AAB。
