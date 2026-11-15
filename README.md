# 雅思练习

只做题：选文章、切换文章/题目、作答、提交判分。完整 242 篇题库随安装包离线提供。退出或重启后保留当前作答。

TestFlight 已发布 **1.1.0（4）**，Apple 处理完成，现有内部测试账号可更新 IELTS Practice。两款 iPhone 模拟器的做题与重启保存验收已通过，详见 [发布记录](RELEASE.md)。

独立实现手机做题页面，只复用公开题库数据。不加载原桌面程序、弹窗会话和功能菜单。原有源码及验证材料作为历史参考保留，不参与打包。

```sh
npm ci
npm run build
npm test
npx cap sync ios
```

题库来源与固定版本见 [DATA_SOURCE.md](DATA_SOURCE.md)。构建时从固定公开版本读取数据库，不需要用户导入题库。浏览器回归逐篇验证 242 篇题目的渲染和判分；原生测试使用两款 iPhone 模拟器实际点题、输入、提交及重启恢复，通过后再发布 TestFlight。

测试用原创示例只在 `IELTS_TEST_FIXTURES=1` 时加入，发布包校验必须恰好包含 242 篇正式题目。发布记录及配置见 [RELEASE.md](RELEASE.md)。

iPhone 模拟器实际截图：[正式题目](docs/screenshots/practice-native-question.png)、[大屏键盘输入](docs/screenshots/practice-native-keyboard.png)、[提交判分](docs/screenshots/practice-native-result.png)。
