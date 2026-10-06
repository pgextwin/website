const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getPostgresqlLifecycleStatus,
  getPostgresqlLifecycleStatusForMajor,
  getUtcCalendarDate,
  indexPostgresqlLifecycleMetadata,
  nextCalendarDate
} = require("../lifecycle.js");

test("PG14 is maintained on the day before EOL", () => {
  assert.equal(getPostgresqlLifecycleStatus("2026-11-12", "2026-11-11"), "maintained");
});

test("PG14 EOL date is inclusive", () => {
  assert.equal(getPostgresqlLifecycleStatus("2026-11-12", "2026-11-12"), "maintained");
});

test("PG14 becomes historical on the day after EOL", () => {
  assert.equal(getPostgresqlLifecycleStatus("2026-11-12", "2026-11-13"), "historical");
});

test("a future-EOL major remains maintained", () => {
  assert.equal(getPostgresqlLifecycleStatus("2027-11-11", "2026-11-13"), "maintained");
});

test("unknown major is never assumed maintained", () => {
  const metadata = indexPostgresqlLifecycleMetadata({
    schemaVersion: 1,
    postgresql: [{ major: 14, eol: "2026-11-12" }]
  });
  assert.equal(getPostgresqlLifecycleStatusForMajor(metadata, 15, "2026-10-06"), "unknown");
});

test("malformed EOL is handled safely", () => {
  assert.equal(getPostgresqlLifecycleStatus("not-a-date", "2026-10-06"), "unknown");
  assert.equal(getPostgresqlLifecycleStatus("2026-02-30", "2026-10-06"), "unknown");
});

test("UTC calendar date does not depend on local timezone", () => {
  assert.equal(getUtcCalendarDate(new Date("2026-11-12T23:59:59Z")), "2026-11-12");
  assert.equal(getUtcCalendarDate(new Date("2026-11-13T00:00:00Z")), "2026-11-13");
});

test("next calendar date handles month boundaries", () => {
  assert.equal(nextCalendarDate("2026-11-12"), "2026-11-13");
  assert.equal(nextCalendarDate("2026-12-31"), "2027-01-01");
});
