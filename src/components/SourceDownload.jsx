import { track } from '../lib/activity';
import manifest from '../../downloads/catalog.json';

export function SourceDownload({ language, year, paper }) {
  if (!year || !paper) return null;
  const file = manifest.files.find(item => item.language === language && item.kind === 'paper' && item.edition === 'original' && item.year === Number(year) && item.paper === paper);
  if (!file) {
    if (!year || !paper) return null;
    return <span className="source-download-unavailable">{language === 'chn' && Number(year) === 2025
      ? '2025 原卷仅有英文版，请切换至 ENG 下载。'
      : '此年份的中文原卷暂未提供。'}</span>;
  }
  return <a onClick={() => track('download', file.url)} className="source-download" href={file.url} download={file.name}>
    {'下载原卷 PDF'}
  </a>;
}
