interface FactorGrade {
  label: string;       // 內部人流動
  labelEn: string;     // INSIDER FLOW
  grade: string;       // A+, A, A-, B+, B, B-, C+, C, C-, D, F
  description: string; // 中小買入
}

interface FactorGradeCardsProps {
  buyCount: number;
  sellCount: number;
  resonanceStrength?: number;
  shortFloatPct?: number;
  confidenceScore: number;
}

function getGradeAndDesc(value: number, thresholds: { aPlus: number; a: number; bPlus: number; b: number; c: number }): { grade: string; desc: string } {
  if (value >= thresholds.aPlus) return { grade: 'A+', desc: '極度強勢' };
  if (value >= thresholds.a) return { grade: 'A', desc: '強勢信號' };
  if (value >= thresholds.bPlus) return { grade: 'B+', desc: '偏多信號' };
  if (value >= thresholds.b) return { grade: 'B', desc: '中性偏多' };
  if (value >= thresholds.c) return { grade: 'C', desc: '中性偏弱' };
  return { grade: 'D', desc: '弱勢信號' };
}

function gradeColor(grade: string): string {
  if (grade.startsWith('A')) return '#0c6';
  if (grade.startsWith('B')) return '#ff8c00';
  if (grade.startsWith('C')) return '#b36800';
  return '#f33';
}

export default function FactorGradeCards({ buyCount, sellCount, resonanceStrength, shortFloatPct, confidenceScore }: FactorGradeCardsProps) {
  // INSIDER FLOW: buy/sell ratio
  const ratio = sellCount > 0 ? buyCount / sellCount : buyCount > 0 ? 10 : 0;
  const insiderFlow = getGradeAndDesc(ratio, { aPlus: 3, a: 2, bPlus: 1.5, b: 1, c: 0.5 });
  if (buyCount > 0 && sellCount === 0) { insiderFlow.grade = 'A+'; insiderFlow.desc = '純買入'; }

  // INSTITUTION CONSENSUS: from resonance strength
  const instStr = resonanceStrength ?? 0;
  const inst = getGradeAndDesc(instStr, { aPlus: 80, a: 65, bPlus: 50, b: 35, c: 20 });

  // SHORT RISK: inverse
  const short = shortFloatPct ?? 0;
  let shortGrade: string, shortDesc: string;
  if (short < 1) { shortGrade = 'A+'; shortDesc = '極低放空'; }
  else if (short < 2) { shortGrade = 'A'; shortDesc = '低放空'; }
  else if (short < 3) { shortGrade = 'B+'; shortDesc = '偏低放空'; }
  else if (short < 5) { shortGrade = 'B'; shortDesc = '中等放空'; }
  else if (short < 10) { shortGrade = 'C'; shortDesc = '偏高放空'; }
  else { shortGrade = 'D'; shortDesc = '高放空壓力'; }

  // WHALESCORE: confidence
  const whale = getGradeAndDesc(confidenceScore, { aPlus: 80, a: 65, bPlus: 50, b: 35, c: 20 });

  const cards: FactorGrade[] = [
    { label: '內部人流動', labelEn: 'INSIDER FLOW', grade: insiderFlow.grade, description: insiderFlow.desc },
    { label: '機構共識', labelEn: 'INST CONSENSUS', grade: inst.grade, description: inst.desc },
    { label: '放空風險', labelEn: 'SHORT RISK', grade: shortGrade, description: shortDesc },
    { label: '鯨力綜合', labelEn: 'WHALESCORE', grade: whale.grade, description: whale.desc },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
      {cards.map((card) => {
        const c = gradeColor(card.grade);
        return (
          <div key={card.label}
            style={{
              padding: 8, background: '#0a0a0a',
              border: `1px solid ${c}22`,
              textAlign: 'center',
              borderLeft: `2px solid ${c}`,
            }}
          >
            <div style={{ fontSize: 7, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
              {card.labelEn}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: c, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
              {card.grade}
            </div>
            <div style={{ fontSize: 8, color: '#888', fontFamily: 'JetBrains Mono, monospace', marginTop: 1 }}>
              {card.description}
            </div>
            <div style={{ fontSize: 7, color: '#555', marginTop: 1, fontFamily: 'JetBrains Mono, monospace' }}>
              {card.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
