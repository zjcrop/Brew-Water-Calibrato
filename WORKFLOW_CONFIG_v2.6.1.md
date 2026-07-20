# 萃离 v2.6.1 永久部署与工作流配置

## 在线地址

<https://zjcrop.github.io/Brew-Water-Calibrato/>

## 目标状态

永久部署完成后：

- 根目录 `index.html` 直接包含 `CUI_LI_V261_PATCH`；
- 页面标题为“配方2.6.1版”；
- `package.json` 和 `package-lock.json` 为 2.6.1；
- `android/app/build.gradle` 为 `versionCode 20601`、`versionName "2.6.1"`；
- Pages 和 APK 工作流不再执行补丁脚本；
- 一次性迁移工作流完成后自动删除自身。

## 首次永久迁移

工作流：

```text
.github/workflows/permanent-v2.6.1-migration.yml
```

上传到 `main` 后会自动运行，也可以在 Actions 页面手工运行。

该工作流需要：

```text
Settings → Actions → General → Workflow permissions
```

选择：

```text
Read and write permissions
```

并允许 GitHub Actions 创建和批准需要的提交权限。

## Pages 工作流

```text
.github/workflows/deploy-pages.yml
```

设置：

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

该工作流只部署已经永久写入仓库的 2.6.1 源码。

## Android 工作流

```text
.github/workflows/build-android-debug.yml
```

输出：

```text
Brew-Water-Calibrato-v2.6.1-debug.apk
```

工作流会验证源码、package 版本和 Android 版本，不再临时修改版本号。

## 失败排查

### 迁移工作流无法推送

检查 Actions 的 `Workflow permissions` 是否为 `Read and write permissions`，以及 `main` 分支保护是否禁止 GitHub Actions 直接提交。

### Pages 验证失败

说明 `index.html` 尚未永久迁移。先完成 `Permanent migrate Brew Water v2.6.1`。

### APK 验证失败

检查：

- `package.json`：2.6.1；
- `package-lock.json`：2.6.1；
- `android/app/build.gradle`：20601 / 2.6.1；
- `index.html`：包含 `CUI_LI_V261_PATCH`。
