import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-slate-800 pt-4 text-xs text-slate-200 sm:pt-6">
      <div className="mt-1 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div className="flex flex-col gap-0.5 sm:gap-1">
          <span>MicCheck runs 100% in your browser.</span>
          <span>Audio is analyzed locally and never uploaded.</span>

        </div>
        <div className="flex flex-wrap gap-4"><a href="https://github.com/abulhawa/miccheck" className="text-slate-200 hover:text-white">Source code</a><Link className="text-slate-200 transition hover:text-white" href="/privacy">
          Privacy policy
        </Link></div>
      </div>
    </footer>
  );
}
