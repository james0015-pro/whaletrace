import { useState } from 'react';
import { MOCK_TRADES, MOCK_RESONANCE_SIGNALS, MOCK_INSTITUTION_ORDERS } from '@/lib/mock-data';
import type { InsiderTrade, ResonanceSignal } from '@/types';
import type { InstitutionOrder } from '@/lib/mock-data';

const ALL: InsiderTrade[] = MOCK_TRADES;
const SIGS: ResonanceSignal[] = MOCK_RESONANCE_SIGNALS;
const INSTS: InstitutionOrder[] = MOCK_INSTITUTION_ORDERS;

const F = (v: number | null | undefined): string => {
  if (v == null) return '—';
  if (v >= 1e9) return (v/1e9).toFixed(2)+'B';
  if (v >= 1e6) return (v/1e6).toFixed(1)+'M';
  if (v >= 1e3) return (v/1e3).toFixed(0)+'K';
  return String(v);
};
const S = (s: string, n: number): string => s.length > n ? s.slice(0, n) : s;

/* ============================================================
   Stock Detail Panel
   ============================================================ */
function StockDetail({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const trades = ALL.filter(t => t.ticker === ticker).sort((a,b)=>b.trade_date.localeCompare(a.trade_date));
  const buys = trades.filter(t=>t.transaction_type==='BUY');
  const sells = trades.filter(t=>t.transaction_type==='SELL');
  const tB = buys.reduce((s,t)=>s+t.total_value,0);
  const tS = sells.reduce((s,t)=>s+t.total_value,0);
  const buyCount = buys.length;
  const sellCount = sells.length;
  const confidence = Math.min(Math.round((buyCount/(buyCount+sellCount||1))*50 + (tB/(tB+tS||1))*50), 100);
  const company = trades[0]?.company_name || ticker;

  // Price chart (sparkline mock)
  const prices = Array.from({length:30},(_,i)=>+(Math.random()*100+100).toFixed(2));

  return (
    <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:50,background:'#000',display:'flex',flexDirection:'column',overflow:'auto'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',padding:'6px 10px',background:'#0a0a0a',borderBottom:'1px solid #1f1f1f',gap:12}}>
        <button onClick={onClose} style={{background:'transparent',border:'1px solid #333',color:'#ff8c00',cursor:'pointer',padding:'3px 10px',fontSize:10,fontFamily:'JetBrains Mono,monospace'}}>← BACK</button>
        <span style={{color:'#ff8c00',fontWeight:700,fontSize:14}}>{ticker}</span>
        <span style={{color:'#888',fontSize:11}}>{company}</span>
        <span style={{marginLeft:'auto',color:'#ff8c00',fontSize:18,cursor:'pointer'}}>⭐</span>
      </div>

      <div style={{padding:12,display:'flex',flexDirection:'column',gap:10,flex:1}}>
        {/* Confidence Score */}
        <div style={{display:'flex',gap:12,alignItems:'center',padding:10,background:'#0a0a0a',border:'1px solid #1f1f1f'}}>
          <div style={{fontSize:10,color:'#888',fontFamily:'JetBrains Mono,monospace'}}>CONFIDENCE</div>
          <div style={{flex:1,height:8,background:'#1f1f1f'}}><div style={{width:`${confidence}%`,height:'100%',background:confidence>60?'#0c6':confidence>30?'#ff8c00':'#f33',transition:'width 0.5s'}}/></div>
          <div style={{fontSize:14,fontWeight:700,color:confidence>60?'#0c6':confidence>30?'#ff8c00':'#f33',fontFamily:'JetBrains Mono,monospace'}}>{confidence}</div>
          <div style={{fontSize:9,color:'#555'}}>/100</div>
        </div>

        {/* Sub-scores */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8,fontFamily:'JetBrains Mono,monospace'}}>
          {[['Buy Scale',Math.round(Math.random()*100)],['Buyer Count',Math.round(Math.random()*100)],['Buy/Sell Ratio',Math.round(buyCount/(sellCount||1)*10)],['Cluster',Math.round(Math.random()*100)]].map(([l,v])=>(
            <div key={l as string} style={{padding:6,background:'#0a0a0a',border:'1px solid #1f1f1f',textAlign:'center'}}>
              <div style={{fontSize:9,color:'#555'}}>{l as string}</div>
              <div style={{fontSize:14,fontWeight:700,color:(v as number)>60?'#0c6':(v as number)>30?'#ff8c00':'#f33'}}>{v as number}</div>
            </div>
          ))}
        </div>

        {/* Price Sparkline */}
        <div style={{padding:10,background:'#0a0a0a',border:'1px solid #1f1f1f'}}>
          <div style={{fontSize:9,color:'#555',marginBottom:4,fontFamily:'JetBrains Mono,monospace'}}>PRICE TREND (30D)</div>
          <div style={{display:'flex',alignItems:'flex-end',gap:2,height:40}}>
            {prices.map((p,i)=>{
              const h = ((p-Math.min(...prices))/(Math.max(...prices)-Math.min(...prices)))*100;
              return <div key={i} style={{flex:1,height:`${Math.max(h,5)}%`,background:'#ff8c00',opacity:0.7}}/>;
            })}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#555',marginTop:2,fontFamily:'JetBrains Mono,monospace'}}>
            <span>${Math.min(...prices).toFixed(2)}</span><span>${Math.max(...prices).toFixed(2)}</span>
          </div>
        </div>

        {/* Resonance History */}
        <div style={{padding:10,background:'#0a0a0a',border:'1px solid #1f1f1f'}}>
          <div style={{fontSize:9,color:'#555',marginBottom:4,fontFamily:'JetBrains Mono,monospace'}}>RESONANCE HISTORY</div>
          <div style={{fontSize:10,color:'#888',fontFamily:'JetBrains Mono,monospace'}}>
            {buyCount+sellCount} trades in 2YR | 🟢{buyCount} buys | 🔴{sellCount} sells | Net: <span style={{color:tB>tS?'#0c6':'#f33'}}>{F(tB-tS)}</span>
          </div>
        </div>

        {/* Institution Holdings */}
        <div style={{padding:10,background:'#0a0a0a',border:'1px solid #1f1f1f'}}>
          <div style={{fontSize:9,color:'#555',marginBottom:6,fontFamily:'JetBrains Mono,monospace'}}>INSTITUTION HOLDINGS</div>
          <div style={{display:'flex',fontSize:9,color:'#555',fontFamily:'JetBrains Mono,monospace',borderBottom:'1px solid #1f1f1f',paddingBottom:4,marginBottom:4}}>
            <span style={{width:120}}>INSTITUTION</span><span style={{width:70,textAlign:'right'}}>SHARES</span><span style={{width:70,textAlign:'right'}}>VALUE</span><span style={{width:60,textAlign:'right'}}>CHANGE</span>
          </div>
          {INSTS.filter(o=>o.ticker===ticker).slice(0,5).map((o,i)=>(
            <div key={i} style={{display:'flex',fontSize:10,color:'#e6e6e6',fontFamily:'JetBrains Mono,monospace',padding:'2px 0'}}>
              <span style={{width:120}}>{S(o.institution,15)}</span>
              <span style={{width:70,textAlign:'right'}}>{F(o.amount/100)}</span>
              <span style={{width:70,textAlign:'right'}}>{F(o.amount)}</span>
              <span style={{width:60,textAlign:'right',color:o.change_pct>0?'#0c6':'#f33'}}>{o.change_pct>0?'+'+o.change_pct:o.change_pct}%</span>
            </div>
          ))}
          {INSTS.filter(o=>o.ticker===ticker).length===0 && <div style={{fontSize:10,color:'#555'}}>No institution data for {ticker}</div>}
        </div>

        {/* Insider Timeline */}
        <div style={{padding:10,background:'#0a0a0a',border:'1px solid #1f1f1f'}}>
          <div style={{fontSize:9,color:'#555',marginBottom:6,fontFamily:'JetBrains Mono,monospace'}}>INSIDER TRADES TIMELINE</div>
          {trades.slice(0,10).map((t,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',fontSize:10,fontFamily:'JetBrains Mono,monospace',padding:'3px 0',borderBottom:i<9?'1px solid #1f1f1f':'none',gap:8}}>
              <span style={{width:55,color:'#888'}}>{t.trade_date.slice(5)}</span>
              <span style={{width:100,color:'#e6e6e6',overflow:'hidden',textOverflow:'ellipsis'}}>{S(t.insider_name,13)}</span>
              <span style={{width:80,color:'#888',overflow:'hidden',textOverflow:'ellipsis'}}>{S(t.title,12)}</span>
              <span style={{width:40,textAlign:'right',color:t.transaction_type==='BUY'?'#0c6':'#f33',fontWeight:600}}>{t.transaction_type==='BUY'?'BUY':'SEL'}</span>
              <span style={{width:55,textAlign:'right',color:'#e6e6e6'}}>{F(t.shares)}</span>
              <span style={{width:55,textAlign:'right',color:'#e6e6e6'}}>{(t.price??0).toFixed(2)}</span>
              <span style={{width:65,textAlign:'right',color:t.transaction_type==='BUY'?'#0c6':'#f33'}}>{F(t.total_value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Dashboard Page
   ============================================================ */
export default function DashboardPage() {
  const [stock, setStock] = useState<string | null>(null);
  const trades = ALL.slice(0, 20);

  return (
    <div style={{height:'100%',background:'#000',color:'#e6e6e6',fontFamily:'JetBrains Mono,monospace',overflow:'auto',position:'relative'}}>
      {stock && <StockDetail ticker={stock} onClose={()=>setStock(null)} />}

      <div style={{maxWidth:1200,margin:'0 auto',padding:16}}>
        <h1 style={{fontSize:16,color:'#ff8c00',fontWeight:700,marginBottom:4,fontFamily:'JetBrains Mono,monospace'}}>🐋 WHALETRACE DASHBOARD</h1>
        <p style={{fontSize:10,color:'#555',marginBottom:16}}>Whale Resonance Signals · Institution Flow · Insider Trades</p>

        {/* SECTION 1: Whale Resonance Signals */}
        <div style={{marginBottom:20}}>
          <h2 style={{fontSize:12,color:'#8b5cf6',fontWeight:700,marginBottom:10,textTransform:'uppercase',letterSpacing:1}}>🔮 Whale Resonance Signals</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:10}}>
            {SIGS.map(s=>(
              <div key={s.ticker} onClick={()=>setStock(s.ticker)} style={{
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
                <span style={{width:60,color:'#ff8c00',fontWeight:600,cursor:'pointer'}} onClick={()=>setStock(o.ticker)}>{o.ticker}</span>
                <span style={{width:80,textAlign:'right',color:'#e6e6e6'}}>{F(o.amount)}</span>
                <span style={{width:100,textAlign:'right',color:'#888'}}>{S(o.company_name,14)}</span>
                <span style={{width:60,textAlign:'right',color:o.direction==='NEW'?'#8b5cf6':o.change_pct>0?'#0c6':'#f33',fontWeight:600}}>{o.direction==='NEW'?'NEW':`${o.change_pct>0?'+':''}${o.change_pct}%`}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3: Latest Insider Trades */}
        <div>
          <h2 style={{fontSize:12,color:'#ff8c00',fontWeight:700,marginBottom:10,textTransform:'uppercase',letterSpacing:1}}>👤 Latest Insider Trades</h2>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {trades.map(t=>(
              <div key={t.id} onClick={()=>setStock(t.ticker)} style={{
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
