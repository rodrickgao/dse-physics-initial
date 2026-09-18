import { duplicateCardGroups } from './duplicate-card-groups.js';
// Reviewed duplicates merge at their first occurrence within a chapter.
// Neighboring distinct topics may share a figure; original identities remain intact.
const titles = {
 'heating-curve':'物態變化與潛熱','velocity-time':'速度—時間圖與運動',
 'moment-arm':'力矩與力臂','work-angle':'力與位移：計算做功','centripetal':'圓周運動',
 'refraction-block':'光的折射與折射率','total-internal-reflection':'臨界角與全內反射',
 'convex-images':'透鏡的實像、虛像與放大率','diverging-lens-rays':'凹透鏡成像與透鏡計算',
 'longitudinal-wave':'波的傳播與振動方向','wave-wavelength':'波長與波速','wave-refraction':'水波折射',
 'diffraction':'波的衍射','interference-path':'干涉、程差與條紋','double-slit':'楊氏雙縫干涉',
 'grating':'衍射光柵與級次','N08-1':'電場強度與電場線','series-circuit':'串並聯的電壓與電源','parallel-circuit':'並聯電路',
 'sine-rms':'交流電與均方根值','wire-right-hand':'長直電流的磁場','solenoid-field':'螺線管的磁場',
 'solenoid-right-hand':'螺線管與電磁鐵','fleming-left-hand':'磁場中的力與方向','parallel-wire-force':'平行載流導線的相互作用',
 'lenz':'電磁感應','flux-angle':'磁通量與方向','flux-linkage':'磁通鏈與電磁感應',
 'transformer-comparison':'變壓器的電壓、功率與效率','atomic-structure':'原子結構、核子數與同位素',
 'decay-curve':'半衰期與放射性衰變','parallax':'週年視差與天文測距',
 'elliptical-orbit':'行星的橢圓軌道','equal-areas':'克卜勒定律與行星運動',
 'blackbody-spectrum':'黑體輻射與恆星','N24-1':'恆星性質與赫羅圖','N39-1':'熱泵與製冷循環',
 'wall-conduction':'建築物導熱與熱傳送值','photoelectric-stop':'光電效應與遏止電勢',
 'hydrogen-levels':'氫原子的軌道、能級與能量變化','N28-1':'納米材料與表面效應',
 'rayleigh-resolution':'分辨能力與瑞利判據','N30-1':'透射電子顯微鏡',
 'spectacles-virtual-image':'視力矯正與眼鏡計算','ultrasound-interface':'聲阻抗與超聲反射',
 'N43-1':'超聲回波與掃描','N43-2':'超聲脈衝與掃描','attenuation':'X 射線衰減與半值厚度',
};
const englishTitles = {
  "heating-curve": "Changes of state and latent heat",
  "velocity-time": "Velocity-time graphs and motion",
  "moment-arm": "Moments and lever arms",
  "work-angle": "Force, displacement and work",
  "centripetal": "Circular motion",
  "refraction-block": "Refraction and refractive index",
  "total-internal-reflection": "Critical angle and total internal reflection",
  "convex-images": "Real and virtual images and magnification",
  "diverging-lens-rays": "Concave lenses and lens calculations",
  "longitudinal-wave": "Wave propagation and vibration direction",
  "wave-wavelength": "Wavelength and wave speed",
  "wave-refraction": "Refraction of water waves",
  "diffraction": "Diffraction",
  "interference-path": "Interference, path difference and fringes",
  "double-slit": "Young’s double-slit interference",
  "grating": "Diffraction gratings and orders",
  "N08-1": "Electric fields and field lines",
  "series-circuit": "Voltages and sources in series and parallel",
  "parallel-circuit": "Parallel circuits",
  "sine-rms": "Alternating current and r.m.s. values",
  "wire-right-hand": "Magnetic fields of straight currents",
  "solenoid-field": "Magnetic fields of solenoids",
  "solenoid-right-hand": "Solenoids and electromagnets",
  "fleming-left-hand": "Magnetic forces and their directions",
  "parallel-wire-force": "Forces between parallel currents",
  "lenz": "Electromagnetic induction",
  "flux-angle": "Magnetic flux and orientation",
  "flux-linkage": "Flux linkage and induction",
  "transformer-comparison": "Transformer voltage, power and efficiency",
  "atomic-structure": "Atomic structure, nucleon numbers and isotopes",
  "decay-curve": "Half-life and radioactive decay",
  "parallax": "Annual parallax and stellar distances",
  "elliptical-orbit": "Elliptical planetary orbits",
  "equal-areas": "Kepler’s laws and planetary motion",
  "blackbody-spectrum": "Black-body radiation and stars",
  "N24-1": "Stellar properties and the H–R diagram",
  "N39-1": "Heat pumps and the refrigeration cycle",
  "wall-conduction": "Building heat transfer",
  "photoelectric-stop": "Photoelectric emission and stopping potential",
  "hydrogen-levels": "Hydrogen orbits, levels and energy changes",
  "N28-1": "Nanomaterials and surface effects",
  "rayleigh-resolution": "Resolving power and Rayleigh’s criterion",
  "N30-1": "Transmission electron microscopy",
  "spectacles-virtual-image": "Vision correction and spectacles",
  "ultrasound-interface": "Acoustic impedance and ultrasound reflection",
  "N43-1": "Ultrasound echoes and scanning",
  "N43-2": "Ultrasound pulses and scanning",
  "attenuation": "X-ray attenuation and half-value thickness"
};
export const cardFigures = point => point.review_figures || point.figures || [];
const duplicateIds = new Map(duplicateCardGroups.flatMap(group => group.map(id => [id, group[0]])));
const membersOf = point => point.members || [point];
const uniqueFigures = members => [...new Map(members.flatMap(cardFigures).map(f => [f.src, f])).values()];
function duplicateCards(points) {
 const groups = new Map();
 for (const point of points) {
  const key = JSON.stringify([point.book_key, point.code, duplicateIds.get(point.sequence) || point.sequence, point.card_title, point.card_summary]);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(point);
 }
 return [...groups.values()].map(members => members.length === 1 ? members[0] : {
  ...members[0], members, review_figures: uniqueFigures(members),
 });
}
export function sharedFigureCards(points) {
 const runs=[];
 for(const point of duplicateCards(points)){
  const previous=runs.at(-1), images=cardFigures(point), incoming=membersOf(point);
  const common=previous?.shared.filter(f=>images.some(g=>g.src===f.src));
  // Exact duplicates stay at their first occurrence. Only adjacent distinct
  // topics may then share a figure; governing laws keep their own topic card.
  if(previous && ![...previous.members,...incoming].some(p=>p.sequence===216||p.is_governing_law) && previous.members[0].book_key===point.book_key && previous.members[0].code===point.code && common.length && previous.members.length+incoming.length<=6){
   previous.members.push(...incoming);previous.shared=common;previous.sharedTopics=true;
  }else runs.push({members:[...incoming],shared:images.filter(f=>titles[f.id]),sharedTopics:false});
 }
 return runs.map(({members,shared,sharedTopics})=>{
  const first=members[0];if(members.length===1)return first;
  return {...first,members,card_title:sharedTopics?(first.card_summary_language === "eng" ? englishTitles : titles)[shared[0].id]:first.card_title,
   review_figures:uniqueFigures(members)};
 });
}
export function cardSections(point){
 const sections=new Map();
 for(const member of membersOf(point)){
  const key=JSON.stringify([member.card_title||member.title,member.card_summary||member.content]);
  if(sections.has(key))sections.get(key).members.push(member);
  else sections.set(key,{point:member,members:[member]});
 }
 return [...sections.values()];
}
