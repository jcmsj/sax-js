import { emit } from "./emit";
import SAXParser from "./SAXParser";
import { SAXOptions } from "./types";
export function parser(strict:boolean, opt:SAXOptions) { return new SAXParser(strict, opt) }
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

var streamWraps = EVENTS.filter(function (ev) {
  return ev !== 'error' && ev !== 'end'
})

export function createStream(strict:boolean, opt:SAXOptions) {
  return new SAXStream(strict, opt)
}

class SAXStream extends ReadableStream {
  /**
   * @type {SAXParser}
   */
  _parser;
  writable: boolean;
  readable: boolean;
  _decoder: TextDecoder;

  constructor(strict:boolean, opt:SAXOptions) {
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
      emit(this._parser,'error', er);
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

  write(data:ArrayBuffer): boolean {
    /* if (typeof Buffer === 'function' &&
      typeof Buffer.isBuffer === 'function' &&
      Buffer.isBuffer(data)) { */
    if (data instanceof ArrayBuffer && !this._decoder) {
      if (!this._decoder) {
        this._decoder =  new TextDecoder();
      }
      data = this._decoder.decode(data);
    }

    this._parser.write(data.toString());
    emit(this._parser, 'data', data);
    return true;
  }
  /**
   * @param {Buffer} chunk 
   */
  end(chunk) {
    if (chunk && chunk.length) {
      this.write(chunk);
    }
    this._parser.end();
    return true;
  }
  on(ev:string, handler:Function) {
    if (!this._parser['on' + ev] && streamWraps.includes(ev)) {
      this._parser['on' + ev] = function () {
        //const args = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments);
        //args.splice(0, 0, ev);
        //me.emit.apply(me, args);
        this._parser.emit(this._parser, [ev, ...arguments])
      };
    }
    
    //return super.on(this._parser, ev, handler)
    //return Stream.prototype.on.call(me, ev, handler);
  }
}