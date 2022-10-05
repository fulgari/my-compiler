/**
 * tokenizer
 * 
 * out: 
 * [
  { type: 'paren', value: '(' },
  { type: 'name', value: 'add' },
  { type: 'number', value: '2' },
  { type: 'paren', value: '(' },
  { type: 'name', value: 'subtract' },
  { type: 'number', value: '4' },
  { type: 'number', value: '2' },
  { type: 'paren', value: ')' },
  { type: 'paren', value: ')' }
]
 */
function tokenizer(str) {
    let out = [];
    let current = 0;
    while (current < str.length) {
        if (/\s/.test(str[current])) {
            current++;
            continue;
        }
        if ("(" === str[current]) {
            out.push({
                type: "paren",
                value: "("
            });
            current++;
            continue;
        }
        if (")" === str[current]) {
            out.push({
                type: "paren",
                value: ")"
            });
            current++;
            continue;
        }
        const NUMBERS = /[0-9]/;
        if (NUMBERS.test(str[current])) {
            let x = str[current];
            while (NUMBERS.test(str[++current])) {
                x += str[current];
            }
            out.push({
                type: "number",
                value: x
            });
            continue;
        }
        const LETTERS = /[a-z]/;
        if (LETTERS.test(str[current])) {
            let x = str[current];
            while (LETTERS.test(str[++current])) {
                x += str[current];
            }
            out.push({
                type: "name",
                value: x
            });
            continue;
        }
        if (/\"/.test(str[current])) {
            let x = str[current];
            while (/^\"/.test(str[++current])) {
                x += str[current];
            }
            out.push({
                type: "string",
                value: x
            });
            continue;
        }
        throw new Error("[jc] Unsupported char `" + str[current] + "` !")
    }
    return out;
}

/**
 * parser
 */
function parser(tokens) {
    let current = 0;

    const walk = () => {
        let token = tokens[current];

        if (token.type === "string") {
            current++;
            return {
                type: "StringLiteral",
                value: token.value
            }
        }
        if (token.type === "number") {
            current++;
            return {
                type: "NumberLiteral",
                value: token.value
            }
        }
        if (token.type === "paren" && token.value === "(") {
            // skip `(`
            current++;
            token = tokens[current];

            let node = {
                type: "CallExpression",
                value: token.value, // fn name
                params: []
            };
            // skip fn name
            current++;
            token = tokens[current];

            while (token.type !== "paren" || token.type === "paren" && token.value !== ")") {
                node.params.push(walk());
                token = tokens[current];
            }
            // skip `)`
            current++;
            return node;
        }
        throw new TypeError(token.type);
    }

    let ast = {
        type: "Program",
        body: []
    }

    while (current < tokens.length) {
        ast.body.push(walk());
    }

    return ast;
}

/**
 * Traverser
 * 
 * `visitor` is a collection of objects who contain 2 hooks:
 * {
 *       enter(node, parent) {
 *         // ...
 *       },
 *       exit(node, parent) {
 *         // ...
 *       },
 * }
 */
function traverser(ast, visitor) {
    function traverseArray(array, parent) {
        array.forEach(item => {
            traverseNode(item, parent);
        })
    }

    function traverseNode(node, parent) {
        // if(node.type === "StringLiteral" || node.type === "NumberLiteral") {
        //     return;
        // }
        const methodEntry = visitor[node.type];
        if (methodEntry && methodEntry.enter) {
            methodEntry.enter(node, parent);
        }
        switch (node.type) {
            case "Program":
                traverseArray(node.body, node);
                break;
            case "CallExpression":
                traverseArray(node.params, node);
                break;
            case "StringLiteral":
            case "NumberLiteral":
                break;
            default:
                throw new TypeError(node.type);
        }
        if (methodEntry && methodEntry.exit) {
            methodEntry.exit(node, parent);
        }
    }
    traverseNode(ast, null);
}

/**
 * transformer
 */
function transformer(ast) {
    let newAst = {
        type: "Program",
        body: []
    }
    ast._context = newAst.body; // ast._context is a pointer used to change the content of `newAst.body`

    traverser(ast, {
        NumberLiteral: {
            enter: function (node, parent) {
                parent._context.push({
                    type: "NumberLiteral",
                    value: node.value
                })
            }
        },
        StringLiteral: {
            enter: function (node, parent) {
                parent._context.push({
                    type: "StringLiteral",
                    value: node.value
                })
            }
        },
        CallExpression: {
            enter: function (node, parent) {
                let expression = {
                    type: "CallExpression",
                    callee: {
                        type: "Identifier",
                        name: node.value
                    },
                    arguments: []
                };
                node._context = expression.arguments; // `._context` 其实就是用来修改 `expression.arguments` 的一个操作指针
                if (parent.type !== "CallExpression") {
                    expression = {
                        type: "ExpressionStatement", // top-level expression are actually expression statements
                        expression: expression
                    }
                }
                parent._context.push(expression);
            }
        }
    });

    return newAst;
}

function codeGenerator(node) {
    switch (node.type) {
        case "Program":
            return node.body.map(codeGenerator).join("\n");
        case "NumberLiteral":
            return node.value;
        case "StringLiteral":
            return '"' + node.value + '"';
        case "ExpressionStatement":
            return codeGenerator(node.expression) + ";";
        case "CallExpression":
            return codeGenerator(node.callee) + "(" + node.arguments.map(codeGenerator).join(", ") + ")";
        case "Identifier":
            return node.name;
        default:
            console.error(node)
            throw new TypeError(node.type)
    }
}

module.exports = {
    tokenizer,
    parser,
    transformer,
    codeGenerator
}