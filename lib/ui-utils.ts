// Display-only contrast choice; these colors never participate in authorization.
export function luminance(hex: string) {
  if (!/^#[a-f\d]{6}$/i.test(hex)) return 0;
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export function contrastRatio(a: string, b: string) {
  const first = luminance(a),
    second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
export function avatarForeground(background: string) {
  if (contrastRatio(background, "#ffffff") >= 4.5) return "#ffffff";
  if (contrastRatio(background, "#252d27") >= 4.5) return "#252d27";
  return "#000000";
}
