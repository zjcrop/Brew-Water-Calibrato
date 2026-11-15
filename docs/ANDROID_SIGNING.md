# Android发布签名

从2.8.1起，正式APK使用固定的RSA3072发布证书；包名为com.zjcrop.brewwater。公开证书为cuili-release-cert.pem，不包含私钥。

证书SHA-256：

```text
207665e48211537e8577578fcabc57d418eed218a25f908a257c36b81fd36cc7
```

工作流从GitHub Actions加密Secrets恢复PKCS12密钥，使用release构建并通过apksigner验证。仓库与发布附件不包含私钥、密钥库或密码。

后续版本应持续使用同一证书。旧版本若使用其他调试证书，不能保证直接覆盖；只有同包名、同签名且版本号合适的APK才能正常升级。正式下载说明见README。

维护者所需Secrets：CUILI_ANDROID_KEYSTORE_B64、CUILI_ANDROID_STORE_PASSWORD、CUILI_ANDROID_KEY_ALIAS、CUILI_ANDROID_KEY_PASSWORD。缺失时发布构建必须失败，不回退到临时调试签名。
