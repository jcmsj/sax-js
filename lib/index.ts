import { emit } from "./emit";
import SAXParser from "./SAXParser";
export { default as SAXParser } from "./SAXParser"
import { SAXOptions } from "./types";
export { type SAXOptions } from "./types";
export default function parser(strict: boolean, opt: SAXOptions) { return new SAXParser(strict, opt) }
// When we pass the MAX_BUFFER_LENGTH position, start checking for buffer overruns.
// When we check, schedule the next check for MAX_BUFFER_LENGTH - (max(buffer lengths)),
// since that's the earliest that a buffer overrun could occur.  This way, checks are
// as rare as required, but as often as necessary to ensure never crossing this bound.
// Furthermore, buffers are only tested at most once per write(), so passing a very
// large string into write() might have undesirable effects, but this is manageable by
// the caller, so it is assumed to be safe.  Thus, a call to write() may, in the extreme
// edge case, result in creating at most one complete copy of the string passed in.
// Set to Infinity to have unlimited buffers.

export const EVENTS = [
  'text',
  'processinginstruction',
  'sgmldeclaration',
  'doctype',
  'comment',
  'opentagstart',
  'attribute',
  'opentag',
  'closetag',
  'opencdata',
  'cdata',
  'closecdata',
  'error',
  'end',
  'ready',
  'script',
  'opennamespace',
  'closenamespace'
]

const streamWraps = EVENTS.filter(function (ev) {
  return ev !== 'error' && ev !== 'end'
})

export function createStream(strict: boolean, opt: SAXOptions) {
  return new SAXStream(strict, opt)
}

export class SAXStream extends ReadableStream {
  /**
   * @type {SAXParser}
   */
  _parser;
  writable: boolean;
  readable: boolean;
  _decoder: TextDecoder;

  constructor(strict: boolean, opt: SAXOptions) {
    super();//Defaults works

    //IDK what this is for
    /* if (!(this instanceof SAXStream)) {
      return new SAXStream(strict, opt);
    } */
    this._parser = new SAXParser(strict, opt);
    this.writable = true;
    this.readable = true;

    this._parser.onend = () => emit(this._parser, 'end');

    this._parser.onerror = er => {
      emit(this._parser, 'error', er);
      // if didn't throw, then means error was handled.
      // go ahead and clear error, so we can write again.
      this._parser.error = null;
    };

    this._decoder = undefined;

    streamWraps.forEach(ev => {
      Object.defineProperty(this, 'on' + ev, {
        get() {
          return this._parser['on' + ev];
        },
        set(h) {
          if (!h) {
            this.removeAllListeners(ev);
            this._parser['on' + ev] = h;
            return h;
          }
          this.on(ev, h);
        },
        enumerable: true,
        configurable: false
      });
    });
  }

  write(data: ArrayBuffer): boolean {
    let decoded_data =  "";
    if (data instanceof ArrayBuffer && !this._decoder) {
      if (!this._decoder) {
        this._decoder = new TextDecoder();
      }
      decoded_data = this._decoder.decode(data);
    }

    this._parser.write(decoded_data);
    emit(this._parser, 'data', decoded_data);
    return true;
  }
  end(chunk:ArrayBuffer) {
    if (chunk instanceof ArrayBuffer) {
      this.write(chunk);
    }
    this._parser.end();
    return true;
  }
  on(ev: string) {
    if (!this._parser['on' + ev] && streamWraps.includes(ev)) {
      console.log(ev);
      
      this._parser['on' + ev] = this._parser.emit.bind(this, this._parser, [ev, ... arguments]);
    }

    //return super.on(this._parser, ev, handler)
    //return Stream.prototype.on.call(me, ev, handler);
  }
}