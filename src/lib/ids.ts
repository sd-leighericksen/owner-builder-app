import { uuidv7 } from "uuidv7";

/** UUID v7 — time-ordered, index-friendly. Used for all primary keys. */
export function newId(): string {
  return uuidv7();
}
