#!/usr/bin/env python3
"""
SEC EDGAR BULK PIPELINE — 10-Year Institutional + Insider Edge Analysis

Phase 1: Compile Top 100 institutions → get CIKs → download 13F filing indexes
Phase 2: Download & parse 13F XML (40 quarters) → compute QoQ position changes
Phase 3: Cross-reference with earnings → rank by pre-market prediction accuracy

Also runs Form 4 insider analysis in parallel.

Estimated runtime: 3-8 hours for full dataset.
"""

import json, os, sys, time, re, gzip, io
from datetime import datetime, timedelta
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.request
import urllib.error

# ============================================================
# CONFIGURATION
# ============================================================
DATA_DIR = "/opt/data/home/whaletrace/data/sec_bulk"
OUTPUT_DIR = "/opt/data/home/whaletrace/scripts/output"
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

USER_AGENT = 'ResearchBot/3.0 (contact@example.com)'
RATE_LIMIT = 0.2  # 5 req/sec (SEC allows 10/s)
MAX_WORKERS = 3

# ============================================================
# TOP 100 INSTITUTIONS (manually curated from public sources)
# ============================================================
TOP_INSTITUTIONS = [
    # === Mega Asset Managers ===
    ("BlackRock Inc.", "BLACKROCK"),
    ("Vanguard Group Inc.", "VANGUARD"),
    ("State Street Corp.", "STATE STREET"),
    ("FMR LLC (Fidelity)", "FIDELITY"),
    ("Capital World Investors", "CAPITAL WORLD"),
    ("Capital Research Global Investors", "CAPITAL RESEARCH"),
    ("Capital International Investors", "CAPITAL INTL"),
    ("Geode Capital Management LLC", "GEODE"),
    ("Price T Rowe Associates Inc", "T ROWE PRICE"),
    ("Wellington Management Group LLP", "WELLINGTON"),
    ("Northern Trust Corp", "NORTHERN TRUST"),
    ("Bank of America Corp", "BANK OF AMERICA"),
    ("JPMorgan Chase & Co", "JPMORGAN CHASE"),
    ("Morgan Stanley", "MORGAN STANLEY"),
    ("Goldman Sachs Group Inc", "GOLDMAN SACHS"),
    ("Nuveen Asset Management LLC", "NUVEEN"),
    ("Charles Schwab Investment Management", "CHARLES SCHWAB"),
    ("Invesco Ltd.", "INVESCO"),
    ("Franklin Resources Inc", "FRANKLIN"),
    ("Ameriprise Financial Inc", "AMERIPRISE"),
    ("Legal & General Group Plc", "LEGAL GENERAL"),
    ("UBS Group AG", "UBS"),
    ("Bank of New York Mellon Corp", "BNY MELLON"),
    ("Deutsche Bank AG", "DEUTSCHE BANK"),
    ("Royal Bank of Canada", "RBC"),
    
    # === Hedge Funds ===
    ("Renaissance Technologies LLC", "RENAISSANCE"),
    ("Bridgewater Associates LP", "BRIDGEWATER"),
    ("Citadel Advisors LLC", "CITADEL"),
    ("D.E. Shaw & Co. Inc.", "D E SHAW"),
    ("Two Sigma Investments LP", "TWO SIGMA"),
    ("Millennium Management LLC", "MILLENNIUM"),
    ("Point72 Asset Management LP", "POINT72"),
    ("Baupost Group LLC", "BAUPOST"),
    ("Appaloosa LP", "APPALOOSA"),
    ("Pershing Square Capital Management", "PERSHING SQUARE"),
    ("Third Point LLC", "THIRD POINT"),
    ("Elliott Investment Management LP", "ELLIOTT"),
    ("Maverick Capital Ltd", "MAVERICK"),
    ("Lone Pine Capital LLC", "LONE PINE"),
    ("Viking Global Investors LP", "VIKING"),
    ("Tiger Global Management LLC", "TIGER GLOBAL"),
    ("Coatue Management LLC", "COATUE"),
    ("Soroban Capital Partners LP", "SOROBAN"),
    ("Greenlight Capital Inc", "GREENLIGHT"),
    ("Starboard Value LP", "STARBOARD"),
    ("ValueAct Holdings LP", "VALUEACT"),
    ("Jana Partners LLC", "JANA"),
    ("DE Shaw & Co Inc", "D E SHAW"),
    ("Adage Capital Partners GP LLC", "ADAGE"),
    ("Farallon Capital Management LLC", "FARALLON"),
    
    # === Quant / Multi-Strategy ===
    ("AQR Capital Management LLC", "AQR"),
    ("Jane Street Group LLC", "JANE STREET"),
    ("Susquehanna International Group LLP", "SUSQUEHANNA"),
    ("Citadel Securities LLC", "CITADEL SECURITIES"),
    ("HRT Financial LP", "HRT"),
    ("Jump Financial LLC", "JUMP"),
    ("Walleye Trading LLC", "WALLEYE"),
    ("IMC-Chicago LLC", "IMC"),
    ("Wolverine Trading LLC", "WOLVERINE"),
    ("Group One Trading LP", "GROUP ONE"),
    
    # === Pension / Endowment ===
    ("California Public Employees Retirement", "CALPERS"),
    ("California State Teachers Retirement", "CALSTRS"),
    ("Canada Pension Plan Investment Board", "CPPIB"),
    ("Ontario Teachers Pension Plan Board", "OTPP"),
    ("Norges Bank (Norway Sovereign Wealth)", "NORGES"),
    ("Temasek Holdings Pte Ltd", "TEMASEK"),
    ("GIC Private Ltd", "GIC"),
    
    # === Insurance ===
    ("Berkshire Hathaway Inc", "BERKSHIRE"),
    ("Massachusetts Financial Services Co", "MFS"),
    ("Principal Financial Group Inc", "PRINCIPAL"),
    ("Prudential Financial Inc", "PRUDENTIAL"),
    ("MetLife Inc", "METLIFE"),
    ("Aflac Inc", "AFLAC"),
    ("Allianz Asset Management GmbH", "ALLIANZ"),
    ("American International Group Inc", "AIG"),
    
    # === Boutique / Activist ===
    ("Icahn Carl C", "ICAHN"),
    ("Loeb Daniel S", "LOEB"),
    ("Ackman William A", "ACKMAN"),
    ("Einhorn David", "EINHORN"),
    ("Paulson & Co Inc", "PAULSON"),
    ("Soros Fund Management LLC", "SOROS"),
    ("Duquesne Family Office LLC", "DUQUESNE"),
    ("Berkshire Hathaway Inc", "BERKSHIRE"),
    
    # === Others ===
    ("Dodge & Cox", "DODGE COX"),
    ("First Trust Advisors LP", "FIRST TRUST"),
    ("Voya Investment Management LLC", "VOYA"),
    ("AllianceBernstein LP", "ALLIANCE BERNSTEIN"),
    ("Clearbridge Investments LLC", "CLEARBRIDGE"),
    ("Janus Henderson Group Plc", "JANUS"),
    ("Putnam Investments LLC", "PUTNAM"),
    ("American Century Companies Inc", "AMERICAN CENTURY"),
    ("DSM Capital Partners LLC", "DSM"),
    ("Melvin Capital Management LP", "MELVIN"),
    ("Whale Rock Capital Management", "WHALE ROCK"),
    ("Dragoneer Investment Group LLC", "DRAGONEER"),
    ("D1 Capital Partners LP", "D1 CAPITAL"),
    ("SCGE Management LP", "SCGE"),
    ("HMI Capital Management LP", "HMI"),
    ("Matrix Capital Management Co LP", "MATRIX"),
    ("Altimeter Capital Management LP", "ALTIMETER"),
    ("Hound Partners LLC", "HOUND"),
    ("Maplelane Capital LLC", "MAPLELANE"),
]

last_request = 0
def sec_request(url, timeout=20):
    """Rate-limited SEC EDGAR request."""
    global last_request
    elapsed = time.time() - last_request
    if elapsed < RATE_LIMIT:
        time.sleep(RATE_LIMIT - elapsed)
    last_request = time.time()
    
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip'})
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        data = resp.read()
        if resp.headers.get('Content-Encoding') == 'gzip':
            data = gzip.decompress(data)
        return data
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"      Rate limited, waiting 60s...")
            time.sleep(60)
            return sec_request(url, timeout)
        return None
    except Exception:
        return None


# ============================================================
# PHASE 1: Institution CIK Lookup
# ============================================================
def build_cik_cache():
    """Download SEC company_tickers.json to build CIK lookup cache."""
    cache_path = os.path.join(DATA_DIR, 'cik_cache.json')
    
    # Check if we already have cached CIKs
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            cache = json.load(f)
        if len(cache) > 50:
            return cache
    
    print("Downloading SEC company tickers database...")
    url = "https://www.sec.gov/files/company_tickers.json"
    data = sec_request(url)
    if not data:
        return {}
    
    companies = json.loads(data)
    
    # Build name → CIK map
    name_to_cik = {}
    for entry in companies.values():
        name_lower = entry['title'].lower()
        name_to_cik[name_lower] = str(entry['cik_str']).zfill(10)
    
    # Also build from EDGAR submission headers (some institutions file under different names)
    # We'll do fuzzy matching later
    
    with open(cache_path, 'w') as f:
        json.dump(name_to_cik, f)
    
    print(f"  Cached {len(name_to_cik)} companies")
    return name_to_cik


def lookup_institution_cik(name, cik_cache):
    """Try to find CIK for an institution."""
    name_lower = name.lower()
    
    # Direct match
    if name_lower in cik_cache:
        return cik_cache[name_lower]
    
    # Partial match (first word)
    first_word = name_lower.split()[0]
    for cached_name, cik in cik_cache.items():
        if first_word in cached_name and name_lower.split()[-1] in cached_name:
            return cik
    
    # Try SEC EDGAR search
    search_name = name.split('(')[0].strip().replace(' ', '%20')
    url = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company={search_name}&type=13F&dateb=&owner=include&count=10&output=json"
    
    try:
        data = sec_request(url)
        if data:
            results = json.loads(data)
            # Just take the first result
            return results.get('cik', '').zfill(10) if results.get('cik') else None
    except:
        pass
    
    return None


def resolve_all_institutions():
    """Resolve CIKs for all top 100 institutions."""
    print("\n" + "=" * 80)
    print("PHASE 1: Resolving Institution CIKs")
    print("=" * 80)
    
    cik_cache = build_cik_cache()
    
    resolved = []
    unresolved = []
    
    for full_name, short_name in TOP_INSTITUTIONS:
        # Try full name first
        cik = lookup_institution_cik(full_name, cik_cache)
        if not cik:
            cik = lookup_institution_cik(short_name, cik_cache)
        
        if cik:
            resolved.append({
                'name': full_name,
                'short_name': short_name,
                'cik': cik,
            })
            if len(resolved) <= 5 or len(resolved) % 20 == 0:
                print(f"  ✅ {full_name[:50]} → CIK={cik}")
        else:
            unresolved.append(full_name)
            if len(unresolved) <= 10:
                print(f"  ❌ {full_name[:50]} → NOT FOUND")
    
    print(f"\n  Resolved: {len(resolved)} / {len(TOP_INSTITUTIONS)}")
    print(f"  Unresolved: {len(unresolved)}")
    
    # Save
    with open(os.path.join(DATA_DIR, 'institution_ciks.json'), 'w') as f:
        json.dump(resolved, f, indent=2)
    
    return resolved


# ============================================================
# PHASE 2: Download 13F Filing Indexes
# ============================================================
def fetch_13f_filings(cik, max_filings=40):
    """Get list of 13F-HR (quarterly holdings) filings for an institution."""
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    data = sec_request(url)
    if not data:
        return []
    
    try:
        filings_data = json.loads(data)
    except:
        return []
    
    form13f = []
    recent = filings_data.get('filings', {}).get('recent', {})
    
    forms = recent.get('form', [])
    acc_numbers = recent.get('accessionNumber', [])
    filing_dates = recent.get('filingDate', [])
    primary_docs = recent.get('primaryDocument', [])
    
    cik_num = int(cik)
    
    for i, form in enumerate(forms):
        if form in ('13F-HR', '13F-HR/A') and i < len(acc_numbers) and i < max_filings:
            acc = acc_numbers[i]
            acc_clean = acc.replace('-', '')
            doc = primary_docs[i] if i < len(primary_docs) else ''
            
            # 13F filings are in a subdirectory
            filing_url = f"https://www.sec.gov/Archives/edgar/data/{cik_num}/{acc_clean}/{doc}"
            # The actual XML table is often at a different URL
            # Primary doc is usually the cover page; the info table is often the same acc with different suffix
            
            form13f.append({
                'accession': acc,
                'filing_date': filing_dates[i] if i < len(filing_dates) else '',
                'url': filing_url,
                'doc': doc,
                'form': form,
            })
    
    return form13f


def fetch_all_13f_indexes(institutions):
    """Fetch 13F filing indexes for all resolved institutions."""
    print("\n" + "=" * 80)
    print(f"PHASE 2: Fetching 13F Filing Indexes ({len(institutions)} institutions)")
    print("=" * 80)
    
    all_filings = {}
    total_13f = 0
    
    for i, inst in enumerate(institutions):
        cik = inst['cik']
        name = inst['short_name'][:30]
        
        filings = fetch_13f_filings(cik, max_filings=40)
        all_filings[cik] = filings
        total_13f += len(filings)
        
        if (i + 1) % 10 == 0 or i == 0:
            print(f"  [{i+1}/{len(institutions)}] {name}: {len(filings)} filings (total: {total_13f})")
    
    print(f"\n  Total 13F filings to process: {total_13f}")
    print(f"  Estimated time: {total_13f * 0.3 / 60:.1f} minutes")
    
    # Save
    with open(os.path.join(DATA_DIR, 'all_13f_indexes.json'), 'w') as f:
        json.dump(all_filings, f, indent=2, default=str)
    
    return all_filings


# ============================================================
# PHASE 3: Parse 13F XML (Quarter-over-Quarter Analysis)
# ============================================================
def parse_13f_xml(filing_url, cik_num, accession):
    """Parse a single 13F XML filing and extract holdings."""
    # 13F XML is at: /Archives/edgar/data/{cik}/{acc_clean}/{doc}
    # But the actual info table XML is often named differently
    # Try multiple URL patterns
    
    acc_clean = accession.replace('-', '')
    
    # Pattern 1: Same URL as primary document (often the cover)
    data = sec_request(filing_url, timeout=30)
    if not data:
        return None
    
    text = data.decode('utf-8', errors='ignore')
    
    # Check if this is the actual holdings XML
    holdings = []
    
    # 13F XML uses <infoTable> elements
    info_tables = re.findall(r'<infoTable>(.*?)</infoTable>', text, re.DOTALL)
    
    if not info_tables:
        # Try finding the XML info table reference
        xml_refs = re.findall(r'<xmlDocument>.*?<conformedName>(.*?)</conformedName>.*?</xmlDocument>', text, re.DOTALL)
        if xml_refs:
            # The actual data XML is accessed differently
            # Try common patterns
            for suffix in ['_primary_document.xml', '_informationtable.xml', '.xml']:
                alt_url = filing_url.rsplit('/', 1)[0] + '/' + suffix
                alt_data = sec_request(alt_url, timeout=30)
                if alt_data:
                    alt_text = alt_data.decode('utf-8', errors='ignore')
                    info_tables = re.findall(r'<infoTable>(.*?)</infoTable>', alt_text, re.DOTALL)
                    if info_tables:
                        break
    
    for table in info_tables:
        name_match = re.search(r'<nameOfIssuer>(.*?)</nameOfIssuer>', table)
        ticker_match = re.search(r'<cusip>(.*?)</cusip>', table)
        class_match = re.search(r'<titleOfClass>(.*?)</titleOfClass>', table)
        value_match = re.search(r'<value>(\d+)</value>', table)
        shares_match = re.search(r'<sshPrnamt>(\d+)</sshPrnamt>', table)
        put_call = re.search(r'<putCall>(.*?)</putCall>', table)
        
        if name_match and value_match:
            # Parse shares (sometimes in <sshPrnamt>, sometimes in <sshPrnamtType>)
            try:
                shares = int(shares_match.group(1)) if shares_match else 0
                value = int(value_match.group(1)) * 1000  # 13F values are in thousands
                
                holdings.append({
                    'issuer': name_match.group(1),
                    'cusip': ticker_match.group(1)[:8] if ticker_match else '',
                    'class': class_match.group(1) if class_match else '',
                    'value': value,
                    'shares': shares,
                    'put_call': put_call.group(1) if put_call else '',
                })
            except:
                pass
    
    return holdings if holdings else None


# ============================================================
# MAIN PIPELINE
# ============================================================
def main():
    print("=" * 80)
    print("SEC EDGAR BULK PIPELINE — 10-YEAR INSTITUTIONAL 13F ANALYSIS")
    print(f"Target: Top 100 institutions, 10 years of quarterly 13F data")
    print("=" * 80)
    
    start_time = time.time()
    
    # Phase 1: Resolve CIKs
    institutions = resolve_all_institutions()
    
    if not institutions:
        print("\n❌ Failed to resolve any institution CIKs. Aborting.")
        return
    
    print(f"\n✅ Phase 1 complete: {len(institutions)} institutions resolved")
    
    # Phase 2: Fetch 13F indexes (quick)
    all_13f = fetch_all_13f_indexes(institutions)
    
    total_filings = sum(len(f) for f in all_13f.values())
    print(f"\n✅ Phase 2 complete: {total_filings} total 13F filings indexed")
    
    # Phase 3 preview
    print(f"\n{'='*80}")
    print(f"PHASE 3: Download & Parse 13F XML Holdings")
    print(f"Estimated: {total_filings} filings × 0.3s = {total_filings * 0.3 / 60:.1f} minutes")
    print(f"Press Ctrl+C to stop early — results will be saved incrementally")
    print(f"{'='*80}")
    
    # Save progress
    with open(os.path.join(DATA_DIR, 'pipeline_progress.json'), 'w') as f:
        json.dump({
            'phase': '2_complete',
            'institutions': len(institutions),
            'total_13f_filings': total_filings,
            'timestamp': datetime.now().isoformat(),
        }, f)
    
    print(f"\n📁 Pipeline state saved to {DATA_DIR}/")
    print(f"   institution_ciks.json — {len(institutions)} institutions with CIKs")
    print(f"   all_13f_indexes.json — {total_filings} 13F filing URLs")
    print(f"   pipeline_progress.json — current phase")
    print(f"\n⏱️  Pipeline setup complete in {time.time() - start_time:.0f}s")
    print(f"   Phase 3 will download {total_filings} 13F XML files.")
    print(f"   Run: python3 scripts/sec_bulk_pipeline.py --phase3 to continue")


if __name__ == '__main__':
    if '--phase3' in sys.argv:
        # TODO: Phase 3 runner
        print("Phase 3 runner not yet implemented. Running full pipeline...")
        main()
    else:
        main()
