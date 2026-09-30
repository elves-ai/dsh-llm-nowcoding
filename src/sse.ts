/**
 * Server-sent-event framing for the gateway's `text/event-stream` response.
 *
 * Hand-written because the framing this route needs is small and fixed: read
 * `data:` lines, stop at `[DONE]`, ignore comments and other fields, and keep
 * an unterminated tail buffered across chunk boundaries. Payload decoding is
 * deliberately not done here — `translate.ts` owns what a payload means, so a
 * malformed payload is reported as a provider protocol failure rather than as
 * a framing failure.
 *
 * @module @elves-ai/dsh-llm-nowcoding/sse
 */

import { LlmError } from '@deepseek-ai/dsh-llm'

/** Frame text terminator, in all three spellings a gateway may emit. */
const SEPARATORS = ['\r\n\r\n', '\n\n', '\r\r'] as const

/**
 * Upper bound on one buffered frame. The bound exists because an adversarial or
 * broken endpoint could otherwise close the stream only after the harness has
 * buffered unbounded text; a well-formed chunk is far below it.
 */
export const NOWCODING_MAX_SSE_FRAME_BYTES = 8 * 1024 * 1024

/** Index and length of the first frame terminator, or undefined when none is buffered yet. */
function nextSeparator(buffer: string): { index: number; length: number } | undefined {
  let found: { index: number; length: number } | undefined
  for (const separator of SEPARATORS) {
    const index = buffer.indexOf(separator)
    if (index === -1) continue
    if (found === undefined || index < found.index) found = { index, length: separator.length }
  }
  return found
}

/** Join one frame's `data:` field values as the SSE specification requires. */
function dataOf(frame: string): string | undefined {
  const values: string[] = []
  for (const line of frame.split(/\r\n|\n|\r/u)) {
    if (!line.startsWith('data:')) continue
    const value = line.slice('data:'.length)
    values.push(value.startsWith(' ') ? value.slice(1) : value)
  }
  return values.length === 0 ? undefined : values.join('\n')
}

/**
 * Frame one response body into SSE data payloads.
 *
 * The generator ends at `[DONE]` or at end of body, whichever comes first; a
 * tail without a terminator is discarded, so a connection cut mid-frame cannot
 * be mistaken for a complete event. Frames carrying no `data:` field (comments,
 * heartbeats, bare field lines) are skipped rather than surfaced.
 *
 * @param body - the response body, read as UTF-8.
 * @returns each frame's payload text, in arrival order.
 * @throws {LlmError} code `MALFORMED_RESPONSE` when one frame exceeds {@link NOWCODING_MAX_SSE_FRAME_BYTES}.
 */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      while (true) {
        const separator = nextSeparator(buffer)
        if (separator === undefined) break
        const frame = buffer.slice(0, separator.index)
        buffer = buffer.slice(separator.index + separator.length)
        const data = dataOf(frame)
        if (data === undefined) continue
        if (data.trim() === '[DONE]') return
        yield data
      }
      if (buffer.length > NOWCODING_MAX_SSE_FRAME_BYTES) {
        throw new LlmError(
          `NowCoding SSE frame exceeds ${NOWCODING_MAX_SSE_FRAME_BYTES} bytes`,
          'MALFORMED_RESPONSE',
        )
      }
    }
  } finally {
    // Reached on normal end, on an early consumer return, and on a thrown
    // error: the response body must be released in every one of those cases.
    await reader.cancel().catch(() => undefined)
  }
}
