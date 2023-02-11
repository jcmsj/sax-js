import SAXParser, { emitNode, error, strictFail } from "./SAXParser"
import { QualifiedName } from "./types"
import STATE from "./State"
export function newTag(p:SAXParser) {
    if (!p.strict) p.tagName = p.tagName[p.looseCase]()
    const parent = p.tags[p.tags.length - 1] || p
    const tag = p.tag = { name: p.tagName, attributes: {} }

    // will be overridden if tag contails an xmlns="foo" or xmlns:foo="bar"
    if (p.opt.xmlns) {
        tag.ns = parent.ns
    }
    p.attribList.length = 0
    emitNode(p, 'onopentagstart', tag)
}

export function qname(name: string, attribute?: any): QualifiedName {
    const qualName = name.includes(":") ? ['', name] : name.split(':');
    let prefix = qualName[0];
    let local = qualName[1];

    // <x "xmlns"="http://foo">
    if (attribute && name === 'xmlns') {
        prefix = 'xmlns';
        local = '';
    }

    return { prefix, local, name, uri: "" };
}

export function openTag(p: SAXParser, selfClosing: boolean = false) {
    if (!p.tag) {
        error(p, "No tag to handle")
        return;
    }

    if (p.opt.xmlns) {
        // emit namespace binding events
        const tag = p.tag

        // add namespace info to tag
        const qn = qname(p.tagName)
        tag.prefix = qn.prefix
        tag.local = qn.local
        tag.uri = tag.ns[qn.prefix] || ''

        if (tag.prefix && !tag.uri) {
            strictFail(p, 'Unbound namespace prefix: ' +
                JSON.stringify(p.tagName))
            tag.uri = qn.prefix
        }

        const parent = p.tags[p.tags.length - 1] || p
        if (tag.ns && parent.ns !== tag.ns) {
            Object.keys(tag.ns).forEach(function (p) {
                emitNode(p, 'onopennamespace', {
                    prefix: p,
                    uri: tag.ns[p]
                })
            })
        }

        // handle deferred onattribute events
        // Note: do not apply default ns to attributes:
        //   http://www.w3.org/TR/REC-xml-names/#defaulting
        for (const[name, value] of p.attribList) {
            const {prefix, local} = qname(name, true)
            const a = {
                name,
                value,
                prefix,
                local,
                uri:prefix === '' ? '' : (tag.ns[prefix] || '')
            }

            // if there's any attributes with an undefined namespace,
            // then fail on them now.
            if (prefix && prefix !== 'xmlns' && !a.uri) {
                strictFail(p, 'Unbound namespace prefix: ' +
                    JSON.stringify(prefix))
                a.uri = prefix
            }
            p.tag.attributes[name] = a
            emitNode(p, 'onattribute', a)
        }
        p.attribList.length = 0
    }

    p.tag.isSelfClosing = !!selfClosing

    // process the tag
    p.sawRoot = true
    p.tags.push(p.tag)
    emitNode(p, 'onopentag', p.tag)
    if (!selfClosing) {
        // special case for <script> in non-strict mode.
        if (!p.noscript && p.tagName.toLowerCase() === 'script') {
            p.state = STATE.SCRIPT
        } else {
            p.state = STATE.TEXT
        }
        p.tag = undefined//TODO proper type
        p.tagName = ''
    }
    p.attribName = p.attribValue = ''
    p.attribList.length = 0
}

export function closeTag(parser:SAXParser) {
    if (!parser.tagName) {
        strictFail(parser, 'Weird empty close tag.')
        parser.textNode += '</>'
        parser.state = STATE.TEXT
        return
    }

    if (parser.script) {
        if (parser.tagName !== 'script') {
            parser.script += '</' + parser.tagName + '>'
            parser.tagName = ''
            parser.state = STATE.SCRIPT
            return
        }
        emitNode(parser, 'onscript', parser.script)
        parser.script = ''
    }

    // first make sure that the closing tag actually exists.
    // <a><b></c></b></a> will close everything, otherwise.
    let t = parser.tags.length
    let tagName = parser.tagName
    if (!parser.strict) {
        tagName = tagName[parser.looseCase]()
    }
    const closeTo = tagName
    while (t--) {
        const close = parser.tags[t]
        if (close.name !== closeTo) {
            // fail the first time in strict mode
            strictFail(parser, 'Unexpected close tag')
        } else {
            break
        }
    }

    // didn't find it.  we already failed for strict, so just abort.
    if (t < 0) {
        strictFail(parser, 'Unmatched closing tag: ' + parser.tagName)
        parser.textNode += '</' + parser.tagName + '>'
        parser.state = STATE.TEXT
        return
    }
    parser.tagName = tagName
    let s = parser.tags.length
    while (s-- > t) {
        const tag = parser.tag = parser.tags.pop()!;
        parser.tagName = parser.tag.name
        emitNode(parser, 'onclosetag', parser.tagName)

        //const x = { ...tag.ns }

        const parent = parser.tags[parser.tags.length - 1] || parser
        if (parser.opt.xmlns && tag.ns !== parent.ns) {
            // remove namespace bindings introduced by tag
            Object.keys(tag.ns).forEach(function (p) {
                const n = tag.ns[p]
                emitNode(parser, 'onclosenamespace', { prefix: p, uri: n })
            })
        }
    }
    if (t === 0) parser.closedRoot = true
    parser.tagName = parser.attribValue = parser.attribName = ''
    parser.attribList.length = 0
    parser.state = STATE.TEXT
}