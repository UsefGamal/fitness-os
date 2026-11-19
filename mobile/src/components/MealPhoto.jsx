import Icon from './Icon.jsx';
import { useMealPhoto } from './useMealPhoto.js';

/** A meal's list thumbnail. With no photo, or a photo whose file did not
 * ship, it shows the plain meal icon (or nothing, with blank false) instead
 * of a broken image. */
export function MealThumb({ photo, blank = true }) {
  const { shown, onError } = useMealPhoto(photo);
  if (shown) return <img className="thumb" src={shown.thumb} alt="" loading="lazy" decoding="async" onError={onError} />;
  if (!blank) return null;
  return <span className="thumb blank meal-thumb" aria-hidden="true"><Icon name="meals" /></span>;
}
