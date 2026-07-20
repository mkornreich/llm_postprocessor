#!/usr/bin/env node
/* LLM postprocessor on the command line: text in (stdin or an argument),
   processed text out (stdout).

     echo "It's fundamentally a thousand tiny mechanisms." | node cli.js
     node cli.js --regular "leave this text alone"
     node cli.js "make this simple"                 # kid mode is the default

   Flags:  --kid (default)   --regular   --fancy (list words still not simple)
*/
"use strict";
require("./words.js");        // populates globalThis.__WORDS
require("./simplify.js");     // populates globalThis.__SIMPLIFY
var PostProcessor = require("./postprocess.js");

var argv = process.argv.slice(2);
var mode = "kid", showFancy = false, textArgs = [];
argv.forEach(function (a) {
  if (a === "--regular" || a === "-r") { mode = "regular"; }
  else if (a === "--kid" || a === "-k") { mode = "kid"; }
  else if (a === "--fancy" || a === "-f") { showFancy = true; }
  else if (a === "--help" || a === "-h") { help(); process.exit(0); }
  else { textArgs.push(a); }
});

function help() {
  process.stdout.write(
    "Usage: node cli.js [--kid|--regular] [--fancy] [text]\n" +
    "  Reads text from the argument or stdin and prints the processed text.\n" +
    "  --kid (default)  child-friendly xkcd 'Thing Explainer' rewrite\n" +
    "  --regular        leave the text as it is\n" +
    "  --fancy          also list the words still outside the simple list\n");
}

function run(text) {
  var out = PostProcessor.process(text, { mode: mode });
  process.stdout.write(out + (out.endsWith("\n") ? "" : "\n"));
  if (showFancy && mode === "kid") {
    var fancy = PostProcessor.fancyWords(out);
    process.stderr.write("[" + fancy.length + " still-fancy word(s)]" +
      (fancy.length ? " " + fancy.join(", ") : "") + "\n");
  }
}

if (textArgs.length) {
  run(textArgs.join(" "));
} else {
  var chunks = [];
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", function (d) { chunks.push(d); });
  process.stdin.on("end", function () { run(chunks.join("")); });
}
