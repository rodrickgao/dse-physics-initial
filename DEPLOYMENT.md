# 初版公网部署

本目录从 `rollback/初版/website-source.zip` 独立恢复，仅增加正式服务和部署配置。原本地项目及冻结备份未修改。

## 状态

尚未上线。需要网站所有人开通并连接托管账号，确认付费套餐，然后完成私有上传、数据迁移和公网验收。不要将 dist 单独发布到静态托管：这会绕过会员后端。

## 两个入口

- 学生端：`https://<分配的域名>/`
- 管理端：`https://<分配的域名>/admin.html`

两个独立界面共用一个服务器和持久数据库，管理员仍需独立登录。域名由托管平台分配；也可之后绑定自有域名。

## 推荐部署配置

Render Docker Web Service，新加坡区域，Starter 起步，2 GB 持久盘挂载 `/var/data`。`render.yaml` 已包含配置。只运行一个实例。性能需以实际线上负载验证，再决定是否升级。Docker 基于 Node 24，后台使用 SQLite、Sharp 和 SMTP，因此不能直接放入仅支持静态页面或 Worker 的托管服务。

环境变量：

| 名称 | 设置 |
| --- | --- |
| DSE_DATA_DIR | `/var/data`，必须是持久盘挂载路径 |
| DSE_MAINTENANCE | 初次部署保持 `true`，验收后改为 `false` |
| PUBLIC_ORIGINS | 精确 HTTPS 来源，多个用逗号分隔；Render 默认自动采用 RENDER_EXTERNAL_HOSTNAME |
| TRUST_PROXY | 仅在可信代理会覆盖或追加真实地址的条件下设为 `true` |
| SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM | 从本机受保护的配置迁移到平台私密变量；不要提交到仓库 |

`SMTP_PORT` 支持 465 或 587。`npm start` 是正式入口；`npm run dev` 仍仅用于本机。服务在缺少邮件或 HTTPS 域名配置时拒绝启动，避免在线显示验证码。平台负责 HTTPS，程序签发 Secure、HttpOnly Cookie，并验证请求来源。

## 上传与首次数据迁移

1. 源码放入独立私有仓库，不上传 `.env*`、`.local`、数据库、管理员密钥、node_modules、dist 或旧的 `.github` 静态发布流程。不推送现有公共题库仓库。
2. 使用该私有仓库的 Dockerfile 创建服务并挂载持久盘。先保持维护状态；此时只有健康检查可访问。
3. 通过 Render 提供的加密文件传输方式，将 `rollback/初版/private/students.sqlite` 上传为 `/var/data/bootstrap.sqlite`，将原 `admin-key.txt` 上传为 `/var/data/bootstrap-admin-key.txt`。文件只进持久盘，不进入镜像或仓库。
4. 重启服务。启动程序只会向空数据库导入一次，检查数据库完整性并保留业务数据，清空本地会话和未使用验证码。如果云端已存在用户记录则拒绝覆盖。
5. 在服务端核对：4 个用户、1 条会员记录、5 条付款申请、4 份付款截图、6 条当前错题；以冻结快照为准。查看 `/var/data/bootstrap-applied.json` 确认导入完成。保留初版管理员密钥，之后应按运营需要轮换。
6. 补充收款二维码，确认 SMTP 从云端可用，之后将维护状态关闭，再做学生注册登录、错题回收站、付款截图、审核/驳回、会员权限、导出与手机端验收。最后交付平台实际分配的网址。

也支持 Render 私密文件自动迁移：将带有版本、数据库 Base64、SHA-256 和管理员密钥的 `initial-data.json` 作为 Render Secret File 提供。程序仅在首次启动且目标数据库为空时校验并导入到持久盘；迁移成功后删除平台上的临时文件配置，再重启验证数据保留。文件总量需小于 Render 的 1 MB 限额。私密文件不能提交到仓库或镜像。

## 备份

服务启动及每 24 小时创建 SQLite 一致性备份，目录 `/var/data/backups`，保留最近 7 个日期。维护状态启动时不做即时备份。它们与业务数据在同一块盘，不能替代异地备份；上线时应再配置独立位置的定期备份，测试恢复后方可视为完整备份方案。

## 尚需用户支持

- 注册并连接 Render，最终开通收费服务需要账号持有人确认费用。
- 初次上传源码需要 GitHub 登录，或提供其他受支持的私有源码/镜像上传入口。
- 实际微信收款二维码已接入付款页，支持打开原图保存；付款截图提交后立即开通的原有规则保留，不会自动核实到账。
- 邮箱凭证本机已有，必须作为私密变量迁移；云端送达能力仍需上线后验证。

本机 SMTP 连接与认证已通过验证，未发送任何测试邮件。

## 本地验证

2026-09-18：学生端和管理端生产构建通过；完整测试 45/45 通过；2,232 条题目记录与 730 张双语知识卡审计通过；SMTP 连接与认证通过（未发送邮件）。已修正归档不保存旧空下载目录造成的测试误报。一次测试被系统随机分配到 fetch 禁用端口而失败，重跑完整套件通过。

构建：`npm run build`。既有业务测试：`node --test tests/backend.test.mjs tests/management.test.mjs tests/payment-orders.test.mjs tests/mistake-trash.test.mjs`。正式服务与迁移测试：`npm run test:production`。所有测试使用独立临时数据库，不修改真实学生资料。

容器尚未在本机运行（本机无 Docker）；云端容器构建、HTTPS、持久盘、实际邮件送达和公网全流程尚待托管账号可用后验证。

参考：https://render.com/docs/disks 、https://render.com/docs/blueprint-spec 、https://render.com/pricing
