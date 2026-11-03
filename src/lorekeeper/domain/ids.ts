/**
 * @file Identifier type and generator shared by every stored entity
 * (folders, pages, text boxes).
 */

/** A unique identifier. Always a string so it survives JSON round-trips unchanged. */
export type Id = string;

/** Creates a new random unique id (a UUID v4). */
export function newId(): Id {
  return crypto.randomUUID();
}
