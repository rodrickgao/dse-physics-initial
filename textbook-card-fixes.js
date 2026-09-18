(function applyTextbookCardFixes(global) {
  "use strict";

  const data = global.DSE_TEXTBOOK_DATA;
  if (!data?.languages) return;

  const overrides = {
    eng: {
      18: { content: "For a closed thermal system, the total energy remains constant: energy cannot be created or destroyed, only transferred or transformed." },
      46: { content: "For uniform motion:\n• speed is constant;\n• the direction of motion is unchanged, so velocity is constant;\n• acceleration is zero." },
      55: { display_mode: "prose", content: "Near the Earth’s surface, if air resistance is negligible, every freely falling object has an acceleration g = 9.81 m s⁻² vertically downward." },
      56: { display_mode: "prose", content: "Free fall means that gravity is the only force acting on an object. Its acceleration is therefore g = 9.81 m s⁻² vertically downward, whether the object is moving upward or downward." },
      63: { content: "Mass and weight are different:\n• Mass measures inertia. It is a scalar measured in kilograms (kg) and does not change with location.\n• Weight is the gravitational force acting on an object, W = mg. It is a vector measured in newtons (N) and changes when g changes." },
      77: { formula_notes: "KE: kinetic energy (J); m: mass (kg); v: speed (m s⁻¹)" },
      80: { content: "In a closed system, total energy is conserved. Energy may change form, but the total amount cannot be created or destroyed." },
      85: { formula_notes: "P: instantaneous power (W); F: force parallel to the motion (N); v: instantaneous speed (m s⁻¹)" },
      86: { formula_notes: "KE: translational kinetic energy; use the object’s instantaneous speed v" },
      88: { formula_notes: "For a force parallel to the object’s velocity; P is the instantaneous rate of doing work" },
      104: { formula_notes: "g: acceleration due to gravity (m s⁻²); M: mass of the celestial body (kg); r: distance from its centre of mass (m)" },
      106: { formula_notes: "g: gravitational field strength (N kg⁻¹); M: mass producing the field (kg); r: distance from its centre of mass (m)" },
      173: { formula_notes: "V: potential difference between two points (V); E: electrical potential energy converted by a load (J); Q: charge (C)" },
      174: { formula_notes: "V: voltage (V); E: change in electrical potential energy (J); Q: charge moved (C)" },
      198: { content: "Right-hand grip rule for a straight current-carrying wire: point your right thumb in the direction of conventional current. The curl of your fingers gives the direction of the circular magnetic field lines around the wire." },
      200: { content: "Inside a long solenoid, the field lines are straight, parallel and evenly spaced, so the magnetic field is approximately uniform.\nOutside the solenoid, the field pattern is similar to that of a bar magnet: one end is a north pole and the other is a south pole." },
      201: { content: "Right-hand grip rule for a solenoid: curl the fingers of your right hand in the direction of conventional current around the turns. Your extended thumb points along the magnetic field inside the solenoid and towards its north pole." },
      202: { content: "An electromagnet can be made stronger by:\n1 increasing the number of turns per unit length of the coil;\n2 increasing the current through the coil;\n3 inserting a soft-iron core into the coil." },
      232: { content: "An atom consists of a tiny nucleus containing protons and neutrons, with electrons surrounding it. Most of the atom is empty space." },
      278: { content: "• Electric hotplate: current in a resistance coil produces heat.\n• Induction cooker: an alternating current produces a changing magnetic field, inducing eddy currents in the metal pot; the pot is heated by their heating effect.\n• Microwave oven: an oscillating electric field makes polar water molecules rotate rapidly; collisions increase the molecules’ total kinetic energy and heat the food." },
      284: { formula_notes: "E: illuminance (lx); Φ: luminous flux received (lm); A: illuminated area (m²)" },
      287: { display_mode: "prose", content: "Luminous efficacy measures how much visible luminous flux a lamp produces per watt of input power. A higher luminous efficacy means that the lamp converts electrical power into useful light more effectively." },
      288: { formula_notes: "Use when luminous flux Φ is distributed uniformly over area A" },
      289: { formula_notes: "luminous flux: useful light output (lm); input power: rated electrical power (W)" },
      324: { formula_notes: "θ_R: angular resolution (rad); λ: wavelength (m); d: aperture diameter (m)" },
      330: { formula_notes: "Rayleigh criterion for the eye; θ_R: minimum resolvable angular separation (rad); λ: wavelength (m); d: pupil diameter (m)" },
      334: { content: "Common vision defects and their correction:\n• Short-sightedness: distant objects are blurred because the eyeball is too long or the eye lens is too powerful; correct with a diverging lens.\n• Long-sightedness: near objects are blurred because the eyeball is too short or the eye lens is too weak; correct with a converging lens.\n• Presbyopia (old-sightedness): near objects are blurred because the eye lens loses elasticity with age; correct with a converging lens." },
    },
    chn: {
      18: { content: "在封閉的熱系統內，總能量保持不變：能量不能被創造或毀滅，只能轉移或轉化。" },
      46: { content: "物體作勻速運動時：\n• 速率保持不變；\n• 運動方向不變，因此速度保持不變；\n• 加速度為零。" },
      55: { content: "在地球表面附近，若空氣阻力可忽略，所有自由下落物體的加速度均為 g = 9.81 m s⁻²，方向鉛直向下。" },
      56: { content: "自由落體是指物體只受重力作用。無論物體當時向上或向下運動，其加速度均為 g = 9.81 m s⁻²，方向鉛直向下。" },
      63: { content: "質量與重量並不相同：\n• 質量量度物體的慣性，是以千克 (kg) 為單位的標量，不會隨地點改變。\n• 重量是作用在物體上的引力，W = mg，是以牛頓 (N) 為單位的矢量，會隨 g 改變。" },
      80: { content: "在封閉系統內，總能量守恆。能量可以由一種形式轉化成另一種形式，但總量不能被創造或毀滅。" },
      198: { content: "長直載流導線的右手螺旋定則：右手拇指指向傳統電流方向，其餘四指彎曲的方向就是導線周圍環形磁力線的方向。" },
      200: { content: "在長螺線管內，磁力線筆直、互相平行且間距均勻，所以磁場近似均勻。\n在螺線管外，磁場圖形與磁棒相似：一端為北極，另一端為南極。" },
      201: { content: "螺線管的右手螺旋定則：右手四指沿線圈中的傳統電流方向彎曲，伸直的拇指便指向螺線管內的磁場方向，並指向螺線管的北極。" },
      202: { content: "增強電磁鐵的方法：\n1 增加線圈每單位長度的匝數；\n2 增大通過線圈的電流；\n3 在線圈內插入軟鐵心。" },
      232: { content: "原子由細小的原子核和核外電子組成；原子核內有質子和中子，而原子的大部分空間都是空的。" },
      278: { content: "• 電熱板：電流通過電阻線圈時產生熱。\n• 電磁爐：交流電產生變化磁場，在金屬鍋內感生渦電流；渦電流的熱效應使鍋發熱。\n• 微波爐：振盪電場使食物中的極性水分子快速轉動；分子碰撞令總動能增加，使食物升溫。" },
      287: { content: "光視效能表示燈具每瓦輸入功率所產生的可見光通量。光視效能愈高，表示燈具把電功率轉化成有用光的效能愈高。" },
      334: { content: "常見視力問題及其矯正方法：\n• 近視：眼球過長或眼球晶狀體屈光力過強，遠物影像模糊；以發散透鏡矯正。\n• 遠視：眼球過短或眼球晶狀體屈光力過弱，近物影像模糊；以會聚透鏡矯正。\n• 老花：晶狀體隨年齡增長而失去彈性，近物影像模糊；以會聚透鏡矯正。" },
    },
  };

  for (const language of ["eng", "chn"]) {
    for (const point of data.languages[language] || []) {
      Object.assign(point, overrides[language]?.[point.sequence] || {});
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
