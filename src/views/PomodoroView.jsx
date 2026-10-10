import { Button } from '../components/ui/button';

export function PomodoroView({ timer, language, visible }) {
  if (!timer) return null;
  const { session, remaining, running, start, pause, reset, time } = timer;
  const en = language === 'eng';
  return <section className="focus-view" hidden={!visible}>
    <div className="view-heading"><div><h1>{'番茄钟'}</h1></div></div>
    <div data-tour="focus-controls" className="focus-panel">
      <div className="focus-ring">
        <svg viewBox="0 0 240 240" aria-hidden="true"><circle className="focus-track" cx="120" cy="120" r="108" /><circle className="focus-progress" cx="120" cy="120" r="108" pathLength="100" strokeDasharray="100" strokeDashoffset={100 * (1 - remaining / (session.minutes * 60000))} /></svg>
        <div className="focus-readout"><span>{'剩余时间'}</span><strong role="timer" aria-label={'剩余时间'}>{time}</strong><small role="status">{remaining === 0 ? ('专注完成！休息一下吧。') : running ? ('专注中，加油！') : remaining < session.minutes * 60000 ? ('已暂停') : ('准备好就开始吧')}</small></div>
      </div>
      <div className="focus-duration"><label htmlFor="focus-minutes">{'专注时长'}<strong>{session.minutes} min</strong></label><input id="focus-minutes" type="range" min="30" max="180" step="1" value={session.minutes} disabled={running} onChange={event => reset(Number(event.target.value))} /><div className="focus-range-labels"><span>30 min</span><span>180 min</span></div></div>
      <div className="focus-buttons"><Button onClick={running ? pause : start}>{running ? ('暂停') : remaining === 0 ? ('再专注一次') : remaining < session.minutes * 60000 ? ('继续专注') : ('开始专注')}</Button><Button variant="outline" onClick={() => reset()}>{'重设'}</Button></div>
      
    </div>
  </section>;
}
