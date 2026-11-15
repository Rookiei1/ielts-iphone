# IELTS Practice (雅思练习) TestFlight 发布说明

## 应用与签名标识

- **GitHub 仓库**: `Rookiei1/ielts-iphone` (分支 `main`)
- **应用名称**: `雅思练习` (`CFBundleDisplayName` / `capacitor.config.json`)
- **App Store Connect 名称**: `IELTS Practice`
- **Bundle ID**: `com.rookiei1.ieltspractice`
- **SKU**: `ielts-iphone-001`
- **Team ID**: `NGV55K28X8`
- **Xcode 工程**: `ios/App/App.xcodeproj` (Scheme: `App`, Configuration: `Release`)
- **签名方式**: Fastlane `match` (`appstore`), 私有签名仓库分支 `signing-assets-v2`（复用现有 Apple Distribution 证书）

## GitHub Secrets 映射

- `ASC_KEY_ID`: App Store Connect API Key ID
- `ASC_ISSUER_ID`: App Store Connect Issuer ID
- `ASC_PRIVATE_KEY`: `.p8` 私钥内容（由 `ci/prepare_apple_key.py` 在 `RUNNER_TEMP` 中生成临时 JSON/.p8）
- `MATCH_PASSWORD_NEXT`: `signing-assets-v2` 签名加密口令（工作流内映射为 `MATCH_PASSWORD`）
- `SIGNING_STORE_URL`: 私有签名仓库地址
- `SIGNING_DEPLOY_KEY`: 私有签名仓库 SSH 部署密钥
- `SIGNING_CERTIFICATE_ID`: 预期复用的 Distribution 证书 ID

## 发布工作流

1. **构建与检查 (`.github/workflows/test.yml`)**: 在 `macos-26` 上构建前端资源，逐篇检查 242 篇题目在 Chromium/WebKit 的渲染、判分和插图，并在两款 iPhone 模拟器中实际打开题目、输入、提交、重启恢复作答。
2. **TestFlight 发布 (`.github/workflows/testflight.yml`)**:
   - `action=diagnose`: 只读检查 Developer App ID、App Store Connect 应用记录、Distribution 证书及签名配置状态。
   - `action=bootstrap`: 在不新建/撤销证书的前提下，为 `com.rookiei1.ieltspractice` 补齐 App Store 描述文件。
   - `action=release`: 以 `readonly: true` 解密证书与描述文件，手动签名导出 `IELTSPractice.ipa`，运行 `ci/verify_release.py` 校验 `.xcarchive` 与 `.ipa` 后上传 TestFlight。
   - `action=status`: 只读查询 Apple 处理状态和现有内部测试组的构建访问情况。
   - 可指定 `validation_run`：并行完成签名打包，但只有所选原生验收运行明确成功后才上传；验收失败则停止发布。

发布构建强制包含 242 篇正式题目及插图，不包含原创测试示例和原桌面运行时。上传后等待 Apple 处理完成，并查询已有内部测试员是否可访问本次构建。

## 已验证发布记录

### 2026-11-15 — 1.1.0（Build 4）纯做题版，已可更新

只保留 242 篇题库、文章/题目切换、作答及提交判分，自动保存当前作答。使用独立页面与判分实现，不打包原桌面运行时。

- 应用修复代码：`34d89d1`；发布提交：`7e50f2b`。后续测试手势与发布等待逻辑的修改没有改变应用代码、题库转换或手机工程。
- Chromium 与 WebKit：逐篇验证 242 篇题目的渲染、3252 个评分点、4 张插图，以及错误答案、返回和重启保存。
- [iPhone 16e 验收](https://github.com/Rookiei1/ielts-iphone/actions/runs/43727265527)：114.972 秒，0 失败。
- [iPhone 17 Pro Max 验收](https://github.com/Rookiei1/ielts-iphone/actions/runs/43730175123)：117.056 秒，0 失败。两台均使用 iOS 26.2，实际打开正式题库文章，再完成填空、选项选择、收键盘、6/6 判分、重启恢复、重做与立即返回保存。大屏通过可见区域内的实际滚动到达输入框，并确认输入值。
- 已修复键盘弹出后的整页偏移；输入时只在作答区内滚动。实际截图见 `docs/screenshots/practice-native-keyboard.png`。
- [TestFlight 发布](https://github.com/Rookiei1/ielts-iphone/actions/runs/43730366354)：构建与 IPA 校验通过，包含 242 篇正式题、0 篇测试示例；原生验收通过后上传。
- Apple 于 2026-11-15 15:43 UTC 完成处理：`VALID`、`IN_BETA_TESTING`、未过期；现有内部测试组有 1 名测试员并自动访问新构建，`availableToExistingInternalTesters=true`。在 TestFlight 中更新 IELTS Practice 至 **1.1.0（4）**，不需重新邀请或导入题库。
- Build 3 已由 Build 4 取代；更新时选择 Build 4，包含大屏键盘修复。
- 以上为模拟器与浏览器验收，不包含用户真机实测；未提交外部 Beta 审核。

- **2026-11-14 — v1.0.0 (Build 2)**:
  - **更新内容**: 全面重构 iPhone 原生风 UI（移除桌面端背景/模糊提示胶囊/错位底部滑动条，修复安全区与单栏排版、精简设置与记录卡片），并修复做题页白屏（先渲染题目再异步读取 IndexedDB 偏好并加超时保护，固定子 `WKWebView` Auto Layout 约束与 iOS CSS 注入顺序）。
  - **测试流水线 (`Test`)**: https://github.com/Rookiei1/ielts-iphone/actions/runs/43586849180 (commit `5a5f277`，通过 Web 构建、Python/Node 单测、Playwright 手机端流程测试、Plist 校验与未签名 iOS Simulator 构建)
  - **TestFlight 发布 (`TestFlight Release`)**: https://github.com/Rookiei1/ielts-iphone/actions/runs/43587053440 (`Uploaded IELTS Practice v1.0.0 (2) to TestFlight`，Apple 已完成处理)
- **2026-11-14 — v1.0.0 (Build 1)**:
  - **测试流水线 (`Test`)**: https://github.com/Rookiei1/ielts-iphone/actions/runs/43582885195 (通过: Web 构建、Python/Node 单测、Playwright 手机端流程测试、Ruby/Plist 校验与未签名 iOS Simulator 构建)
  - **TestFlight 发布 (`TestFlight Release`)**: https://github.com/Rookiei1/ielts-iphone/actions/runs/43582886001 (`upload_to_testflight` 成功，Apple 已处理完成 `1.0.0 - 1` for iOS，App ID `6834748437`)
  - **状态说明**: 内部团队测试构建已处理完成；真机安装测试由用户在 iPhone TestFlight 客户端验证，未提交外部 Beta 审核。
