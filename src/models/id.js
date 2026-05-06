/**
 * Shared ID generator. Every entity factory uses this so IDs are
 * consistently formatted across the entire application.
 *
 * Format: 8 random base-36 characters, e.g. "k7x2m9nq"
 */
export function newId() {
  return Math.random().toString(36).slice(2, 10)
}
