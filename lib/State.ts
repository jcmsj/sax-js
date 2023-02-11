export enum STATE {
    BEGIN, // leading byte order mark or whitespace
    BEGIN_WHITESPACE, // leading whitespace
    TEXT, // general stuff
    TEXT_ENTITY, // &amp and such.
    OPEN_WAKA, // <
    SGML_DECL, // <!BLARG
    SGML_DECL_QUOTED, // <!BLARG foo "bar
    DOCTYPE, // <!DOCTYPE
    DOCTYPE_QUOTED, // <!DOCTYPE "//blah
    DOCTYPE_DTD, // <!DOCTYPE "//blah" [ ...
    DOCTYPE_DTD_QUOTED, // <!DOCTYPE "//blah" [ "foo
    COMMENT_STARTING, // <!-
    COMMENT, // <!--
    COMMENT_ENDING, // <!-- blah -
    COMMENT_ENDED, // <!-- blah --
    CDATA, // <![CDATA[ something
    CDATA_ENDING, // ]
    CDATA_ENDING_2, // ]]
    PROC_INST, // <?hi
    PROC_INST_BODY, // <?hi there
    PROC_INST_ENDING, // <?hi "there" ?
    OPEN_TAG, // <strong
    OPEN_TAG_SLASH, // <strong /
    ATTRIB, // <a
    ATTRIB_NAME, // <a foo
    ATTRIB_NAME_SAW_WHITE, // <a foo _
    ATTRIB_VALUE, // <a foo=
    ATTRIB_VALUE_QUOTED, // <a foo="bar
    ATTRIB_VALUE_CLOSED, // <a foo="bar"
    ATTRIB_VALUE_UNQUOTED, // <a foo=bar
    ATTRIB_VALUE_ENTITY_Q, // <foo bar="&quot;"
    ATTRIB_VALUE_ENTITY_U, // <foo bar=&quot
    CLOSE_TAG, // </a
    CLOSE_TAG_SAW_WHITE, // </a   >
    SCRIPT, // <script> ...
    SCRIPT_ENDING // <script> ... <
}

export default STATE;