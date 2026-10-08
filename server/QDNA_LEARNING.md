# DDPhysics QDNA 学习分析与推荐：本地实现说明

日期：2026-10-08。实现依据：用户提供的 `DDPhysics_QDNA_开发Prompt.docx`。本次仅修改 `dse-physics-past-papers/`，不修改基线或生产发布目录，不推送、不部署、不发送周报。

## 现状与实际数据

- 现有 Node HTTP 服务、SQLite、登录会话、会员检查和管理员角色保持不变，无新增依赖或外部服务。
- 学生当前状态来自 `mistakes(user_id,question_key,marked_at)` 与 `mastered`；UNMARKED 为两表均无记录。原错题回收站、整组标记、撤销功能保留。
- 服务器题目目录覆盖 2,468 道题：真题 1,116、课本习题 979、课本例题 373；知识点目录 410 项。
- QDNA 由原有导入流程载入私有 `protected_dna`。当前输入来自 `output/qdna-20261008/{中文版,英文版}/json/QDNA.json`，中英文各 1,116 条。中文 1,102 条、英文 1,090 条的权重数组非空；课本习题和例题当前没有 QDNA。
- 现有中英文有 140 道题的权重组合不同。学生题目状态跨语言共用，故采用一个可配置的有效 QDNA 基准，默认中文版。仅在基准语言完全缺少该题记录时使用另一语言，空数组不擅自补标。切换界面语言只改变文案，不改变学习分析。原 JSON、权重、evidence 和生成算法均未修改；这些标注没有经过本次独立物理核验。
- 原周报只有设计模板，没有实际学生分析或发送调度。本次连接真实数据生成与管理员预览，保留原模板入口，不增加调度或自动发送。

## 模块与状态一致性

| 模块 | 职责 |
| --- | --- |
| `question-status.mjs` | 统一读取当前状态；在现有写事务中比较前后状态、记录真正变化 |
| `knowledge-weakness.mjs` | 独立纯计算：权重、样本数、薄弱信号及分类 |
| `qdna-recommendations.mjs` | 独立确定性推荐：评分、稳定排序、新题/错题分区 |
| `qdna-learning.mjs` | 题目/知识点索引、学生画像、管理员汇总、周报共用入口 |
| `qdna-weekly-email.mjs` | 只负责排版，不另写分析公式 |
| `QdnaProfile.jsx` / `AdminQdna.jsx` | 学生统计、知识点详情、后台统计与周报预览 |

`/api/progress`、单题错题标记、历史错题导入、回收站恢复和撤销均在同一 SQLite 事务内更新状态并记录变化。WRONG 与 MASTERED 互斥；重复标记不增加统计贡献或状态事件；取消标记撤销该题贡献。读取时按当前状态重算，避免维护增减缓存造成漂移。对旧库若存在双状态，统一读取层按较新时间选择；同时间以错题为准，管理员分析采用相同规则。

新增两张小表：

- `question_status_events(id,user_id,question_id,from_status,to_status,at)`，索引 `(user_id,at)`；只记录实际提交的状态变化。
- `learning_metadata(key,value)`，保存首次开始记录状态历史的时间 `status_history_since`。不把旧有当前状态伪造成本周活动。

前端沿用保存成功后更新 `mistakes` / `mastered` 的流程，再刷新画像和推荐；返回主页时也按需获取最新结果。没有新增作答、作答计时或学生标记按钮，也未改变已有专注计时功能。

## 分析与推荐规则

只对当前标记且有有效 QDNA 的题计算。每道题每个知识点只计一次，不对权重归一化；现有非标准档位（例如 0.3）也原样适配，不擅自改成其他档位。无效、未知知识点、重复知识点或非有限/不在 (0,1] 范围内的权重被跳过，管理员响应包含 `ignored_weights` 诊断数量。

`WrongWeight = Σ WRONG 的该点权重`；`MasteredWeight = Σ MASTERED 的该点权重`。

`TotalMarkedWeight = WrongWeight + MasteredWeight`。

`raw_weakness = WrongWeight / TotalMarkedWeight`（总权重为零时 null）。

`AdjustedWeakness = (WrongWeight + alpha) / (TotalMarkedWeight + beta)`。

只有不同相关标记数达到最低阈值且总权重大于零，才公开显示有效薄弱信号：

- `>= 0.6`：NEEDS_REVIEW / 需要复习。
- `>= 0.3` 且 `< 0.6`：DEVELOPING / 巩固中。
- `< 0.3`：STRONG / 表现较好。
- 未达到阈值：INSUFFICIENT_DATA / 数据不足，`weakness_signal` 和 `adjusted_weakness` 为 null，不显示默认 50%，不参与推荐评分。

返回每点的 marked_question_count、wrong_question_count、mastered_question_count、total_marked_weight、数据支持状态。这里的数据支持只表示相关标记数量足够，不是统计置信概率。页面明确标为 Knowledge Weakness Signal / 知识点薄弱信号，不称为真实考试能力或正确率。

推荐分数为所有数据充足知识点的 `候选题权重 × AdjustedWeakness` 之和。MASTERED 排除，UNMARKED 默认选 8 道，WRONG 单独选最多 3 道。按分数降序、Question ID 字符串升序稳定排序；轻量多样性规则优先限制同一主要知识点约占一半，候选不足时再补足，最终返回列表仍按分数/ID排序。理由由固定双语规则生成，不调用 AI。无充足数据时返回空推荐和题库入口；没有剩余新题时如实显示，没有占位假题。

## 页面与权限

- 主页保留“继续上次学习”和原题库入口，新增“我的知识画像”和“为你推荐”；错题页也可展开同一统计组件。
- 画像显示总体标记数、当前待复习/表现较好知识点；完整知识点表按 20 条翻页。点击知识点查看已掌握/错题/未标记题、当前点权重及相关推荐，链接仍进入原阅读器。
- `/admin.html` 总览新增题目/知识点统计；学生详情提供相同知识画像、推荐与周报预览。旧站内管理入口也接入同一组件。
- 题目 WRONG / MASTERED / 覆盖人数按不同学生的当前状态计算。知识点统计显示 QDNA 关联题数、至少有一题 WRONG / MASTERED 的学生数和有效薄弱信号达到 NEEDS_REVIEW 的学生数；同一学生可在某点两种题目状态中都有记录。

| 接口 | 范围 |
| --- | --- |
| `GET /api/learning/dashboard?language=chn&offset=0&limit=20` | 当前会话用户，不能指定他人 ID；知识点分页、计数、少量推荐 |
| `GET /api/learning/knowledge?id=16&status=ALL&offset=0&limit=20` | 当前用户、单个知识点；status 支持 ALL/MASTERED/WRONG/UNMARKED |
| `GET /api/admin/learning/dashboard?studentId=…` | 管理员查看指定学生 |
| `GET /api/admin/learning/knowledge?studentId=…&id=…` | 管理员查看该学生的单点详情 |
| `GET /api/admin/learning/overview?type=questions` | 分页题目统计及有效 QDNA 权重；type=knowledge 为知识点统计 |
| `GET /api/admin/learning/weekly?studentId=…` | 最近 7 日真实活动与当前分析、邮件预览；可指定毫秒 start/end，范围最多 31 日 |

新增接口拒绝未知/重复参数、超大分页和批量题号；limit=1–50，offset=0–10000，推荐数由服务器固定。未登录 401，非管理员访问他人/管理接口 403；自有接口携带 studentId 拒绝。响应 `Cache-Control: private, no-store`、`Vary: Cookie`，共享内容保护的账号/IP限流及临时冷却。

知识画像供已登录用户查看自己的分析；实际题干、原有试读、原创解析和文件仍由原接口独立核验权限。按照本次文档，允许普通用户看到有界的“单点对应题目权重”和已选推荐的 recommendation_score；完整 DNA、evidence、reasoning_steps、全候选网络及计算代码仍保留在服务器。这两个字段是对上一轮“所有权重/分数不下发”要求的明确功能例外，详见 `CONTENT_PROTECTION.md`。

## 周报与历史边界

周报固定四部分：期间新增掌握/错题、最多 3 个当前关注知识点、最多 3 个新题推荐、继续学习链接。活动按 `[start,end)` 内曾进入对应状态的不同题号计数；重复点击无事件，反复进入同状态在同一期只计一题；同题期内曾进入两种状态，可分别计入两项活动。不是期末库存或净增加数。

网站和周报都调用 `snapshot()`；周报取默认 8 题推荐的前 3 题，避免另以 limit=3 运行多样性选择而产生不一致。相同学生、数据和参数时结果一致。冷启动和推荐不足时不强凑数量。

服务端集成入口：`createApi(...).buildWeeklyReport(studentId, options)` 返回数据，再交给现有 `weeklyReportEmail({from,to,report})` 得到邮件对象。管理员周报接口仅预览，代码没有调用发送器。

QDNA 启动时解析一次，以 Map 建题目和知识点反向索引，页面访问不重新解析 JSON。`qdna_version` 使用基准语言和私有导入内容的 SHA-256 摘要，随数据/基准改变而改变；需要重启服务加载新内容。

现阶段没有存储历史 QDNA 分析快照。周报的 start/end 限定活动区间，关注知识点和推荐始终使用生成时的当前状态、当前 QDNA、当前参数，不能重建过去某周的知识画像。生成时间、QDNA 版本及历史开始时间随报告返回。历史记录起点晚于周报起始时间的数据缺口用 partial_history 和邮件提示明确说明；不声称既往活动完整或历史分析不受版本更新影响。

## 可调配置

在服务启动环境设置，修改后重启；`.env.example` 是配置示例，程序不会自动加载该文件。

| 变量 | 默认 | 说明 |
| --- | ---: | --- |
| DSE_QDNA_ALPHA | 0.5 | 平滑分子，有限数且 0 ≤ alpha ≤ beta |
| DSE_QDNA_BETA | 1 | 平滑分母，有限正数 |
| DSE_QDNA_MIN_MARKED | 3 | 每点不同相关题的最低样本数，正整数 |
| DSE_QDNA_CANONICAL_LANGUAGE | chn | 统一有效 QDNA 基准，chn 或 eng；不随界面语言变化 |
| DSE_QDNA_DIR | 本地预览为 output/qdna-20261008 | 私有 QDNA 输入目录；其他环境显式配置 |
| DSE_LIMIT_SIMILAR | 30 | 推荐/新分析接口每账号每分钟，共用原账号/IP临时冷却策略 |

0.5/1 与 3 题最低样本遵循开发文档，减少单题极端判断；0.6/0.3 分类界限保持文档规则。限流配置、共享网络策略和文件保护沿用 `content-limits.mjs`，不新增基础设施或自动封号。

## 验证与剩余限制

- 全套自动化：111 项通过。最后基准版本配置改动后，QDNA 与内容保护专项 12 项再次通过。
- 覆盖文档十项情境：无标记、少量错题、已掌握、双向切换、取消、重复点击、缺失 QDNA、推荐排序、网页/邮件一致；补充撤销、恢复、事务失败、持久化、版本变化、语言回退和限流账号隔离。
- 浏览器使用临时数据库、独立测试用户和标明用途的合成 QDNA；验证双语、8 道新题与 3 道错题、单点权重/分类、分页、真实阅读器跳转、手机宽度、后台学生/题目/知识点分析、周报预览。未改动指定本地测试账号已有题目标记。
- 5178 现有网站阅读器、原报告、解析水印、搜索翻页、知识关联、错题页、手机例题回归通过，无浏览器脚本错误。
- 构建通过；扫描 1,139 个公开构建文件，未发现完整题库包、DNA、内部推荐算法标记、来源机器上的密钥值或凭据模式。范围仅本地源码与构建，不包含线上环境或完整 Git 历史。
- 当前课本题缺少 QDNA，可正常浏览和标记；总标记数包含它们，但知识画像和个性化推荐跳过它们，页面显示缺失数量。没有补造 QDNA。
- 自主标记仍有主观偏差；小样本“充足”不等于客观可靠。可见的逐点权重及题目仍可被截图/逐步收集，限流不等于完全防复制。
- 未实现自动邮件调度或历史版本重建，未发布到生产。生产仍需按既有部署流程保留生产登录安全配置、私有数据存放和备份规则，不能用本地项目整目录覆盖生产。

验证产物位于 `output/qdna-learning/`、`output/qdna-learning-tests.log`；浏览器截图与周报 HTML 为隔离测试数据，不能视为实际学生学习成果。
