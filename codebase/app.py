"""Khung chạy bản chạy thử (dòng lệnh) có bộ nhớ hội thoại theo phiên.

Chạy bằng: python run.py   (macOS/Linux có thể là python3, Windows có thể là py)
Lượt đầu (hoặc /new <yêu cầu>) gọi generate_plan; các lượt hỏi tiếp theo gọi ask_about_plan
kèm plan vừa tạo và 10 tin nhắn gần nhất. Lệnh phụ: /memory, /reset.
"""
import os
import sys

for _stream in (sys.stdout, sys.stderr, sys.stdin):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _where(e):
    """File (trong codebase/) gây lỗi khi nạp: SyntaxError có e.filename, lỗi khác lấy khung cuối của traceback."""
    import traceback
    path = getattr(e, "filename", None) or (traceback.extract_tb(e.__traceback__)[-1].filename if e.__traceback__ else "")
    if not path:
        return "codebase/"
    p = os.path.abspath(path)
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.relpath(p, base).replace(os.sep, "/") if p.startswith(base) else path


def main() -> int:
    try:
        import tracing
        from agent import ASK_MEMORY_WINDOW, ask_about_plan, generate_plan
    except Exception as e:  # lỗi cú pháp, thiếu thư viện… trong codebase/
        print("Không nạp được codebase/ — lỗi ở %s: %s: %s" % (_where(e), type(e).__name__, e))
        print("Sửa lỗi rồi chạy lại. Cách nối model: docs/connect-model.md")
        return 1

    print("Bản chạy thử (có memory hội thoại) — gõ yêu cầu chuyến đi hoặc câu hỏi rồi Enter.")
    print("Lệnh: /new <yêu cầu> (lập lịch mới) · /memory (xem bộ nhớ) · /reset (xoá bộ nhớ) · Enter 2 lần để thoát.")
    blank = 0
    last_plan = None
    history = []

    while True:
        try:
            text = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        if not text:
            blank += 1
            if blank >= 2:
                return 0
            continue
        blank = 0

        if text == "/reset":
            last_plan = None
            history = []
            print("Đã xoá bộ nhớ phiên và lịch trình đang giữ.")
            continue
        if text == "/memory":
            days_cnt = len(last_plan.get("days", [])) if isinstance(last_plan, dict) else 0
            print(f"Memory hiện tại: {len(history)}/{ASK_MEMORY_WINDOW} tin nhắn · plan={days_cnt} ngày.")
            continue

        is_new_plan = last_plan is None or text.startswith("/new ")
        prompt = text[5:].strip() if text.startswith("/new ") else text
        if not prompt:
            print("Hãy nhập yêu cầu sau /new.")
            continue

        tracing.begin("app")
        try:
            if is_new_plan:
                result = generate_plan(prompt)
                reply_text = result.get("output", "")
                if result.get("status") == "ok" and result.get("plan"):
                    last_plan = result["plan"]
                    history = [
                        {"role": "member", "author_name": "Bạn", "content": prompt},
                        {"role": "agent", "author_name": "Roa", "content": reply_text[:400]},
                    ]
                suggest_fb = False
            else:
                result = ask_about_plan(prompt, plan=last_plan, history=history)
                reply_text = result.get("answer", "")
                suggest_fb = bool(result.get("suggest_feedback"))
                history = (history + [
                    {"role": "member", "author_name": "Bạn", "content": prompt},
                    {"role": "agent", "author_name": "Roa", "content": reply_text},
                ])[-ASK_MEMORY_WINDOW:]
        except NotImplementedError as e:
            tracing.end()
            print("Chưa nối model: %s" % e)
            return 1
        except Exception as e:  # lỗi gọi model: báo rồi cho hỏi tiếp
            tracing.end()
            print("[lỗi] %s: %s" % (type(e).__name__, e))
            continue

        s, _ = tracing.end()
        print(reply_text)
        if suggest_fb:
            print("   (Gợi ý: chế độ hỏi chỉ đọc; nếu muốn đổi lịch, dùng /new <yêu cầu> hoặc tạo đề xuất trên web.)")
        print("   (model: %s · gọi model %d lần · công cụ %d lần · token vào %d / ra %d · memory: %d tin)"
              % (", ".join(s["models"]) or "—", s["model_calls"], s["tool_calls"],
                 s["tokens_in"], s["tokens_out"], len(history)))


if __name__ == "__main__":
    sys.exit(main())
