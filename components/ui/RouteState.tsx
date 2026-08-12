import Link from "next/link";

export function RouteState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: { href: string; label: string };
}) {
  return (
    <main className="flex min-h-[50vh] items-center justify-center px-6">
      <section className="w-full max-w-lg rounded-card border border-border bg-white p-8 text-center">
        <h1 className="font-serif text-2xl text-ink">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-mid">{message}</p>
        {action ? (
          <Link
            className="mt-6 inline-flex rounded-pill bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
            href={action.href}
          >
            {action.label}
          </Link>
        ) : null}
      </section>
    </main>
  );
}

export function RouteSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label={label}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
