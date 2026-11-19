import { useState } from 'react';

/** A meal photo that may not be there: the build downloads the photos from
 * Wikimedia Commons and can miss some, so a file can be listed but absent.
 * `shown` is the photo while its file loads (null once it fails), and the
 * failure is remembered per file, so moving to another meal tries again. */
export function useMealPhoto(photo) {
  const [failed, setFailed] = useState(null);
  const file = photo?.file;
  return { shown: photo && failed !== file ? photo : null, onError: () => setFailed(file) };
}
