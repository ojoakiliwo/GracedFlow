import { LIVE_APP_ORIGIN, isLockedVercelHost } from "../lib/apiError";

export function PreviewLockNotice() {
  if (typeof window === "undefined") return null;
  if (!isLockedVercelHost(window.location.hostname)) return null;

  const liveLogin = `${LIVE_APP_ORIGIN}/login`;
  return (
    <div className="mt-6 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
      <p className="font-medium">This preview link is locked by Vercel.</p>
      <p className="mt-1">
        Church email and password will not work here. Sign in on the live site:{" "}
        <a className="font-medium text-brand-800 underline" href={liveLogin}>
          {LIVE_APP_ORIGIN.replace("https://", "")}
        </a>
      </p>
    </div>
  );
}
