# 雅思练习 · iPhone

离线雅思阅读练习。1.1.0 重新实现题库、记录、复盘、备份和练习页的手机界面，复用原有评分与持久化内核。

- 题库：关键词搜索、P1/P2/P3、频率筛选、收藏和套题。
- 练习：文章/题目切换、字体大小、计时、触屏配对、键盘收起与提交。
- 记录：成绩、逐题答案对照、备份导入导出。数据兼容原版本。
- 恢复：会话初始化并恢复草稿后启用作答；返回前等待草稿持久化回执。

## 开发与验证

```sh
npm ci
npm test
npm run build
npx playwright install chromium webkit
npm run test:browser
TEST_BROWSER=webkit npm run test:browser
npx cap sync ios
```

Windows 可用已安装 Chrome 测试：设置 `TEST_BROWSER_CHANNEL=chrome`。iOS 构建与 XCUITest 在 GitHub `macos-26` 上完成。测试工作流在两种 iPhone 模拟器上运行真实 WKWebView 流程，并保存原生截图。

默认包仅带原创示例。个人题库由 `tools/convert_private_bank.py` 转成 `private-data/reading-bank.zip`，传到手机“文件”，在“我的 → 导入阅读题库”导入。个人题库与学习数据不提交到公开仓库。

源码及第三方许可见 `third_party/ielts-practice/LICENSE`；发布身份与入口见 [RELEASE.md](RELEASE.md)。
