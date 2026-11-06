// The open overlays (sheets, confirm sheets), newest last, so Android's back
// button closes the top one before it leaves the page (E6-S7). Pure stack,
// tested in overlays.test.js; Sheet registers itself with useOverlay().
const stack = [];

/** Add an overlay's close function; returns the function that removes it. */
export function pushOverlay(close) {
  const entry = { close };
  stack.push(entry);
  return () => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Close the newest overlay. True when there was one. */
export function closeTopOverlay() {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

export function overlayCount() {
  return stack.length;
}
