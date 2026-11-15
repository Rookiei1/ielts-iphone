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

1. **构建与检查 (`.github/workflows/test.yml`)**: 在 `macos-26` 上构建前端资源、执行 Python/Node/Playwright 浏览器测试、检查发布脚本并执行未签名模拟器构建。
2. **TestFlight 发布 (`.github/workflows/testflight.yml`)**:
   - `action=diagnose`: 只读检查 Developer App ID、App Store Connect 应用记录、Distribution 证书及签名配置状态。
   - `action=bootstrap`: 在不新建/撤销证书的前提下，为 `com.rookiei1.ieltspractice` 补齐 App Store 描述文件。
   - `action=release`: 以 `readonly: true` 解密证书与描述文件，手动签名导出 `IELTSPractice.ipa`，运行 `ci/verify_release.py` 校验 `.xcarchive` 与 `.ipa` 后上传 TestFlight。

## 已验证发布记录

### 1.1.0 手机界面重做（发布结果待本次流水线核对）

独立手机界面、单一安全区处理、阅读/题目切换、键盘避让、逐题复盘、会话恢复后作答，以及返回前持久化草稿确认。新增真实 iOS XCUITest 和两种 iPhone 原生截图；上传和可安装状态在验证后补充。

- **2026-11-14 — v1.0.0 (Build 2)**:
  - **更新内容**: 全面重构 iPhone 原生风 UI（移除桌面端背景/模糊提示胶囊/错位底部滑动条，修复安全区与单栏排版、精简设置与记录卡片），并修复做题页白屏（先渲染题目再异步读取 IndexedDB 偏好并加超时保护，固定子 `WKWebView` Auto Layout 约束与 iOS CSS 注入顺序）。
  - **测试流水线 (`Test`)**: https://github.com/Rookiei1/ielts-iphone/actions/runs/43586849180 (commit `5a5f277`，通过 Web 构建、Python/Node 单测、Playwright 手机端流程测试、Plist 校验与未签名 iOS Simulator 构建)
  - **TestFlight 发布 (`TestFlight Release`)**: https://github.com/Rookiei1/ielts-iphone/actions/runs/43587053440 (`Uploaded IELTS Practice v1.0.0 (2) to TestFlight`，Apple 已完成处理)
- **2026-11-14 — v1.0.0 (Build 1)**:
  - **测试流水线 (`Test`)**: https://github.com/Rookiei1/ielts-iphone/actions/runs/43582885195 (通过: Web 构建、Python/Node 单测、Playwright 手机端流程测试、Ruby/Plist 校验与未签名 iOS Simulator 构建)
  - **TestFlight 发布 (`TestFlight Release`)**: https://github.com/Rookiei1/ielts-iphone/actions/runs/43582886001 (`upload_to_testflight` 成功，Apple 已处理完成 `1.0.0 - 1` for iOS，App ID `6834748437`)
  - **状态说明**: 内部团队测试构建已处理完成；真机安装测试由用户在 iPhone TestFlight 客户端验证，未提交外部 Beta 审核。
