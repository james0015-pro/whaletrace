#!/usr/bin/env python3
"""
WhaleTrace → GitHub 資料推送
=============================
讀取爬蟲輸出 JSON，用 GitHub API 上傳到 repo，
供 n8n WhaleTrace Data API 從 GitHub Raw 讀取。
取代原本的 upload_to_n8n.py。
"""

import json, os, sys, base64, urllib.request

SCRAPER_OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
TOKEN = os.getenv("GITHUB_TOKEN", "")
OWNER, REPO = "james0015-pro", "whaletrace"
BRANCH = "master"

FILES_TO_SYNC = [
    ("stock_snapshots.json", "data: update stock snapshots"),
    ("institutional_holdings.json", "data: update institutional holdings"),
]

def upload_file(path: str, message: str) -> bool:
    """Upload a file to GitHub repo via API"""
    filepath = os.path.join(SCRAPER_OUTPUT, path)
    if not os.path.exists(filepath):
        print(f"  ⚠️ {path} not found, skipping")
        return False
    
    with open(filepath) as f:
        content = f.read()
    
    api_path = f"/contents/scripts/output/{path}"
    url = f"https://api.github.com/repos/{OWNER}/{REPO}{api_path}"
    
    b64 = base64.b64encode(content.encode()).decode()
    body = {"message": message, "content": b64, "branch": BRANCH}
    
    # Get existing SHA if file exists
    try:
        req_get = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        })
        existing = json.loads(urllib.request.urlopen(req_get, timeout=15).read())
        if 'sha' in existing:
            body['sha'] = existing['sha']
    except Exception:
        pass  # New file
    
    req = urllib.request.Request(url,
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
        },
        method="PUT"
    )
    
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        result = json.loads(resp.read())
        if 'content' in result:
            print(f"  ✅ {path} ({len(content)} bytes)")
            return True
        else:
            print(f"  ❌ {path}: {result}")
            return False
    except Exception as e:
        print(f"  ❌ {path}: {e}")
        return False

if __name__ == "__main__":
    print(f"📤 Pushing WhaleTrace data to GitHub...")
    success = 0
    for filename, message in FILES_TO_SYNC:
        if upload_file(filename, message):
            success += 1
    print(f"\n✅ {success}/{len(FILES_TO_SYNC)} files pushed")
    sys.exit(0 if success > 0 else 1)
