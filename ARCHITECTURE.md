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
- `src/lib/use-content-motion.js`：共用的 200ms 内容淡入，处理数据就绪、快速打断、父子动画去重和减少动态效果。学生与后台的页面外壳统一触发页面动画；题目、目录、筛选及小面板按自身状态触发，保留 DOM、焦点和滚动位置。
- `src/components/HomeWeakTopics.jsx`：主页薄弱知识点，默认取最弱三项，展开按分册排列；查看知识卡后允许隐藏，不展示推荐题目。错题库只负责错题管理。

## 后端

- `server/api.mjs`：组装服务、HTTP 路由、认证、权限和请求验证。路由顺序也是权限边界，不随意移动。
- `server/database.mjs`：基础表结构、原地迁移、数据库读写与同步事务。
- `server/progress-store.mjs`：错题、掌握、导入、回收站与撤销。状态变更和历史记录在同一事务内完成。
- `server/mistake-archive.mjs`：回收站恢复与彻底删除。大批量选择使用排除列表缩小请求，并按选中题目集合校验并发变化，保留整批事务及原标记时间。
- `server/admin-reports.mjs`：学生统计、学习详情与 Excel 导出。
- `server/admin-insights.mjs`：使用时长、页面停留与逐题统计。
- `server/question-stats-export.mjs`：逐题统计 Excel，筛除三项人数全部为零的题目；读取与后台相同的学生统计快照。
- `server/content.mjs`：内容读取、会员权限、分页限流及文件保护；章节 PDF 恢复原有关闭规则。
- `server/management.mjs`：学习活动、注册／活跃学生及会员统计；会员期限、暂停状态与变更审计。
- `server/payment-orders.mjs`：付款申请、开通、审核及凭证；幂等申请和会员变更保持在同一事务。
- `server/payment-notifications.mjs`：付款通知持久队列与失败重试；本地预览不配置发送器。
- `server/weekly-report-scheduler.mjs`：周日报表时间安排与失败重试；生成及重试时按当前会员状态筛选，非会员保留必修一推荐。
- `server/qdna-*`：学习分析和推荐；邮件模板只负责展示。
- `server/topic-practice.mjs`：错题知识卡完整分组与对应课本习题；同卡去重，按当前错题／掌握记录排序，在选取前过滤已掌握练习及会员权限。
- `server/weak-topic-store.mjs`：主页知识卡的账号独立查看／隐藏记录。沿用当前错题与掌握算法；用稳定卡身份和相关新错题事件编号决定是否恢复展示。恢复旧回收站题目、重复提交已有错题均不重新显示；新错题会重新显示并要求重新查看。隐藏不改变题目标记。兼容分析、后台和周报接口保持原有用途。

## 修改与验证

本地预览使用 `server/preview.mjs` 和 `.local-membership-preview/`，不发真实邮件。
`npm test` 运行功能与内容检查；`npm run build` 构建两个入口；`npm run test:protection` 检查内容保护。

题目数据、历史生成脚本、测试兼容入口及原始资料不是可随意删除的冗余。只清理已核实无调用、无副作用的代码。

2026-10-12 已按用户追加要求恢复会员：必修一知识关联及推荐保留免费，其他关联、详解、问老师和详解打印按会员权限开放。`MembershipProvider` 刷新会员状态并清理阅读缓存；到期／暂停立即由服务器收回权限。后台会员管理、付款审核、通知及会员统计恢复。学生 Excel 仍为单一「学生学习」表，每人一行，加入会员状态及到期时间；最近的打印排版、排序、Top 5 知识点分布及「问老师」按钮保持。后台独立登录、用户数据隔离、分页／下载限流与原始数据／DNA 隔离继续生效。

生产目录为 `../deployment/initial-release/`，普通修改只在本地进行。后续发布需逐项合并，保留生产专有的 HTTPS 来源、Secure Cookie、代理 IP、SMTP 和持久化数据配置，不能直接覆盖生产 `server/api.mjs`。

## 免费与会员模式

`src/lib/access-policy.js` 是浏览器与 API 共用的模式开关。当前 `MEMBERSHIP_ENABLED=false`；免费权限通过上下文提供，不改写历史会员。学生与后台隐藏会员操作，付款／审核／会员变更 API 返回 410，旧付款通知不重试。登录、个人数据隔离和内容限流继续生效。恢复会员须将开关改为 true，重新构建并重启，选择性发布时继续保留生产安全配置。

周报生成按当前模式取推荐；免费模式发送此前的试读周报时只补全推荐部分，周次与原学习统计保持。回归测试显式使用会员模式验证原规则，免费模式另有完整权限与路由测试。2026-10-14 原源码及历史会员资料备份、恢复说明见 `../output/free-site-20261014/`。
