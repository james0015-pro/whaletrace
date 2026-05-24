import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MOCK_TRADES, MOCK_RESONANCE_SIGNALS, MOCK_INSTITUTION_ORDERS } from '@/lib/mock-data';
import { formatCompactNumber, truncate } from '@/lib/utils';
import type { InsiderTrade, ResonanceSignal, TradeType } from '@/types';
import type { InstitutionOrder } from '@/lib/mock-data';

const ROW_H = 20;
const ALL: InsiderTrade[] = MOCK_TRADES;
const SIGS: ResonanceSignal[] = MOCK_RESONANCE_SIGNALS;
const INSTS: InstitutionOrder[] = MOCK_INSTITUTION_ORDERS;

type FM = 'all'|'buy'|'sell'|'cluster';
type DetailMode = 'insider'|'ticker'|'institution';
type DetailTarget = { mode: DetailMode; label: string; subtitle?: string };

const F = formatCompactNumber;
const S = truncate;

/* ============================================================
   Reusable components
   ============================================================ */
function Cell({ w, color, bold, underline, onClick, children }: { w: number; color: string; bold?: boolean; underline?: boolean; onClick?: () => void; children: React.ReactNode }) {
  const interactive = !!onClick;
  return <span
    onClick={onClick}
    role={interactive ? 'button' : undefined}
    tabIndex={interactive ? 0 : undefined}
    onKeyDown={interactive ? (e: React.KeyboardEvent) => { if (e.key === 'Enter') onClick?.(); } : undefined}
    style={{width:w,color,fontWeight:bold?600:400,cursor:onClick?'pointer':'default',textDecoration:underline?'underline':'none',display:'inline-block',height:ROW_H,lineHeight:`${ROW_H}px`,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',verticalAlign:'middle',fontFamily:'JetBrains Mono,monospace',fontSize:11,textAlign:'left',padding:'0 3px'}}>{children}</span>;
}
function Row({ children, h }: { children: React.ReactNode; h?: boolean }) {
  return <div style={{display:'flex',alignItems:'center',height:ROW_H,padding:0,fontSize:11,fontFamily:'JetBrains Mono,monospace',background:h?'rgba(255,255,255,0.03)':'transparent',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>{children}</div>;
}
function Hdr({ title, detail }: { title: string; detail?: string }) {
  return <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',height:22,padding:'0 8px',background:'#0a0a0a',borderBottom:'1px solid #1f1f1f',fontSize:10,fontWeight:700,color:'#ff8c00',letterSpacing:1,textTransform:'uppercase'}}><span>{title}</span>{detail&&<span style={{color:'#555',fontWeight:400,fontSize:9}}>{detail}</span>}</div>;
}
function R({ w, c, b, onClick, children }: { w: number; c: string; b?: boolean; onClick?: () => void; children: React.ReactNode }) {
  const interactive = !!onClick;
  return <span
    onClick={onClick}
    role={interactive ? 'button' : undefined}
    tabIndex={interactive ? 0 : undefined}
    onKeyDown={interactive ? (e: React.KeyboardEvent) => { if (e.key === 'Enter') onClick?.(); } : undefined}
    style={{display:'inline-block',width:w,height:ROW_H,lineHeight:`${ROW_H}px`,color:c,fontWeight:b?600:400,fontSize:11,fontFamily:'JetBrains Mono,monospace',textAlign:'right',padding:'0 3px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',verticalAlign:'middle',cursor:onClick?'pointer':'default',textDecoration:onClick?'underline':'none'}}>{children}</span>;
}

// Column widths for Q1 (total = 512 to fill panel)
const CW = { T:52, I:90, CT:112, D:38, S:55, P:62, V:65, DT:50 };

/* ============================================================
   Avatar generator
   ============================================================ */
const AVATAR_COLORS = ['#ff8c00','#0c6','#f33','#8b5cf6','#3b82f6','#ec4899','#14b8a6','#f59e0b'];
function getColor(name: string) { return AVATAR_COLORS[name.split('').reduce((a,c)=>a+c.charCodeAt(0),0) % AVATAR_COLORS.length]; }
function getInitials(name: string) { return name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2); }

/* ============================================================
   Insider Profile Card (click Company/Title)
   ============================================================ */
function InsiderProfile({ trade, onClose }: { trade: InsiderTrade; onClose: () => void }) {
  const initials = getInitials(trade.insider_name);
  const color = getColor(trade.insider_name);
  const allByInsider = ALL.filter(t => t.insider_name === trade.insider_name);
  const tB = allByInsider.filter(t=>t.transaction_type==='BUY').reduce((s,t)=>s+t.total_value,0);
  const tS = allByInsider.filter(t=>t.transaction_type==='SELL').reduce((s,t)=>s+t.total_value,0);
  const tickers = [...new Set(allByInsider.map(t=>t.ticker))];

  return (
    <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:60,background:'#0d0d0d',border:'1px solid #333',padding:20,minWidth:380,maxWidth:500,fontFamily:'JetBrains Mono,monospace',color:'#e6e6e6'}}>
      <div style={{display:'flex',gap:16,alignItems:'flex-start',marginBottom:16}}>
        {/* Avatar */}
        <div style={{width:56,height:56,borderRadius:'50%',background:color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:700,color:'#000',flexShrink:0}}>
          {initials}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:'#ff8c00',marginBottom:4}}>{trade.insider_name}</div>
          <div style={{fontSize:11,color:'#e6e6e6',marginBottom:2}}>{trade.title}</div>
          <div style={{fontSize:11,color:'#888'}}>{trade.ticker} · {trade.company_name}</div>
        </div>
        <button onClick={onClose} aria-label="Close profile" style={{background:'transparent',border:'1px solid #333',color:'#888',cursor:'pointer',padding:'2px 8px',fontSize:10,fontFamily:'JetBrains Mono,monospace'}}>✕</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:10,marginBottom:12,padding:'8px 0',borderTop:'1px solid #1f1f1f',borderBottom:'1px solid #1f1f1f'}}>
        <div>Total trades: <span style={{color:'#fff'}}>{allByInsider.length}</span></div>
        <div>Tickers: <span style={{color:'#ff8c00'}}>{tickers.length}</span></div>
        <div>Total buy: <span style={{color:'#0c6'}}>{F(tB)}</span></div>
        <div>Total sell: <span style={{color:'#f33'}}>{F(tS)}</span></div>
        <div>Net: <span style={{color:tB>tS?'#0c6':'#f33'}}>{F(tB-tS)}</span></div>
        <div>Tickers: <span style={{color:'#888',fontSize:9}}>{tickers.slice(0,6).join(' ')}</span></div>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button onClick={()=>{onClose();}} style={{flex:1,background:'transparent',border:'1px solid #333',color:'#ff8c00',cursor:'pointer',padding:'4px',fontSize:10,fontFamily:'JetBrains Mono,monospace'}}>VIEW FULL HISTORY</button>
        <button onClick={onClose} style={{flex:1,background:'transparent',border:'1px solid #333',color:'#888',cursor:'pointer',padding:'4px',fontSize:10,fontFamily:'JetBrains Mono,monospace'}}>CLOSE</button>
      </div>
    </div>
  );
}

/* ============================================================
   Data builders
   ============================================================ */
function buildInsiderHistory(label: string) {
  const history = ALL.filter(t => t.insider_name === label).sort((a,b)=>b.trade_date.localeCompare(a.trade_date));
  const rows = history.map(t=>({date:t.trade_date,ticker:t.ticker,insider:t.insider_name,dir:t.transaction_type,shares:t.shares,price:t.price??0,value:t.total_value,note:t.is_10b5_1?'10B5-1':t.signal_category==='CLUSTER'?'CLUSTER':''}));
  const base=new Date(history[0]?.trade_date||'2026-05-01');
  for(let m=1;m<=24;m++){const d=new Date(base);d.setMonth(d.getMonth()-m);if(Math.random()>0.4){const tk=['AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','JPM'][Math.floor(Math.random()*8)];const sh=Math.floor(Math.random()*50000)+100;const pr=+(Math.random()*500+10).toFixed(2);rows.push({date:d.toISOString().slice(0,10),ticker:tk,insider:label,dir:Math.random()>0.5?'BUY':'SELL',shares:sh,price:pr,value:+(sh*pr).toFixed(2),note:''});}}
  rows.sort((a,b)=>b.date.localeCompare(a.date));
  return rows;
}
function buildTickerHistory(label: string) {
  const trades = ALL.filter(t=>t.ticker===label).sort((a,b)=>b.trade_date.localeCompare(a.trade_date));
  const rows = trades.map(t=>({date:t.trade_date,ticker:t.ticker,insider:t.insider_name,dir:t.transaction_type,shares:t.shares,price:t.price??0,value:t.total_value,note:t.title?.slice(0,20)||''}));
  const base=new Date(trades[0]?.trade_date||'2026-05-01');const insiders=[...new Set(trades.map(t=>t.insider_name))].slice(0,5);
  for(let m=1;m<=24;m++){const d=new Date(base);d.setMonth(d.getMonth()-m);if(Math.random()>0.3){const ins=insiders[Math.floor(Math.random()*insiders.length)]||'Unknown';const sh=Math.floor(Math.random()*100000)+100;const pr=+(Math.random()*600+10).toFixed(2);rows.push({date:d.toISOString().slice(0,10),ticker:label,insider:ins,dir:Math.random()>0.5?'BUY':'SELL',shares:sh,price:pr,value:+(sh*pr).toFixed(2),note:''});}}
  rows.sort((a,b)=>b.date.localeCompare(a.date));
  return rows;
}
function buildInstitutionHistory(label: string) {
  const rows: {date:string;ticker:string;insider:string;dir:TradeType;shares:number;price:number;value:number;note:string}[]=[];
  const base=new Date('2026-05-15');const tickers=['AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','JPM','V','WMT'];
  for(let m=0;m<=24;m++){const d=new Date(base);d.setMonth(d.getMonth()-m);if(m===0||Math.random()>0.5){const tk=tickers[Math.floor(Math.random()*tickers.length)];const sh=Math.floor(Math.random()*5000000)+10000;const pr=+(Math.random()*1000+10).toFixed(2);rows.push({date:d.toISOString().slice(0,10),ticker:tk,insider:label,dir:Math.random()>0.35?'BUY':'SELL',shares:sh,price:pr,value:+(sh*pr).toFixed(2),note:m===0?'LATEST':m<3?'RECENT':''});}}
  rows.sort((a,b)=>b.date.localeCompare(a.date));
  return rows;
}

/* ============================================================
   10-Year Data Generators (for ticker filter mode)
   ============================================================ */
const INSIDER_NAMES = ['Tim Cook','Satya Nadella','Jensen Huang','Sundar Pichai','Andy Jassy','Mark Zuckerberg','Elon Musk','Jamie Dimon','Warren Buffett','Brian Moynihan','Bob Iger','Shantanu Narayen','Reed Hastings','Marc Benioff','Ruth Porat','Amy Hood','Colette Kress','Luca Maestri','John Giannandrea','Craig Federighi'];
const INSTITUTION_NAMES = ['Vanguard Group','BlackRock','State Street','Fidelity','T. Rowe Price','Capital Group','Geode Capital','Northern Trust','Bank of America','Goldman Sachs','Morgan Stanley','J.P. Morgan','Citadel','Two Sigma','Renaissance Tech','Bridgewater','Baillie Gifford','Wellington','Norges Bank','Tiger Global'];

function gen10YearTrades(ticker: string): InsiderTrade[] {
  const realTrades = ALL.filter(t => t.ticker === ticker);
  const rows: InsiderTrade[] = [...realTrades];
  let idCounter = 10000;
  const base = new Date('2026-06-01');
  for (let m = 0; m < 120; m++) {
    const d = new Date(base);
    d.setMonth(d.getMonth() - m);
    const count = Math.floor(Math.random() * 3) + 1; // 1-3 trades per month
    for (let c = 0; c < count; c++) {
      const insider = INSIDER_NAMES[Math.floor(Math.random() * INSIDER_NAMES.length)];
      const dir: TradeType = Math.random() > 0.4 ? 'BUY' : 'SELL';
      const shares = Math.floor(Math.random() * 500000) + 500;
      const price = +(Math.random() * 500 + 10).toFixed(2);
      rows.push({
        id: idCounter++,
        ticker,
        company_name: ticker,
        insider_name: insider,
        title: Math.random() > 0.5 ? 'CEO' : Math.random() > 0.5 ? 'CFO' : Math.random() > 0.5 ? 'Director' : 'SVP',
        transaction_type: dir,
        shares,
        price,
        total_value: +(shares * price).toFixed(2),
        filing_date: d.toISOString().slice(0, 10),
        trade_date: d.toISOString().slice(0, 10),
        is_10b5_1: Math.random() > 0.85,
        sec_form_url: '',
        signal_category: dir,
        signal_strength: Math.floor(Math.random() * 60) + 20,
      });
    }
  }
  rows.sort((a, b) => b.trade_date.localeCompare(a.trade_date));
  return rows;
}

function gen10YearInstitutions(ticker: string): InstitutionOrder[] {
  const rows: InstitutionOrder[] = [];
  const base = new Date('2026-06-01');
  for (let q = 0; q < 40; q++) {
    const d = new Date(base);
    d.setMonth(d.getMonth() - q * 3);
    const count = Math.floor(Math.random() * 5) + 3; // 3-7 institutions per quarter
    const usedInstitutions = new Set<string>();
    for (let c = 0; c < count; c++) {
      let inst: string;
      do { inst = INSTITUTION_NAMES[Math.floor(Math.random() * INSTITUTION_NAMES.length)]; } while (usedInstitutions.has(inst) && usedInstitutions.size < INSTITUTION_NAMES.length);
      usedInstitutions.add(inst);
      const amount = Math.random() > 0.3 ? Math.floor(Math.random() * 5000000000) + 10000000 : Math.floor(Math.random() * 500000000) + 5000000;
      const pct = +(Math.random() * 30 - 10).toFixed(1);
      rows.push({
        institution: inst,
        ticker,
        company_name: ticker,
        amount,
        change_pct: pct,
        direction: pct > 5 ? 'INCREASED' as const : pct < -5 ? 'DECREASED' as const : 'INCREASED' as const,
      });
    }
  }
  rows.sort((a, b) => {
    const aIsNew = a.direction === 'NEW';
    const bIsNew = b.direction === 'NEW';
    if (aIsNew && !bIsNew) return -1;
    if (!aIsNew && bIsNew) return 1;
    return b.amount - a.amount;
  });
  return rows;
}

/* ============================================================
   Detail Panel (drill-down)
   ============================================================ */
function DetailPanel({ target: initialTarget, onClose }: { target: DetailTarget; onClose: () => void }) {
  const [stack, setStack] = useState<DetailTarget[]>([initialTarget]);
  const active = stack[stack.length - 1];
  const push = (t: DetailTarget) => setStack(prev => [...prev, t]);
  const pop = () => { if (stack.length > 1) setStack(prev => prev.slice(0, -1)); else onClose(); };

  let rows: ReturnType<typeof buildInsiderHistory>;
  let col2: string;

  if (active.mode === 'insider') { rows = buildInsiderHistory(active.label); col2 = 'TICKER'; }
  else if (active.mode === 'ticker') { rows = buildTickerHistory(active.label); col2 = 'INSIDER'; }
  else { rows = buildInstitutionHistory(active.label); col2 = 'TYPE'; }

  const tB=rows.filter(r=>r.dir==='BUY').reduce((s,r)=>s+r.value,0);
  const tS=rows.filter(r=>r.dir==='SELL').reduce((s,r)=>s+r.value,0);

  return (
    <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:50,background:'#000',display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',alignItems:'center',padding:'4px 8px',background:'#0a0a0a',borderBottom:'1px solid #1f1f1f',gap:12}}>
        <button onClick={pop}
          aria-label="Go back (Escape)"
          style={{background:'transparent',border:'1px solid #333',color:'#ff8c00',cursor:'pointer',padding:'2px 8px',fontSize:10,fontFamily:'JetBrains Mono,monospace'}}>ESC BACK</button>
        <div style={{display:'flex',gap:4,alignItems:'center',fontSize:10,fontFamily:'JetBrains Mono,monospace'}}>
          {stack.map((t,i) => (<span key={i} style={{display:'flex',gap:4,alignItems:'center'}}>{i>0&&<span style={{color:'#555'}}>&gt;</span>}<span
            role="button"
            tabIndex={0}
            aria-label={`Navigate to ${t.mode} ${t.label} layer`}
            onKeyDown={e=>{if(e.key==='Enter') setStack(prev=>prev.slice(0,i+1))}}
            onClick={()=>setStack(prev=>prev.slice(0,i+1))}
            style={{color:i===stack.length-1?'#ff8c00':'#888',fontWeight:i===stack.length-1?700:400,cursor:'pointer'}}>{t.mode==='ticker'?t.label:t.label}</span></span>))}
        </div>
        <span style={{marginLeft:'auto',color:'#555',fontSize:9}}>{rows.length} rows | 🟢{F(tB)} 🔴{F(tS)} | L{stack.length}</span>
      </div>
      <div style={{flex:1,overflow:'auto'}}>
        <Row><R w={60} c="#555" b>DATE</R><R w={55} c="#555" b>TICKER</R><R w={active.mode==='ticker'?130:55} c="#555" b>{col2}</R><R w={45} c="#555" b>DIR</R><R w={65} c="#555" b>SHARES</R><R w={65} c="#555" b>PRICE</R><R w={75} c="#555" b>VALUE</R><R w={60} c="#555" b>NOTE</R></Row>
        {rows.map((r,i)=>(
          <Row key={i} h={i%2===0}>
            <R w={60} c="#e6e6e6">{r.date.slice(2)}</R>
            <R w={55} c="#ff8c00" onClick={()=>push({mode:'ticker',label:r.ticker})}>{r.ticker}</R>
            <R w={active.mode==='ticker'?130:55} c="#e6e6e6" onClick={active.mode==='ticker'?()=>push({mode:'insider',label:r.insider}):undefined}>{S(active.mode==='ticker'?r.insider:r.ticker,active.mode==='ticker'?16:10)}</R>
            <R w={45} c={r.dir==='BUY'?'#0c6':'#f33'} b>{r.dir==='BUY'?'BUY':'SEL'}</R>
            <R w={65} c="#e6e6e6">{F(r.shares)}</R>
            <R w={65} c="#e6e6e6">{r.price.toFixed(2)}</R>
            <R w={75} c={r.dir==='BUY'?'#0c6':'#f33'}>{F(r.value)}</R>
            <R w={60} c="#555">{r.note}</R>
          </Row>
        ))}
      </div>
      <div style={{display:'flex',padding:'4px 8px',gap:16,background:'#0a0a0a',borderTop:'1px solid #1f1f1f',fontSize:9,color:'#888'}}>
        <span>Net: <span style={{color:tB>tS?'#0c6':'#f33'}}>{F(tB-tS)}</span></span>
        <span style={{marginLeft:'auto'}}>Click ticker/insider to drill down | ESC to go back</span>
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
  const [profile, setProfile] = useState<InsiderTrade | null>(null);
  const [tickerFilter, setTickerFilter] = useState<string | null>(null);
  const inp = useRef<HTMLInputElement>(null);

  // Data: when tickerFilter is set, generate 10-year history
  const tickerTrades = tickerFilter ? gen10YearTrades(tickerFilter) : null;
  const tickerInstitutions = tickerFilter ? gen10YearInstitutions(tickerFilter) : null;

  const filtered = (() => {
    const base = tickerFilter ? (tickerTrades || []) : ALL;
    switch (f) {
      case 'buy': return base.filter(t => t.transaction_type === 'BUY');
      case 'sell': return base.filter(t => t.transaction_type === 'SELL');
      case 'cluster': return base.filter(t => t.signal_category === 'CLUSTER');
      default: return base;
    }
  })();

  const instData = tickerFilter ? (tickerInstitutions || []) : INSTS;

  const buyN = filtered.filter(t => t.transaction_type === 'BUY').length;
  const sellN = filtered.filter(t => t.transaction_type === 'SELL').length;
  const cluN = filtered.filter(t => t.signal_category === 'CLUSTER').length;

  const clearTickerFilter = () => {
    setTickerFilter(null);
    setF('all');
  };

  useEffect(()=>{const h=(e:KeyboardEvent)=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(detail||profile){if(e.key==='Escape'){setDetail(null);setProfile(null);}return;}if(e.target instanceof HTMLInputElement&&e.key!=='Escape')return;if(e.key==='1'){setF('all');setTickerFilter(null);}if(e.key==='2')setF('buy');if(e.key==='3')setF('sell');if(e.key==='4')setF('cluster');if(e.key==='/'||e.key==='`'){e.preventDefault();inp.current?.focus();}if(e.key==='Escape'){inp.current?.blur();setCmd('');clearTickerFilter();}};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);},[detail,profile,tickerFilter]);

  const onCmd=(e:React.KeyboardEvent)=>{if(e.key!=='Enter')return;const v=cmd.trim().toUpperCase();setCmd('');if(v==='ALL'||v==='1'){setF('all');clearTickerFilter();}else if(v==='BUY'||v==='2')setF('buy');else if(v==='SELL'||v==='3')setF('sell');else if(v==='CLUSTER'||v==='4')setF('cluster');else if(v==='CLEAR'||v==='CLS'){clearTickerFilter();setMsg('Filter cleared');}else{const tk=v.startsWith('/')?v.slice(1):v;if(/^[A-Z]{1,5}$/.test(tk)){setTickerFilter(tk);setDetail(null);setF('all');setMsg(`🔍 ${tk} — 10Y history`);}else{setMsg('?');}}inp.current?.blur();setTimeout(()=>setMsg(''),2500);};

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#000',position:'relative'}}>
      <div style={{display:'flex',alignItems:'center',height:22,padding:'0 8px',fontSize:9,color:'#888',background:'#0a0a0a',borderBottom:'1px solid #1f1f1f',gap:12}}>
        {tickerFilter ? (
          <>
            <span style={{color:'#ff8c00',fontWeight:700}}>🔍 {tickerFilter}</span>
            <span style={{color:'#0c6'}}>10年歷史</span>
            <span>{filtered.length} trades | {instData.length} inst</span>
            <span style={{marginLeft:'auto',color:'#555',cursor:'pointer'}} onClick={clearTickerFilter}>ESC 清除</span>
          </>
        ) : (
          <>
            <span style={{color:'#fff',fontWeight:600}}>{f==='buy'?'🟢 BUY':f==='sell'?'🔴 SELL':f==='cluster'?'🟣 CLUSTER':'◉ ALL'}</span>
            <span>{filtered.length} of {ALL.length}</span>
            <span style={{marginLeft:'auto',color:msg?'#ff8c00':'#555'}}>{msg||'1-4 filter  /=cmd  click to explore'}</span>
          </>
        )}
      </div>

      {detail ? (
        <DetailPanel target={detail} onClose={()=>setDetail(null)} />
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gridTemplateRows:'1fr 1fr',flex:1,overflow:'hidden'}}>
          {/* Q1: INSIDER TRADES */}
          <div style={{borderRight:'1px solid #1f1f1f',borderBottom:'1px solid #1f1f1f',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <Hdr title={tickerFilter ? `🔍 ${tickerFilter} · 內部人交易 (10年)` : (t('feed.section_insider_trades')||'INSIDER TRADES')} detail={tickerFilter ? `${filtered.length}筆 | ESC清除` : 'tap ticker/insider/company'} />
            <div style={{flex:1,overflow:'auto'}}>
              <Row>
                <Cell w={CW.T} color="#555" bold>TICKER</Cell>
                <Cell w={CW.I} color="#555" bold>INSIDER</Cell>
                <Cell w={CW.CT} color="#555" bold>COMPANY / TITLE</Cell>
                <R w={CW.D} c={f==='buy'?'#0c6':f==='sell'?'#f33':'#555'} b onClick={()=>{setF(f==='all'?'buy':f==='buy'?'sell':'all');}}>DIR ▾</R>
                <R w={CW.S} c="#555" b>SHARES</R>
                <R w={CW.P} c="#555" b>PRICE</R>
                <R w={CW.V} c="#555" b>VALUE</R>
                <R w={CW.DT} c="#555" b>DATE</R>
              </Row>
              {filtered.map((t,i)=>(
                <Row key={t.id} h={i%2===0}>
                  <Cell w={CW.T} color="#ff8c00" bold underline onClick={()=>setDetail({mode:'ticker',label:t.ticker,subtitle:t.company_name})}>{t.ticker}</Cell>
                  <Cell w={CW.I} color="#e6e6e6" onClick={()=>setDetail({mode:'insider',label:t.insider_name,subtitle:t.title})}>{S(t.insider_name,12)}</Cell>
                  <Cell w={CW.CT} color="#888" onClick={()=>setProfile(t)}>{S(`${t.ticker} · ${t.title}`, 18)}</Cell>
                  <R w={CW.D} c={t.transaction_type==='BUY'?'#0c6':'#f33'} b>{t.transaction_type==='BUY'?'BUY':'SEL'}</R>
                  <R w={CW.S} c="#e6e6e6">{F(t.shares)}</R>
                  <R w={CW.P} c="#e6e6e6">{(t.price??0).toFixed(2)}</R>
                  <R w={CW.V} c={t.transaction_type==='BUY'?'#0c6':'#f33'}>{F(t.total_value)}</R>
                  <R w={CW.DT} c="#888">{t.trade_date.slice(5)}</R>
                </Row>
              ))}
            </div>
          </div>

          {/* Q2: RESONANCE SIGNALS */}
          <div style={{borderBottom:'1px solid #1f1f1f',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <Hdr title={t('feed.section_signals')||'RESONANCE SIGNALS'} detail={`${SIGS.length} active`} />
            <div style={{flex:1,overflow:'auto'}}>
              <Row><R w={50} c="#555" b>TICKER</R><R w={90} c="#555" b>COMPANY</R><R w={70} c="#555" b>INST BUY</R><R w={35} c="#555" b>#I</R><R w={35} c="#555" b>#P</R><R w={55} c="#555" b>STR</R><R w={65} c="#555" b>BAR</R></Row>
              {SIGS.map((s,i)=>(<Row key={s.ticker} h={i%2===0}>
                <Cell w={50} color="#ff8c00" bold underline onClick={()=>setDetail({mode:'ticker',label:s.ticker,subtitle:s.company_name})}>{s.ticker}</Cell>
                <R w={90} c="#e6e6e6">{S(s.company_name,11)}</R><R w={70} c="#0c6">{F(s.total_institutional_buy)}</R><R w={35} c="#e6e6e6">{s.institution_count}</R><R w={35} c="#e6e6e6">{s.insider_buy_count}</R><R w={55} c="#ff8c00" b>{s.signal_strength}</R>
                <R w={65} c="#333"><span style={{display:'inline-block',width:55,height:5,background:'#333',verticalAlign:'middle'}}><span style={{display:'block',width:`${s.signal_strength}%`,height:'100%',background:'#ff8c00'}}/></span></R>
              </Row>))}
            </div>
          </div>

          {/* Q3: INSTITUTION FLOW */}
          <div style={{borderRight:'1px solid #1f1f1f',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <Hdr title={tickerFilter ? `🏦 ${tickerFilter} · 機構持股 (10年)` : (t('feed.section_institutions')||'INSTITUTION FLOW')} detail={tickerFilter ? `${instData.length}筆` : 'tap institution/ticker'} />
            <div style={{flex:1,overflow:'auto'}}>
              <Row><Cell w={108} color="#555" bold>INSTITUTION</Cell><Cell w={52} color="#555" bold>TICK</Cell><R w={75} c="#555" b>AMOUNT</R><R w={55} c="#555" b>CHG%</R></Row>
              {instData.map((o,i)=>(<Row key={`${o.institution}-${o.ticker}-${i}`} h={i%2===0}>
                <Cell w={108} color="#e6e6e6" onClick={()=>setDetail({mode:'institution',label:o.institution})}>{S(o.institution,14)}</Cell>
                <Cell w={52} color="#ff8c00" bold underline onClick={()=>setDetail({mode:'ticker',label:o.ticker,subtitle:o.company_name})}>{o.ticker}</Cell>
                <R w={75} c="#e6e6e6">{F(o.amount)}</R><R w={55} c={o.direction==='NEW'?'#ff8c00':o.change_pct>0?'#0c6':'#f33'} b>{o.direction==='NEW'?'NEW':`${o.change_pct>0?'+':''}${o.change_pct}%`}</R>
              </Row>))}
            </div>
          </div>

          {/* Q4: COMMANDS */}
          <div style={{display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <Hdr title="COMMANDS & STATS" />
            <div style={{flex:1,padding:8,fontFamily:'JetBrains Mono,monospace',overflow:'auto'}}>
              {tickerFilter ? (
                <>
                  <div style={{color:'#ff8c00',fontWeight:600,fontSize:10,marginBottom:4}}>🔍 當前過濾</div>
                  <div style={{fontSize:10,color:'#e6e6e6',marginBottom:8,padding:'4px 6px',background:'#0d0d0d',border:'1px solid #333'}}>
                    <div>股票: <span style={{color:'#ff8c00',fontWeight:700}}>{tickerFilter}</span></div>
                    <div style={{marginTop:2}}>內部人: <span style={{color:'#0c6'}}>{buyN} 買 / {sellN} 賣</span></div>
                    <div>機構: <span style={{color:'#8b5cf6'}}>{instData.length} 筆</span></div>
                  </div>
                  <button onClick={clearTickerFilter}
                    style={{width:'100%',background:'transparent',border:'1px solid #f33',color:'#f33',cursor:'pointer',padding:'3px',fontSize:10,fontFamily:'JetBrains Mono,monospace',marginBottom:12}}>
                    ✕ 清除過濾 (ESC)
                  </button>
                </>
              ) : (
                <>
                  <div style={{color:'#ff8c00',fontWeight:600,fontSize:10,marginBottom:4}}>DATA</div>
                  <div style={{fontSize:10,color:'#888',marginBottom:8}}>
                    <div>Total: <span style={{color:'#fff'}}>{ALL.length}</span> | Buy: <span style={{color:'#0c6'}}>{buyN}</span> | Sell: <span style={{color:'#f33'}}>{sellN}</span> | Cluster: <span style={{color:'#ff8c00'}}>{cluN}</span></div>
                  </div>
                </>
              )}
              <div style={{color:'#ff8c00',fontWeight:600,fontSize:10,marginBottom:4}}>NAVIGATION</div>
              <div style={{fontSize:10,color:'#888',marginBottom:8}}>
                <div><span style={{color:'#ff8c00',textDecoration:'underline'}}>TICKER</span> → stock detail</div>
                <div><span style={{color:'#e6e6e6'}}>INSIDER</span> → 2YR history</div>
                <div><span style={{color:'#888'}}>COMPANY/TITLE</span> → profile card</div>
              </div>
              <div style={{color:'#ff8c00',fontWeight:600,fontSize:10,marginBottom:4}}>FILTERS</div>
              <div style={{fontSize:10,color:'#888',marginBottom:8}}><div><span style={{color:'#fff'}}>1</span> ALL <span style={{color:'#fff',marginLeft:8}}>2</span> BUY <span style={{color:'#fff',marginLeft:8}}>3</span> SELL <span style={{color:'#fff',marginLeft:8}}>4</span> CLUSTER</div></div>
              <div style={{marginTop:6}}>
                <div style={{fontSize:10,color:'#ff8c00',fontWeight:600,marginBottom:2}}>CMD</div>
                <div style={{display:'flex',alignItems:'center',border:'1px solid #1f1f1f',padding:'3px 6px'}}>
                  <span style={{color:'#0c6',fontSize:12,marginRight:6}}>&gt;</span>
                  <input ref={inp} value={cmd} onChange={e=>setCmd(e.target.value)} onKeyDown={onCmd} placeholder="AAPL | /NVDA | buy | sell"
                    style={{flex:1,background:'transparent',border:'none',outline:'none',color:'#ff8c00',fontFamily:'JetBrains Mono,monospace',fontSize:12}}/>
                  <span style={{color:'#555',fontSize:9}}>↵</span>
                </div>
                {msg&&<div style={{marginTop:4,fontSize:10,color:'#0c6'}}>{msg}</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Insider Profile Overlay */}
      {profile && <InsiderProfile trade={profile} onClose={() => setProfile(null)} />}

      {/* Backdrop for profile */}
      {profile && <div
        role="button"
        tabIndex={0}
        aria-label="Close profile overlay"
        onClick={()=>setProfile(null)}
        onKeyDown={e=>{if(e.key==='Enter'||e.key==='Escape') setProfile(null)}}
        style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:55,background:'rgba(0,0,0,0.6)',cursor:'pointer'}} />}

      <div style={{display:'flex',alignItems:'center',height:18,padding:'0 8px',fontSize:9,color:'#555',background:'#0a0a0a',borderTop:'1px solid #1f1f1f',gap:12}}>
        {tickerFilter ? (
          <><span style={{color:'#ff8c00'}}>🔍 過濾中: {tickerFilter}</span><span>1-4切換 BUY/SELL | ESC清除</span></>
        ) : (
          <><span>🟠 Ticker=stock | 🟠 Insider=history | 🟠 Company/Title=profile | ESC to close</span></>
        )}
        <span style={{marginLeft:'auto'}}>🐋 WhaleTrace</span>
      </div>
    </div>
  );
}
