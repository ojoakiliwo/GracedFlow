import { describe, expect, it } from "vitest";
import {
  CHURCH_EMAIL,
  CHURCH_MAILTO,
  CHURCH_PHONE,
  CHURCH_PHONE_DISPLAY,
  CHURCH_TEL,
} from "../src/lib/contact";

describe("Church public contact", () => {
  it("uses the church-domain inbox and the published Nigeria number", () => {
    expect(CHURCH_EMAIL).toBe("info@infinitelygracedchurch.com");
    expect(CHURCH_PHONE).toBe("+2348064503178");
    expect(CHURCH_PHONE_DISPLAY).toBe("+234 806 450 3178");
    expect(CHURCH_MAILTO).toBe("mailto:info@infinitelygracedchurch.com");
    expect(CHURCH_TEL).toBe("tel:+2348064503178");
  });
});
