const KEYWORDS = new Set([
  "import",
  "export",
  "from",
  "default",
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "break",
  "continue",
  "new",
  "class",
  "extends",
  "super",
  "this",
  "typeof",
  "instanceof",
  "null",
  "undefined",
  "true",
  "false",
  "async",
  "await",
  "try",
  "catch",
  "finally",
  "throw",
  "of",
  "in",
  "=>",
  "static",
  "get",
  "set",
  "def",
  "print",
  "elif",
  "pass",
  "lambda",
  "with",
  "as",
  "not",
  "and",
  "or",
  "is",
  "None",
  "True",
  "False",
]);

function tokenizeLine(line) {
  const tokens = [];
  let i = 0;
  while (i < line.length) {
    // String
    if (line[i] === '"' || line[i] === "'" || line[i] === "`") {
      const q = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== q) {
        if (line[j] === "\\") j++;
        j++;
      }
      tokens.push({ type: "string", text: line.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    // Comment
    if (line[i] === "/" && line[i + 1] === "/") {
      tokens.push({ type: "comment", text: line.slice(i) });
      break;
    }
    if (line[i] === "#") {
      tokens.push({ type: "comment", text: line.slice(i) });
      break;
    }
    // Number
    if (/\d/.test(line[i])) {
      let j = i;
      while (j < line.length && /[\d.]/.test(line[j])) j++;
      tokens.push({ type: "number", text: line.slice(i, j) });
      i = j;
      continue;
    }
    // Word / keyword
    if (/[a-zA-Z_$]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[\w$]/.test(line[j])) j++;
      const word = line.slice(i, j);
      tokens.push({
        type: KEYWORDS.has(word) ? "keyword" : "ident",
        text: word,
      });
      i = j;
      continue;
    }
    // Punctuation / operator
    tokens.push({ type: "punct", text: line[i] });
    i++;
  }
  return tokens;
}

export default tokenizeLine;