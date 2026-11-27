"""Thử thu "quán hot" từ TikTok cho một điểm đến, xem có khớp bảng `trending_spots` không.

Đây là script thử (spike), chạy tay một lần, KHÔNG chạy lúc web/agent chạy (ARCHITECTURE.md mục 5).
Điều khoản TikTok còn chờ OQ-11: kết quả chỉ để đánh giá cấu trúc, chưa phải dữ liệu chính thức.

Nguồn:
  1. Tavily search, giới hạn domain tiktok.com  -> URL video + tiêu đề + đoạn mô tả (luôn chạy)
  2. Firecrawl scrape trang video               -> thử lấy lượt xem/thích (tuỳ chọn, --firecrawl N)
  3. RapidAPI TikTok (vd tiktok-scraper7)       -> lượt xem/thích/lưu (tuỳ chọn, --rapidapi-host, phải đăng ký API đó trên RapidAPI)

Không lưu tên, ảnh, handle người đăng vào file ứng viên. File thô (data/raw/) có caption và URL gốc:
chỉ để trên máy, .gitignore đã bỏ qua.

Câu tìm luôn kết thúc bằng tên thành phố, vd "bùng binh chợ mới đà lạt" (with_city).

Chiều A (--from-catalog): lấy tên nơi trong kho Geoapify (spike_geoapify.py), tìm "<tên nơi> <thành phố>"
trên TikTok, đếm video có caption nhắc tên nơi đó. Mỗi nơi 1 lượt Tavily.

Chạy:
  python scripts/spike_tiktok_trending.py --env-file <đường dẫn .env có TAVILY_API_KEY...> --city "Đà Lạt"
  python scripts/spike_tiktok_trending.py --env-file .env --city "Đà Lạt" \
      --from-catalog data/raw/geoapify-da-lat-<stamp>.json --top 20
Chỉ dùng thư viện chuẩn của Python.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TIMEOUT = 45
MENTION_SCORE = 0.6  # cùng ngưỡng khớp tên với spike_geoapify.py

sys.path.insert(0, str(Path(__file__).resolve().parent))
import spike_geoapify as gp  # noqa: E402  (dùng chung norm, name_score, is_distinctive)

# Từ khoá -> category của trending_spots. Thô, chỉ để thử; bản thật nên để model hoặc người gán.
CATEGORY_HINTS = [
    ("cafe", ["cafe", "cà phê", "coffee", "caphe", "quán cf"]),
    ("food", ["quán ăn", "ăn gì", "món", "lẩu", "bánh", "nướng", "food", "ăn vặt", "nhà hàng", "bún", "phở"]),
    ("sight", ["check-in", "check in", "checkin", "săn mây", "đồi", "hồ", "thác", "view", "cảnh"]),
    ("hotel", ["homestay", "khách sạn", "resort", "villa"]),
    ("activity", ["chợ đêm", "trải nghiệm", "cắm trại", "camping", "trekking"]),
]

VIDEO_ID_RE = re.compile(r"tiktok\.com/@[^/]+/(?:video|photo)/(\d+)")
NUMBER_RE = r"([\d.,]+\s*[KMBkmb]?)"


def load_env(path: Path) -> None:
    """Nạp KEY=VALUE vào os.environ. Không in giá trị."""
    if not path.exists():
        sys.exit(f"Không thấy file env: {path}")
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


def http_json(url: str, *, body: dict | None = None, headers: dict | None = None) -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def tavily_search(query: str, max_results: int) -> list[dict]:
    key = os.getenv("TAVILY_API_KEY")
    if not key:
        sys.exit("Thiếu TAVILY_API_KEY trong file env")
    data = http_json(
        "https://api.tavily.com/search",
        body={
            "query": query,
            "max_results": max_results,
            "search_depth": "basic",
            "include_domains": ["tiktok.com"],
        },
        headers={"Authorization": f"Bearer {key}"},
    )
    return data.get("results", [])


def firecrawl_scrape(url: str) -> dict:
    key = os.getenv("FIRECRAWL_API_KEY")
    if not key:
        return {"error": "thiếu FIRECRAWL_API_KEY"}
    try:
        data = http_json(
            "https://api.firecrawl.dev/v1/scrape",
            body={"url": url, "formats": ["markdown"]},
            headers={"Authorization": f"Bearer {key}"},
        ).get("data", {})
        return {"markdown": (data.get("markdown") or "")[:6000], "metadata": data.get("metadata") or {}}
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}"}
    except Exception as e:  # noqa: BLE001 - script thử, ghi lỗi rồi đi tiếp
        return {"error": type(e).__name__}


def rapidapi_tiktok(url: str, host: str) -> dict:
    """Theo định dạng tiktok-scraper7 (tikwm): GET /?url=...&hd=0 -> data.play_count, digg_count, collect_count."""
    key = os.getenv("RAPIDAPI_KEY")
    if not key:
        return {"error": "thiếu RAPIDAPI_KEY"}
    q = urllib.parse.urlencode({"url": url, "hd": 0})
    try:
        data = http_json(f"https://{host}/?{q}", headers={"x-rapidapi-key": key, "x-rapidapi-host": host})
        d = data.get("data") or {}
        return {
            "views": d.get("play_count"),
            "likes": d.get("digg_count"),
            "saves": d.get("collect_count"),
            "comments": d.get("comment_count"),
            "create_time": d.get("create_time"),
            "title": d.get("title"),
        }
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}" + (" (chưa đăng ký API này trên RapidAPI?)" if e.code in (401, 403) else "")}
    except Exception as e:  # noqa: BLE001
        return {"error": type(e).__name__}


def parse_count(s: str) -> int | None:
    s = s.strip().replace(" ", "")
    if not s:
        return None
    mult = {"k": 1e3, "m": 1e6, "b": 1e9}.get(s[-1].lower(), 1)
    num = s[:-1] if mult != 1 else s
    try:
        if mult == 1:  # 94,824 / 94.824 -> 94824
            return int(re.sub(r"[.,]", "", num))
        return int(float(num.replace(",", ".")) * mult)  # 55.9K / 55,9K
    except ValueError:
        return None


def engagement_from_table(md: str) -> dict:
    """Firecrawl trả bảng '| Views | Likes | Comments | Shares | Saves |' rồi một dòng số."""
    lines = [l.strip() for l in md.splitlines() if l.strip().startswith("|")]
    for i, line in enumerate(lines[:-2]):
        heads = [h.strip().lower() for h in line.strip("|").split("|")]
        if "views" in heads or "likes" in heads:
            vals = [x.strip() for x in lines[i + 2].strip("|").split("|")]
            return {h: parse_count(v) for h, v in zip(heads, vals) if h}
    return {}


def posted_date(md: str) -> str | None:
    m = re.search(r"\*\*@[^*]+\*\*[^\n]*?(\d{4}-\d{2}-\d{2})", md)
    return m.group(1) if m else None


def strip_people(text: str) -> str:
    """Bỏ handle và tên hiển thị người đăng khỏi đoạn trích."""
    text = re.sub(r"Video TikTok từ [^:]*?\(@[\w.]+\)\s*:?", "", text)
    text = re.sub(r"\*\*@[\w.]+\*\*\s*\([^)]*\)", "", text)
    return re.sub(r"@[\w.]+", "@…", text)


def name_guess(title: str) -> str | None:
    """Đoán tên quán từ tiêu đề: phần trước ':' '—' '|' ' - '. Chỉ để người duyệt tham khảo."""
    head = re.split(r"\s*(?:[:|–—]|\s-\s)\s*", title, maxsplit=1)[0].strip()
    generic = ("review", "check-in", "quán cafe", "quán cà phê đẹp", "top", "địa điểm")
    if not head or head.lower().startswith(generic) or len(head) > 60:
        return None
    return head


def engagement_from_text(text: str) -> dict:
    """Thử bắt '12.3K Likes', '1.2M views'… trong markdown/tiêu đề trang."""
    out = {}
    for field, words in (("likes", "likes|lượt thích"), ("views", "views|lượt xem"), ("saves", "saves|favorites|lượt lưu"),
                         ("comments", "comments|bình luận")):
        m = re.search(NUMBER_RE + r"\s*(?:" + words + r")\b", text, re.I)
        if m:
            out[field] = parse_count(m.group(1))
    return out


def guess_category(text: str) -> str | None:
    t = text.lower()
    for cat, words in CATEGORY_HINTS:
        if any(w in t for w in words):
            return cat
    return None


def hashtags(text: str) -> list[str]:
    return sorted(set(re.findall(r"#(\w+)", text)))[:15]


def strip_city(text: str, city: str) -> str:
    """Bỏ tên thành phố ('Đà Lạt', 'Da Lat', 'Dalat') và chữ không phải Latin (vd '달랏') khỏi chuỗi.

    Giữ nguyên phần còn lại của chuỗi gốc ('check-in', "D'Lart"), và giữ chữ trùng âm như 'Đá' trong 'Hồ Đá Xanh'.
    """
    text = text or ""
    toks = list(re.finditer(r"\w+", text))
    ct = gp.norm(city).split()
    compact = "".join(ct)
    drop: list[tuple[int, int]] = []
    i = 0
    while i < len(toks):
        if ct and [gp.norm(m.group()) for m in toks[i:i + len(ct)]] == ct:
            drop.append((toks[i].start(), toks[i + len(ct) - 1].end()))
            i += len(ct)
            continue
        if gp.norm(toks[i].group()) in ("", compact):
            drop.append(toks[i].span())
        i += 1
    for a, b in reversed(drop):
        text = text[:a] + " " + text[b:]
    text = re.sub(r"\s+", " ", text)
    return text.strip(" -–|,.:")


def with_city(query: str, city: str) -> str:
    """Câu tìm TikTok: tên thành phố luôn đứng cuối, vd 'Bùng binh Chợ Mới đà lạt'."""
    return f"{strip_city(query, city)} {city.lower()}".strip()


def pick_catalog_targets(path: Path, city: str, groups: str, top: int) -> list[dict]:
    """Chọn `top` nơi trong kho Geoapify để tìm trên TikTok, xen kẽ các nhóm theo thứ tự `groups`.

    Bỏ nơi không tên, tên không có chữ Latin (vd tiếng Nga, tiếng Trung), tên chỉ gồm chữ chung,
    toạ độ thay tên, nơi có dấu hiệu đóng cửa, tên chuỗi (>= 2 chi nhánh trong kho). Trong mỗi nhóm, nơi có website hoặc giờ mở cửa
    đứng trước (OSM ghi đủ thường là nơi đã có tiếng; đây là cách chọn tạm, chưa kiểm).
    """
    data = json.loads(path.read_text(encoding="utf-8"))
    # Tên xuất hiện >= 2 lần trong kho thường là chuỗi (vd Highlands Coffee): video TikTok nói về
    # cả chuỗi, không phải chi nhánh này, nên bỏ.
    counts: dict[str, int] = {}
    for g in (data.get("groups") or {}).values():
        for r in g.get("places") or []:
            k = gp.norm(strip_city(r.get("name") or "", city))
            counts[k] = counts.get(k, 0) + 1
    seen: set[str] = set()
    queues: list[list[dict]] = []
    for grp in [g.strip() for g in groups.split(",") if g.strip()]:
        rows = (data.get("groups", {}).get(grp) or {}).get("places") or []
        rows = sorted(rows, key=lambda r: -(bool(r.get("website")) + bool(r.get("opening_hours"))))
        q = []
        for r in rows:
            name = strip_city(r.get("name") or "", city)
            key = gp.norm(name)
            # Xét "đủ riêng" sau khi bỏ chữ chung ('quán', 'cafe', 'ngon'): 'Pho nuong ngon' bị bỏ.
            core = gp.clean_guess(name, city)
            if (not re.search(r"[a-z]{3,}", key) or not gp.is_distinctive(core)
                    or r.get("maybe_closed") or key in seen or counts.get(key, 0) >= 2):
                continue
            seen.add(key)
            q.append({"group": grp, "osm": r.get("osm"), "name": r.get("name"), "match_name": name,
                      "query": with_city(name, city)})
        queues.append(q)
    picked: list[dict] = []
    while len(picked) < top and any(queues):
        for q in queues:
            if q and len(picked) < top:
                picked.append(q.pop(0))
    return picked


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--env-file", required=True, type=Path)
    ap.add_argument("--city", default="Đà Lạt")
    ap.add_argument("--query", action="append", help="Thêm câu tìm; bỏ trống dùng bộ mặc định")
    ap.add_argument("--max-results", type=int, default=10)
    ap.add_argument("--firecrawl", type=int, default=0, help="Scrape N video đầu bằng Firecrawl (tốn credit)")
    ap.add_argument("--rapidapi-host", default=os.getenv("RAPIDAPI_TIKTOK_HOST", ""), help="vd tiktok-scraper7.p.rapidapi.com")
    ap.add_argument("--rapidapi", type=int, default=0, help="Gọi RapidAPI cho N video đầu")
    ap.add_argument("--from-catalog", type=Path,
                    help="file geoapify-*.json từ spike_geoapify.py: lấy tên nơi đi tìm trên TikTok (chiều A)")
    ap.add_argument("--groups", default="sight,cafe,food", help="nhóm trong kho, theo thứ tự ưu tiên")
    ap.add_argument("--top", type=int, default=20, help="số nơi trong kho đem đi tìm (1 lượt Tavily mỗi nơi)")
    ap.add_argument("--out", type=Path, default=ROOT / "data" / "raw")
    args = ap.parse_args()

    load_env(args.env_file)
    if not args.rapidapi_host:
        args.rapidapi_host = os.getenv("RAPIDAPI_TIKTOK_HOST", "")
    city = args.city
    # Câu tìm TikTok luôn kết thúc bằng tên thành phố, vd "bùng binh chợ mới đà lạt".
    queries = [with_city(q, city) for q in (args.query or [
        "quán cafe hot",
        "quán ăn ngon tiktok",
        "địa điểm check-in",
    ])]

    # Chiều A: tên nơi trong kho Geoapify -> tìm trên TikTok -> đếm video có nhắc tên.
    catalog_targets = pick_catalog_targets(args.from_catalog, city, args.groups, args.top) if args.from_catalog else []
    targets = [(q, None) for q in queries] + [(t["query"], t) for t in catalog_targets]

    # 1) Tavily
    videos: dict[str, dict] = {}
    for q, target in targets:
        results = tavily_search(q, args.max_results)
        if target is not None:
            target["videos_found"] = target["videos_mention"] = 0
            target["video_ids"] = []
        for r in results:
            url = r.get("url") or ""
            m = VIDEO_ID_RE.search(url)
            if not m:  # bỏ trang hồ sơ, trang tag, trang "discover"
                continue
            vid = m.group(1)
            v = videos.setdefault(vid, {"video_id": vid, "url": url, "queries": [], "title": r.get("title") or "",
                                        "content": r.get("content") or "", "tavily_score": r.get("score"),
                                        "catalog_refs": []})
            v["queries"].append(q)
            if target is not None:
                target["videos_found"] += 1
                # Tavily trả video gần đúng; chỉ tính là "nhắc tới" khi caption chứa tên nơi.
                if gp.name_score(target["match_name"], f"{v['title']} {v['content']}") >= MENTION_SCORE:
                    target["videos_mention"] += 1
                    target["video_ids"].append(vid)
                    v["catalog_refs"].append({"osm": target["osm"], "name": target["name"]})

    ids = list(videos)
    # 2) Firecrawl, 3) RapidAPI (tuỳ chọn)
    for vid in ids[: args.firecrawl]:
        videos[vid]["firecrawl"] = firecrawl_scrape(videos[vid]["url"])
    if args.rapidapi_host:
        for vid in ids[: args.rapidapi]:
            videos[vid]["rapidapi"] = rapidapi_tiktok(videos[vid]["url"], args.rapidapi_host)

    # Ghép thành dòng ứng viên theo trending_spots (docs/DATABASE.md 2.11)
    today = dt.date.today().isoformat()
    rows = []
    for v in videos.values():
        text = " ".join([v["title"], v["content"]])
        eng = {}
        fc = v.get("firecrawl") or {}
        if fc.get("markdown"):
            eng.update(engagement_from_table(fc["markdown"]) or engagement_from_text(fc["markdown"]))
        ra = v.get("rapidapi") or {}
        for k in ("views", "likes", "saves", "comments"):
            if ra.get(k) is not None:
                eng[k] = ra[k]
        if not eng:
            eng.update(engagement_from_text(text))
        rows.append({
            # --- cột của trending_spots ---
            "city": city,
            "name": None,                       # Tavily không trả tên quán: cần người hoặc model tách từ caption
            "category": guess_category(text),
            "place_id": None,                   # cần khớp Google Places sau
            "source": "tiktok",
            "source_url": f"https://www.tiktok.com/video/{v['video_id']}",  # bỏ handle người đăng (chưa kiểm link này mở được)
            "engagement": eng or None,
            "summary": None,                    # nhóm tự tóm tắt, không chép caption
            "collected_at": today,
            # --- phụ, để người duyệt điền name/summary; không nạp vào DB ---
            "_review": {
                "name_guess": name_guess(v["title"]),
                "posted_at": posted_date(fc.get("markdown", "")),
                "caption_excerpt": strip_people(text)[:240],
                "hashtags": hashtags(text),
                "matched_queries": v["queries"],
                # Nơi trong kho Geoapify mà caption có nhắc tên (chiều A). Ghép trending_spots theo mã OSM.
                "catalog_refs": v["catalog_refs"],
            },
        })

    # Thống kê độ khớp
    n = len(rows)
    def filled(f):
        return sum(1 for r in rows if r[f] not in (None, "", {}))
    fit = {f: f"{filled(f)}/{n}" for f in ("city", "name", "category", "place_id", "source", "source_url", "engagement",
                                             "summary", "collected_at")}
    eng_fields = {k: sum(1 for r in rows if (r["engagement"] or {}).get(k) is not None)
                  for k in ("views", "likes", "comments", "shares", "saves")}
    review_fields = {k: sum(1 for r in rows if r["_review"].get(k)) for k in ("name_guess", "posted_at")}

    args.out.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    ascii_city = unicodedata.normalize("NFKD", city.replace("đ", "d").replace("Đ", "D")).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_city.lower()).strip("-") or "city"
    raw_path = args.out / f"tiktok-{slug}-{stamp}.raw.json"
    cand_path = args.out / f"tiktok-{slug}-{stamp}.candidates.json"
    raw_path.write_text(json.dumps(list(videos.values()), ensure_ascii=False, indent=2), encoding="utf-8")
    cand_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")

    if catalog_targets:
        hits_path = args.out / f"tiktok-{slug}-{stamp}.catalog-hits.json"
        hits_path.write_text(json.dumps(catalog_targets, ensure_ascii=False, indent=2), encoding="utf-8")
        hot = [t for t in catalog_targets if t["videos_mention"]]
        print(f"Chiều A (kho Geoapify -> TikTok): thử {len(catalog_targets)} nơi, "
              f"{len(hot)} nơi có video nhắc tên")
        for t in sorted(catalog_targets, key=lambda t: -t["videos_mention"]):
            print(f"  {t['videos_mention']:>2}/{t['videos_found']:<2} [{t['group']}] {t['query']}")
        print(f"Kết quả chiều A: {hits_path}")

    print(f"Câu tìm: {len(targets)} ({len(catalog_targets)} từ kho) · video TikTok duy nhất: {n}")
    print("Cột trending_spots có giá trị:", json.dumps(fit, ensure_ascii=False))
    print("engagement theo trường:", json.dumps(eng_fields))
    print("phụ để duyệt:", json.dumps(review_fields))
    for src in ("firecrawl", "rapidapi"):
        errs = [v[src]["error"] for v in videos.values() if isinstance(v.get(src), dict) and v[src].get("error")]
        tried = sum(1 for v in videos.values() if src in v)
        if tried:
            print(f"{src}: thử {tried}, lỗi {len(errs)} {sorted(set(errs))}")
    print(f"File thô (không commit): {raw_path}")
    print(f"Dòng ứng viên: {cand_path}")


if __name__ == "__main__":
    main()
