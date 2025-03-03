export interface SAXOptions {
    trim?: boolean;
    normalize?: boolean;
    lowercase?: boolean;
    xmlns?: boolean;
    noscript?: boolean;
    position?: boolean;
}

export interface QualifiedName {
    name: string;
    prefix: string;
    local: string;
    uri: string;
}

export interface QualifiedAttribute extends QualifiedName {
    value: string;
}

export interface BaseTag {
    name: string;
    isSelfClosing: boolean;
}

// Interface used when the xmlns option is set
export interface QualifiedTag extends QualifiedName, BaseTag {
    ns: { [key: string]: string };
    attributes: { [key: string]: QualifiedAttribute };
}

export interface Tag extends BaseTag {
    attributes: { [key: string]: string };
}

export interface SAXParser {
    constructor(strict?: boolean, opt?: SAXOptions):SAXParser;

    // Methods
    end(): void;
    write(s: string): SAXParser;
    resume(): SAXParser;
    close(): SAXParser;
    flush(): void;

    // Members
    line: number;
    column: number;
    error: Error;
    position: number;
    startTagPosition: number;
    closed: boolean;
    strict: boolean;
    opt: SAXOptions;
    tag: Tag;
    ENTITIES: {[key: string]: string};

    // Events
    onerror(e: Error): void;
    ontext(t: string): void;
    ondoctype(doctype: string): void;
    onprocessinginstruction(node: { name: string; body: string }): void;
    onsgmldeclaration(sgmlDecl: string): void;
    onopentag(tag: Tag | QualifiedTag): void;
    onopentagstart(tag: Tag | QualifiedTag): void;
    onclosetag(tagName: string): void;
    onattribute(attr: { name: string; value: string }): void;
    oncomment(comment: string): void;
    onopencdata(): void;
    oncdata(cdata: string): void;
    onclosecdata(): void;
    onopennamespace(ns: { prefix: string; uri: string }): void;
    onclosenamespace(ns: { prefix: string; uri: string }): void;
    onend(): void;
    onready(): void;
    onscript(script: string): void;
}

//export function createStream(strict?: boolean, opt?: SAXOptions): SAXStream;
export interface SAXStream extends ReadableStream {
    new(strict?: boolean, opt?: SAXOptions);
    _parser: SAXParser;
    on(event: "text", listener: (this: this, text: string) => void): this;
    on(event: "doctype", listener: (this: this, doctype: string) => void): this;
    on(event: "processinginstruction", listener: (this: this, node: { name: string; body: string }) => void): this;
    on(event: "sgmldeclaration", listener: (this: this, sgmlDecl: string) => void): this;
    on(event: "opentag" | "opentagstart", listener: (this: this, tag: Tag | QualifiedTag) => void): this;
    on(event: "closetag", listener: (this: this, tagName: string) => void): this;
    on(event: "attribute", listener: (this: this, attr: { name: string; value: string }) => void): this;
    on(event: "comment", listener: (this: this, comment: string) => void): this;
    on(event: "opencdata" | "closecdata" | "end" | "ready" | "close" | "readable" | "drain" | "finish", listener: (this: this) => void): this;
    on(event: "cdata", listener: (this: this, cdata: string) => void): this;
    on(event: "opennamespace" | "closenamespace", listener: (this: this, ns: { prefix: string; uri: string }) => void): this;
    on(event: "script", listener: (this: this, script: string) => void): this;
    on(event: "data", listener: (this: this, chunk: any) => void): this;
    on(event: "error", listener: (this: this, err: Error) => void): this;
    on(event: "pipe" | "unpipe", listener: (this: this, src: ReadableStream) => void): this;
    on(event: string | symbol, listener: (this: this, ...args: any[]) => void): this;
}
