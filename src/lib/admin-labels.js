import { MEMBERSHIP_ENABLED } from './access-policy.js';
const disabledPages = new Set(['membership','payment','receipt','activating','member-success']);
export const statuses = { none: '未开通', active: '有效会员', expired: '已到期', revoked: '已暂停' };
export const actions = { login: '登录', logout: '退出登录', profile_update: '更新资料', page_view: '浏览页面', question_view: '阅读题目', answer_view: '展开官方解答', reasoning_view: '展开详细思路', knowledge_view: '打开知识点', search: '搜索', download: '点击下载', mark: '新增错题', unmark: '移入回收站', restore: '恢复错题', delete: '学生彻底删除', focus_start: '开始专注', focus_pause: '暂停专注', focus_reset: '重设专注' };
export const pages = { bank: '题库', examples: '课本例题', exercises: '课本习题', support: '技术支持', receipt: '付款凭证', activating: '会员开通', 'member-success': '会员开通成功', ask: '问老师', home: '主页', papers: '真题库', textbook: '课本知识库', mistakes: '错题库', focus: '番茄钟', profile: '个人资料', membership: '会员方案', payment: '支付页面' };

const englishPages={home:'Home',bank:'Question bank',papers:'Past papers',textbook:'Knowledge',examples:'Textbook examples',exercises:'Textbook exercises',support:'Technical support',mistakes:'Mistakes',focus:'Focus timer',profile:'Profile settings',membership:'Membership',payment:'Payment',receipt:'Payment receipt',activating:'Membership activation','member-success':'Membership activated',ask:'Ask a teacher'};
export function adminPageLabel(target='',language='chn'){const page=target.split('?')[0];if(!MEMBERSHIP_ENABLED&&disabledPages.has(page))return language==='eng'?'Disabled page':'已停用页面';return (language==='eng'?englishPages:pages)[page]||page||'—';}
export function adminPageHref(target=''){const page=target.split('?')[0];return (!MEMBERSHIP_ENABLED&&disabledPages.has(page))?null:pages[page]?`/#${target}`:null;}
if (!MEMBERSHIP_ENABLED) for (const page of disabledPages) pages[page]='已停用页面';
