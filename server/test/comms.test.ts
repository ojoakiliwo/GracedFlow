import { afterEach, describe, expect, it, vi } from "vitest";
import { sendSms } from "../src/comms.js";

describe("SMS providers", () => {
  afterEach(() => {
    delete process.env.SMS_PROVIDER;
    delete process.env.BULKSMS_API_TOKEN;
    delete process.env.TERMII_API_KEY;
    vi.unstubAllGlobals();
  });

  it("sends through BulkSMS Nigeria when a token is set", async () => {
    process.env.BULKSMS_API_TOKEN = "test-token";
    process.env.BULKSMS_SENDER_ID = "IGC";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: "success" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendSms("+2348091112233", "Choir rehearsal tonight");
    expect(result).toEqual({ ok: true, provider: "bulksmsnigeria" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.bulksmsnigeria.com/api/v2/sms",
      expect.objectContaining({
        method: "POST",
      }),
    );
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as { body: string }).body));
    expect(body.to).toBe("2348091112233");
    expect(body.from).toBe("IGC");
    expect(body.body).toContain("Choir rehearsal");
  });

  it("stays in dry-run when no SMS keys are set", async () => {
    const result = await sendSms("+2348091112233", "Hello");
    expect(result.provider).toBe("dryrun");
  });
});
