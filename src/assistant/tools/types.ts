/**
 * @file What an AI tool is: its name and description for the AI, its
 * arguments as JSON Schema, and what running it gives back (text, and for
 * some tools a picture).
 */

/** A mistake in what the AI asked for; the message goes back to it. */
export class ToolError extends Error {}

/** A picture a tool gives back (base64), so a model that can see can look at it. */
export interface ToolImage {
  data: string;
  mimeType: string;
}

/** What a tool gives back: text, or text with a picture. */
export type ToolOutput = string | { text: string; image?: ToolImage };

/** The text of a tool's output. */
export const outputText = (output: ToolOutput): string => (typeof output === 'string' ? output : output.text);
/** The picture in a tool's output, if any. */
export const outputImage = (output: ToolOutput): ToolImage | undefined => (typeof output === 'string' ? undefined : output.image);

/** An action an AI app can take, described for it (name, what it does, its arguments as JSON Schema). */
export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  /** Only looks; changes nothing. Only these may take time (load data); changes run at once, so undo can record them. */
  readOnly?: boolean;
  /**
   * Work a change needs done first that may take time and doesn't touch the
   * notes (storing a picture); its result is passed to run, which then makes
   * the change at once.
   */
  prepare?(args: Record<string, unknown>): Promise<unknown>;
  run(args: Record<string, unknown>, prepared?: unknown): ToolOutput | Promise<ToolOutput>;
}
