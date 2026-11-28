"""Cầu sang lõi Roa ở codebase/ (ADR 0003). codebase/ chỉ dùng thư viện chuẩn, import qua đường dẫn."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CODEBASE = ROOT / "codebase"
if str(CODEBASE) not in sys.path:
    sys.path.insert(0, str(CODEBASE))

import tools  # noqa: E402  (codebase/tools.py)

city_key = tools.city_key
hhmm = tools.hhmm
use_store = tools.use_store
