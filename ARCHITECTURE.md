# 网站代码结构

## 前台

- `src/main.jsx`：学生网站入口；`src/admin-main.jsx`：后台入口。
- `src/student-styles.js`、`src/admin-styles.js`：各入口的样式清单。顺序承接原有层叠关系，组件拆分不会改变界面样式。
- `src/App.jsx`：登录状态、学习状态同步、导航及页面外壳。
- `src/components/layout/`：侧栏和顶部栏；`src/views/HomeView.jsx`：首页。
- `src/views/StudyPages.jsx`：学生各页面的渲染组合，不持有登录或学习状态。
- `src/views/`：各功能页面；`src/components/`：共享界面组件。
- `src/components/DataTable.jsx`：后台表格；`src/lib/admin-labels.js`：后台状态和操作名称。
- `src/lib/api.js`：请求和错误处理；`src/lib/admin-api.js`：后台调用入口；`src/lib/api-messages.js`：共用文字规范化。
- `src/lib/`：路由、存储、搜索、阅读器、计时和教程等功能逻辑。

## 后端

- `server/api.mjs`：组装服务、HTTP 路由、认证、权限和请求验证。路由顺序也是权限边界，不随意移动。
- `server/database.mjs`：基础表结构、原地迁移、数据库读写与同步事务。
- `server/progress-store.mjs`：错题、掌握、导入、回收站与撤销。状态变更和历史记录在同一事务内完成。
- `server/admin-reports.mjs`：学生统计、学习详情与 Excel 导出。
- `server/admin-insights.mjs`：使用时长、页面停留与逐题统计。
- `server/question-stats-export.mjs`：逐题统计 Excel，筛除三项人数全部为零的题目；读取与后台相同的学生统计快照。
- `server/content.mjs`：内容读取、会员限制及文件保护。
- `server/management.mjs`、`server/payment-orders.mjs`：会员及订单。
- `server/payment-notifications.mjs`、`server/weekly-report-scheduler.mjs`：持久化邮件队列及周报时间安排。
- `server/qdna-*`：学习分析和推荐；邮件模板只负责展示。

## 修改与验证

本地预览使用 `server/preview.mjs` 和 `.local-membership-preview/`，不发真实邮件。
`npm test` 运行功能与内容检查；`npm run build` 构建两个入口；`npm run test:protection` 检查内容保护。

题目数据、历史生成脚本、测试兼容入口及原始资料不是可随意删除的冗余。只清理已核实无调用、无副作用的代码。

生产目录为 `../deployment/initial-release/`，普通修改只在本地进行。后续发布需逐项合并，保留生产专有的 HTTPS 来源、Secure Cookie、代理 IP、SMTP 和持久化数据配置，不能直接覆盖生产 `server/api.mjs`。
