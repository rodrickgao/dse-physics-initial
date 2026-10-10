// The first five entries are the requested quick choices; other entries cover provinces and regions.
export const REGIONS = [
  ['beijing', '北京', 'Beijing'], ['shanghai', '上海', 'Shanghai'],
  ['guangzhou', '广州', 'Guangzhou'], ['shenzhen', '深圳', 'Shenzhen'], ['hong-kong', '香港', 'Hong Kong'],
  ['tianjin', '天津', 'Tianjin'], ['chongqing', '重庆', 'Chongqing'],
  ['hebei', '河北', 'Hebei'], ['shanxi', '山西', 'Shanxi'], ['inner-mongolia', '内蒙古', 'Inner Mongolia'],
  ['liaoning', '辽宁', 'Liaoning'], ['jilin', '吉林', 'Jilin'], ['heilongjiang', '黑龙江', 'Heilongjiang'],
  ['jiangsu', '江苏', 'Jiangsu'], ['zhejiang', '浙江', 'Zhejiang'], ['anhui', '安徽', 'Anhui'],
  ['fujian', '福建', 'Fujian'], ['jiangxi', '江西', 'Jiangxi'], ['shandong', '山东', 'Shandong'],
  ['henan', '河南', 'Henan'], ['hubei', '湖北', 'Hubei'], ['hunan', '湖南', 'Hunan'],
  ['guangdong', '广东', 'Guangdong'], ['guangxi', '广西', 'Guangxi'], ['hainan', '海南', 'Hainan'],
  ['sichuan', '四川', 'Sichuan'], ['guizhou', '贵州', 'Guizhou'], ['yunnan', '云南', 'Yunnan'],
  ['tibet', '西藏', 'Tibet'], ['shaanxi', '陕西', 'Shaanxi'], ['gansu', '甘肃', 'Gansu'],
  ['qinghai', '青海', 'Qinghai'], ['ningxia', '宁夏', 'Ningxia'], ['xinjiang', '新疆', 'Xinjiang'],
  ['macau', '澳门', 'Macau'], ['taiwan', '台湾', 'Taiwan'], ['overseas', '其他／海外', 'Other / Overseas']
].map(([value, label, labelEn]) => ({value, label, labelEn}));
export const REGION_IDS = new Set(REGIONS.map(region => region.value));
export function regionLabel(value, language = 'chn') {
  const region = REGIONS.find(region => region.value === value);
  return region ? region[language === 'eng' ? 'labelEn' : 'label'] : (language === 'eng' ? 'Not set' : '未填写');
}
