import './brand-logo.css';
export function BrandLogo({language='chn'}) {return <img className="signature-logo" src={`/assets/brand/signature-${language==='eng'?'eng':'chn'}.png`} alt={language==='eng'?'ddphysics':'高多多物理'} width="2172" height="724"/>;}
