/**
 * tokenizer
 * 
 * out: 
 * [
  { type: 'declare', value: 'let' },
  { type: 'name', value: 'a' },
  { type: 'mark', value: '=' },
  { type: 'name', value: 'x' },
  { type: 'mark', value: '?' },
  { type: 'mark', value: '.' },
  { type: 'name', value: 'y' },
  { type: 'mark', value: ';' },
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
        if (["=", "?", ".", ";"].includes(str[current])) {
            out.push({
                type: "mark",
                value: str[current]
            });
            current++;
            continue;
        }

        const KEYWORDS = ["let", "const"];

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
            while (current + 1 < str.length && LETTERS.test(str[current + 1])) {
                current++;
                x += str[current];
            }
            current++;
            const key = KEYWORDS.indexOf(x);
            if (key !== -1) {
                out.push({
                    type: "keyword",
                    value: KEYWORDS[key]
                });
                continue;
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

    const walk = ({ isDeclare, isChain, isMember } = { isDeclare: false, isChain: false, isMember: false }) => {
        let token = tokens[current];
        if (!token) return;
        if (isMember && token.type === 'name') {
            let expression = {
                type: "MemberExpression",
                object: token.value,
            }
            token = tokens[++current];
            let isOptional = false;
            if (token.type === "mark") {
                if (token.value === "?") {
                    isOptional = true;
                    token = tokens[++current];
                    expression.optional = isOptional;
                }
                if (token.value === ".") {
                    token = tokens[++current];
                    expression.property = token.value;
                }
            }
            current++;
            return expression;
        }

        if (isChain) {
            current++;
            return {
                type: "ChainExpression",
                expression: walk({ isMember: true })
            }
        }

        if (token.type === "mark" && token.value === "=") {
            return walk({ isChain: true })
        }

        if (token.type === "mark" && token.value === ";") {
            return
        }

        if (isDeclare && token.type === "name") {
            current++;
            let declarator = {
                type: "VariableDeclarator",
                name: token.value,
                init: walk()
            };
            return declarator;
        }

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
        if (token.type === "keyword" && token.value === "let") {
            let node = {
                type: "VariableDeclaration",
                kind: token.value, // fn name
                declarations: []
            };
            current++;
            token = tokens[current];


            while (token && (token.type !== "mark" || token.type === "mark" && token.value !== ";")) {
                node.declarations.push(walk({ isDeclare: true }));
                token = tokens[current];
            }
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
            case "VariableDeclaration":
                traverseArray(node.declarations, node);
                break;
            case "VariableDeclarator":
                traverseNode(node.init, node);
                break;
            case "ChainExpression":
                traverseNode(node.expression, node);
                break;
            case "MemberExpression":
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
        VariableDeclarator: {
            enter: function (node, parent) {
                let init = {};
                let expression = {
                    type: "VariableDeclarator",
                    id: {
                        type: "Identifier",
                        name: node.name,
                    },
                    init: init
                };
                node._context = init;
                parent._context.push(expression);
            }
        },
        ChainExpression: {
            enter: function (node, parent) {
                if (node.expression.optional) {
                    let expression = {
                        type: "LogicalExpression",
                        left: {
                            type: "Identifier",
                            name: node.expression.object,
                        },
                        operator: "&&",
                        right: {
                            type: "MemberExpression",
                            object: {
                                type: "Identifier",
                                name: node.expression.object,
                            },
                            optional: false,
                            property: {
                                type: "Identifier",
                                name: node.expression.property,
                            }
                        }
                    }
                    for (let key in expression) {
                        parent._context[key] = expression[key];
                    }
                }
            }
        },
        VariableDeclaration: {
            enter: function (node, parent) {
                let expression = {
                    type: "VariableDeclaration",
                    kind: node.kind,
                    declarations: []
                };
                node._context = expression.declarations; // `._context` 其实就是用来修改 `expression.arguments` 的一个操作指针
                if (parent.type !== "VariableDeclaration") {
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
        case "VariableDeclaration":
            return node.kind + " " + node.declarations.map(codeGenerator).join(", ");
        case "VariableDeclarator":
            return codeGenerator(node.id) + " = " + codeGenerator(node.init);
        case "LogicalExpression":
            return codeGenerator(node.left) + " " + node.operator + " " + codeGenerator(node.right);
        case "MemberExpression":
            return codeGenerator(node.object) + "." + codeGenerator(node.property);
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