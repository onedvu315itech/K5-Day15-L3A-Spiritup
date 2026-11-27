# Đào data — cách đếm và kết quả

> Điền ở guide bước 1.2. Ôn lại: ngày 2, ngày 6 · lab ngày 2, lab ngày 6.
> Không đào data thì xoá file này. Script / công thức đếm để trong repo (vd `evidence/count.py` hoặc ghi công thức Sheets ngay dưới), người khác chạy lại phải ra cùng số.
> Repo chỉ chứa số đã tổng hợp và vài dòng ví dụ — không chép lại nguyên file data.

## 1. Cách đếm — viết TRƯỚC khi chạy

- Data dùng: Review công khai trên Google Play / App Store của các app lập lịch trình du lịch, đi chơi nhóm (ví dụ: Wanderlog, TripIt, Polarsteps, Google Maps/Travel apps), lấy N review gần nhất (mọi mức sao hoặc ghi rõ bộ lọc) từ ngày __ đến ngày __. Link nguồn & ngày xem: __
- Đếm gì: Số review phản ánh các nhóm vấn đề: (1) `sai_gio_mo_cua` (giờ mở cửa/trạng thái quán sai thực tế), (2) `kho_dung_nhom` (khó gom ý kiến, phân quyền hoặc chia sẻ lịch cho nhóm đông), (3) `thong_tin_roi_rac_ngan_sach` (thiếu gợi ý thực tế, khó tính ngân sách/tuyến đi) · trên tập: toàn bộ N review đã đọc và gắn nhãn (không chép tên người viết, mỗi review trích tối đa 2 câu) · lọc gì: ghi rõ nếu lọc theo ngôn ngữ hoặc mức sao.
- **Mẫu số là gì:** Tổng số review N đã đọc và gắn nhãn (bao gồm cả review không liên quan hoặc khen).
- Script / công thức: Bảng CSV/Sheets gắn nhãn + công thức `=COUNTIF(nhan, "...") / COUNTA(nhan)` (hoặc script Python đếm lại được).

## 2. Đọc trước, đếm sau

Đã đọc __ dòng đầu (tối thiểu 30 review). Các *kiểu* vấn đề thấy được (trước khi chốt nhãn):
- *(Điền sau khi đọc 30 review đầu)*
- *(Điền sau khi đọc 30 review đầu)*

## 3. Kết quả

| Đếm gì | x / N | % | Ghi chú |
|---|---|---|---|
| | | | |
| | | | |

Ghi dạng "x/N (y%)". "Nhiều bạn…" không phải số.

## 4. ≥5 ví dụ cụ thể (mã dòng / mã đã ẩn danh, không đoán ai là ai)

1.
2.
3.
4.
5.

## 5. Giới hạn của data

Data cho biết người ta **làm gì**, không cho biết **vì sao**. Thiếu gì, lệch về phía nào: __
→ Kiểm lại bằng phỏng vấn / khảo sát nào: __
