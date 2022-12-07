import SAXParser, { emitNode, error, strictFail } from "./SAXParser"
import { QualifiedName } from "./types"
import { S } from "./State"
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
    const i = name.indexOf(':');
    const qualName = i < 0 ? ['', name] : name.split(':');
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

        var parent = p.tags[p.tags.length - 1] || p
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
        for (var i = 0, l = p.attribList.length; i < l; i++) {
            var nv = p.attribList[i]
            var name = nv[0]
            var value = nv[1]
            var qualName = qname(name, true)
            var prefix = qualName.prefix
            var local = qualName.local
            var uri = prefix === '' ? '' : (tag.ns[prefix] || '')
            var a = {
                name: name,
                value: value,
                prefix: prefix,
                local: local,
                uri: uri
            }

            // if there's any attributes with an undefined namespace,
            // then fail on them now.
            if (prefix && prefix !== 'xmlns' && !uri) {
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
            p.state = S.SCRIPT
        } else {
            p.state = S.TEXT
        }
        p.tag = undefined as any//TODO proper type
        p.tagName = ''
    }
    p.attribName = p.attribValue = ''
    p.attribList.length = 0
}

export function closeTag(parser) {
    if (!parser.tagName) {
        strictFail(parser, 'Weird empty close tag.')
        parser.textNode += '</>'
        parser.state = S.TEXT
        return
    }

    if (parser.script) {
        if (parser.tagName !== 'script') {
            parser.script += '</' + parser.tagName + '>'
            parser.tagName = ''
            parser.state = S.SCRIPT
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
        parser.state = S.TEXT
        return
    }
    parser.tagName = tagName
    let s = parser.tags.length
    while (s-- > t) {
        const tag = parser.tag = parser.tags.pop()
        parser.tagName = parser.tag.name
        emitNode(parser, 'onclosetag', parser.tagName)

        const x = { ...tag.ns }
        /* for (var i in tag.ns) {
            x[i] = tag.ns[i]
        } */

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
    parser.state = S.TEXT
}