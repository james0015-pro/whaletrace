import { useNavigate } from 'react-router-dom';
import { MOCK_TRADES, MOCK_RESONANCE_SIGNALS, MOCK_INSTITUTION_ORDERS } from '@/lib/mock-data';
import { formatCompactNumber, truncate } from '@/lib/utils';
import type { InsiderTrade, ResonanceSignal } from '@/types';
import type { InstitutionOrder } from '@/lib/mock-data';

const ALL: InsiderTrade[] = MOCK_TRADES;
const SIGS: ResonanceSignal[] = MOCK_RESONANCE_SIGNALS;
const INSTS: InstitutionOrder[] = MOCK_INSTITUTION_ORDERS;

const F = formatCompactNumber;
const S = truncate;

/* ============================================================
   Dashboard Page
   ============================================================ */
export default function DashboardPage() {
  const navigate = useNavigate();
  const trades = ALL.slice(0, 20);

  return (
    <div style={{height:'100%',background:'#000',color:'#e6e6e6',fontFamily:'JetBrains Mono,monospace',overflow:'auto',position:'relative'}}>

      <div style={{maxWidth:1200,margin:'0 auto',padding:16}}>
        <h1 style={{fontSize:16,color:'#ff8c00',fontWeight:700,marginBottom:4,fontFamily:'JetBrains Mono,monospace'}}>🐋 WHALETRACE DASHBOARD</h1>
        <p style={{fontSize:10,color:'#555',marginBottom:16}}>Whale Resonance Signals · Institution Flow · Insider Trades</p>

        {/* SECTION 1: Whale Resonance Signals */}
        <div style={{marginBottom:20}}>
          <h2 style={{fontSize:12,color:'#8b5cf6',fontWeight:700,marginBottom:10,textTransform:'uppercase',letterSpacing:1}}>🔮 Whale Resonance Signals</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:10}}>
            {SIGS.map(s=>(
              <div key={s.ticker} onClick={()=>navigate(`/stocks/${s.ticker}`)} style={{
                padding:12,background:'#0a0a0a',border:'1px solid #8b5cf6',borderLeft:'3px solid #8b5cf6',
                cursor:'pointer',transition:'all 0.15s',
              }} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='#a78bfa';(e.currentTarget as HTMLElement).style.background='#111'}}
                 onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='#8b5cf6';(e.currentTarget as HTMLElement).style.background='#0a0a0a'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <div>
                    <span style={{fontSize:15,fontWeight:700,color:'#ff8c00'}}>{s.ticker}</span>
                    <span style={{fontSize:10,color:'#888',marginLeft:8}}>{S(s.company_name,16)}</span>
                  </div>
                  <span style={{fontSize:9,color:'#555'}}>{s.signal_date.slice(5)}</span>
                </div>
                <div style={{fontSize:20,fontWeight:700,color:'#e6e6e6',marginBottom:4}}>{F(s.total_institutional_buy)}</div>
                <div style={{fontSize:9,color:'#888',marginBottom:8}}>{s.institution_count} institutions</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:'4px 8px',marginBottom:8}}>
                  {s.institutions.map(i=><span key={i.name} style={{fontSize:9,color:'#888'}}><span style={{color:'#e6e6e6'}}>{S(i.name,12)}</span> <span style={{color:'#555'}}>{F(i.amount)}</span></span>)}
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:10,color:'#0c6'}}>🟢 {s.insider_buy_count} insiders buying</span>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <div style={{width:50,height:4,background:'#1f1f1f'}}><div style={{width:`${s.signal_strength}%`,height:'100%',background:'#8b5cf6'}}/></div>
                    <span style={{fontSize:11,fontWeight:700,color:'#8b5cf6'}}>{s.signal_strength}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 2: Today's Institution Orders */}
        <div style={{marginBottom:20}}>
          <h2 style={{fontSize:12,color:'#ff8c00',fontWeight:700,marginBottom:10,textTransform:'uppercase',letterSpacing:1}}>🏦 Today's Institution Large Orders</h2>
          <div style={{background:'#0a0a0a',border:'1px solid #1f1f1f',overflow:'hidden'}}>
            <div style={{display:'flex',fontSize:9,color:'#555',padding:'6px 8px',borderBottom:'1px solid #1f1f1f',fontFamily:'JetBrains Mono,monospace'}}>
              <span style={{width:140}}>INSTITUTION</span><span style={{width:60}}>TICKER</span><span style={{width:80,textAlign:'right'}}>AMOUNT</span><span style={{width:100,textAlign:'right'}}>COMPANY</span><span style={{width:60,textAlign:'right'}}>CHANGE</span>
            </div>
            {INSTS.map((o,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',fontSize:10,padding:'5px 8px',borderBottom:i<INSTS.length-1?'1px solid #1a1a1a':'none',fontFamily:'JetBrains Mono,monospace',background:i%2===0?'rgba(255,255,255,0.015)':'transparent'}}>
                <span style={{width:140,color:'#e6e6e6',overflow:'hidden',textOverflow:'ellipsis'}}>{S(o.institution,18)}</span>
                <span style={{width:60,color:'#ff8c00',fontWeight:600,cursor:'pointer'}} onClick={()=>navigate(`/stocks/${o.ticker}`)}>{o.ticker}</span>
                <span style={{width:80,textAlign:'right',color:'#e6e6e6'}}>{F(o.amount)}</span>
                <span style={{width:100,textAlign:'right',color:'#888'}}>{S(o.company_name,14)}</span>
                <span style={{width:60,textAlign:'right',color:o.direction==='NEW'?'#8b5cf6':o.change_pct>0?'#0c6':'#f33',fontWeight:600}}>{o.direction==='NEW'?'NEW':`${o.change_pct>0?'+':''}${o.change_pct}%`}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 2.5: Market Intelligence - NVDA Competition */}
        <div style={{marginBottom:20}}>
          <h2 style={{fontSize:12,color:'#e6e6e6',fontWeight:700,marginBottom:10,textTransform:'uppercase',letterSpacing:1}}>MARKET INTELLIGENCE</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:10}}>
            {/* NVDA China */}
            <div style={{padding:12,background:'#0a0a0a',border:'1px solid #f33',borderLeft:'3px solid #f33'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:700,color:'#ff8c00'}}>NVDA</span>
                <span style={{fontSize:9,color:'#555'}}>2026-05-21 CNBC</span>
              </div>
              <div style={{fontSize:9,color:'#e6e6e6',lineHeight:1.8}}>
                <div style={{color:'#f33',fontWeight:600}}>Jensen Huang admits: "Effectively abandoned China market to Huawei"</div>
                <div style={{color:'#888',fontSize:8}}>Q1 FY2027 revenue $81.6B (+85%) but stock fell 2% — market questions AI valuation ceiling</div>
              </div>
            </div>
            {/* Broadcom ASIC */}
            <div style={{padding:12,background:'#0a0a0a',border:'1px solid #8b5cf6',borderLeft:'3px solid #8b5cf6'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:700,color:'#8b5cf6'}}>Broadcom ASIC</span>
                <span style={{fontSize:9,color:'#555'}}>Custom AI Chips</span>
              </div>
              <div style={{fontSize:9,color:'#e6e6e6',lineHeight:1.8}}>
                <div>Google TPU / Meta MTIA / Anthropic — custom ASIC threat to NVDA general-purpose GPU dominance</div>
                <div style={{color:'#888',fontSize:8}}>Broadcom AI revenue growing rapidly as hyperscalers diversify away from NVDA GPU dependency</div>
              </div>
            </div>
            {/* Trump / AMD chip deal */}
            <div style={{padding:12,background:'#0a0a0a',border:'1px solid #ff8c00',borderLeft:'3px solid #ff8c00'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:700,color:'#ff8c00'}}>Geopolitics</span>
                <span style={{fontSize:9,color:'#555'}}>2026-05-21</span>
              </div>
              <div style={{fontSize:9,color:'#e6e6e6',lineHeight:1.8}}>
                <div>Trump pushes NVDA China chip export deal — Beijing counters: wants AMD chips instead</div>
                <div style={{color:'#888',fontSize:8}}>Stalemate reshapes AI chip supply chain. AMD $10B Taiwan investment (2026/5/21) strengthens AMD position</div>
              </div>
            </div>
            {/* SOX / AI Bubble */}
            <div style={{padding:12,background:'#0a0a0a',border:'1px solid #f33',borderLeft:'3px solid #f33'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:700,color:'#f33'}}>SOX / AI Bubble</span>
                <span style={{fontSize:9,color:'#555'}}>2026-05-22</span>
              </div>
              <div style={{fontSize:9,color:'#e6e6e6',lineHeight:1.8}}>
                <div style={{color:'#f33',fontWeight:600}}>Philly SOX at 2-week low — Morningstar draws 1999 dot-com parallel</div>
                <div style={{color:'#888',fontSize:8}}>Harvard Business Review also warns of AI overinvestment cycle. Fund managers brace for AI/semi correction</div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: Latest Insider Trades */}
        <div>
          <h2 style={{fontSize:12,color:'#ff8c00',fontWeight:700,marginBottom:10,textTransform:'uppercase',letterSpacing:1}}>👤 Latest Insider Trades</h2>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {trades.map(t=>(
              <div key={t.id} onClick={()=>navigate(`/stocks/${t.ticker}`)} style={{
                display:'flex',alignItems:'center',padding:'8px 10px',background:'#0a0a0a',border:'1px solid #1f1f1f',
                borderLeft:`3px solid ${t.transaction_type==='BUY'?'#0c6':'#f33'}`,
                cursor:'pointer',fontFamily:'JetBrains Mono,monospace',fontSize:10,
              }} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='#111'}}
                 onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='#0a0a0a'}}>
                <span style={{width:55,color:'#ff8c00',fontWeight:700,fontSize:11}}>{t.ticker}</span>
                <span style={{width:110,color:'#e6e6e6',overflow:'hidden',textOverflow:'ellipsis'}}>{S(t.insider_name,14)}</span>
                <span style={{width:100,color:'#888',overflow:'hidden',textOverflow:'ellipsis'}}>{S(t.title,14)}</span>
                <span style={{width:45,textAlign:'right',color:t.transaction_type==='BUY'?'#0c6':'#f33',fontWeight:600,fontSize:11}}>{t.transaction_type==='BUY'?'BUY':'SEL'}</span>
                <span style={{width:55,textAlign:'right',color:'#e6e6e6'}}>{F(t.shares)}</span>
                <span style={{width:55,textAlign:'right',color:'#e6e6e6'}}>{(t.price??0).toFixed(2)}</span>
                <span style={{width:65,textAlign:'right',color:t.transaction_type==='BUY'?'#0c6':'#f33'}}>{F(t.total_value)}</span>
                <span style={{width:55,textAlign:'right',color:'#888'}}>{t.trade_date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
