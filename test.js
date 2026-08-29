#!/usr/bin/env node
/* Tiny dependency-free test suite for the postprocessor.  Run: node test.js */
"use strict";
require("./words.js");
require("./simplify.js");
var P = require("./postprocess.js");

var pass = 0, fail = 0;
function eq(label, got, want) {
  if (got === want) { pass++; return; }
  fail++;
  console.log("FAIL  " + label + "\n   got:  " + JSON.stringify(got) + "\n   want: " + JSON.stringify(want));
}
var r = function (s) { return P.process(s, { mode: "regular" }); };
var k = function (s) { return P.process(s, { mode: "kid" }); };

// ── edge cases (from de-LLMing real prose) ───────────────────────────────────

// deMarkdown only strips PAIRED asterisks; a lone "*" is literal.
eq("A* preserved", r("The A* search — it works."), "The A* search. It works.");
eq("multiply preserved", r("Compute 5 * 3 quickly."), "Compute 5 * 3 quickly.");
eq("bold stripped", r("This is **bold** text."), "This is bold text.");
eq("italic stripped", r("This is *italic* text."), "This is italic text.");

// deDash leaves a dash BETWEEN DIGITS (a range) alone.
eq("en-dash range", r("Boards 1–14 in milliseconds."), "Boards 1–14 in milliseconds.");
eq("year range", r("Active 2020–2024 nonstop."), "Active 2020–2024 nonstop.");
eq("spaced digit range", r("Pages 5 - 10 here."), "Pages 5 - 10 here.");
eq("real em-dash breaks", r("It works — really well."), "It works. Really well.");
eq("digit then word breaks", r("Level 5 — go now."), "Level 5. Go now.");
eq("double-hyphen breaks", r("A -- B done."), "A. B done.");

// deEllipsis: "…" or 3+ dots break; a 2-dot range does not.
eq("2-dot range kept", r("Range 600..749 here."), "Range 600..749 here.");
eq("three dots break", r("Wait... it continues."), "Wait. It continues.");
eq("unicode ellipsis breaks", r("Wait… it continues."), "Wait. It continues.");

// expandSlang: "em" is slang for "them" only with the apostrophe.
eq("em dash kept", r("An em dash is long."), "An em dash is long.");
eq("lick-em kept", r("It says lick-em loudly."), "It says lick-em loudly.");
eq("bare em kept", r("Go get em all."), "Go get em all.");
eq("apostrophe em expands", r("Go get ’em all."), "Go get them all.");
eq("intra-word apostrophe kept", P.transforms.expandSlang("y’gonna fall"), "y’gonna fall");
eq("normal slang expands", r("I kinda wanna go."), "I kind of want to go.");

// deSemicolon: a ";" that closes an HTML entity is one glyph, not a clause break.
eq("named entity kept", r("Nurses &middot; aides."), "Nurses &middot; aides.");
eq("arrow entity kept", r("Go &rarr; there now."), "Go &rarr; there now.");
eq("numeric entity kept", r("A &#8212; B here."), "A &#8212; B here.");
eq("hex entity kept", r("A &#x2014; B here."), "A &#x2014; B here.");
eq("real semicolon breaks near entity", r("See &amp; more; it works."), "See &amp; more. It works.");
eq("plain semicolon still breaks", r("First; second here."), "First. Second here.");

// ── core behavior (regression guard) ─────────────────────────────────────────
eq("kid full pipeline", k("It’s fundamentally a thousand things."), "It is at heart a ten hundred things.");
eq("regular expands contractions", r("It's a test."), "It is a test.");
eq("regular breaks semicolons", r("A works; B fails."), "A works. B fails.");
eq("regular keeps vocabulary", r("utilize the algorithm."), "utilize the algorithm.");
eq("regular keeps iOS (conservative voice)", r("iOS is a system."), "iOS is a system.");
eq("kid always-capitalizes (eager voice)", k("iOS is a system."), "IOS is a set of things.");
eq("kid strips a bare 'So' opener", k("So it works."), "It works.");
eq("regular keeps a bare 'So' (no comma)", r("So many dogs."), "So many dogs.");
eq("we'll / we're expand", r("We're happy and we'll go."), "We are happy and we will go.");
eq("keep protects a phrase", P.process("A computer program runs.", { mode: "kid", keep: "computer program" }), "A computer program runs.");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
