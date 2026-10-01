const numericOrder=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
export function orderKnowledge(items,numberFor) {
  const sequence=item=>Number(typeof item==='object'?item.sequence:item);
  return [...(items||[])].sort((a,b)=>numericOrder.compare(String(numberFor(sequence(a))),String(numberFor(sequence(b)))) || sequence(a)-sequence(b));
}
