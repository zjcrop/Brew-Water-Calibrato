# 萃离 Android APK 自动构建部署说明（2.5）

## 本版改动
- APP 图标使用新上传的完整方形水滴图片，不进行内容裁切。
- 旧版 Android 图标仅缩放；自适应图标增加安全留白，尽量避免系统圆形/圆角矩形遮罩裁掉波浪线。
- “关于”内容最下方增加“返回”按钮。
- 风险页面在所有项目均为低风险时显示“返回”按钮。
- 该按钮会返回方案页，并自动定位到“各种物质用量”区域。
- GitHub Actions 工作流已加入 Android SDK、Gradle、CRLF 与 exit code 127 修复。

## 上传方法
1. 解压部署包。
2. 打开 GitHub 仓库 `zjcrop/Brew-Water-Calibrato`。
3. 确认当前分支为 `main`。
4. 选择 `Add file` → `Upload files`。
5. 上传解压目录内的全部内容，使 `index.html`、`android`、`assets`、`.github` 等直接位于仓库根目录。
6. GitHub 网页批量上传有时会忽略隐藏目录 `.github`。上传后务必检查：
   `.github/workflows/build-android-debug.yml`
7. 提交说明建议填写：
   `Update app icon and navigation to v2.5`
8. 提交到 `main` 后，进入 `Actions` → `Build Android Debug APK`。
9. 不要重新运行旧的失败记录，等待新提交自动产生的新任务。
10. 构建成功后，在运行页面底部的 `Artifacts` 下载：
    `Brew-Water-Calibrato-v2.5.0-debug`
11. 解压后得到：
    `Brew-Water-Calibrato-v2.5.0-debug.apk`

## 若 .github 没有上传
单独在仓库新建或编辑：
`.github/workflows/build-android-debug.yml`

内容以本部署包中的同名文件为准。
