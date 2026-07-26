# 萃离 v2.7 工作流配置

## 一、部署顺序

1. 将扩展包全部文件上传至`zjcrop/Brew-Water-Calibrato`根目录。
2. 在Actions运行`Permanent migrate Brew Water v2.7`。
3. 迁移成功后，确认`index.html`包含`CUI_LI_V27_TEA_PATCH`。
4. 迁移提交会因`index.html`和版本文件变化自动触发Pages与Android；也可以手动运行。

## 二、永久迁移内容

- 网页标题更新为咖啡与茶调水2.7；
- 注入饮品模式切换、六类茶预设、源水输入和茶类风险评估；
- `package.json`和`package-lock.json`更新至2.7.0；
- Android更新至`versionCode 20700`、`versionName 2.7.0`；
- 删除一次性迁移工作流。

## 三、Pages

工作流直接发布永久源码，不在构建时临时打补丁。

## 四、Android

- 不执行`npm audit`；
- `npm ci`包含三次重试；
- 使用`npx --no-install cap sync android`，避免不必要的在线包解析；
- 输出`Brew-Water-Calibrato-v2.7.0-debug.apk`。

## 五、失败排查

若校验步骤失败，确认运行绑定的是迁移完成后的最新`main`提交，不要对旧提交使用`Re-run failed jobs`。

## 六、避免迁移前误触发

正式Pages和Android工作流的push路径不包含工作流文件本身。上传扩展包时不会因为仅替换YAML而先运行2.7校验；永久迁移提交修改`index.html`后才会触发正式构建。
