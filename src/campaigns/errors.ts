/**
 * @file Reporting problems with campaigns (a file that couldn't be saved, a
 * campaign that couldn't be opened). Each tab shows its own notices, so
 * main.tsx connects this to the showing tab's.
 */

let show: (text: string) => void = (text) => console.error(text);

/** Says where error messages go. */
export function setErrorReporter(report: (text: string) => void) {
  show = report;
}

/** Shows an error message: `what` and the error's message. */
export function reportError(what: string, err?: unknown) {
  show(err === undefined ? what : `${what}: ${err instanceof Error ? err.message : String(err)}`);
}
