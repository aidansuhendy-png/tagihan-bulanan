"""Server-side date helpers. The pod clock is UTC — anchor "today" here, never in the browser."""

import os
from datetime import date, datetime
from zoneinfo import ZoneInfo
import calendar


def today_iso(tz: str | None = None) -> str:
    """Today's date as YYYY-MM-DD in `tz` (default: APP_TZ env, else UTC)."""
    zone = tz or os.environ.get("APP_TZ", "UTC")
    return datetime.now(ZoneInfo(zone)).strftime("%Y-%m-%d")


def days_until_due(due_day: int, tz: str | None = None) -> int:
    """Signed days to this month's due date (0 = today, <0 = overdue, >0 = upcoming).

    Anchored to APP_TZ (default Asia/Jakarta so reminders match the user's local day),
    with the due day clamped to the month's last day (e.g. day 31 in February).
    """
    zone = tz or os.environ.get("APP_TZ", "Asia/Jakarta")
    today = datetime.now(ZoneInfo(zone)).date()
    last = calendar.monthrange(today.year, today.month)[1]
    due = date(today.year, today.month, min(max(due_day, 1), last))
    return (due - today).days
