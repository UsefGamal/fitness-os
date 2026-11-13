// The install and update guide (UPD-1): three phone families, a few plain
// steps each. Every step names its string and the drawn card that goes
// with it; the wording lives in i18n. Each brand's wording still has to be
// checked on a real phone before the pilot.

/** @typedef {{ key: string, card: 'file' | 'switch' | 'button' | 'over', label: string }} GuideStep */

const OPEN = { key: 'install.step.open', card: 'file', label: 'install.card.file' };
const ALLOW = { key: 'install.step.allow', card: 'switch', label: 'install.card.allow' };
const PROTECT = { key: 'install.step.protect', card: 'button', label: 'install.card.anyway' };
const UPDATE = { key: 'install.step.update', card: 'over', label: 'install.card.update' };

export const INSTALL_GUIDE = [
  // VERIFY ON DEVICE: Samsung (One UI 6 to 8), Auto Blocker wording.
  { key: 'samsung', title: 'install.brand.samsung', steps: [OPEN, { key: 'install.step.autoBlocker', card: 'switch', label: 'install.card.autoBlocker' }, ALLOW, PROTECT, UPDATE] },
  // VERIFY ON DEVICE: Xiaomi / Redmi / Poco (HyperOS, MIUI), the wait-10-seconds warning.
  { key: 'xiaomi', title: 'install.brand.xiaomi', steps: [OPEN, ALLOW, { key: 'install.step.xiaomiWait', card: 'button', label: 'install.card.ok' }, PROTECT, UPDATE] },
  // VERIFY ON DEVICE: Infinix / Tecno (XOS, HiOS), the phone's own security scan.
  { key: 'transsion', title: 'install.brand.transsion', steps: [OPEN, ALLOW, { key: 'install.step.transsionScan', card: 'button', label: 'install.card.continue' }, PROTECT, UPDATE] },
];

/** The brand to show: the one asked for, else the first. */
export function guideFor(key) {
  return INSTALL_GUIDE.find((b) => b.key === key) || INSTALL_GUIDE[0];
}
