import { describe, expect, it } from "vitest";
import {
  LIVE_APP_ORIGIN,
  formatApiError,
  isLockedVercelHost,
} from "../../client/src/lib/apiError.js";

describe("login error messages", () => {
  it("treats Vercel preview hosts as locked and the live domain as open", () => {
    expect(isLockedVercelHost("infinitelygracedchurch.com")).toBe(false);
    expect(isLockedVercelHost("www.infinitelygracedchurch.com")).toBe(false);
    expect(isLockedVercelHost("graced-flow.vercel.app")).toBe(false);
    expect(isLockedVercelHost("localhost")).toBe(false);
    expect(
      isLockedVercelHost(
        "graced-flow-git-cursor-flutter-38ef56-ojoakiliwo-8092s-projects.vercel.app",
      ),
    ).toBe(true);
    expect(
      isLockedVercelHost("graced-flow-935v3lla2-ojoakiliwo-8092s-projects.vercel.app"),
    ).toBe(true);
  });

  it("explains Vercel deployment protection instead of Request failed", () => {
    const body = {
      error: { code: "401", message: "Protected deployment" },
      protection: { vercel_auth_enabled: true },
    };
    const message = formatApiError(body, 401);
    expect(message).not.toBe("Request failed");
    expect(message).toContain("locked");
    expect(message).toContain(LIVE_APP_ORIGIN);
  });

  it("keeps ordinary church API errors", () => {
    expect(formatApiError({ error: "Invalid email or password" }, 401)).toBe(
      "Invalid email or password",
    );
  });
});
