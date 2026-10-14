import { MEMBERSHIP_ENABLED } from './access-policy.js';
// Completion selectors expose committed React state, never raw click events.
// Only browsing routes are prepared. Tutorials never invoke mutations or payments.
const t=(zh,en)=>({chn:zh,eng:en});
const step=(id,target,title,body,instruction,extra={})=>({id,target,title:t(...title),body:t(...body),instruction:t(...instruction),permission:'signed-in',mode:'intro',...extra});
export const coreSteps=[
 step('open','example-chapter-101',["打开例题", "Open an example"],["用必修一体验做题、错题复习和知识点关联。", "Try questions, mistake review and knowledge links in Compulsory 1."],['点击 101 章，打开例题 1。','Click chapter 101 to open Example 1.'],{mode:'action',route:['examples','',{book:'compulsory-1'}],complete:'[data-tour="example-state"][data-ready="true"][data-question="ex-101-1"]'}),
 step('solution','example-solution',["查看解答", "Check the solution"],["先读题思考，再核对解答。", "Think through the question, then check the solution."],['点击「查看解答」。','Click “Show solution”.'],{mode:'action',route:['examples','ex-101-1'],complete:'[data-tour="example-state"][data-ready="true"][data-question="ex-101-1"][data-answer="true"]'}),
 step('mastered','mark-mastered',["标记已掌握", "Mark as mastered"],["会做的题用钩标记。标记会保存，之后可修改。", "Tick questions you understand. Marks are saved and can be changed."],['点击钩，标记已掌握。','Click the tick to mark it mastered.'],{mode:'action',route:['examples','ex-101-1'],complete:'[data-tour="example-state"][data-question="ex-101-1"] [data-tour="mark-mastered"][aria-pressed="true"]:not(:disabled)'}),
 step('mark','mark-mistake',["加入错题库", "Save a mistake"],["星号保存错题，并替换已掌握状态。", "The star saves a mistake and replaces mastery."],['点击星号，保存成功后进入错题库。','Click the star. After saving, we will open your mistake book.'],{mode:'action',route:['examples','ex-101-1'],complete:'[data-tour="example-state"][data-question="ex-101-1"] [data-tour="mark-mistake"][aria-pressed="true"]:not(:disabled)'}),
 step('mistake-review','tour-mistake-open',["复习错题", "Review a mistake"],["错题可重做、导出，或标为已掌握。", "Revisit, export or mark saved mistakes as mastered."],['点击这道题的「打开」。','Click “Open” on this question.'],{mode:'action',route:['mistakes'],complete:'[data-tour="example-state"][data-ready="true"][data-question="ex-101-1"]'}),
 step('question-knowledge','question-knowledge',["题目关联知识点", "Question to knowledge"],["查看本题相关概念。必修一关联免费开放。", "Review related concepts. Compulsory 1 links are free."],['点击关联知识点，打开知识卡。','Click the related knowledge point to open its card.'],{mode:'action',route:['examples','ex-101-1'],complete:'[data-tour="knowledge-card"][data-study-knowledge-card="2"]'}),
 step('knowledge-question','knowledge-question-2',["知识点关联题目", "Knowledge to questions"],["用关联题目练习刚学的概念。", "Practise the concept with linked questions."],['点击任一道关联题目。','Click a related question.'],{mode:'action',route:['textbook','',{knowledge:2}],complete:'[data-tour="example-state"][data-ready="true"][data-question]:not([data-question=""]), [data-tour="paper-solution"], [data-tour="exercise-ready"]'}),
 step('analysis-open','knowledge-profile',["薄弱知识点", "Topics to review"],["主页显示最薄弱的 3 个知识点，展开可查看全部。", "Home shows your three weakest topics. Expand to see all."],['点击「下一步」。','Click “Next”.'],{route:['home'],interactive:false}),
 step('analysis-report','knowledge-profile',["选择复习内容", "Choose what to review"],["打开知识点查看后，回到主页可点击叉号隐藏。再次做错相关题目时会重新显示。", "After reading a topic, return home and use the cross to hide it. A new related mistake brings it back."],['也可点击「下一步」。','You can also click “Next”.'],{route:['home'],advanceOnNavigate:['textbook']}),
 step('replay','tour-help',["随时重看", "Replay anytime"],["顶部「使用教程」可重看。示范题已保存到错题库，复习后可标为已掌握。", "Replay from User guide at the top. Your saved example can be marked mastered after review."],['点击「下一步」，结束教程。','Click “Next” to finish the guide.'])
];
const intro=(id,target,title,body,permission='signed-in')=>step(id,target,title,body,['了解后点击「下一步」。','Click “Next” when ready.'],{permission});
export const pageTours={
  "home": [
    {
      "id": "dashboard",
      "target": [
        "knowledge-profile",
        "page-root"
      ],
      "title": {
        "chn": "学习主页",
        "eng": "Study home"
      },
      "body": {
        "chn": "继续上次学习，查看记录和薄弱知识点。",
        "eng": "Continue studying and review your history and weak topics."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    },
    {
      "id": "navigation",
      "target": "profile-settings",
      "title": {
        "chn": "导航与帮助",
        "eng": "Navigation and help"
      },
      "body": {
        "chn": "左侧目录可收起；手机用底部导航。顶部可切换语言或重看教程。",
        "eng": "Collapse the sidebar or use mobile navigation. Language and User guide are at the top."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    }
  ],
  "bank": [
    {
      "id": "search",
      "target": "bank-search",
      "title": {
        "chn": "描述想练的内容",
        "eng": "Describe your practice"
      },
      "body": {
        "chn": "输入知识点、情境或方法，点击搜索结果进入题目。",
        "eng": "Search by topic, situation or method, then open a result."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    },
    {
      "id": "sources",
      "target": "page-root",
      "title": {
        "chn": "选择来源",
        "eng": "Choose a source"
      },
      "body": {
        "chn": "清空搜索后，可浏览真题、课本习题或例题。",
        "eng": "Clear search to browse past papers, exercises or examples."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    }
  ],
  "examples": [
    {
      "id": "directory",
      "target": [
        "example-state",
        "page-root"
      ],
      "title": {
        "chn": "选择例题",
        "eng": "Choose an example"
      },
      "body": {
        "chn": "按分册、章节或关键词选题，用题号和上一题、下一题切换。",
        "eng": "Browse or search, then use question numbers or Previous/Next."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    },
    {
      "id": "reading",
      "target": [
        "example-solution",
        "example-state"
      ],
      "title": {
        "chn": "查看解答",
        "eng": "Check solutions"
      },
      "body": {
        "chn": "展开解答和「想一想」，放大插图，或点击「问这道题」。",
        "eng": "Reveal solutions and Think about answers, enlarge diagrams or ask about the question."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    },
    {
      "id": "marks",
      "target": [
        "mark-mistake",
        "example-state"
      ],
      "title": {
        "chn": "钩与星",
        "eng": "Tick and star"
      },
      "body": {
        "chn": "钩表示掌握，星表示错题；两者互斥，标记会保存。",
        "eng": "Tick for mastery, star for mistakes. Marks are saved and mutually exclusive."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    }
  ],
  "exercises": [
    {
      "id": "choose",
      "target": "page-root",
      "title": {
        "chn": "选题与搜索",
        "eng": "Browse and search"
      },
      "body": {
        "chn": "按分册、章节或关键词选题，用上一题、下一题连续练习。",
        "eng": "Browse or search, then use Previous/Next to keep practising."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    },
    {
      "id": "answers",
      "target": [
        "paper-solution",
        "example-solution",
        "page-root"
      ],
      "title": {
        "chn": "查看解答",
        "eng": "Check answers"
      },
      "body": {
        "chn": "展开标答或详解，点击插图放大；受限内容需会员。",
        "eng": "Reveal answers or explanations and enlarge diagrams. Restricted content requires membership."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    }
  ],
  "papers": [
    {
      "id": "years",
      "target": [
        "paper-years",
        "paper-picker",
        "paper-directory"
      ],
      "title": {
        "chn": "按年份与试卷找题",
        "eng": "Find a paper"
      },
      "body": {
        "chn": "选择年份、试卷和题号；手机可展开目录。",
        "eng": "Choose a year, paper and question. Expand the directory on mobile."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    },
    {
      "id": "answers",
      "target": [
        "paper-solution",
        "example-solution",
        "page-root"
      ],
      "title": {
        "chn": "查看解答",
        "eng": "Check answers"
      },
      "body": {
        "chn": "展开标答或详解，点击插图放大；受限内容需会员。",
        "eng": "Reveal answers or explanations and enlarge diagrams. Restricted content requires membership."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    },
    {
      "id": "status",
      "target": [
        "mark-mastered",
        "paper-years"
      ],
      "title": {
        "chn": "记录与提问",
        "eng": "Record and ask"
      },
      "body": {
        "chn": "钩表示掌握，星表示错题。「问这道题」附上当前题目；全卷标记影响整卷。",
        "eng": "Tick for mastery, star for mistakes. Ask includes this question; whole-paper marks affect every question."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    }
  ],
  "textbook": [
    {
      "id": "knowledge",
      "target": "knowledge-search",
      "title": {
        "chn": "找到知识点",
        "eng": "Find a knowledge point"
      },
      "body": {
        "chn": "按分册、章节或关键词查找知识卡，复习解释、公式和插图。",
        "eng": "Find a knowledge card to review concepts, equations and diagrams."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    },
    {
      "id": "links",
      "target": [
        "knowledge-links",
        "page-root"
      ],
      "title": {
        "chn": "关联练习",
        "eng": "Linked practice"
      },
      "body": {
        "chn": "点击关联题目练习。必修一关联免费，其他分册关联需会员。",
        "eng": "Open linked questions. Compulsory 1 links are free; other books require membership."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "member-explained",
      "mode": "intro"
    }
  ],
  "mistakes": [
    {
      "id": "first",
      "target": [
        "mistake-list",
        "mistake-empty",
        "mistake-active-tab"
      ],
      "title": {
        "chn": "建立自己的错题库",
        "eng": "Build your mistake book"
      },
      "body": {
        "chn": "在题目右上角点星加入错题；这里可重做、标为掌握或移入回收站。",
        "eng": "Star a question to save it here, then revisit it, mark it mastered or move it to Trash."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    },
    {
      "id": "export",
      "target": [
        "mistake-export",
        "mistake-empty",
        "mistake-active-tab"
      ],
      "title": {
        "chn": "选择题目并导出",
        "eng": "Select and export"
      },
      "body": {
        "chn": "勾选题目后导出：原题版用于练习，详解版用于核对，需会员。",
        "eng": "Select questions to export. Use Questions for practice; Solutions requires membership."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    },
    {
      "id": "review",
      "target": [
        "mistake-analysis",
        "mistake-empty",
        "mistake-active-tab"
      ],
      "title": {
        "chn": "按知识点或章节复习",
        "eng": "Review by topic or chapter"
      },
      "body": {
        "chn": "点击章节统计筛选错题；「查看全部错题」取消筛选。",
        "eng": "Filter mistakes by chapter in statistics. Show all mistakes clears the filter."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "member-explained",
      "mode": "intro"
    },
    {
      "id": "profile",
      "target": [
        "mistake-active-tab"
      ],
      "title": {
        "chn": "复习错题",
        "eng": "Review mistakes"
      },
      "body": {
        "chn": "打开错题重做，掌握后点击「标为已掌握」。",
        "eng": "Open a saved mistake and try again. Mark it mastered when ready."
      },
      "instruction": {
        "chn": "查看后点击「下一步」。",
        "eng": "Review the mistakes, then click “Next”."
      },
      "permission": "signed-in",
      "mode": "intro"
    },
    {
      "id": "trash",
      "target": "mistake-trash-tab",
      "title": {
        "chn": "认识回收站",
        "eng": "Visit Trash"
      },
      "body": {
        "chn": "移除的错题会保留在回收站，可恢复。",
        "eng": "Removed mistakes stay in Trash and can be restored."
      },
      "instruction": {
        "chn": "点击「回收站」，等待加载完成。",
        "eng": "Click “Trash” and wait for it to load."
      },
      "permission": "signed-in",
      "mode": "action",
      "unavailable": "[data-tour=\"mistake-trash\"][data-error=\"true\"]",
      "complete": "[data-tour=\"mistake-trash\"][data-ready=\"true\"]"
    },
    {
      "id": "restore",
      "target": "mistake-trash",
      "title": {
        "chn": "恢复与整理",
        "eng": "Restore and organise"
      },
      "body": {
        "chn": "可恢复单题或所选题目；彻底删除需确认。",
        "eng": "Restore one or selected questions. Permanent deletion requires confirmation."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    }
  ],
  "membership": [
    {
      "id": "access",
      "target": "page-root",
      "title": {
        "chn": "了解当前权限",
        "eng": "Understand your access"
      },
      "body": {
        "chn": "查看会员状态和方案；受限内容按会员权限开放。",
        "eng": "Check your membership and plans for access to restricted content."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    },
    {
      "id": "purchase",
      "target": "page-root",
      "title": {
        "chn": "按需购买",
        "eng": "Purchase if needed"
      },
      "body": {
        "chn": "教程不会代你下单或付款。",
        "eng": "The guide never orders or pays for you."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    }
  ],
  "ask": [
    {
      "id": "context",
      "target": "teacher-form",
      "title": {
        "chn": "带着题目问老师",
        "eng": "Ask with context"
      },
      "body": {
        "chn": "从「问这道题」进入会附上题目，也可查看提问与回复。",
        "eng": "Ask about this question includes its context. Read questions and replies here."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    },
    {
      "id": "send",
      "target": "teacher-message",
      "title": {
        "chn": "发送提问",
        "eng": "Send your question"
      },
      "body": {
        "chn": "核对内容和服务要求后，自行发送。",
        "eng": "Check the message and service requirements before sending."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    }
  ],
  "focus": [
    {
      "id": "timer",
      "target": "focus-controls",
      "title": {
        "chn": "安排一段专注学习",
        "eng": "Plan focused study"
      },
      "body": {
        "chn": "设置时长，自行开始、暂停或重置计时。",
        "eng": "Set a duration, then start, pause or reset the timer."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    }
  ],
  "profile": [
    {
      "id": "settings",
      "target": "page-root",
      "title": {
        "chn": "管理个人设置",
        "eng": "Your settings"
      },
      "body": {
        "chn": "修改资料、目标或账号设置。教程进度按账号保存在本浏览器。",
        "eng": "Edit your profile, goals or account. Guide progress is saved per account in this browser."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    }
  ],
  "payment": [
    {
      "id": "payment",
      "target": "page-root",
      "title": {
        "chn": "核对订单",
        "eng": "Check your order"
      },
      "body": {
        "chn": "核对订单及支付方式后，自行付款或上传凭证。",
        "eng": "Check the order and payment method before paying or uploading a receipt."
      },
      "instruction": {
        "chn": "了解后点击「下一步」。",
        "eng": "Click “Next” when ready."
      },
      "permission": "signed-in",
      "mode": "intro"
    }
  ]
};
pageTours.receipt=pageTours.payment;
pageTours['member-success']=pageTours.membership;
pageTours.activating=pageTours.membership;
export const pageSteps=page=>pageTours[page]||pageTours.home;

export const CORE_STEP_COUNT=coreSteps.length;

// Preserve paid-mode tutorial copy for later restoration.
if (!MEMBERSHIP_ENABLED) {
  const clean = value => {
    if (typeof value === 'string') return value
      .replace('；受限内容需会员。','。')
      .replace(' Restricted content requires membership.','')
      .replace('点击关联题目练习。必修一关联免费，其他分册关联需会员。','点击关联题目练习。')
      .replace('Open linked questions. Compulsory 1 links are free; other books require membership.','Open linked questions.')
      .replace('勾选题目后导出：原题版用于练习，详解版用于核对，需会员。','勾选题目后导出：原题版用于练习，详解版用于核对。')
      .replace('Select questions to export. Use Questions for practice; Solutions requires membership.','Select questions to export. Use Questions for practice and Solutions to check your work.');
    if (value && typeof value === 'object') for (const key of Object.keys(value)) value[key] = clean(value[key]);
    return value;
  };
  clean(pageTours);
  clean(coreSteps);
  const linked = coreSteps.find(step=>step.id==='question-knowledge');
  linked.body = {chn:'查看本题相关概念。',eng:'Review related concepts.'};
}
