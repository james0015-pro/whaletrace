import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MOCK_TRADES, MOCK_RESONANCE_SIGNALS, MOCK_INSTITUTION_ORDERS } from '@/lib/mock-data';
import type { InsiderTrade, ResonanceSignal } from '@/types';
import type { InstitutionOrder } from '@/lib/mock-data';

/* ============================================================
   BLOOMBERG TERMINAL
   Click: Insider → history | Ticker → all trades | Institution → flow
   ============================================================ */

const ROW_H = 20;
const ALL: InsiderTrade[] = MOCK_TRADES;
const SIGS: ResonanceSignal[] = MOCK_RESONANCE_SIGNALS;
const INSTS: InstitutionOrder[] = MOCK_INSTITUTION_ORDERS;

function Row({ children, h, onClick }: { children: React.ReactNode; h?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', height: ROW_H, cursor: onClick ? 'pointer' : 'default',
      padding: '0 6px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace',
      background: h ? 'rgba(255,255,255,0.03)' : 'transparent',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }} onMouseEnter={onClick ? (e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,140,0,0.1)'; } : undefined}
       onMouseLeave={onClick ? (e) => { (e.currentTarget as HTMLElement).style.background = h ? 'rgba(255,255,255,0.03)' : 'transparent'; } : undefined}>
      {children}
    </div>
  );
}

function Hdr({ title, detail }: { title: string; detail?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 22, padding: '0 8px',
      background: '#0a0a0a', borderBottom: '1px solid #1f1f1f', fontSize: '10px', fontWeight: 700, color: '#ff8c00',
      letterSpacing: 1, textTransform: 'uppercase' }}>
      <span>{title}</span>
      {detail && <span style={{ color: '#555', fontWeight: 400, fontSize: 9 }}>{detail}</span>}
    </div>
  );
}

const F = (v: number | null | undefined): string => {
  if (v == null) return '     —';
  if (v >= 1e9) return (v/1e9).toFixed(2)+'B';
  if (v >= 1e6) return (v/1e6).toFixed(1)+'M';
  if (v >= 1e3) return (v/1e3).toFixed(0)+'K';
  return String(v);
};
const S = (s: string, n: number): string => s.length > n ? s.slice(0, n) : s;
type FM = 'all'|'buy'|'sell'|'cluster';
type DetailMode = 'insider'|'ticker'|'institution';
type DetailTarget = { mode: DetailMode; label: string; subtitle?: string };

/* ============================================================
   Detail Panel — 3 modes
   ============================================================ */
function DetailPanel({ target, onClose }: { target: DetailTarget; onClose: () => void }) {
  let rows: { date: string; ticker: string; entity: string; dir: string; shares: number; price: number; value: number; note: string }[] = [];
  let title = target.label;
  let sub = target.subtitle || '';

  if (target.mode === 'insider') {
    // All trades by this insider
    const history = ALL.filter(t => t.insider_name === target.label)
      .sort((a, b) => b.trade_date.localeCompare(a.trade_date));
    rows = history.map(t => ({
      date: t.trade_date, ticker: t.ticker, entity: t.ticker,
      dir: t.transaction_type, shares: t.shares, price: t.price ?? 0,
      value: t.total_value, note: t.is_10b5_1 ? '10B5-1' : t.signal_category === 'CLUSTER' ? 'CLUSTER' : '',
    }));
    // Add historical mock (2yr)
    const base = new Date(history[0]?.trade_date || '2026-05-01');
    for (let m = 1; m <= 24; m++) {
      const d = new Date(base); d.setMonth(d.getMonth() - m);
      if (Math.random() > 0.4) {
        const tk = ['AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','JPM'][Math.floor(Math.random()*8)];
        const sh = Math.floor(Math.random()*50000)+100;
        const pr = +(Math.random()*500+10).toFixed(2);
        const isB = Math.random()>0.5;
        rows.push({ date: d.toISOString().slice(0,10), ticker: tk, entity: tk,
          dir: isB?'BUY':'SELL', shares: sh, price: pr, value: +(sh*pr).toFixed(2), note: '' });
      }
    }
    sub = `Insider · ${history.length} real + historical`;
  } else if (target.mode === 'ticker') {
    // All trades for this ticker (insiders)
    const tk = target.label;
    const trades = ALL.filter(t => t.ticker === tk)
      .sort((a, b) => b.trade_date.localeCompare(a.trade_date));
    rows = trades.map(t => ({
      date: t.trade_date, ticker: t.ticker, entity: t.insider_name,
      dir: t.transaction_type, shares: t.shares, price: t.price ?? 0,
      value: t.total_value, note: t.title?.slice(0,20) || '',
    }));
    // Add historical
    const base = new Date(trades[0]?.trade_date || '2026-05-01');
    const insiders = [...new Set(trades.map(t => t.insider_name))].slice(0, 5);
    for (let m = 1; m <= 24; m++) {
      const d = new Date(base); d.setMonth(d.getMonth() - m);
      if (Math.random() > 0.3) {
        const ins = insiders[Math.floor(Math.random()*insiders.length)] || 'Unknown';
        const sh = Math.floor(Math.random()*100000)+100;
        const pr = +(Math.random()*600+10).toFixed(2);
        const isB = Math.random()>0.5;
        rows.push({ date: d.toISOString().slice(0,10), ticker: tk, entity: ins,
          dir: isB?'BUY':'SELL', shares: sh, price: pr, value: +(sh*pr).toFixed(2), note: '' });
      }
    }
    sub = `${tk} · ${trades.length} insider + institution trades`;
  } else if (target.mode === 'institution') {
    // Institution flow history (2yr simulated)
    const inst = target.label;
    const base = new Date('2026-05-15');
    const tickers = ['AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','JPM','V','WMT'];
    for (let m = 0; m <= 24; m++) {
      const d = new Date(base); d.setMonth(d.getMonth() - m);
      if (m === 0 || Math.random() > 0.5) {
        const tk = tickers[Math.floor(Math.random()*tickers.length)];
        const sh = Math.floor(Math.random()*5000000)+10000;
        const pr = +(Math.random()*1000+10).toFixed(2);
        const isB = Math.random()>0.35;
        rows.push({ date: d.toISOString().slice(0,10), ticker: tk, entity: inst,
          dir: isB?'BUY':'SELL', shares: sh, price: pr, value: +(sh*pr).toFixed(2),
          note: m===0?'LATEST':m<3?'RECENT':'' });
      }
    }
    sub = `${inst} · 2YR flow history`;
  }

  rows.sort((a, b) => b.date.localeCompare(a.date));
  const totalB = rows.filter(r => r.dir==='BUY').reduce((s,r)=>s+r.value,0);
  const totalS = rows.filter(r => r.dir==='SELL').reduce((s,r)=>s+r.value,0);

  return (
    <div style={{ position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:50,background:'#000',display:'flex',flexDirection:'column' }}>
      <div style={{ display:'flex',alignItems:'center',padding:'4px 8px',background:'#0a0a0a',borderBottom:'1px solid #1f1f1f',gap:12 }}>
        <button onClick={onClose} style={{ background:'transparent',border:'1px solid #333',color:'#ff8c00',cursor:'pointer',padding:'2px 8px',fontSize:10,fontFamily:'JetBrains Mono,monospace' }}>ESC BACK</button>
        <span style={{ color:'#ff8c00',fontWeight:700,fontSize:12 }}>{title}</span>
        <span style={{ color:'#888',fontSize:10 }}>{sub}</span>
        <span style={{ marginLeft:'auto',color:'#555',fontSize:9 }}>{rows.length} rows | 🟢{F(totalB)} 🔴{F(totalS)}</span>
      </div>
      <div style={{ flex:1,overflow:'auto' }}>
        <Row>
          <span style={{ width:60,color:'#555' }}>DATE</span>
          <span style={{ width:55,color:'#555' }}>TICKER</span>
          <span style={{ width: target.mode==='ticker'?130:target.mode==='institution'?55:55,color:'#555' }}>{target.mode==='ticker'?'INSIDER':target.mode==='institution'?'TYPE':'TICKER'}</span>
          <span style={{ width:45,color:'#555',textAlign:'right' }}>DIR</span>
          <span style={{ width:65,color:'#555',textAlign:'right' }}>SHARES</span>
          <span style={{ width:65,color:'#555',textAlign:'right' }}>PRICE</span>
          <span style={{ width:75,color:'#555',textAlign:'right' }}>VALUE</span>
          <span style={{ flex:1,color:'#555' }}>NOTE</span>
        </Row>
        {rows.map((r,i)=>(
          <Row key={i} h={i%2===0}>
            <span style={{ width:60,color:'#e6e6e6' }}>{r.date.slice(2)}</span>
            <span style={{ width:55,color:'#ff8c00',fontWeight:500 }}>{r.ticker}</span>
            <span style={{ width:target.mode==='ticker'?130:target.mode==='institution'?55:55,color:'#e6e6e6',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {S(target.mode==='ticker'?r.entity:target.mode==='institution'?r.dir:r.ticker, target.mode==='ticker'?16:10)}
            </span>
            <span style={{ width:45,textAlign:'right',color:r.dir==='BUY'?'#0c6':'#f33',fontWeight:600 }}>{r.dir==='BUY'?'BUY':'SEL'}</span>
            <span style={{ width:65,textAlign:'right',color:'#e6e6e6' }}>{F(r.shares)}</span>
            <span style={{ width:65,textAlign:'right',color:'#e6e6e6' }}>{r.price.toFixed(2)}</span>
            <span style={{ width:75,textAlign:'right',color:r.dir==='BUY'?'#0c6':'#f33' }}>{F(r.value)}</span>
            <span style={{ flex:1,color:'#555',fontSize:10,paddingLeft:8 }}>{r.note}</span>
          </Row>
        ))}
      </div>
      <div style={{ display:'flex',padding:'4px 8px',gap:16,background:'#0a0a0a',borderTop:'1px solid #1f1f1f',fontSize:9,color:'#888' }}>
        <span>Net: <span style={{ color:totalB>totalS?'#0c6':'#f33' }}>{F(totalB-totalS)}</span></span>
        <span style={{ marginLeft:'auto' }}>🐋 WhaleTrace</span>
      </div>
    </div>
  );
}

/* ============================================================
   Main Page
   ============================================================ */
export default function FeedPage() {
  const { t } = useTranslation();
  const [f, setF] = useState<FM>('all');
  const [cmd, setCmd] = useState('');
  const [msg, setMsg] = useState('');
  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const inp = useRef<HTMLInputElement>(null);

  const filtered = (() => {
    switch (f) {
      case 'buy': return ALL.filter(t => t.transaction_type === 'BUY');
      case 'sell': return ALL.filter(t => t.transaction_type === 'SELL');
      case 'cluster': return ALL.filter(t => t.signal_category === 'CLUSTER');
      default: return ALL;
    }
  })().slice(0, 35);

  const buyN = ALL.filter(t => t.transaction_type === 'BUY').length;
  const sellN = ALL.filter(t => t.transaction_type === 'SELL').length;
  const cluN = ALL.filter(t => t.signal_category === 'CLUSTER').length;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey||e.metaKey||e.altKey) return;
      if (detail) { if (e.key==='Escape') setDetail(null); return; }
      if (e.target instanceof HTMLInputElement && e.key !== 'Escape') return;
      if (e.key==='1'){setF('all');setMsg('ALL');}
      if (e.key==='2'){setF('buy');setMsg('BUY only');}
      if (e.key==='3'){setF('sell');setMsg('SELL only');}
      if (e.key==='4'){setF('cluster');setMsg('CLUSTER');}
      if (e.key==='/'||e.key==='`'){e.preventDefault();inp.current?.focus();setMsg('');}
      if (e.key==='Escape'){inp.current?.blur();setCmd('');setMsg('');}
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [detail]);

  const onCmd = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    const v = cmd.trim().toLowerCase(); setCmd('');
    if (v==='all'||v==='1'){setF('all');setMsg('ALL');}
    else if (v==='buy'||v==='2'){setF('buy');setMsg('BUY only');}
    else if (v==='sell'||v==='3'){setF('sell');setMsg('SELL only');}
    else if (v==='cluster'||v==='4'){setF('cluster');setMsg('CLUSTER');}
    else if (v.startsWith('/')){setMsg('Search: '+v.slice(1).toUpperCase());}
    else {setMsg('Unknown: '+v);}
    inp.current?.blur();
    setTimeout(()=>setMsg(''),2500);
  };

  const fLabel = f==='buy'?'🟢 BUY':f==='sell'?'🔴 SELL':f==='cluster'?'🟣 CLUSTER':'◉ ALL';

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#000',position:'relative'}}>
      <div style={{display:'flex',alignItems:'center',height:22,padding:'0 8px',fontSize:9,color:'#888',background:'#0a0a0a',borderBottom:'1px solid #1f1f1f',gap:12}}>
        <span style={{color:'#fff',fontWeight:600}}>{fLabel}</span>
        <span>{filtered.length} rows</span>
        <span>🟢{buyN} 🔴{sellN} 🟣{cluN}</span>
        <span style={{marginLeft:'auto',color:msg?'#ff8c00':'#555'}}>{msg||'1-4:filter /=cmd  ENTER=detail'}</span>
      </div>

      {detail ? (
        <DetailPanel target={detail} onClose={() => setDetail(null)} />
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gridTemplateRows:'1fr 1fr',flex:1,overflow:'hidden'}}>
          {/* Q1: Insider Trades */}
          <div style={{borderRight:'1px solid #1f1f1f',borderBottom:'1px solid #1f1f1f',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <Hdr title={t('feed.section_insider_trades')||'INSIDER TRADES'} detail={`CLICK: insider/ticker`} />
            <div style={{flex:1,overflow:'auto'}}>
              <Row><span style={{width:50,color:'#555'}}>TICKER</span><span style={{width:110,color:'#555'}}>INSIDER</span><span style={{width:38,color:'#555',textAlign:'right'}}>DIR</span><span style={{width:55,color:'#555',textAlign:'right'}}>SHARES</span><span style={{width:55,color:'#555',textAlign:'right'}}>PRICE</span><span style={{width:65,color:'#555',textAlign:'right'}}>VALUE</span><span style={{width:52,color:'#555',textAlign:'right'}}>DATE</span></Row>
              {filtered.map((t,i)=>(
                <Row key={t.id} h={i%2===0}>
                  <span onClick={(e)=>{e.stopPropagation();setDetail({mode:'ticker',label:t.ticker,subtitle:t.company_name});}}
                    style={{width:50,color:'#ff8c00',fontWeight:600,cursor:'pointer',textDecoration:'underline',display:'inline-block',height:ROW_H,lineHeight:`${ROW_H}px`,verticalAlign:'middle'}}>{t.ticker}</span>
                  <span onClick={()=>setDetail({mode:'insider',label:t.insider_name,subtitle:t.title})}
                    style={{width:110,color:'#e6e6e6',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',cursor:'pointer'}}>{S(t.insider_name,14)}</span>
                  <span style={{width:38,textAlign:'right',color:t.transaction_type==='BUY'?'#0c6':'#f33',fontWeight:600}}>{t.transaction_type==='BUY'?'BUY':'SEL'}</span>
                  <span style={{width:55,textAlign:'right',color:'#e6e6e6'}}>{F(t.shares)}</span>
                  <span style={{width:55,textAlign:'right',color:'#e6e6e6'}}>{(t.price??0).toFixed(2)}</span>
                  <span style={{width:65,textAlign:'right',color:t.transaction_type==='BUY'?'#0c6':'#f33'}}>{F(t.total_value)}</span>
                  <span style={{width:52,textAlign:'right',color:'#888'}}>{t.trade_date.slice(5)}</span>
                </Row>
              ))}
            </div>
          </div>

          {/* Q2: Resonance Signals */}
          <div style={{borderBottom:'1px solid #1f1f1f',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <Hdr title={t('feed.section_signals')||'RESONANCE SIGNALS'} detail={`${SIGS.length} active`} />
            <div style={{flex:1,overflow:'auto'}}>
              <Row><span style={{width:50,color:'#555'}}>TICKER</span><span style={{width:90,color:'#555'}}>COMPANY</span><span style={{width:70,color:'#555',textAlign:'right'}}>INST BUY</span><span style={{width:35,color:'#555',textAlign:'right'}}>#I</span><span style={{width:35,color:'#555',textAlign:'right'}}>#P</span><span style={{width:55,color:'#555',textAlign:'right'}}>STR</span><span style={{width:65,color:'#555'}}>BAR</span></Row>
              {SIGS.map((s,i)=>(
                <Row key={s.ticker} h={i%2===0}>
                  <span onClick={()=>setDetail({mode:'ticker',label:s.ticker,subtitle:s.company_name})}
                    style={{width:50,color:'#ff8c00',fontWeight:600,cursor:'pointer',textDecoration:'underline'}}>{s.ticker}</span>
                  <span style={{width:90,color:'#e6e6e6',overflow:'hidden',textOverflow:'ellipsis'}}>{S(s.company_name,11)}</span>
                  <span style={{width:70,textAlign:'right',color:'#0c6'}}>{F(s.total_institutional_buy)}</span>
                  <span style={{width:35,textAlign:'right',color:'#e6e6e6'}}>{s.institution_count}</span>
                  <span style={{width:35,textAlign:'right',color:'#e6e6e6'}}>{s.insider_buy_count}</span>
                  <span style={{width:55,textAlign:'right',color:'#ff8c00',fontWeight:700}}>{s.signal_strength}</span>
                  <span style={{width:65,paddingLeft:2}}><span style={{display:'inline-block',width:55,height:5,background:'#333',verticalAlign:'middle'}}><span style={{display:'block',width:`${s.signal_strength}%`,height:'100%',background:'#ff8c00'}}/></span></span>
                </Row>
              ))}
            </div>
          </div>

          {/* Q3: Institution Flow */}
          <div style={{borderRight:'1px solid #1f1f1f',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <Hdr title={t('feed.section_institutions')||'INSTITUTION FLOW'} detail="CLICK: institution" />
            <div style={{flex:1,overflow:'auto'}}>
              <Row><span style={{width:110,color:'#555'}}>INSTITUTION</span><span style={{width:50,color:'#555'}}>TICK</span><span style={{width:75,color:'#555',textAlign:'right'}}>AMOUNT</span><span style={{width:55,color:'#555',textAlign:'right'}}>CHG%</span></Row>
              {INSTS.map((o,i)=>(
                <Row key={`${o.institution}-${o.ticker}`} h={i%2===0}>
                  <span onClick={()=>setDetail({mode:'institution',label:o.institution})}
                    style={{width:110,color:'#e6e6e6',overflow:'hidden',textOverflow:'ellipsis',cursor:'pointer'}}>{S(o.institution,14)}</span>
                  <span onClick={()=>setDetail({mode:'ticker',label:o.ticker,subtitle:o.company_name})}
                    style={{width:50,color:'#ff8c00',fontWeight:600,cursor:'pointer',textDecoration:'underline'}}>{o.ticker}</span>
                  <span style={{width:75,textAlign:'right',color:'#e6e6e6'}}>{F(o.amount)}</span>
                  <span style={{width:55,textAlign:'right',color:o.direction==='NEW'?'#ff8c00':o.change_pct>0?'#0c6':'#f33',fontWeight:600}}>{o.direction==='NEW'?'NEW':`${o.change_pct>0?'+':''}${o.change_pct}%`}</span>
                </Row>
              ))}
            </div>
          </div>

          {/* Q4 */}
          <div style={{display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <Hdr title="COMMANDS & STATS" />
            <div style={{flex:1,padding:8,fontFamily:'JetBrains Mono,monospace',overflow:'auto'}}>
              <div style={{color:'#ff8c00',fontWeight:600,fontSize:10,marginBottom:4}}>DATA</div>
              <div style={{fontSize:10,color:'#888',marginBottom:8}}>
                <div>Total: <span style={{color:'#fff'}}>{ALL.length}</span></div>
                <div>Buys: <span style={{color:'#0c6'}}>{buyN}</span> | Sells: <span style={{color:'#f33'}}>{sellN}</span> | Clusters: <span style={{color:'#ff8c00'}}>{cluN}</span></div>
              </div>
              <div style={{color:'#ff8c00',fontWeight:600,fontSize:10,marginBottom:4}}>CLICK TARGETS</div>
              <div style={{fontSize:10,color:'#888',marginBottom:8}}>
                <div><span style={{color:'#ff8c00',textDecoration:'underline'}}>TICKER</span> → all trades for stock</div>
                <div><span style={{color:'#e6e6e6'}}>INSIDER</span> → 2YR personal history</div>
                <div><span style={{color:'#e6e6e6'}}>INSTITUTION</span> → 2YR flow history</div>
              </div>
              <div style={{color:'#ff8c00',fontWeight:600,fontSize:10,marginBottom:4}}>FILTERS</div>
              <div style={{fontSize:10,color:'#888'}}>
                <div><span style={{color:'#fff'}}>1</span> ALL <span style={{color:'#fff',marginLeft:8}}>2</span> BUY <span style={{color:'#fff',marginLeft:8}}>3</span> SELL <span style={{color:'#fff',marginLeft:8}}>4</span> CLUSTER</div>
              </div>
              <div style={{marginTop:6}}>
                <div style={{fontSize:10,color:'#ff8c00',fontWeight:600,marginBottom:2}}>CMD</div>
                <div style={{display:'flex',alignItems:'center',border:'1px solid #1f1f1f',padding:'3px 6px'}}>
                  <span style={{color:'#0c6',fontSize:12,marginRight:6}}>&gt;</span>
                  <input ref={inp} value={cmd} onChange={e=>setCmd(e.target.value)} onKeyDown={onCmd}
                    placeholder="/AAPL or buy/sell/all"
                    style={{flex:1,background:'transparent',border:'none',outline:'none',color:'#ff8c00',fontFamily:'JetBrains Mono,monospace',fontSize:12}}/>
                  <span style={{color:'#555',fontSize:9}}>↵</span>
                </div>
                {msg&&<div style={{marginTop:4,fontSize:10,color:'#0c6'}}>{msg}</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{display:'flex',alignItems:'center',height:18,padding:'0 8px',fontSize:9,color:'#555',background:'#0a0a0a',borderTop:'1px solid #1f1f1f',gap:12}}>
        <span>CLICK: <span style={{color:'#ff8c00'}}>ticker</span> · <span style={{color:'#e6e6e6'}}>insider</span> · <span style={{color:'#e6e6e6'}}>institution</span> for detail | ESC to close</span>
        <span style={{marginLeft:'auto'}}>🐋 WhaleTrace BLOOMBERG</span>
      </div>
    </div>
  );
}
