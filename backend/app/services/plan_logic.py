"""Hàm thuần trên plan JSON (docs/DATABASE.md mục 3): kiểm schema, cấp id, áp `ops`, diff, tính `computed`.

Không đụng DB. Tiền chỉ cộng số có trong plan, không ước lượng (R-41).
"""
import copy
import re
import secrets

KINDS = ("food", "cafe", "sight", "hotel", "activity", "move", "other")
_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
ITEM_FIELDS = ("start", "end", "kind", "name", "place_id", "address", "lat", "lng", "cost_per_person",
               "hours_unverified", "price_unverified", "reason", "note", "sources")
EDITABLE = set(ITEM_FIELDS)  # update_item không được đổi `id`


class PlanError(Exception):
    """Plan hoặc `ops` sai. `index`: thao tác lỗi (None khi lỗi ở plan)."""

    def __init__(self, message: str, index: int | None = None):
        super().__init__(message)
        self.message, self.index = message, index


def _min(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def new_item_id(used: set) -> str:
    while True:
        iid = "itm_" + secrets.token_hex(3)
        if iid not in used:
            used.add(iid)
            return iid


def all_ids(plan: dict) -> list[str]:
    return [it.get("id") for d in plan.get("days", []) for it in d.get("items", [])]


def validate_item(it, where: str, need_id: bool = True) -> None:
    if not isinstance(it, dict):
        raise PlanError(f"{where}: mục phải là object")
    if need_id and not (isinstance(it.get("id"), str) and it["id"].startswith("itm_")):
        raise PlanError(f"{where}: thiếu id mục")
    for k in ("start", "end"):
        if not isinstance(it.get(k), str) or not _HHMM.match(it[k]):
            raise PlanError(f"{where}: `{k}` phải dạng HH:MM")
    if _min(it["end"]) <= _min(it["start"]):
        raise PlanError(f"{where}: giờ kết thúc phải sau giờ bắt đầu")
    if it.get("kind") not in KINDS:
        raise PlanError(f"{where}: `kind` phải là một trong {', '.join(KINDS)}")
    if not isinstance(it.get("name"), str) or not it["name"].strip():
        raise PlanError(f"{where}: thiếu tên")
    cost = it.get("cost_per_person")
    if cost is not None and (not isinstance(cost, int) or isinstance(cost, bool) or cost < 0):
        raise PlanError(f"{where}: `cost_per_person` phải là số nguyên ≥ 0 hoặc null")


def validate_plan(plan, n_days: int, need_ids: bool = True) -> None:
    """Kiểm schema mục 3.1. `n_days`: số ngày của chuyến đi (ngày ngoài chuyến đi là lỗi)."""
    if not isinstance(plan, dict) or plan.get("schema_version") != 1:
        raise PlanError("Plan phải có schema_version = 1")
    days = plan.get("days")
    if not isinstance(days, list) or not days:
        raise PlanError("Plan phải có ít nhất một ngày")
    seen_days, seen_ids = set(), set()
    for d in days:
        if not isinstance(d, dict) or not isinstance(d.get("day"), int) or not 1 <= d["day"] <= n_days:
            raise PlanError(f"Ngày phải là số từ 1 đến {n_days}")
        if d["day"] in seen_days:
            raise PlanError(f"Ngày {d['day']} bị lặp")
        seen_days.add(d["day"])
        if not isinstance(d.get("items"), list):
            raise PlanError(f"Ngày {d['day']}: thiếu danh sách mục")
        for i, it in enumerate(d["items"]):
            validate_item(it, f"Ngày {d['day']}, mục {i + 1}", need_ids)
            if need_ids:
                if it["id"] in seen_ids:
                    raise PlanError(f"Mã mục {it['id']} bị lặp")  # I7
                seen_ids.add(it["id"])


def _clean_item(it: dict) -> dict:
    out = {k: it.get(k) for k in ITEM_FIELDS}
    out["hours_unverified"] = bool(it.get("hours_unverified", True))
    out["price_unverified"] = bool(it.get("price_unverified", True))
    out["reason"], out["note"] = it.get("reason") or "", it.get("note") or ""
    out["sources"] = it.get("sources") or []
    return out


def normalize(plan: dict, start_date, n_days: int) -> dict:
    """Bản nháp nhóm trưởng gửi duyệt → plan v1: cấp lại id (I7), điền ngày, xếp mục theo giờ."""
    from datetime import timedelta
    validate_plan(plan, n_days, need_ids=False)
    used: set = set()
    days = []
    for d in sorted(plan["days"], key=lambda d: d["day"]):
        items = [{"id": new_item_id(used), **_clean_item(it)} for it in d["items"]]
        days.append({"day": d["day"], "date": (start_date + timedelta(days=d["day"] - 1)).isoformat(),
                     "title": d.get("title") or f"Ngày {d['day']}", "items": sort_items(items)})
    return {"schema_version": 1, "transport": plan.get("transport") or "", "notes": plan.get("notes") or "",
            "days": days}


def sort_items(items: list) -> list:
    return sorted(items, key=lambda it: _min(it["start"]))


# ---------------------------------------------------------------- ops (mục 3.2)

def touched(ops: list | None) -> set:
    """Mục bị đụng theo bảng mục 3.2 (dùng phát hiện đề xuất cũ)."""
    out = set()
    for op in ops or []:
        for key in ("item_id", "after_id"):
            if op.get(key):
                out.add(op[key])
    return out


def _find(plan, item_id):
    for d in plan["days"]:
        for i, it in enumerate(d["items"]):
            if it["id"] == item_id:
                return d, i
    return None, None


def _day(plan, n):
    return next((d for d in plan["days"] if d["day"] == n), None)


def _insert(day, item, after_id, idx):
    if after_id is None:
        day["items"].insert(0, item)
        return
    pos = next((i for i, it in enumerate(day["items"]) if it["id"] == after_id), None)
    if pos is None:
        raise PlanError(f"Không có mục {after_id} trong ngày {day['day']}", idx)
    day["items"].insert(pos + 1, item)


def apply_ops(plan: dict, ops: list, n_days: int, used_ids: set | None = None) -> dict:
    """Áp `ops` tuần tự lên bản sao của plan; một thao tác lỗi → PlanError (cả đề xuất bị từ chối)."""
    if not isinstance(ops, list) or not ops:
        raise PlanError("`ops` phải là danh sách có ít nhất một thao tác")
    out = copy.deepcopy(plan)
    used = set(all_ids(out)) | set(used_ids or ())
    for idx, op in enumerate(ops):
        kind = op.get("op") if isinstance(op, dict) else None
        if kind == "add_item":
            day = _day(out, op.get("day"))
            if day is None:
                raise PlanError(f"Ngày {op.get('day')} không có trong plan", idx)
            item = op.get("item")
            try:
                validate_item(item, f"Thao tác {idx + 1}", need_id=False)
            except PlanError as e:
                raise PlanError(e.message, idx) from None
            _insert(day, {"id": new_item_id(used), **_clean_item(item)}, op.get("after_id"), idx)
        elif kind == "update_item":
            day, i = _find(out, op.get("item_id"))
            changes = op.get("set")
            if day is None:
                raise PlanError(f"Không có mục {op.get('item_id')}", idx)
            if not isinstance(changes, dict) or not changes or set(changes) - EDITABLE:
                raise PlanError("`set` chỉ được đổi các trường của mục (không đổi id)", idx)
            day["items"][i] = {**day["items"][i], **changes}
        elif kind == "remove_item":
            day, i = _find(out, op.get("item_id"))
            if day is None:
                raise PlanError(f"Không có mục {op.get('item_id')}", idx)
            day["items"].pop(i)
        elif kind == "move_item":
            day, i = _find(out, op.get("item_id"))
            to = _day(out, op.get("to_day"))
            if day is None:
                raise PlanError(f"Không có mục {op.get('item_id')}", idx)
            if to is None:
                raise PlanError(f"Ngày {op.get('to_day')} không có trong plan", idx)
            item = day["items"].pop(i)
            _insert(to, item, op.get("after_id"), idx)
        else:
            raise PlanError(f"Thao tác không hợp lệ: {kind}", idx)
    for d in out["days"]:
        for it in d["items"]:
            try:
                validate_item(it, f"Ngày {d['day']}, mục {it.get('name')}")
            except PlanError as e:
                raise PlanError(e.message, len(ops) - 1) from None
        d["items"] = sort_items(d["items"])
    validate_plan(out, n_days)
    return out


# ---------------------------------------------------------------- diff, computed

def _index(plan: dict) -> dict:
    return {it["id"]: (d["day"], it) for d in plan.get("days", []) for it in d.get("items", [])}


def diff(old: dict, new: dict) -> dict:
    """Thay đổi theo `id` mục, cùng dạng API diff (docs/API_SPEC.md mục 3)."""
    a, b = _index(old), _index(new)
    changes = []
    for iid, (day, it) in b.items():
        if iid not in a:
            changes.append({"type": "added", "item_id": iid, "day": day, "name": it["name"]})
            continue
        oday, oit = a[iid]
        if oday != day:
            changes.append({"type": "moved", "item_id": iid, "name": it["name"],
                            "from": {"day": oday, "start": oit["start"]}, "to": {"day": day, "start": it["start"]}})
        fields = {k: [oit.get(k), it.get(k)] for k in ITEM_FIELDS if oit.get(k) != it.get(k)}
        if fields and oday == day:
            changes.append({"type": "updated", "item_id": iid, "name": it["name"], "fields": fields})
    for iid, (day, it) in a.items():
        if iid not in b:
            changes.append({"type": "removed", "item_id": iid, "day": day, "name": it["name"]})
    delta = compute(new)["total_cost_per_person"] - compute(old)["total_cost_per_person"]
    return {"changes": changes, "cost_delta_per_person": delta}


def changed_ids(old: dict, new: dict) -> set:
    return {c["item_id"] for c in diff(old, new)["changes"]}


def compute(plan: dict) -> dict:
    """Tổng tiền/người chỉ cộng mục có giá; cảnh báo chồng giờ và mục chưa xác minh."""
    per_day, warnings = [], []
    for d in plan.get("days", []):
        items = d.get("items", [])
        cost = sum(it.get("cost_per_person") or 0 for it in items)
        per_day.append({"day": d["day"], "cost_per_person": cost})
        for prev, cur in zip(items, items[1:]):
            if _min(cur["start"]) < _min(prev["end"]):
                warnings.append({"item_id": cur.get("id"), "type": "overlap",
                                 "message": f"Ngày {d['day']}: {cur['name']} chồng giờ với {prev['name']}"})
        for it in items:
            if it.get("hours_unverified") and it.get("kind") not in ("move", "hotel"):
                warnings.append({"item_id": it.get("id"), "type": "hours_unverified",
                                 "message": f"Giờ mở cửa của {it['name']} chưa xác minh"})
            if it.get("price_unverified") and it.get("kind") != "move":
                warnings.append({"item_id": it.get("id"), "type": "price_unverified",
                                 "message": f"Giá của {it['name']} chưa xác minh"})
    return {"total_cost_per_person": sum(p["cost_per_person"] for p in per_day), "per_day": per_day,
            "warnings": warnings}
