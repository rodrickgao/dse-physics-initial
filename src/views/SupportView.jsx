import { useState } from 'react';
import { Copy, Check, LifeBuoy } from 'lucide-react';
export function SupportView({language='chn'}) {
 const en=language==='eng';const [copied,setCopied]=useState(false),[failed,setFailed]=useState(false);
 async function copy(){try{await navigator.clipboard.writeText('rodrick666');setCopied(true);setFailed(false);}catch{setFailed(true);setCopied(false);}}
 return <section className="support-view"><h1><LifeBuoy aria-hidden="true"/>{en?'Technical support':'技术支持'}</h1><p>{en?'Contact us by email or Xiaohongshu.':'问题反馈：邮箱或小红书联系。'}</p><div className="support-card support-email"><span>{en?'Email':'邮箱'}</span><a href="mailto:rodrickgao@gmail.com">rodrickgao@gmail.com</a></div><div className="support-card"><span>{en?'Xiaohongshu ID':'小红书 ID'}</span><strong>rodrick666</strong><button type="button" onClick={copy}>{copied?<Check aria-hidden="true"/>:<Copy aria-hidden="true"/>}{en?(copied?'Copied':'Copy ID'):(copied?'已复制':'复制 ID')}</button><p role="status">{failed?(en?'Please select and copy rodrick666 manually.':'请长按或选中 rodrick666 手动复制。'):(en?'':'')}</p></div></section>;
}
export function LoginSupport({language}) {return <details className="login-support"><summary>{language==='eng'?'Technical support':'技术支持'}</summary><SupportView language={language}/></details>;}
