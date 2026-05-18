import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MOCK_TRADES, MOCK_RESONANCE_SIGNALS, MOCK_INSTITUTION_ORDERS } from '@/lib/mock-data';
import type { InsiderTrade, ResonanceSignal } from '@/types';
import type { InstitutionOrder } from '@/lib/mock-data';

/* ============================================================
   BLOOMBERG 4-QUADRANT — v3 direct data
   ============================================================ */

const ROW_H = 20;
const ALL_TRADES: InsiderTrade[] = MOCK_TRADES;  // direct constant, no state needed
const SIGNALS: ResonanceSignal[] = MOCK_RESONANCE_SIGNALS;
const INST_ORDERS: InstitutionOrder[] = MOCK_INSTITUTION_ORDERS;

function Row({ children, h }: { children: React.ReactNode; h?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: ROW_H,
      padding: '0 6px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace',
      background: h ? 'rgba(255,255,255,0.03)' : 'transparent',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>{children}</div>
  );
}

function Hdr({ title, detail }: { title: string; detail?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 22, padding: '0 8px',
      background: '#0a0a0a', borderBottom: '1px solid #1f1f1f',
      fontSize: '10px', fontWeight: 700, color: '#ff8c00',
      letterSpacing: 1, textTransform: 'uppercase',
    }}>
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

export default function FeedPage() {
  const { t } = useTranslation();
  const [f, setF] = useState<FM>('all');
  const [cmd, setCmd] = useState('');
  const [msg, setMsg] = useState('');
  const inp = useRef<HTMLInputElement>(null);

  const filtered = (() => {
    switch (f) {
      case 'buy': return ALL_TRADES.filter(t => t.transaction_type === 'BUY');
      case 'sell': return ALL_TRADES.filter(t => t.transaction_type === 'SELL');
      case 'cluster': return ALL_TRADES.filter(t => t.signal_category === 'CLUSTER');
      default: return ALL_TRADES;
    }
  })().slice(0, 35);

  const buyN = ALL_TRADES.filter(t => t.transaction_type === 'BUY').length;
  const sellN = ALL_TRADES.filter(t => t.transaction_type === 'SELL').length;
  const cluN = ALL_TRADES.filter(t => t.signal_category === 'CLUSTER').length;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey||e.metaKey||e.altKey) return;
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
  }, []);

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
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#000'}}>
      {/* Status bar */}
      <div style={{display:'flex',alignItems:'center',height:22,padding:'0 8px',fontSize:9,color:'#888',background:'#0a0a0a',borderBottom:'1px solid #1f1f1f',gap:12}}>
        <span style={{color:'#fff',fontWeight:600}}>{fLabel}</span>
        <span>{filtered.length} rows</span>
        <span>🟢{buyN} 🔴{sellN} 🟣{cluN}</span>
        <span style={{marginLeft:'auto',color:msg?'#ff8c00':'#555'}}>{msg||'1-4:filter /=cmd'}</span>
      </div>

      {/* Grid */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gridTemplateRows:'1fr 1fr',flex:1,overflow:'hidden'}}>
        {/* Q1 */}
        <div style={{borderRight:'1px solid #1f1f1f',borderBottom:'1px solid #1f1f1f',display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <Hdr title={t('feed.section_insider_trades')||'INSIDER TRADES'} detail={`${filtered.length}/${ALL_TRADES.length}`} />
          <div style={{flex:1,overflow:'auto'}}>
            <Row><span style={{width:50,color:'#555'}}>TICKER</span><span style={{width:110,color:'#555'}}>INSIDER</span><span style={{width:38,color:'#555',textAlign:'right'}}>DIR</span><span style={{width:55,color:'#555',textAlign:'right'}}>SHARES</span><span style={{width:55,color:'#555',textAlign:'right'}}>PRICE</span><span style={{width:65,color:'#555',textAlign:'right'}}>VALUE</span><span style={{width:52,color:'#555',textAlign:'right'}}>DATE</span></Row>
            {filtered.map((t,i)=>(
              <Row key={t.id} h={i%2===0}>
                <span style={{width:50,color:'#ff8c00',fontWeight:600}}>{t.ticker}</span>
                <span style={{width:110,color:'#e6e6e6',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{S(t.insider_name,14)}</span>
                <span style={{width:38,textAlign:'right',color:t.transaction_type==='BUY'?'#0c6':'#f33',fontWeight:600}}>{t.transaction_type==='BUY'?'BUY':'SEL'}</span>
                <span style={{width:55,textAlign:'right',color:'#e6e6e6'}}>{F(t.shares)}</span>
                <span style={{width:55,textAlign:'right',color:'#e6e6e6'}}>{(t.price??0).toFixed(2)}</span>
                <span style={{width:65,textAlign:'right',color:t.transaction_type==='BUY'?'#0c6':'#f33'}}>{F(t.total_value)}</span>
                <span style={{width:52,textAlign:'right',color:'#888'}}>{t.trade_date.slice(5)}</span>
              </Row>
            ))}
          </div>
        </div>

        {/* Q2 */}
        <div style={{borderBottom:'1px solid #1f1f1f',display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <Hdr title={t('feed.section_signals')||'RESONANCE SIGNALS'} detail={`${SIGNALS.length} active`} />
          <div style={{flex:1,overflow:'auto'}}>
            <Row><span style={{width:50,color:'#555'}}>TICKER</span><span style={{width:90,color:'#555'}}>COMPANY</span><span style={{width:70,color:'#555',textAlign:'right'}}>INST BUY</span><span style={{width:35,color:'#555',textAlign:'right'}}>#I</span><span style={{width:35,color:'#555',textAlign:'right'}}>#P</span><span style={{width:55,color:'#555',textAlign:'right'}}>STR</span><span style={{width:65,color:'#555'}}>BAR</span></Row>
            {SIGNALS.map((s,i)=>(
              <Row key={s.ticker} h={i%2===0}>
                <span style={{width:50,color:'#ff8c00',fontWeight:600}}>{s.ticker}</span>
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

        {/* Q3 */}
        <div style={{borderRight:'1px solid #1f1f1f',display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <Hdr title={t('feed.section_institutions')||'INSTITUTION FLOW'} detail=">100M" />
          <div style={{flex:1,overflow:'auto'}}>
            <Row><span style={{width:110,color:'#555'}}>INSTITUTION</span><span style={{width:50,color:'#555'}}>TICK</span><span style={{width:75,color:'#555',textAlign:'right'}}>AMOUNT</span><span style={{width:55,color:'#555',textAlign:'right'}}>CHG%</span></Row>
            {INST_ORDERS.map((o,i)=>(
              <Row key={`${o.institution}-${o.ticker}`} h={i%2===0}>
                <span style={{width:110,color:'#e6e6e6',overflow:'hidden',textOverflow:'ellipsis'}}>{S(o.institution,14)}</span>
                <span style={{width:50,color:'#ff8c00',fontWeight:600}}>{o.ticker}</span>
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
              <div>Total: <span style={{color:'#fff'}}>{ALL_TRADES.length}</span></div>
              <div>Buys: <span style={{color:'#0c6'}}>{buyN}</span> | Sells: <span style={{color:'#f33'}}>{sellN}</span> | Clusters: <span style={{color:'#ff8c00'}}>{cluN}</span></div>
              <div>Signals: <span style={{color:'#ff8c00'}}>{SIGNALS.length}</span> | Institutions: <span style={{color:'#fff'}}>{INST_ORDERS.length}</span></div>
            </div>
            <div style={{color:'#ff8c00',fontWeight:600,fontSize:10,marginBottom:4}}>FILTERS</div>
            <div style={{fontSize:10,color:'#888'}}>
              <div><span style={{color:'#fff'}}>1</span> ALL <span style={{color:'#fff',marginLeft:8}}>2</span> BUY <span style={{color:'#fff',marginLeft:8}}>3</span> SELL <span style={{color:'#fff',marginLeft:8}}>4</span> CLUSTER</div>
            </div>
            <div style={{marginTop:8}}>
              <div style={{fontSize:10,color:'#ff8c00',fontWeight:600,marginBottom:2}}>CMD</div>
              <div style={{display:'flex',alignItems:'center',border:'1px solid #1f1f1f',padding:'3px 6px'}}>
                <span style={{color:'#0c6',fontSize:12,marginRight:6}}>&gt;</span>
                <input ref={inp} value={cmd} onChange={e=>setCmd(e.target.value)} onKeyDown={onCmd}
                  placeholder="buy / sell / /AAPL"
                  style={{flex:1,background:'transparent',border:'none',outline:'none',color:'#ff8c00',fontFamily:'JetBrains Mono,monospace',fontSize:12}}/>
                <span style={{color:'#555',fontSize:9}}>↵</span>
              </div>
              {msg&&<div style={{marginTop:4,fontSize:10,color:'#0c6'}}>{msg}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div style={{display:'flex',alignItems:'center',height:18,padding:'0 8px',fontSize:9,color:'#555',background:'#0a0a0a',borderTop:'1px solid #1f1f1f',gap:12}}>
        <span>MOCK | v{new Date().toISOString().slice(0,10)}</span>
        <span style={{marginLeft:'auto'}}>🐋 WhaleTrace BLOOMBERG</span>
      </div>
    </div>
  );
}
