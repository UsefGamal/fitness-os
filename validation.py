"""Shared server-side validation for POST form handlers.

Mandatory-ness and basic type coercion (str -> int/float/date) are already
enforced by FastAPI/Pydantic on every `= Form(...)` parameter — a
non-numeric weight_kg, a missing required field, or a malformed date
already gets rejected before a route body even runs (see main.py's
RequestValidationError handler for how that's turned into a friendly
redirect instead of a bare 422). What Pydantic doesn't know is *sane
ranges* for this domain — a weight of -50kg or an RPE of 15 both pass
type-checking fine. That's what this module is for.

Every check raises ValidationError with a user-facing message; routes
catch it once and redirect back to the referring page with `?error=`.
"""

from urllib.parse import quote


class ValidationError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def error_redirect(path: str, message: str) -> str:
    sep = "&" if "?" in path else "?"
    return f"{path}{sep}error={quote(message)}"


def require_range(value, lo, hi, field_name: str):
    """None passes through untouched — use on Optional fields where the
    field itself isn't mandatory but must be sane *if* provided."""
    if value is None:
        return value
    if value < lo or value > hi:
        raise ValidationError(f"{field_name} must be between {lo} and {hi}.")
    return value


def require_choice(value, choices, field_name: str):
    if value is not None and value not in choices:
        raise ValidationError(f"{field_name} must be one of: {', '.join(str(c) for c in choices)}.")
    return value


def require_max_length(value, max_len: int, field_name: str):
    if value is not None and len(value) > max_len:
        raise ValidationError(f"{field_name} is too long (max {max_len} characters).")
    return value


def require_not_future(value, field_name: str, today):
    if value is not None and value > today:
        raise ValidationError(f"{field_name} can't be in the future.")
    return value
