// The next set's kg and reps open rulers in a sheet (SetPicker); tests type
// into the big number there, as a person can, then close the sheet.

/** The kg cell of the set table's next row (a button that opens the rulers). */
export const kgCell = (page) => page.getByRole('button', { name: /^Set \d+: [\d.]+ kg\. Tap to change/ });

/** The weight on the next row, read from its cell. */
export async function nextKg(page) {
  return Number((await kgCell(page).first().textContent()) || 'NaN');
}

/** Open the rulers, type `kg` (and `reps`), close the sheet. */
export async function fillSet(page, kg, reps = null) {
  await kgCell(page).first().click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('spinbutton', { name: /^Weight for set \d+, in kg$/ }).fill(String(kg));
  if (reps != null) await sheet.getByRole('spinbutton', { name: /^Reps for set \d+$/ }).fill(String(reps));
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
}
