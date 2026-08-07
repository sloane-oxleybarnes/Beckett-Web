import dynamic from "next/dynamic";

const AppsPanel = dynamic(() => import("@/components/dashboard/AppsPanel"), {
  ssr: false,
  loading: () => <div className="flex h-64 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>,
});

export default function AppsPage() {
  return <AppsPanel />;
}

