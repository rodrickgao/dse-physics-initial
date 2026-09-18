import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const siteRoot = path.resolve(import.meta.dirname, "..");
const recordsPath = path.resolve(siteRoot, "..", "真题库", "records.json");
const textbookPath = path.join(siteRoot, "textbook-data.js");
const outputPath = path.join(siteRoot, "paper2-knowledge-data.js");
const auditPath = path.join(import.meta.dirname, "paper2-knowledge-audit.json");

const moduleSequences = {
  1: [247, 276],
  2: [300, 326],
  3: [277, 299],
  4: [327, 365],
};

const stopwords = new Set(`
  a an and are as at be been being below between by can correct could does during each figure find following
  for from given graph has have having if in into is it its may more most must no not of on one only or other
  over question respectively shown shows state statement than that the their them then there these they this
  through to two under use used using variation when which while with would x y p q r s t object objects value
  values calculate determine deduce assume neglect diagram exact source image refer answer marks mark solution
  paper option options about according also amount
`.trim().split(/\s+/));

// These starts repair the small number of source text layers where multi-column
// extraction places several printed question numbers before their question bodies.
const manualStarts = {
  "2012-1-7": /\(For questions 1\.7 and 1\.8\)/i,
  "2012-3-1": /luminous flux\s+power rating/i,
  "2013-1-8": /The diagram shows the top view of a galaxy/i,
  "2015-1-7": /absolute magnitude\s*\|?\s*apparent magnitude/i,
  "2015-2-1": /A beam of a-particles with the same initial kinetic energy/i,
  "2015-2-2": /Which of the following provides experimental evidence for discrete energy levels/i,
  "2015-2-3": /In a photoelectric experiment, monochromatic light of frequency/i,
  "2015-2-4": /A spy aircraft is cruising at a height/i,
  "2015-3-1": /A lamp is fixed on the ceiling of a room/i,
  "2015-3-2": /The schematic diagram below shows a solar cell under sunlight/i,
  "2015-3-3": /A satellite is powered by a solar panel/i,
  "2017-3-7": /The hydroelectric power plant shown has an efficiency/i,
  "2017-3-8": /Energy is released in the following nuclear fission/i,
  "2019-3-2": /The battery pack of an electric vehicle can store/i,
  "2019-3-3": /Which of the following descriptions about a hybrid car/i,
  "2019-3-4": /Air-conditioners P and Q below are used respectively/i,
  "2019-3-8": /binding\s+iron\s+energy\s+per nucleon/i,
  "2021-1-6": /Which of the following statements is\/are correct \?\s*\n\s*\(1\)\s+For observers in Galaxy 1/i,
  "2021-1-8": /power per unit\s+area per\s+wavelength/i,
  "2021-3-7": /The figure below shows a hydroelectric power plant/i,
  "2021-3-8": /For the fission reaction of a U-235 nucleus/i,
  "2022-1-2": /Three identical stars X[^\n]*situated at the vertices/i,
};

// Source-question review overrides for astronomy items whose exact concept is
// obscured by diagrams, formula OCR, shared stems, or very short answer choices.
// Governing-law cards (category 1) are deliberately excluded.
const manualLinks = {
  "2012-1-2": [258, 257],
  "2012-1-4": [251],
  "2012-1-5": [255],
  "2012-1-S": [274, 265, 262, 250],
  "2013-1-3": [275, 255],
  "2013-1-4": [262, 260, 250],
  "2013-1-5": [251],
  "2013-1-6": [265],
  "2013-1-7": [274, 273],
  "2013-1-S": [255, 257, 258],
  "2014-1-2": [248, 249],
  "2014-1-6": [258, 257],
  "2014-1-7": [271],
  "2014-1-8": [274, 273],
  "2014-1-S": [272, 273, 274, 255],
  "2015-1-1": [257, 255],
  "2015-1-3": [265, 247],
  "2016-1-1": [256, 255],
  "2016-1-2": [258, 257],
  "2016-1-3": [247],
  "2016-1-4": [255],
  "2016-1-6": [265, 267, 248],
  "2016-1-7": [262, 265],
  "2018-1-4": [271, 275],
  "2018-1-5": [262, 260],
  "2018-1-8": [276],
  "2019-1-5": [275],
  "2019-1-7": [270, 271, 272],
  "2020-1-1": [247],
  "2020-1-4": [265],
  "2020-1-5": [275],
  "2020-1-7": [262, 248, 260],
  "2020-1-8": [272, 270],
  "2022-1-2": [255],
  "2022-1-3": [257, 258, 255],
  "2022-1-5": [274, 273, 271],
  "2022-1-6": [262, 265],
  "2022-1-7": [275],
  "2022-1-8": [271, 274, 273],
  "2022-1-S": [257, 275],
  "2023-1-2": [251],
  "2023-1-3": [255, 256],
  "2023-1-6": [255],
  "2023-1-7": [268, 267, 269],
  "2023-1-8": [271, 274, 273],
  "2023-1-S": [274, 273, 272, 262],
  "2024-1-1": [247],
  "2024-1-3": [258, 259],
  "2024-1-6": [262, 260, 250],
  "2012-2-2": [317],
  "2012-2-5": [313, 314],
  "2012-2-7": [322],
  "2013-2-3": [317],
  "2013-2-5": [317, 315],
  "2013-2-6": [317],
  "2014-2-2": [317],
  "2014-2-4": [317, 314],
  "2015-2-1": [310],
  "2015-2-2": [317, 315],
  "2015-2-3": [308, 301],
  "2015-2-5": [302, 307],
  "2015-2-6": [315, 317, 304],
  "2016-2-3": [317, 314],
  "2016-2-4": [317, 314],
  "2016-2-6": [324, 323],
  "2017-2-2": [307, 302, 305],
  "2017-2-3": [302, 307],
  "2017-2-4": [317],
  "2017-2-6": [324],
  "2018-2-2": [311, 312, 313, 314],
  "2018-2-3": [317],
  "2018-2-4": [317, 314],
  "2018-2-5": [317],
  "2019-2-1": [317],
  "2019-2-2": [302, 307, 301],
  "2019-2-3": [307, 304, 305],
  "2019-2-8": [322],
  "2020-2-2": [317],
  "2020-2-4": [311, 312, 313, 314],
  "2020-2-5": [317],
  "2020-2-6": [320, 325],
  "2021-2-2": [320, 309],
  "2021-2-3": [307, 304],
  "2021-2-4": [307, 308, 305],
  "2021-2-5": [315, 314],
  "2022-2-1": [310],
  "2022-2-2": [317, 315],
  "2022-2-3": [317, 314],
  "2022-2-4": [311, 313, 314],
  "2024-2-1": [310],
  "2024-2-2": [315],
  "2024-2-3": [317, 314],
  "2012-2-S": [314, 315, 316, 317],
  "2013-2-S": [307, 302, 304, 305, 321],
  "2015-2-S": [314, 316, 320, 317],
  "2016-2-S": [307, 302, 304, 305],
  "2017-2-S": [317, 314, 313, 304],
  "2018-2-S": [301, 302, 307, 308, 305],
  "2020-2-S": [307, 302, 304, 305],
  "2022-2-S": [301, 302, 307, 308, 305],
  "2024-2-S": [310, 311, 314, 317],
  "2013-3-S": [286, 284, 281, 277],
  "2014-3-S": [293, 277],
  "2018-3-S": [285, 286, 287, 289],
  "2024-3-S": [298, 287, 286],
  "2012-4-S": [347, 349, 350],
  "2014-4-S": [346, 351, 352],
};

const rules = new Map();
function addRules(sequence, ...patterns) {
  rules.set(sequence, patterns);
}

addRules(247, /astronomical unit|\bAU\b|typical (?:size|diameter).{0,80}(?:galaxy|star cluster|nebula)|arrange.{0,80}celestial bodies|best location.{0,80}observatory|telescope.{0,80}(?:atmosphere|Earth|Moon)/i);
addRules(248, /light[ -]?year/i);
addRules(249, /9\.46\s*[×x]?\s*10|convert.{0,30}light[ -]?year/i);
addRules(250, /\bparsec|\bpc\b|206\s*265/i);
addRules(251, /retrograde|Ptolemaic|Ptolemy|Copernican|geocentric|heliocentric|phases? of Venus|constellation|ecliptic|celestial equator/i);
addRules(255, /Kepler|orbital period|period.{0,80}(?:orbit|around)|semi-major|complete one (?:rotation|orbit)|circular orbit|orbiting around|orbits? (?:the|a) (?:Earth|Sun|star|Moon)|present orbit around the Sun|T\s*[²2].{0,15}[a-r]\s*[³3]/i);
addRules(256, /weightless/i);
addRules(257, /gravitational potential energy|potential energy.{0,30}infinity|[-−]\s*GMm/i);
addRules(258, /conservation of mechanical energy|kinetic energy.{0,60}gravitational potential|initial speed.{0,160}far away|speed when it is very far away|unpowered spacecraft.{0,80}(?:elliptical|orbit)/i);
addRules(259, /escape velocit/i);
addRules(260, /arc[ -]?second|angular (?:size|separation|displacement|scale)/i);
addRules(261, /206\s*265\s*AU/i);
addRules(262, /parallax/i);
addRules(263, /3\.09\s*[×x]?\s*10|3\.26\s*(?:ly|light)/i);
addRules(264, /luminosity.{0,40}(?:total energy|power emitted)/i);
addRules(265, /apparent brightness|brightness.{0,80}(?:distance|luminosity)|L\s*\/\s*\(?4\s*[πp]i?/i);
addRules(266, /apparent magnitude.{0,50}(?:measure|brightness)/i);
addRules(267, /apparent magnitude.{0,100}(?:luminosity|distance)|equal apparent brightness/i);
addRules(268, /absolute magnitude.{0,100}10\s*pc/i);
addRules(269, /absolute magnitude.{0,100}luminosity|same absolute magnitude/i);
addRules(270, /Wien|peak wavelength|lambda.{0,20}max|radiation curve.{0,80}temperature/i);
addRules(271, /spectral class|appears? (?:redder|bluer)|surface temperature.{0,100}(?:red|blue|colour)|intensity of (?:red|blue) light|absorption spectrum of (?:a )?star|chemical composition.{0,50}star|O\s*B\s*A\s*F\s*G\s*K\s*M/i);
addRules(272, /Stefan|blackbody|J\s*=\s*[σo].{0,10}T/i);
addRules(273, /luminosity.{0,80}(?:radius|surface temperature)|L\s*=\s*4\s*[πp].{0,20}R/i);
addRules(274, /times that of the Sun|in terms of R.{0,10}Sun|solar luminosity.{0,80}surface temperature/i);
addRules(275, /Doppler|red\s*shift|blue\s*shift|radial velocity|spectral line.{0,120}(?:wavelength|shift)|observed wavelength.{0,80}(?:line|spectrum)|absorption spectra.{0,120}galaxy/i);
addRules(276, /Hubble|receding velocity|rotation curve|dark matter|expansion of the universe/i);

addRules(300, /photoelectric effect is|emission of photoelectrons/i);
addRules(301, /stopping potential/i);
addRules(302, /maximum kinetic energy.{0,50}stopping potential|K.{0,10}max.{0,10}=.{0,10}eV/i);
addRules(303, /threshold frequency/i);
addRules(304, /energy of (?:a )?photon|photon.{0,30}frequency|E\s*=\s*h\s*f/i);
addRules(305, /work function/i);
addRules(306, /work function.{0,50}threshold|phi.{0,10}=.{0,10}h.{0,10}f/i);
addRules(307, /maximum kinetic energy.{0,80}(?:frequency|work function)|photoelectric equation|K.{0,10}max.{0,20}h/i);
addRules(308, /stopping potential.{0,100}(?:frequency|graph|slope)/i);
addRules(309, /wave[ -]?particle duality|light exhibits.{0,30}(?:wave|particle)/i);
addRules(310, /Rutherford|alpha[ -]?particles?.{0,120}(?:scatter|nucleus)|a[ -]?particles?.{0,120}(?:scatter|nucleus)|α particles?.{0,120}(?:scatter|nucleus)|particle.{0,80}(?:approaching|heavy|massive) nucleus|positive charge.{0,60}nucleus/i);
addRules(311, /angular momentum.{0,40}Bohr|m.{0,8}v.{0,8}r.{0,15}n.{0,8}h/i);
addRules(312, /quantized angular momentum|quantised angular momentum/i);
addRules(313, /radius.{0,80}(?:Bohr|electron.?s? orbit)|ratio of the radius|orbital radii|r.{0,8}n.{0,10}=.{0,15}n.{0,5}[²2]/i);
addRules(314, /energy levels?.{0,100}(?:-?13\.6|Bohr|hydrogen atom|drawn)|lowest.{0,30}energy levels|E.{0,8}n.{0,10}=.{0,15}-?13\.6/i);
addRules(315, /excitation energy|excited state|electron collides? with (?:a )?(?:gas )?atom.{0,80}excit/i);
addRules(316, /ioni[sz](?:e|ation|ing) (?:a )?(?:hydrogen )?atom|ionization energy/i);
addRules(317, /atomic spectra|line spectra|continuous spectrum|emission spectrum|absorption spectrum|transition.{0,100}(?:photon|wavelength)|emission lines?|absorption lines?|discrete (?:line )?spectrum|spectrum.{0,100}discrete lines|photons? (?:are )?emitted.{0,100}(?:energy level|wavelength)|h\s*f.{0,15}E/i);
addRules(318, /Rydberg|1\s*\/\s*(?:lambda|λ).{0,20}13\.6/i);
addRules(319, /momentum.{0,30}wavelength|p\s*=\s*h\s*\//i);
addRules(320, /de Broglie/i);
addRules(321, /nano.?scale|nanomet|\bnm\b.{0,30}(?:1|100)/i);
addRules(322, /bulk.{0,100}nano|nano.?sized.{0,120}(?:colour|conduct|strength|transparent|properties|zinc oxide|ZnO)|properties.{0,60}nano|sunscreen.{0,80}nano|nano.{0,80}sunscreen|Lotus effect/i);
addRules(323, /Rayleigh|just resolved|central maximum.{0,50}first.order minimum/i);
addRules(324, /resolving power|angular resolution|minimum resolvable|minimum separation.{0,100}(?:aperture|lens|camera|telescope)|distinguished by.{0,60}(?:camera|telescope)|1\.22.{0,20}(?:wavelength|lambda|λ)/i);
addRules(325, /transmission electron microscope|\bTEM\b|magnetic (?:objective )?lens/i);
addRules(326, /scanning tunnelling microscope|\bSTM\b|tunnelling current/i);

addRules(277, /end-use energy efficiency|energy efficiency.{0,60}(?:input|output|label)|energy label|annual energy consumption/i);
addRules(278, /electric hotplate|induction cooker|microwave oven/i);
addRules(279, /heat pump|reverse-cycle air-conditioner|refrigerator|refrigerant|evaporator|compressor.{0,50}condenser|expansion valve/i);
addRules(280, /Q.{0,5}H.{0,10}=.{0,10}Q.{0,5}C|heat removed.{0,60}electrical/i);
addRules(281, /cooling capacity|time required to cool|cool(?:ing)? (?:the )?(?:room|container|air)/i);
addRules(282, /coefficient of performance|\bCOP\b|energy label.{0,120}air-conditioner|air-conditioner.{0,120}energy label/i);
addRules(283, /luminous flux is|definition of luminous flux/i);
addRules(284, /illuminance.{0,50}(?:area|flux)|E\s*=\s*(?:Φ|phi).{0,5}\//i);
addRules(285, /luminous flux.{0,80}illuminance/i);
addRules(286, /illuminance.{0,100}(?:angle|distance|point source|cos)|lamp.{0,80}uniformly in all directions/i);
addRules(287, /luminous efficacy|efficacy of (?:the )?(?:lamp|light source)/i);
addRules(288, /illuminance.{0,30}lux|luminous flux.{0,50}area/i);
addRules(289, /luminous flux.{0,50}(?:input power|power rating)/i);
addRules(290, /thermal conductivity|rate of heat transfer by conduction|Q\s*\/\s*t.{0,20}(?:kappa|κ)/i);
addRules(291, /thermal transmittance|U-value/i);
addRules(292, /Overall Thermal Transfer Value|\bOTTV\b|energy efficiency of buildings?|windows?.{0,100}(?:air conditioning|heat transfer|glass)|building.{0,100}(?:insulat|roof|window film|dark colour)/i);
addRules(293, /regenerative braking|hybrid (?:car|vehicle)|electric vehicle.{0,80}braking/i);
addRules(294, /binding energy (?:of|per)|break a nucleus|nuclear fission reactor|moderator.{0,80}(?:neutron|fission)|chain reaction|control rods?|nuclear energy/i);
addRules(295, /mass defect|fission reaction.{0,120}(?:energy|mass)|energy.{0,100}fission/i);
addRules(296, /wind turbine|wind power/i);
addRules(297, /hydroelectric|water.{0,80}turbine|upper reservoir/i);
addRules(298, /solar constant|solar (?:cell|panel)|sunlight.{0,80}(?:panel|cell|electrical power)/i);
addRules(299, /greenhouse effect/i);

addRules(327, /accommodation of (?:an |the )?eye|eye.{0,60}accommodat/i);
addRules(328, /rods? and cones?|retina.{0,60}(?:colour|low light)/i);
addRules(329, /angular size.{0,50}eye|visual angle/i);
addRules(330, /Rayleigh|angular resolution.{0,50}(?:eye|pupil)/i);
addRules(331, /power of (?:a )?lens|P\s*=\s*1\s*\/\s*f/i);
addRules(332, /effective power.{0,50}(?:lenses|lens)/i);
addRules(333, /near[ -]?point|far[ -]?point/i);
addRules(334, /short[ -]?sighted|long[ -]?sighted|old[ -]?sighted|eye defect/i);
addRules(335, /spectacle.{0,80}(?:power|lens)|corrective lens/i);
addRules(336, /power of (?:the )?eye/i);
addRules(337, /effective power.{0,80}(?:eye|spectacle)/i);
addRules(338, /critical angle|total internal reflection|refractive index.{0,80}(?:core|cladding)/i);
addRules(339, /coherent bundle|incoherent bundle|fibre optic endoscope|optical fibre.{0,60}(?:image|illumination)/i);
addRules(340, /middle ear|ear bones|ossicles|eardrum.{0,50}oval window|pressure amplification/i);
addRules(341, /cochlea|frequency analyser|discerns frequency/i);
addRules(342, /sound intensity.{0,60}(?:energy|power|area)/i);
addRules(343, /sound intensity.{0,80}distance|loudspeaker.{0,80}distance|I\s*=\s*P\s*\//i);
addRules(344, /sound intensity level|decibel|\bdB\b|10\s*log/i);
addRules(345, /threshold of hearing|hearing loss/i);
addRules(346, /piezoelectric|ultrasound transducer.{0,80}(?:voltage|crystal)/i);
addRules(347, /acoustic impedance/i);
addRules(348, /intensity reflection coefficient/i);
addRules(349, /reflection coefficient.{0,100}(?:impedance|Z)/i);
addRules(350, /A-scan|B-scan|echoes received|pulse.{0,50}echo|thickness.{0,80}ultrasound/i);
addRules(351, /ultrasound.{0,80}(?:attenuation|penetration depth)|frequency.{0,50}penetration/i);
addRules(352, /ultrasound.{0,80}(?:axial )?resolution|frequency.{0,50}resolution/i);
addRules(353, /linear attenuation|X-ray beam.{0,80}(?:intensity|attenuat)|I\s*=\s*I.{0,5}0.{0,10}e/i);
addRules(354, /half-value thickness|half value thickness/i);
addRules(355, /density.{0,50}(?:attenuation|coefficient)/i);
addRules(356, /X-ray.{0,80}(?:frequency|energy|penetrating power)/i);
addRules(357, /layers?.{0,80}linear attenuation|total attenuation.{0,80}(?:different|multiple)/i);
addRules(358, /X-ray (?:radiographic )?image|radiograph/i);
addRules(359, /contrast medium|\bACM\b/i);
addRules(360, /computed tomography|\bCT\b.{0,20}scan|back projection/i);
addRules(361, /radionuclide imaging|gamma camera|tracer.{0,60}target organ/i);
addRules(362, /physical half-life/i);
addRules(363, /biological half-life/i);
addRules(364, /effective half-life/i);
addRules(365, /hot spot|cold spot/i);

function loadTextbookData() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(textbookPath, "utf8"), context);
  return context.window.DSE_TEXTBOOK_DATA.languages;
}

function normalizeToken(token) {
  let value = token.toLowerCase().replace(/^[-_]+|[-_]+$/g, "");
  if (value.length > 5 && value.endsWith("ies")) value = `${value.slice(0, -3)}y`;
  else if (value.length > 5 && value.endsWith("ing")) value = value.slice(0, -3);
  else if (value.length > 4 && value.endsWith("ed")) value = value.slice(0, -2);
  else if (value.length > 4 && value.endsWith("s") && !value.endsWith("ss")) value = value.slice(0, -1);
  return value;
}

function tokens(text) {
  return (String(text || "").match(/[A-Za-z][A-Za-z0-9-]*|[αβγθλμρφωΔπσ]+|\d+(?:\.\d+)?/g) || [])
    .map(normalizeToken)
    .filter((token) => token.length >= 2 && !stopwords.has(token) && !/^\d+$/.test(token));
}

function findPattern(text, pattern) {
  const match = pattern.exec(text);
  pattern.lastIndex = 0;
  return match ? match.index : -1;
}

function printedMarker(section, item) {
  return new RegExp(`^\\s*(?:#{1,6}\\s*)?${section}\\s*(?:\\.\\s*)?${item}[.]?(?=\\s|$)`, "gmi");
}

function structuredStart(text, afterIndex) {
  const pattern = /Q[^\n]{0,14}Structured question/gi;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > afterIndex) return match.index;
  }
  return text.length;
}

function splitRecord(record) {
  const text = record.question_text || "";
  const section = Number(record.question_number);
  const starts = [];
  for (let item = 1; item <= 8; item += 1) {
    const override = manualStarts[`${record.year}-${section}-${item}`];
    const start = override ? findPattern(text, override) : findPattern(text, printedMarker(section, item));
    starts.push(start);
  }
  const missing = starts.map((start, index) => start < 0 ? index + 1 : null).filter(Boolean);
  const ordered = starts.every((start, index) => start >= 0 && (index === 0 || start > starts[index - 1]));
  if (missing.length || !ordered) {
    throw new Error(`Cannot split ${record.id}; missing=${missing.join(",") || "none"}; starts=${starts.join(",")}`);
  }
  const structured = structuredStart(text, starts[7]);
  const items = starts.map((start, index) => text.slice(start, index < 7 ? starts[index + 1] : structured).trim());
  return { items, structured: text.slice(structured).trim() };
}

function termFrequency(items) {
  const counts = new Map();
  items.forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  return counts;
}

function cosine(queryTokens, docTokens, idf) {
  const queryCounts = termFrequency(queryTokens);
  const docCounts = termFrequency(docTokens);
  let dot = 0;
  let queryNorm = 0;
  let docNorm = 0;
  queryCounts.forEach((count, token) => {
    const value = (1 + Math.log(count)) * (idf.get(token) || 1);
    queryNorm += value * value;
    const docCount = docCounts.get(token);
    if (docCount) dot += value * (1 + Math.log(docCount)) * (idf.get(token) || 1);
  });
  docCounts.forEach((count, token) => {
    const value = (1 + Math.log(count)) * (idf.get(token) || 1);
    docNorm += value * value;
  });
  return dot / (Math.sqrt(queryNorm * docNorm) || 1);
}

function main() {
  const textbook = loadTextbookData();
  const englishPoints = textbook.eng;
  const chineseBySequence = new Map(textbook.chn.map((point) => [Number(point.sequence), point]));
  const pointsBySequence = new Map(englishPoints.map((point) => [Number(point.sequence), point]));
  const linkablePoints = englishPoints.filter((point) => point.book_key?.startsWith("elective-") && point.link_policy !== "standalone");
  const pointDocs = new Map(linkablePoints.map((point) => [
    Number(point.sequence),
    tokens(`${point.chapter} ${point.chapter} ${point.formula || point.content}`),
  ]));
  const documentFrequency = new Map();
  pointDocs.forEach((doc) => new Set(doc).forEach((term) => documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1)));
  const idf = new Map([...documentFrequency].map(([term, count]) => [term, Math.log((linkablePoints.length + 1) / (count + 1)) + 1]));

  const records = JSON.parse(fs.readFileSync(recordsPath, "utf8")).records
    .filter((record) => record.language === "en" && record.paper_id === "paper-2")
    .sort((a, b) => a.year - b.year || a.question_number - b.question_number);
  const network = {};
  const audit = { meta: {}, questions: {} };
  const selectedSetsBySection = new Map();

  for (const record of records) {
    const section = Number(record.question_number);
    const { items, structured } = splitRecord(record);
    const questionTexts = [...items, `${structured}\n${record.answer_transcription || ""}`];
    const identities = ["1", "2", "3", "4", "5", "6", "7", "8", "S"];
    const [minimumSequence, maximumSequence] = moduleSequences[section];
    const candidates = linkablePoints.filter((point) => point.sequence >= minimumSequence && point.sequence <= maximumSequence);

    questionTexts.forEach((questionText, index) => {
      const queryTokens = tokens(questionText);
      const ranked = candidates.map((point) => {
        const sequence = Number(point.sequence);
        const matchedRules = (rules.get(sequence) || []).filter((pattern) => {
          const matched = pattern.test(questionText);
          pattern.lastIndex = 0;
          return matched;
        });
        const similarity = cosine(queryTokens, pointDocs.get(sequence) || [], idf);
        const overlap = new Set((pointDocs.get(sequence) || []).filter((term) => queryTokens.includes(term))).size;
        return {
          point,
          sequence,
          score: similarity + matchedRules.length * 1.35 + Math.min(0.22, overlap * 0.018),
          similarity,
          overlap,
          ruleHits: matchedRules.length,
        };
      }).sort((a, b) => b.score - a.score || b.ruleHits - a.ruleHits || a.sequence - b.sequence);

      const maxLinks = index === 8 ? 5 : 3;
      let chosen = [];
      const seenContent = new Set();
      for (const candidate of ranked) {
        if (chosen.length >= maxLinks) break;
        const contentKey = `${candidate.point.code}|${String(candidate.point.formula || candidate.point.content).toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
        if (seenContent.has(contentKey)) continue;
        const strongest = ranked[0]?.score || 0;
        const supported = candidate === ranked[0]
          || (candidate.ruleHits > 0 && candidate.score >= strongest * 0.42)
          || (candidate.similarity >= 0.20 && candidate.overlap >= 2 && candidate.score >= strongest * 0.58);
        if (!supported) continue;
        seenContent.add(contentKey);
        chosen.push(candidate);
      }
      if (!chosen.length) chosen.push(ranked[0]);

      const identity = `${section}.${identities[index]}`;
      const reviewed = manualLinks[`${record.year}-${section}-${identities[index]}`];
      if (reviewed) {
        chosen = reviewed.map((sequence) => {
          const candidate = ranked.find((item) => item.sequence === sequence);
          if (!candidate) throw new Error(`Invalid reviewed Paper 2 link ${record.year}-${identity}: ${sequence}`);
          return candidate;
        });
      }
      const key = `${record.year}|paper-2|${identity}`;
      const links = chosen.map((candidate, linkIndex) => {
        const english = candidate.point;
        const chinese = chineseBySequence.get(candidate.sequence);
        return {
          sequence: candidate.sequence,
          code: english.code,
          bookKey: english.book_key,
          chapterEn: english.chapter,
          chapterZh: chinese?.chapter || english.chapter,
          type: linkIndex === 0 ? "primary" : "supporting",
        };
      });
      network[key] = {
        keywords: links.map((link) => `${link.code} ${link.chapterEn} ${link.chapterZh}`).join(" "),
        links,
      };
      audit.questions[key] = links.map((link) => link.sequence);
      const sectionKey = `${record.year}-${section}`;
      if (!selectedSetsBySection.has(sectionKey)) selectedSetsBySection.set(sectionKey, new Set());
      selectedSetsBySection.get(sectionKey).add(links.map((link) => link.sequence).join(","));
    });
  }

  const expectedQuestions = 13 * 4 * 9;
  const invalidModuleLinks = Object.entries(network).flatMap(([key, item]) => {
    const section = Number(key.split("|")[2].split(".")[0]);
    const [minimum, maximum] = moduleSequences[section];
    return item.links.filter((link) => link.sequence < minimum || link.sequence > maximum).map((link) => ({ key, sequence: link.sequence }));
  });
  const sectionsWithoutVariation = [...selectedSetsBySection].filter(([, sets]) => sets.size < 3).map(([key]) => key);
  audit.meta = {
    method: "individual-question answer-aware lexical mapping constrained to the exact Paper 2 elective module",
    questionCount: Object.keys(network).length,
    expectedQuestions,
    everyQuestionLinked: Object.values(network).every((item) => item.links.length > 0),
    invalidModuleLinks,
    sectionsWithoutVariation,
  };
  if (audit.meta.questionCount !== expectedQuestions || !audit.meta.everyQuestionLinked || invalidModuleLinks.length || sectionsWithoutVariation.length) {
    throw new Error(`Paper 2 knowledge validation failed: ${JSON.stringify(audit.meta)}`);
  }

  fs.writeFileSync(outputPath, `window.DSE_PAPER2_KNOWLEDGE = ${JSON.stringify(network)};\n`);
  fs.writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
  console.log(`Generated ${audit.meta.questionCount} individual Paper 2 knowledge mappings.`);
}

if (path.resolve(process.argv[1] || "") === path.resolve(import.meta.filename)) main();

export { splitRecord };
