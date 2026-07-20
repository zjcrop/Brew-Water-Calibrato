# 萃离 v2.6.1 工作流配置与部署文档

## 一、包内工作流

### 1. GitHub Pages

路径：

```text
.github/workflows/deploy-pages.yml
```

作用：

1. 检出当前仓库；
2. 检查是否为已审核的2.5基线；
3. 在构建工作区应用v2.6.1组合补丁；
4. 复制`index.html`和`assets`到`_site`；
5. 上传Pages构件；
6. 部署到GitHub Pages。

### 2. Android Debug APK

路径：

```text
.github/workflows/build-android-debug.yml
```

作用：

1. 校验并应用同一v2.6.1补丁；
2. 使用Node 22.16.0；
3. 使用Java 21；
4. 安装Android SDK 36；
5. 执行Capacitor资源同步；
6. 设置`versionCode 20601`和`versionName 2.6.1`；
7. 构建Debug APK；
8. 输出APK、SHA256和配方审核说明。

输出构件：

```text
Brew-Water-Calibrato-v2.6.1-debug
└─ Brew-Water-Calibrato-v2.6.1-debug.apk
```

## 二、上传步骤

1. 解压部署包。
2. 打开仓库`zjcrop/Brew-Water-Calibrato`。
3. 确认分支为`main`。
4. 将解压后的文件上传到仓库根目录，保持目录结构。
5. 覆盖原有`.github/workflows/build-android-debug.yml`。
6. 确认新增：
   - `.github/workflows/deploy-pages.yml`
   - `scripts/patch_brew_water_v2_6_1.py`
   - `FORMULA_AUDIT_v2.6.1.md`
7. 提交到`main`。

建议提交说明：

```text
Apply Brew Water v2.6.1 calibration and K-Na rebalance
```

## 三、Pages设置

进入：

```text
Settings → Pages → Build and deployment
```

将`Source`设置为：

```text
GitHub Actions
```

随后在`Actions`页面检查：

```text
Deploy calibrated app to GitHub Pages
```

成功后网页地址仍为：

```text
https://zjcrop.github.io/Brew-Water-Calibrato/
```

## 四、APK下载

进入：

```text
Actions → Build Android Debug APK
```

打开最新成功运行，在页面底部`Artifacts`下载：

```text
Brew-Water-Calibrato-v2.6.1-debug
```

解压即可取得APK。

## 五、是否要先修改index.html

不需要。两个工作流都会在独立构建工作区自动应用补丁。

这意味着：

- 仓库原始`index.html`可以仍显示2.5；
- 实际Pages和APK输出为2.6.1；
- 工作流不会自动把修改后的`index.html`提交回仓库。

需要把源码永久写成2.6.1时，在仓库根目录执行：

```bash
python3 scripts/patch_brew_water_v2_6_1.py --root . --check
python3 scripts/patch_brew_water_v2_6_1.py --root . --in-place --backup
```

Windows也可以双击：

```text
apply-v2.6.1-local.bat
```

执行后检查并提交：

- `index.html`
- `package.json`
- `README.md`
- `PATCH_APPLIED_v2.6.1.txt`

## 六、常见故障

### 1. `scripts/patch_brew_water_v2_6_1.py`不存在

GitHub网页上传时目录未保持。重新上传`scripts`目录。

### 2. `.github`没有出现

GitHub网页批量上传可能忽略隐藏目录。单独创建或上传：

```text
.github/workflows/build-android-debug.yml
.github/workflows/deploy-pages.yml
```

### 3. `Verify v2.5 baseline`失败

当前`index.html`已不再是审核时的2.5结构。不要删除校验强行构建，应重新根据当前源码生成补丁。

### 4. Pages仍显示旧版

检查：

1. Pages Source是否为GitHub Actions；
2. `Deploy calibrated app to GitHub Pages`是否成功；
3. 浏览器或PWA缓存；
4. 是否访问了正确地址。

### 5. APK仍显示2.5

不要下载旧运行记录。确认最新构件名称包含`v2.6.1`。

## 七、K/Na显示口径

方案页原有“Na占Na+K”指标按离子mg/L质量计算。v2.6.1风险说明还会显示“Na缓冲当量占比”，该指标按摩尔/酸碱当量计算。

例如花香方案可以同时出现：

- Na缓冲当量占比约55%；
- 但按mg/L质量计，Na占Na+K约42%。

原因是K和Na的摩尔质量不同。部署后不要把两个百分比当作同一指标。
