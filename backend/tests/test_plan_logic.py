"""Hàm thuần trên plan JSON: cấp id, áp ops, diff, computed (docs/DATABASE.md mục 3)."""
from datetime import date

import pytest

from app.services import plan_logic as pl


def item(start, end, name, kind="food", cost=None, **kw):
    kw.setdefault("hours_unverified", False)
    kw.setdefault("price_unverified", False)
    return {"start": start, "end": end, "kind": kind, "name": name, "cost_per_person": cost, **kw}


def draft():
    return {"schema_version": 1, "days": [
        {"day": 2, "items": [item("12:00", "13:00", "Bún", cost=50000)]},
        {"day": 1, "items": [item("14:00", "14:30", "Nhận phòng", "hotel", price_unverified=True),
                             item("08:00", "09:00", "Phở", cost=40000)]},
    ]}


def plan():
    return pl.normalize(draft(), date(2026, 12, 5), 2)


def test_normalize_assigns_ids_dates_and_sorts():
    p = plan()
    assert [d["date"] for d in p["days"]] == ["2026-12-05", "2026-12-06"]
    assert [it["name"] for it in p["days"][0]["items"]] == ["Phở", "Nhận phòng"]
    ids = pl.all_ids(p)
    assert len(set(ids)) == 3 and all(i.startswith("itm_") for i in ids)


def test_normalize_rejects_bad_time_and_day():
    bad = draft()
    bad["days"][0]["items"][0]["start"] = "25:00"
    with pytest.raises(pl.PlanError):
        pl.normalize(bad, date(2026, 12, 5), 2)
    with pytest.raises(pl.PlanError):
        pl.normalize(draft(), date(2026, 12, 5), 1)  # có ngày 2 khi chuyến chỉ 1 ngày


def test_apply_ops_does_not_mutate_and_resorts():
    p = plan()
    pho = p["days"][0]["items"][0]["id"]
    bun = p["days"][1]["items"][0]["id"]
    new = pl.apply_ops(p, [
        {"op": "update_item", "item_id": pho, "set": {"start": "15:00", "end": "16:00"}},
        {"op": "move_item", "item_id": bun, "to_day": 1, "after_id": None},
        {"op": "add_item", "day": 2, "after_id": None, "item": item("09:00", "10:00", "Cà phê", "cafe", 30000)},
    ], 2)
    assert p["days"][0]["items"][0]["start"] == "08:00"  # bản gốc giữ nguyên (I1)
    assert [it["name"] for it in new["days"][0]["items"]] == ["Bún", "Nhận phòng", "Phở"]
    added = new["days"][1]["items"][0]
    assert added["name"] == "Cà phê" and added["id"] not in pl.all_ids(p)
    changes = pl.diff(p, new)["changes"]
    types = sorted(c["type"] for c in changes)
    assert types == ["added", "moved", "updated"]
    updated = next(c for c in changes if c["type"] == "updated")
    assert updated["name"] == "Phở"
    assert pl.diff(p, new)["cost_delta_per_person"] == 30000
    assert pl.touched([{"op": "move_item", "item_id": bun, "after_id": pho}]) == {bun, pho}


@pytest.mark.parametrize("ops,idx", [
    ([{"op": "remove_item", "item_id": "itm_000000"}], 0),
    ([{"op": "update_item", "item_id": "X", "set": {}}], 0),
    ([{"op": "add_item", "day": 9, "item": item("09:00", "10:00", "A")}], 0),
    ([{"op": "nhay"}], 0),
])
def test_apply_ops_errors_carry_index(ops, idx):
    with pytest.raises(pl.PlanError) as e:
        pl.apply_ops(plan(), ops, 2)
    assert e.value.index == idx


def test_update_cannot_change_id():
    p = plan()
    iid = p["days"][0]["items"][0]["id"]
    with pytest.raises(pl.PlanError):
        pl.apply_ops(p, [{"op": "update_item", "item_id": iid, "set": {"id": "itm_abcdef"}}], 2)


def test_compute_totals_and_warnings():
    p = plan()
    p["days"][0]["items"].append(item("08:30", "09:30", "Bánh mì", cost=20000, hours_unverified=True))
    p["days"][0]["items"] = pl.sort_items(p["days"][0]["items"])
    c = pl.compute(p)
    assert c["total_cost_per_person"] == 110000
    assert c["per_day"] == [{"day": 1, "cost_per_person": 60000}, {"day": 2, "cost_per_person": 50000}]
    kinds = sorted(w["type"] for w in c["warnings"])
    assert kinds == ["hours_unverified", "overlap", "price_unverified"]
