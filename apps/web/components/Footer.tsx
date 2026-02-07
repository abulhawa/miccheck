import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-slate-800 pt-6 text-xs text-slate-200">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center text-sm text-slate-700">
        <strong>Your privacy is protected.</strong> Audio analyzed locally, never uploaded.
        <span className="block">
          We store your latest recording only in this browser tab to enable playback.
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span>MicCheck runs 100% in your browser.</span>
          <span>As an Amazon Associate I earn from qualifying purchases.</span>
        </div>
        <Link className="text-slate-200 transition hover:text-white" href="/privacy">
          Privacy policy
        </Link>
      </div>
    </footer>
  );
}
