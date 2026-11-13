/** Inline stroke icons (no icon font, no extra requests). Decorative: aria-hidden. */
type P = { size?: number };
const base = (size = 22) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });
export const HomeIcon = ({ size }: P) => <svg {...base(size)}><path d="M4 11l8-7 8 7v9H4z" /></svg>;
export const CalendarIcon = ({ size }: P) => <svg {...base(size)} strokeWidth={2}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
export const ClockIcon = ({ size }: P) => <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const PinIcon = ({ size }: P) => <svg {...base(size)}><path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>;
export const CheckIcon = ({ size = 36 }: P) => <svg {...base(size)} strokeWidth={2.4}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
