import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-[16px] border border-hairline bg-surface p-8 text-center shadow-notion-1 space-y-4">
        <h1 className="type-heading-2 text-ink">Không tìm thấy trang này</h1>
        <p className="text-[15px] text-ink-muted">
          Đường dẫn có thể đã sai hoặc mã mời chuyến đi không còn hiệu lực.
        </p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-full bg-primary active:bg-primary-active px-6 py-2.5 text-[15px] font-medium text-on-primary transition-colors"
        >
          Quay về trang chủ
        </Link>
      </div>
    </div>
  );
}
