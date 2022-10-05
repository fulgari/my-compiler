const { tokenizer, parser, transformer, codeGenerator } = require("./johnnys-compiler");

let log = console.log;

const input = '(add 2 (subtract 4 2))';
const output = 'add(2, subtract(4, 2));';

let tokens = tokenizer(input);
log(tokens);

let ast = parser(tokens);
log(JSON.stringify(ast, undefined, 4));

let newAst = transformer(ast);
log(JSON.stringify(newAst, undefined, 4));

let code = codeGenerator(newAst);
log(code, code === output);
