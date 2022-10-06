const { tokenizer, parser, transformer, codeGenerator } = require("./optional-chaining-compiler");

let log = console.log;

const input = 'let o = x?.y;';
const output = 'let o = x && x.y;';

let tokens = tokenizer(input);
log(tokens);

let ast = parser(tokens);
log(JSON.stringify(ast, undefined, 4));

let newAst = transformer(ast);
log(JSON.stringify(newAst, undefined, 4));

let code = codeGenerator(newAst);
log(code, code === output);
