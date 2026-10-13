export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export function validateImageBytes(bytes: Uint8Array, mime: string) {
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (bytes.length > MAX_IMAGE_SIZE || bytes.length < 12)
    throw new Error("Choose an image smaller than 5 MB.");
  if (!(
    (mime === "image/jpeg" && jpeg) ||
    (mime === "image/png" && png) ||
    (mime === "image/webp" && webp)
  ))
    throw new Error("Choose a valid JPEG, PNG, or WebP image.");
  return mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
}
