/** Helpers that draw the key faces as SVG data URIs. */

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Black or white, whichever reads better on the given background. */
export function contrast(hex: string): string {
	const n = parseInt(hex.replace("#", ""), 16) || 0;
	const r = (n >> 16) & 255;
	const g = (n >> 8) & 255;
	const b = n & 255;
	return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111111" : "#ffffff";
}

/** Approximate on-screen color of a white light at the given temperature. */
export function kelvinToHex(kelvin: number): string {
	const t = kelvin / 100;
	const c = (v: number): number => Math.round(Math.min(255, Math.max(0, v)));
	const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
	const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
	const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
	return "#" + [r, g, b].map((v) => c(v).toString(16).padStart(2, "0")).join("");
}

export function keyImage(opts: { bg: string; line1: string; line2?: string }): string {
	const fg = contrast(opts.bg);
	const size = opts.line1.length > 8 ? 26 : opts.line1.length > 5 ? 34 : 44;
	const y1 = opts.line2 ? 78 : 88;
	const line2 = opts.line2
		? `<text x="72" y="116" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="${fg}" fill-opacity="0.8" text-anchor="middle">${esc(opts.line2)}</text>`
		: "";
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">` +
		`<rect width="144" height="144" fill="${opts.bg}"/>` +
		`<text x="72" y="${y1}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="700" fill="${fg}" text-anchor="middle">${esc(opts.line1)}</text>` +
		line2 +
		`</svg>`;
	return `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`;
}
