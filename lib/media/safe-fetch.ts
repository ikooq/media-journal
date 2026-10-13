import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
const blocked = new BlockList();
for (const [network, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(network, bits, "ipv4");
for (const [network, bits] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
] as const)
  blocked.addSubnet(network, bits, "ipv6");
export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (!family) return false;
  if (family === 6 && !/^[23][0-9a-f]{3}:/i.test(address)) return false;
  if (family === 6 && /^(2001:0:|2002:)/i.test(address)) return false;
  return !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}
export function validateFetchUrl(url: URL) {
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".local") ||
    url.hostname.endsWith(".internal") ||
    (url.port && !["80", "443"].includes(url.port))
  )
    throw new Error("That URL cannot be fetched safely.");
}
export async function fetchHtmlSafely(
  raw: URL,
): Promise<{ html: string; url: URL }> {
  let url = raw;
  const deadline = Date.now() + 8000;
  for (let redirects = 0; redirects <= 3; redirects++) {
    validateFetchUrl(url);
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const records = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        const t = setTimeout(
          () => reject(new Error("Metadata request timed out.")),
          Math.max(1, deadline - Date.now()),
        );
        t.unref();
      }),
    ]);
    if (!records.length || records.some((r) => !isPublicAddress(r.address)))
      throw new Error("That URL resolves to a private or reserved address.");
    const pinned = records[0];
    const response = await new Promise<{ html?: string; location?: string }>(
      (resolve, reject) => {
        const transport =
          url.protocol === "https:" ? httpsRequest : httpRequest;
        const req = transport(
          url,
          {
            method: "GET",
            headers: {
              "User-Agent": "OurShelfMetadata/1.0",
              Accept: "text/html",
              "Accept-Encoding": "identity",
            },
            lookup: (_host, options, callback) => {
              if (typeof options === "object" && options.all)
                callback(null, [
                  { address: pinned.address, family: pinned.family },
                ]);
              else callback(null, pinned.address, pinned.family);
            },
          },
          (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0)) {
              res.resume();
              resolve({ location: res.headers.location });
              return;
            }
            if (
              (res.statusCode ?? 500) >= 400 ||
              !(res.headers["content-type"] ?? "")
                .toLowerCase()
                .includes("text/html")
            ) {
              res.resume();
              reject(
                new Error(
                  "This page does not offer readable metadata. Add it by hand.",
                ),
              );
              return;
            }
            const chunks: Buffer[] = [];
            let length = 0;
            res.on("data", (chunk: Buffer) => {
              length += chunk.length;
              if (length > 1_000_000) {
                res.destroy();
                reject(
                  new Error("This page is too large. Add its details by hand."),
                );
              } else chunks.push(chunk);
            });
            res.on("end", () =>
              resolve({ html: Buffer.concat(chunks).toString("utf8") }),
            );
            res.on("error", reject);
          },
        );
        const timer = setTimeout(
          () => req.destroy(new Error("Metadata request timed out.")),
          Math.max(1, deadline - Date.now()),
        );
        req.on("close", () => clearTimeout(timer));
        req.on("error", reject);
        req.end();
      },
    );
    if (response.html !== undefined) return { html: response.html, url };
    if (!response.location) throw new Error("Could not read this link.");
    url = new URL(response.location, url);
  }
  throw new Error("Too many redirects. Add this item by hand.");
}
