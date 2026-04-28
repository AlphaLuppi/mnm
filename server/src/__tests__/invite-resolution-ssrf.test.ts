import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPrivateOrReservedIpv4,
  isPrivateOrReservedIpv6,
  isPublicIpAddress,
  setInviteResolutionNetworkForTest,
} from "../routes/access.js";

/**
 * Regression tests for upstream Paperclip PR #4122 zone Z6 — DNS/NAT64
 * SSRF validation on the invite resolution probe. The probe at
 * GET /invites/:token/test-resolution must reject DNS targets that
 * resolve to private, link-local, loopback, multicast, NAT64, or
 * reserved address space.
 */

describe("isPrivateOrReservedIpv4", () => {
  it.each([
    ["0.0.0.0", true],
    ["10.0.0.1", true],
    ["10.255.255.255", true],
    ["100.64.0.1", true], // CGNAT
    ["100.127.255.255", true], // CGNAT
    ["127.0.0.1", true], // loopback
    ["127.255.255.254", true],
    ["169.254.0.1", true], // link-local
    ["169.254.169.254", true], // AWS/GCP metadata
    ["172.16.0.1", true],
    ["172.31.255.255", true],
    ["192.0.0.1", true], // IETF protocol assignments
    ["192.0.2.1", true], // doc TEST-NET-1
    ["192.88.99.1", true], // 6to4 anycast
    ["192.168.0.1", true],
    ["198.18.0.1", true], // benchmarking
    ["198.51.100.1", true], // doc TEST-NET-2
    ["203.0.113.1", true], // doc TEST-NET-3
    ["224.0.0.1", true], // multicast
    ["239.255.255.255", true], // multicast
    ["240.0.0.1", true], // reserved
    ["255.255.255.255", true], // limited broadcast
  ])("treats %s as private/reserved", (addr, expected) => {
    expect(isPrivateOrReservedIpv4(addr)).toBe(expected);
  });

  it.each([
    ["8.8.8.8"],
    ["1.1.1.1"],
    ["140.82.121.4"], // github.com
    ["52.84.0.1"], // cloudfront
    ["100.63.255.255"], // just below CGNAT
    ["100.128.0.1"], // just above CGNAT
    ["172.15.255.255"], // just below 172.16/12
    ["172.32.0.1"], // just above 172.16/12
    ["169.253.255.255"], // just below link-local
    ["169.255.0.0"], // just above link-local
    ["223.255.255.255"], // just below multicast
  ])("treats %s as public", (addr) => {
    expect(isPrivateOrReservedIpv4(addr)).toBe(false);
  });

  it("rejects malformed addresses as private (fail-closed)", () => {
    expect(isPrivateOrReservedIpv4("not-an-ip")).toBe(true);
    expect(isPrivateOrReservedIpv4("10.0.0")).toBe(true);
    expect(isPrivateOrReservedIpv4("999.999.999.999")).toBe(true);
  });
});

describe("isPrivateOrReservedIpv6", () => {
  it.each([
    ["::", true], // unspecified
    ["::1", true], // loopback
    ["fc00::1", true], // ULA
    ["fd00::1", true], // ULA
    ["fe80::1", true], // link-local
    ["fea0::1", true], // link-local
    ["ff02::1", true], // multicast (all nodes)
    ["ff05::2", true], // multicast (site-local all routers)
    ["100::1", true], // discard prefix
    ["2001:db8::1", true], // doc range
    ["2001:2::1", true], // benchmarking
    ["2002:c0a8::1", true], // 6to4 (deprecated, treat reserved)
    ["64:ff9b::1.2.3.4", true], // NAT64 well-known prefix
    ["64:ff9b::8.8.8.8", true], // NAT64 to public IPv4
    ["::ffff:127.0.0.1", true], // IPv4-mapped loopback
    ["::ffff:192.168.1.1", true], // IPv4-mapped private
    ["::ffff:169.254.169.254", true], // IPv4-mapped metadata
  ])("treats %s as private/reserved", (addr) => {
    expect(isPrivateOrReservedIpv6(addr)).toBe(true);
  });

  it.each([
    ["2606:4700:4700::1111"], // cloudflare
    ["2001:4860:4860::8888"], // google dns
    ["2a00:1450::1"], // generic public
    ["::ffff:8.8.8.8"], // IPv4-mapped public
  ])("treats %s as public", (addr) => {
    expect(isPrivateOrReservedIpv6(addr)).toBe(false);
  });
});

describe("isPublicIpAddress", () => {
  it("returns false for non-IP strings (fail-closed)", () => {
    expect(isPublicIpAddress("not-an-ip")).toBe(false);
    expect(isPublicIpAddress("github.com")).toBe(false);
    expect(isPublicIpAddress("")).toBe(false);
  });

  it("returns true only for public IPv4 / IPv6", () => {
    expect(isPublicIpAddress("8.8.8.8")).toBe(true);
    expect(isPublicIpAddress("2606:4700:4700::1111")).toBe(true);
    expect(isPublicIpAddress("169.254.169.254")).toBe(false);
    expect(isPublicIpAddress("::1")).toBe(false);
  });
});

describe("setInviteResolutionNetworkForTest", () => {
  afterEach(() => {
    setInviteResolutionNetworkForTest(null);
  });

  it("is exported and callable so route-level tests can inject mocks", () => {
    // Sanity check — the rest of the integration coverage requires the full
    // express app harness. The address-classification helpers above cover the
    // SSRF logic exhaustively; this hook is the seam for future route tests.
    expect(typeof setInviteResolutionNetworkForTest).toBe("function");
    expect(() =>
      setInviteResolutionNetworkForTest({
        lookup: async () => [{ address: "8.8.8.8", family: 4 }],
        requestHead: vi.fn(),
      }),
    ).not.toThrow();
  });
});
