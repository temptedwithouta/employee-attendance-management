import { attendanceDateFor } from './attendance-date';

it.each([
  ['2026-01-01T16:59:59.999Z', '2026-01-01T00:00:00.000Z'],
  ['2026-01-01T17:00:00.000Z', '2026-01-02T00:00:00.000Z'],
  ['2025-12-31T17:00:00.000Z', '2026-01-01T00:00:00.000Z'],
])('uses the Jakarta calendar day for %s', (instant, expected) => {
  expect(attendanceDateFor(new Date(instant)).toISOString()).toBe(expected);
});
