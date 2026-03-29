import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 bg-bg">
      <div className="w-full max-w-[340px] text-center">
        <h1 className="font-mono text-3xl font-semibold tracking-wider uppercase mb-2">
          TacticsDuel
        </h1>
        <p className="text-text-dim text-base mb-10">
          Build. Tacticate. Duel.
        </p>
        <Link
          href="/signup"
          className="block w-full h-12 leading-[48px] bg-accent text-black font-mono text-sm font-medium uppercase tracking-wide rounded-[4px] hover:bg-accent-dim transition-colors duration-100"
        >
          Start Playing
        </Link>
        <Link
          href="/login"
          className="block w-full h-10 leading-[40px] mt-3 border border-border text-text-mid font-mono text-sm uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
        >
          Log In
        </Link>
      </div>
    </div>
  );
}
