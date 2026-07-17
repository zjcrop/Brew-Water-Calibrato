# GitHub Pages 部署说明

目标仓库：`zjcrop/Brew-Water-Calibrato`

## 一、上传文件

1. 解压本压缩包。
2. 打开仓库：https://github.com/zjcrop/Brew-Water-Calibrato
3. 进入 `main` 分支根目录。
4. 上传压缩包内的全部文件，确保 `index.html` 位于仓库根目录，而不是多套一层文件夹。
5. 提交更改。

根目录应至少包含：

```text
index.html
.nojekyll
README.md
DEPLOYMENT.md
```

## 二、开启 GitHub Pages

1. 进入仓库 `Settings`。
2. 左侧选择 `Pages`。
3. 在 `Build and deployment` 中，将 `Source` 设为 `Deploy from a branch`。
4. Branch 选择 `main`。
5. Folder 选择 `/(root)`。
6. 点击 `Save`。

## 三、访问地址

```text
https://zjcrop.github.io/Brew-Water-Calibrato/
```

首次发布或更新后通常需要等待数分钟。若页面仍显示旧版本，先确认 `main` 根目录中的 `index.html` 已更新，再使用浏览器无痕窗口或强制刷新。

## 四、常见错误

- `index.html` 被放在 `Brew-Water-Calibrato-GitHub-Pages-v2.3/index.html` 这一子目录内：Pages 根地址会找不到入口。
- Pages 来源选成 `/docs`，但文件实际在根目录：应改为 `/(root)`。
- 上传后未提交：仓库文件不会更新。
- 浏览器缓存：可使用无痕窗口检查。
