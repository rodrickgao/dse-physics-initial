// Stable references determine the picker path, including restored drafts and reader context.
export function teacherQuestionLocation(reference = '') {
  const paper=/^(20\d{2})\|(paper-(?:1a|1b|2))\|[\w.]+$/.exec(reference);
  if(paper)return {source:'past-paper',year:paper[1],paper:paper[2]};
  const textbook=/^(ex|tb)-(E?[1-5](?:A|B)?\d{2})-\d+$/.exec(reference);
  if(!textbook)return null;
  const code=textbook[2],elective=code.startsWith('E'),number=elective?code[1]:code[0];
  return {source:textbook[1]==='ex'?'examples':'textbook',bookKey:`${elective?'elective':'compulsory'}-${number}`,chapterCode:code};
}
