export const PHYSICISTS = [
  { id: 'newton', name: '牛顿', en: 'Isaac Newton' },
  { id: 'einstein', name: '爱因斯坦', en: 'Albert Einstein' },
  { id: 'galileo', name: '伽利略', en: 'Galileo Galilei' },
  { id: 'curie', name: '居里夫人', en: 'Marie Curie' },
  { id: 'faraday', name: '法拉第', en: 'Michael Faraday' },
  { id: 'maxwell', name: '麦克斯韦', en: 'James Clerk Maxwell' },
  { id: 'planck', name: '普朗克', en: 'Max Planck' },
  { id: 'bohr', name: '玻尔', en: 'Niels Bohr' },
  { id: 'schrodinger', name: '薛定谔', en: 'Erwin Schrödinger' },
  { id: 'feynman', name: '费曼', en: 'Richard Feynman' },
];
export const POSES = [{ id: 'wave', name: '招手' }, { id: 'think', name: '思考' }, { id: 'read', name: '阅读' }, { id: 'teach', name: '讲解' }, { id: 'thumbs-up', name: '点赞' }];
export const AVATARS = PHYSICISTS.flatMap(person => POSES.map(pose => ({ id: `${person.id}-${pose.id}`, person: person.id, name: `${person.name} · ${pose.name}`, url: `/assets/avatars/${person.id}-${pose.id}.webp` })));
export const AVATAR_IDS = new Set(AVATARS.map(a => a.id));
export const GRADES = ['中四', '中五', '中六'];
export const TARGETS = ['5', '5*', '5**'];
