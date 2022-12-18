import { emit } from "./emit";
import { STATE, S } from "./State"
import { CDATA, DOCTYPE, rootNS, XMLNS_NAMESPACE, XML_NAMESPACE } from './RootNS';
import { XML_ENTITIES, ENTITIES, isWhitespace, isQuote, isMatch, isAttribEnd, nameStart, entityBody, entityStart, nameBody, notMatch } from './Entities';
import { charAt } from './charAt';
import { closeTag, newTag, openTag, qname } from './tag';
import { buffers, MAX_BUFFER_LENGTH, clearBuffers} from "./buffers"
import { QualifiedTag, SAXOptions } from "./types";
export default class SAXParser {
  q!: string;
  c!: string;
  bufferCheckPosition!: number;
  opt: any;
  looseCase!: string;
  tags!: QualifiedTag[];
  closed!: boolean;
  closedRoot!: boolean;
  sawRoot!: boolean;
  tag?: QualifiedTag;
  error?: Error;
  strict!: boolean;
  noscript!: boolean;
  state!: STATE;
  strictEntities: any;
  ENTITIES: any;
  attribList!: any[];
  ns: any;
  trackPosition!: boolean;
  position!: number;
  line!: number;
  column!: number;
  textNode!: string;
  comment!: string;
  cdata!: string;
  attribValue!: string;
  attribName: any;
  entity!: string;
  doctype!: string | boolean;
  script!: string;
  tagName!: string;
  procInstName: any;
  procInstBody: any;
  sgmlDecl!: string;
  startTagPosition!: number;

  constructor(strict: boolean, opt: SAXOptions) {
    this.exec(strict, opt)
  }

  write(chunk: any) {
    if (this.error) {
      throw this.error
    }
    if (this.closed) {
      return error(this,
        'Cannot write after close. Assign an onready handler.')
    }
    if (chunk === null) {
      return this.end()
    }
    if (typeof chunk === 'object') {
      chunk = chunk.toString()
    }

    let i = 0
    let c = ''
    while (true) {
      c = charAt(chunk, i++)
      this.c = c

      if (!c) {
        break
      }

      if (this.trackPosition) {
        this.position++
        if (c === '\n') {
          this.line++
          this.column = 0
        } else {
          this.column++
        }
      }

      switch (this.state) {
        case S.BEGIN:
          this.state = S.BEGIN_WHITESPACE
          if (c === '\uFEFF') {
            continue
          }
          this.beginWhiteSpace(c)
          continue

        case S.BEGIN_WHITESPACE:
          this.beginWhiteSpace(c)
          continue

        case S.TEXT:
          if (this.sawRoot && !this.closedRoot) {
            var starti = i - 1
            while (c && c !== '<' && c !== '&') {
              c = charAt(chunk, i++)
              if (c && this.trackPosition) {
                this.position++
                if (c === '\n') {
                  this.line++
                  this.column = 0
                } else {
                  this.column++
                }
              }
            }
            this.textNode += chunk.substring(starti, i - 1)
          }
          if (c === '<' && !(this.sawRoot && this.closedRoot && !this.strict)) {
            this.state = S.OPEN_WAKA
            this.startTagPosition = this.position
          } else {
            if (!isWhitespace(c) && (!this.sawRoot || this.closedRoot)) {
              strictFail(this, 'Text data outside of root node.')
            }
            if (c === '&') {
              this.state = S.TEXT_ENTITY
            } else {
              this.textNode += c
            }
          }
          continue

        case S.SCRIPT:
          // only non-strict
          if (c === '<') {
            this.state = S.SCRIPT_ENDING
          } else {
            this.script += c
          }
          continue

        case S.SCRIPT_ENDING:
          if (c === '/') {
            this.state = S.CLOSE_TAG
          } else {
            this.script += '<' + c
            this.state = S.SCRIPT
          }
          continue

        case S.OPEN_WAKA:
          // either a /, ?, !, or text is coming next.
          if (c === '!') {
            this.state = S.SGML_DECL
            this.sgmlDecl = ''
          } else if (isWhitespace(c)) {
            // wait for it...
          } else if (isMatch(nameStart, c)) {
            this.state = S.OPEN_TAG
            this.tagName = c
          } else if (c === '/') {
            this.state = S.CLOSE_TAG
            this.tagName = ''
          } else if (c === '?') {
            this.state = S.PROC_INST
            this.procInstName = this.procInstBody = ''
          } else {
            strictFail(this, 'Unencoded <')
            // if there was some whitespace, then add that in.
            if (this.startTagPosition + 1 < this.position) {
              var pad = this.position - this.startTagPosition
              c = new Array(pad).join(' ') + c
            }
            this.textNode += '<' + c
            this.state = S.TEXT
          }
          continue

        case S.SGML_DECL:
          if ((this.sgmlDecl + c).toUpperCase() === CDATA) {
            emitNode(this, 'onopencdata')
            this.state = S.CDATA
            this.sgmlDecl = ''
            this.cdata = ''
          } else if (this.sgmlDecl + c === '--') {
            this.state = S.COMMENT
            this.comment = ''
            this.sgmlDecl = ''
          } else if ((this.sgmlDecl + c).toUpperCase() === DOCTYPE) {
            this.state = S.DOCTYPE
            if (this.doctype || this.sawRoot) {
              strictFail(this,
                'Inappropriately located doctype declaration')
            }
            this.doctype = ''
            this.sgmlDecl = ''
          } else if (c === '>') {
            emitNode(this, 'onsgmldeclaration', this.sgmlDecl)
            this.sgmlDecl = ''
            this.state = S.TEXT
          } else if (isQuote(c)) {
            this.state = S.SGML_DECL_QUOTED
            this.sgmlDecl += c
          } else {
            this.sgmlDecl += c
          }
          continue

        case S.SGML_DECL_QUOTED:
          if (c === this.q) {
            this.state = S.SGML_DECL
            this.q = ''
          }
          this.sgmlDecl += c
          continue

        case S.DOCTYPE:
          if (c === '>') {
            this.state = S.TEXT
            emitNode(this, 'ondoctype', this.doctype)
            this.doctype = true // just remember that we saw it.
          } else {
            this.doctype += c
            if (c === '[') {
              this.state = S.DOCTYPE_DTD
            } else if (isQuote(c)) {
              this.state = S.DOCTYPE_QUOTED
              this.q = c
            }
          }
          continue

        case S.DOCTYPE_QUOTED:
          this.doctype += c
          if (c === this.q) {
            this.q = ''
            this.state = S.DOCTYPE
          }
          continue

        case S.DOCTYPE_DTD:
          this.doctype += c
          if (c === ']') {
            this.state = S.DOCTYPE
          } else if (isQuote(c)) {
            this.state = S.DOCTYPE_DTD_QUOTED
            this.q = c
          }
          continue

        case S.DOCTYPE_DTD_QUOTED:
          this.doctype += c
          if (c === this.q) {
            this.state = S.DOCTYPE_DTD
            this.q = ''
          }
          continue

        case S.COMMENT:
          if (c === '-') {
            this.state = S.COMMENT_ENDING
          } else {
            this.comment += c
          }
          continue

        case S.COMMENT_ENDING:
          if (c === '-') {
            this.state = S.COMMENT_ENDED
            this.comment = textopts(this.opt, this.comment)
            if (this.comment) {
              emitNode(this, 'oncomment', this.comment)
            }
            this.comment = ''
          } else {
            this.comment += '-' + c
            this.state = S.COMMENT
          }
          continue

        case S.COMMENT_ENDED:
          if (c !== '>') {
            this.strictFail("Malformed comment")
            // allow <!-- blah -- bloo --> in non-strict mode,
            // which is a comment of " blah -- bloo "
            this.comment += '--' + c
            this.state = S.COMMENT
          } else {
            this.state = S.TEXT
          }
          continue

        case S.CDATA:
          if (c === ']') {
            this.state = S.CDATA_ENDING
          } else {
            this.cdata += c
          }
          continue

        case S.CDATA_ENDING:
          if (c === ']') {
            this.state = S.CDATA_ENDING_2
          } else {
            this.cdata += ']' + c
            this.state = S.CDATA
          }
          continue

        case S.CDATA_ENDING_2:
          if (c === '>') {
            if (this.cdata) {
              emitNode(this, 'oncdata', this.cdata)
            }
            emitNode(this, 'onclosecdata')
            this.cdata = ''
            this.state = S.TEXT
          } else if (c === ']') {
            this.cdata += ']'
          } else {
            this.cdata += ']]' + c
            this.state = S.CDATA
          }
          continue

        case S.PROC_INST:
          if (c === '?') {
            this.state = S.PROC_INST_ENDING
          } else if (isWhitespace(c)) {
            this.state = S.PROC_INST_BODY
          } else {
            this.procInstName += c
          }
          continue

        case S.PROC_INST_BODY:
          if (!this.procInstBody && isWhitespace(c)) {
            continue
          } else if (c === '?') {
            this.state = S.PROC_INST_ENDING
          } else {
            this.procInstBody += c
          }
          continue

        case S.PROC_INST_ENDING:
          if (c === '>') {
            emitNode(this, 'onprocessinginstruction', {
              name: this.procInstName,
              body: this.procInstBody
            })
            this.procInstName = this.procInstBody = ''
            this.state = S.TEXT
          } else {
            this.procInstBody += '?' + c
            this.state = S.PROC_INST_BODY
          }
          continue

        case S.OPEN_TAG:
          if (isMatch(nameBody, c)) {
            this.tagName += c
          } else {
            newTag(this)
            if (c === '>') {
              openTag(this)
            } else if (c === '/') {
              this.state = S.OPEN_TAG_SLASH
            } else {
              if (!isWhitespace(c)) {
                strictFail(this, 'Invalid character in tag name')
              }
              this.state = S.ATTRIB
            }
          }
          continue

        case S.OPEN_TAG_SLASH:
          if (c === '>') {
            openTag(this, true)
            closeTag(this)
          } else {
            strictFail(this, 'Forward-slash in opening tag not followed by >')
            this.state = S.ATTRIB
          }
          continue

        case S.ATTRIB:
          // haven't read the attribute name yet.
          if (isWhitespace(c)) {
            continue
          } else if (c === '>') {
            openTag(this)
          } else if (c === '/') {
            this.state = S.OPEN_TAG_SLASH
          } else if (isMatch(nameStart, c)) {
            this.attribName = c
            this.attribValue = ''
            this.state = S.ATTRIB_NAME
          } else {
            strictFail(this, 'Invalid attribute name')
          }
          continue

        case S.ATTRIB_NAME:
          if (c === '=') {
            this.state = S.ATTRIB_VALUE
          } else if (c === '>') {
            strictFail(this, 'Attribute without value')
            this.attribValue = this.attribName
            attrib(this)
            openTag(this)
          } else if (isWhitespace(c)) {
            this.state = S.ATTRIB_NAME_SAW_WHITE
          } else if (isMatch(nameBody, c)) {
            this.attribName += c
          } else {
            strictFail(this, 'Invalid attribute name')
          }
          continue

        case S.ATTRIB_NAME_SAW_WHITE:
          if (c === '=') {
            this.state = S.ATTRIB_VALUE
          } else if (isWhitespace(c)) {
            continue
          } else {
            strictFail(this, 'Attribute without value')
            this.tag!.attributes[this.attribName] = '' as any//TODO: remove 'as'
            this.attribValue = ''
            emitNode(this, 'onattribute', {
              name: this.attribName,
              value: ''
            })
            this.attribName = ''
            if (c === '>') {
              openTag(this)
            } else if (isMatch(nameStart, c)) {
              this.attribName = c
              this.state = S.ATTRIB_NAME
            } else {
              strictFail(this, 'Invalid attribute name')
              this.state = S.ATTRIB
            }
          }
          continue

        case S.ATTRIB_VALUE:
          if (isWhitespace(c)) {
            continue
          } else if (isQuote(c)) {
            this.q = c
            this.state = S.ATTRIB_VALUE_QUOTED
          } else {
            this.strictFail('Unquoted attribute value')
            this.state = S.ATTRIB_VALUE_UNQUOTED
            this.attribValue = c
          }
          continue

        case S.ATTRIB_VALUE_QUOTED:
          if (c !== this.q) {
            if (c === '&') {
              this.state = S.ATTRIB_VALUE_ENTITY_Q
            } else {
              this.attribValue += c
            }
            continue
          }
          attrib(this)
          this.q = ''
          this.state = S.ATTRIB_VALUE_CLOSED
          continue

        case S.ATTRIB_VALUE_CLOSED:
          if (isWhitespace(c)) {
            this.state = S.ATTRIB
          } else if (c === '>') {
            openTag(this)
          } else if (c === '/') {
            this.state = S.OPEN_TAG_SLASH
          } else if (isMatch(nameStart, c)) {
            strictFail(this, 'No whitespace between attributes')
            this.attribName = c
            this.attribValue = ''
            this.state = S.ATTRIB_NAME
          } else {
            strictFail(this, 'Invalid attribute name')
          }
          continue

        case S.ATTRIB_VALUE_UNQUOTED:
          if (!isAttribEnd(c)) {
            if (c === '&') {
              this.state = S.ATTRIB_VALUE_ENTITY_U
            } else {
              this.attribValue += c
            }
            continue
          }
          attrib(this)
          if (c === '>') {
            openTag(this)
          } else {
            this.state = S.ATTRIB
          }
          continue

        case S.CLOSE_TAG:
          if (!this.tagName) {
            if (isWhitespace(c)) {
              continue
            } else if (notMatch(nameStart, c)) {
              if (this.script) {
                this.script += '</' + c
                this.state = S.SCRIPT
              } else {
                strictFail(this, 'Invalid tagname in closing tag.')
              }
            } else {
              this.tagName = c
            }
          } else if (c === '>') {
            closeTag(this)
          } else if (isMatch(nameBody, c)) {
            this.tagName += c
          } else if (this.script) {
            this.script += '</' + this.tagName
            this.tagName = ''
            this.state = S.SCRIPT
          } else {
            if (!isWhitespace(c)) {
              strictFail(this, 'Invalid tagname in closing tag')
            }
            this.state = S.CLOSE_TAG_SAW_WHITE
          }
          continue

        case S.CLOSE_TAG_SAW_WHITE:
          if (isWhitespace(c)) {
            continue
          }
          if (c === '>') {
            closeTag(this)
          } else {
            strictFail(this, 'Invalid characters in closing tag')
          }
          continue

        case S.TEXT_ENTITY:
        case S.ATTRIB_VALUE_ENTITY_Q:
        case S.ATTRIB_VALUE_ENTITY_U:
          var returnState
          var buffer
          switch (this.state) {
            case S.TEXT_ENTITY:
              returnState = S.TEXT
              buffer = 'textNode'
              break

            case S.ATTRIB_VALUE_ENTITY_Q:
              returnState = S.ATTRIB_VALUE_QUOTED
              buffer = 'attribValue'
              break

            case S.ATTRIB_VALUE_ENTITY_U:
              returnState = S.ATTRIB_VALUE_UNQUOTED
              buffer = 'attribValue'
              break
          }

          if (c === ';') {
            this[buffer] += parseEntity(this)
            this.entity = ''
            this.state = returnState
          } else if (isMatch(this.entity.length ? entityBody : entityStart, c)) {
            this.entity += c
          } else {
            strictFail(this, 'Invalid character in entity name')
            this[buffer] += '&' + this.entity + c
            this.entity = ''
            this.state = returnState
          }

          continue

        default: /* istanbul ignore next */ {
          throw new Error('Unknown state: ' + this.state)
        }
      }
    } // while

    if (this.position >= this.bufferCheckPosition) {
      checkBufferLength(this)
    }
    return this
  }

  end() {
    if (this.sawRoot && !this.closedRoot) strictFail(this, 'Unclosed root tag')
    if ((this.state !== STATE.BEGIN) &&
      (this.state !== STATE.BEGIN_WHITESPACE) &&
      (this.state !== STATE.TEXT)) {
      error(this, 'Unexpected end')
    }
    this.closeText()
    this.c = ''
    this.closed = true
    emit(this, 'onend')
    this.exec(this.strict, this.opt)
    //SAXthis.call(this, this.strict, this.opt)
    return this;
  }

  continue() {
    this.exec(this.strict, this.opt)
  }
  exec(strict: boolean, opt: SAXOptions = {}) {
    clearBuffers(this);
    this.q = this.c = '';
    this.bufferCheckPosition = MAX_BUFFER_LENGTH;
    this.opt = opt;
    this.opt.lowercase = this.opt.lowercase || this.opt.lowercasetags;
    this.looseCase = this.opt.lowercase ? 'toLowerCase' : 'toUpperCase';
    this.tags = [];
    this.closed = this.closedRoot = this.sawRoot = false;
    this.tag = this.error = undefined;
    this.strict = !!strict;
    this.noscript = !!(strict || this.opt.noscript);
    this.state = STATE.BEGIN;
    this.strictEntities = this.opt.strictEntities;
    this.ENTITIES = this.strictEntities ? Object.create(XML_ENTITIES) : Object.create(ENTITIES);
    this.attribList = [];

    // namespaces form a prototype chain.
    // it always points at the current tag,
    // which protos to its parent tag.
    if (this.opt.xmlns) {
      this.ns = Object.create(rootNS);
    }

    // mostly just for error reporting
    this.trackPosition = this.opt.position !== false;
    if (this.trackPosition) {
      this.position = this.line = this.column = 0;
    }
    emit(this, 'onready');
  }

  beginWhiteSpace(c: string) {
    if (c === '<') {
      this.state = STATE.OPEN_WAKA
      this.startTagPosition = this.position
    } else if (!isWhitespace(c)) {
      // have to process this as a text node.
      // weird, but happens.
      strictFail(this, 'Non-whitespace before first tag.')
      this.textNode = c
      this.state = S.TEXT
    }
  }

  strictFail(message: string) {
    if (this.strict) {
      error(this, message)
    }
  }

  closeText() {
    this.textNode = textopts(this.opt, this.textNode)
    if (this.textNode) emit(this, 'ontext', this.textNode)
    this.textNode = ''
  }

  flush() {
    if (this.cdata !== '') {
      emitNode(this, 'oncdata', this.cdata)
      this.cdata = ''
    }
    if (this.script !== '') {
      emitNode(this, 'onscript', this.script)
      this.script = ''
    }
  }

  close() {
    this.write(null)
  }

  resume() { this.error = undefined; return this }

  getError() {
    return this.error
  }
}

export function error(p: SAXParser, error_msg: string) {
  p.closeText()
  if (p.trackPosition) {
    error_msg += `\nLine: ${p.line}\nColumn: ${p.column}\nChar: ${p.c}`;
  }
  p.error = new Error(error_msg)
  emit(p, 'onerror', p.error)
  return p
}

export function textopts(opt: any, s: string) {
  if (opt.trim) s = s.trim()
  if (opt.normalize) s = s.replace(/\s+/g, ' ')
  return s
}

export function emitNode(p: SAXParser, nodeType: any, data?: any) {
  if (p.textNode)
    p.closeText();
  emit(p, nodeType, data);
}

export function attrib(p: SAXParser) {
  if (!p.strict) {
    p.attribName = p.attribName[p.looseCase]();
  }

  if (p.attribList.indexOf(p.attribName) !== -1 ||
    p.tag!.attributes.hasOwnProperty(p.attribName)) {
    p.attribName = p.attribValue = '';
    return;
  }

  if (p.opt.xmlns) {
    const { prefix, local } = qname(p.attribName, true);

    if (prefix === 'xmlns') {
      // namespace binding attribute. push the binding into scope
      if (local === 'xml' && p.attribValue !== XML_NAMESPACE) {
        strictFail(p,
          'xml: prefix must be bound to ' + XML_NAMESPACE + '\n' +
          'Actual: ' + p.attribValue);
      } else if (local === 'xmlns' && p.attribValue !== XMLNS_NAMESPACE) {
        strictFail(p,
          'xmlns: prefix must be bound to ' + XMLNS_NAMESPACE + '\n' +
          'Actual: ' + p.attribValue);
      } else {
        const tag = p.tag!;
        const parent = p.tags[p.tags.length - 1] || p
        if (tag.ns === parent.ns) {
          tag.ns = Object.create(parent.ns);
        }
        tag.ns[local] = p.attribValue;
      }
    }

    // defer onattribute events until all attributes have been seen
    // so any new bindings can take effect. preserve attribute order
    // so deferred events can be emitted in document order
    p.attribList.push([p.attribName, p.attribValue]);
  } else {
    // in non-xmlns mode, we can emit the event right away
    p.tag!.attributes[p.attribName] = p.attribValue as any;
    emitNode(p, 'onattribute', {
      name: p.attribName,
      value: p.attribValue
    });
  }

  p.attribName = p.attribValue = '';
}

export function strictFail(p: SAXParser, message: string) {
  if (typeof p !== 'object' || !(p instanceof SAXParser)) {
    throw new Error('bad call to strictFail')
  }

  if (p.strict) {
    error(p, message)
  }
}

export function parseEntity(p: SAXParser) {
  let entity = p.entity
  const entityLC = entity.toLowerCase()
  let num = NaN;
  let numStr = ''

  if (p.ENTITIES[entity]) {
    return p.ENTITIES[entity]
  }
  if (p.ENTITIES[entityLC]) {
    return p.ENTITIES[entityLC]
  }
  entity = entityLC
  if (entity[0] === '#') {
    if (entity[1] === 'x') {
      entity = entity.slice(2)
      num = parseInt(entity, 16)
      numStr = num.toString(16)
    } else {
      entity = entity.slice(1)
      num = parseInt(entity, 10)
      numStr = num.toString(10)
    }
  }
  entity = entity.replace(/^0+/, '')
  if (isNaN(num) || numStr.toLowerCase() !== entity) {
    strictFail(p, 'Invalid character entity')
    return '&' + p.entity + ';'
  }

  return String.fromCodePoint(num)
}

function checkBufferLength(p: SAXParser) {
  const MAX_ALLOWED = Math.max(MAX_BUFFER_LENGTH, 10)
  let max_actual = 0
  for (const buffer of buffers) {
    const len = p[buffer].length
    if (len > MAX_ALLOWED) {
      // Text/cdata nodes can get big, and since they're buffered,
      // we can get here under normal conditions.
      // Avoid issues by emitting the text node now,
      // so at least it won't get any bigger.
      switch (buffer) {
        case 'textNode':
          p.closeText()
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
          error(p, 'Max buffer length exceeded: ' + buffer)
      }
    }
    max_actual = Math.max(max_actual, len)
  }
  // schedule the next check for the earliest possible buffer overrun.
  const m = MAX_BUFFER_LENGTH - max_actual
  p.bufferCheckPosition = m + p.position
}