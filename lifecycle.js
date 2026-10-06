(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.pgextwinLifecycle = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

  function isValidCalendarDate(value) {
    if (typeof value !== "string") return false;
    const match = CALENDAR_DATE_PATTERN.exec(value);
    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;
  }

  function getPostgresqlLifecycleStatus(eolDate, effectiveDate) {
    if (!isValidCalendarDate(eolDate) || !isValidCalendarDate(effectiveDate)) {
      return "unknown";
    }

    return effectiveDate <= eolDate ? "maintained" : "historical";
  }

  function getUtcCalendarDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  function nextCalendarDate(value) {
    if (!isValidCalendarDate(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + 1));
    return date.toISOString().slice(0, 10);
  }

  function indexPostgresqlLifecycleMetadata(metadata) {
    const result = new Map();
    if (!metadata || metadata.schemaVersion !== 1 || !Array.isArray(metadata.postgresql)) {
      return result;
    }

    for (const entry of metadata.postgresql) {
      if (!entry || !Number.isInteger(entry.major)) continue;
      const key = String(entry.major);
      if (!result.has(key)) result.set(key, entry);
    }

    return result;
  }

  function getPostgresqlLifecycleStatusForMajor(lifecycleByMajor, major, effectiveDate) {
    if (!(lifecycleByMajor instanceof Map)) return "unknown";
    const entry = lifecycleByMajor.get(String(major));
    return getPostgresqlLifecycleStatus(entry && entry.eol, effectiveDate);
  }

  return {
    getPostgresqlLifecycleStatus,
    getPostgresqlLifecycleStatusForMajor,
    getUtcCalendarDate,
    indexPostgresqlLifecycleMetadata,
    isValidCalendarDate,
    nextCalendarDate
  };
});
