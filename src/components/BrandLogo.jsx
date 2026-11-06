const brandImages = { chn: '/assets/brand/signature-chn.png', eng: '/assets/brand/signature-eng.png' };
export function BrandLogo({language='chn'}) {return <img className="signature-logo" src={brandImages[language==='eng'?'eng':'chn']} alt={language==='eng'?'ddphysics':'高多多物理'} width="2172" height="724"/>;}
