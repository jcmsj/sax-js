// When we pass the MAX_BUFFER_LENGTH position, start checking for buffer overruns.
// When we check, schedule the next check for MAX_BUFFER_LENGTH - (max(buffer lengths)),
// since that's the earliest that a buffer overrun could occur.  This way, checks are
// as rare as required, but as often as necessary to ensure never crossing this bound.
// Furthermore, buffers are only tested at most once per write(), so passing a very
// large string into write() might have undesirable effects, but this is manageable by
// the caller, so it is assumed to be safe.  Thus, a call to write() may, in the extreme
// edge case, result in creating at most one complete copy of the string passed in.
// Set to Infinity to have unlimited buffers.

import SAXParser, { emitNode, error } from "./SAXParser";

export let MAX_BUFFER_LENGTH = 64 * 1024;
export const buffers = [
  'comment', 'sgmlDecl', 'textNode', 'tagName', 'doctype',
  'procInstName', 'procInstBody', 'entity', 'attribName',
  'attribValue', 'cdata', 'script'
]

export function checkBufferLength(p:SAXParser) {
  const maxAllowed = Math.max(MAX_BUFFER_LENGTH, 10)
  let maxActual = 0
  for (const buffer_name of buffers) {
    const len = p[buffer_name].length
    if (len > maxAllowed) {
      // Text/cdata nodes can get big, and since they're buffered,
      // we can get here under normal conditions.
      // Avoid issues by emitting the text node now,
      // so at least it won't get any bigger.
      switch (buffer_name) {
        case 'textNode':
          p.closeText();
          break

        case 'cdata':
          emitNode(p, 'oncdata', p.cdata)
          p.cdata = ''
          break

        case 'script':
          emitNode(p, 'onscript', p.script)
          p.script = ''
          break

        default:
          error(p, 'Max buffer length exceeded: ' + buffer_name)
      }
    }
    maxActual = Math.max(maxActual, len)
  }

  // schedule the next check for the earliest possible buffer overrun.
  const m = MAX_BUFFER_LENGTH - maxActual
  p.bufferCheckPosition = m + p.position
}

export function clearBuffers(p:SAXParser) {
  buffers.map(b => p[b] = "");
}