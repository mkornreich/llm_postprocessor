/* ============================================================================
   LLM POSTPROCESSOR. Text in, text out.

   Takes the raw text an LLM produced and rewrites it. Two modes:

     • "regular". The "de-LLM" clean-up: strips markdown, breaks them-dashes,
                    semicolons and ellipses into plain sentences, undoes
                    contractions and slang, and drops hedging. But keeps every
                    word as-is. The normal, grown-up version.
     • "kid". Everything regular does, PLUS the child-friendly / xkcd
                    "Thing Explainer" layer: it swaps fancy words for plain
                    ones, writes big numbers the "ten hundred" way, and uses the
                    eager plain voice. Using words a small child would know.

   The kid-mode pipeline is ported from the "Cool Concepts" LLM postprocessor
   (https://mkornreich.me/projects/coolconcepts). The fancy->simple swap table
   lives in simplify.js (window.__SIMPLIFY). The "ten hundred" common-word list
   lives in words.js (window.__WORDS), from xkcd's Simple Writer
   (https://xkcd.com/simplewriter/).

   Works in the browser (as window.PostProcessor, after words.js + simplify.js
   are loaded) and in Node (require the two data files first, then this one).
   ============================================================================ */
(function (root, factory) {
  var api = factory();
  root.PostProcessor = api;                                   // browser global
  if (typeof module !== "undefined" && module.exports) {      // Node / bundlers
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var G = typeof globalThis !== "undefined" ? globalThis : this;

  // The "ten hundred" simple words (xkcd Simple Writer list) and the
  // fancy->simple swap table are loaded as separate data files. Read them
  // lazily so load order is forgiving.
  var _simpleWords = null, _simplify = null, _simplifyRe = null;
  // Re-read from the globals until they are actually populated, so calling the
  // API before words.js / simplify.js have loaded does not cache an empty
  // result forever (it just returns unprocessed text until the data is there).
  function simpleWords() {
    if (_simpleWords && _simpleWords.size) { return _simpleWords; }
    var w = typeof G.__WORDS === "string" ? G.__WORDS : "";
    _simpleWords = new Set(w ? w.split("|") : []);
    return _simpleWords;
  }
  function simplifyTable() {
    if (_simplifyRe) { return _simplify; }              // already built
    var src = (G.__SIMPLIFY && typeof G.__SIMPLIFY === "object") ? G.__SIMPLIFY : {};
    var keys = Object.keys(src);
    if (!keys.length) { return (_simplify = _simplify || {}); }   // not loaded yet. Do not lock in empty
    _simplify = src;
    // \b.\b around an alternation of every fancy word (longest first so
    // multi-word keys like "computer program" win over "computer").
    keys.sort(function (a, b) { return b.length - a.length; });
    _simplifyRe = new RegExp("\\b(" + keys.map(escapeRe).join("|") + ")\\b", "gi");
    return _simplify;
  }
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // ── individual text transforms (each is pure: string -> string) ────────────

  // Chat models wrap words in markdown emphasis (italic, bold) or code
  // ticks. Strip the markers, keep the text.
  function deMarkdown(s) {
    s = (s || "");
    s = s.replace(/\*\*([^*]+)\*\*/g, "$1");   // bold
    s = s.replace(/\*([^*\n]+)\*/g, "$1");     // italic
    s = s.replace(/`+/g, "");                   // code ticks
    return s.replace(/\*+/g, "");               // any stray asterisks
  }

  // A long dash between clauses becomes a sentence break, so no long dashes
  // survive. brk is the break mark: "!" for kid mode's eager voice, "." for
  // regular mode's plain one. A spaced single hyphen always starts a sentence.
  function deDash(s, brk) {
    var b = brk || "!";
    s = s.replace(/\s*(?:[—–―‒−]|--)\s*([A-Za-z])/g,
      function (_, ch) { return b + " " + ch.toUpperCase(); });
    s = s.replace(/\s*(?:[—–―‒−]|--)\s*/g, b + " ");
    s = s.replace(/\s+-\s+([A-Za-z])/g, function (_, ch) { return ". " + ch.toUpperCase(); });
    return s.replace(/\s+-\s+/g, ". ");
  }

  // An ellipsis becomes a fresh sentence when the thought keeps going.
  function deEllipsis(s) {
    s = s.replace(/\s*(?:…|\.(?:\s*\.)+)\s*([A-Za-z])/g,
      function (_, ch) { return ". " + ch.toUpperCase(); });
    return s.replace(/\s*(?:…|\.(?:\s*\.)+)\s*/g, ".");
  }

  // No semicolons for kids: a semicolon becomes a new sentence.
  function deSemicolon(s) {
    s = s.replace(/\s*;\s*([A-Za-z])/g, function (_, ch) { return ". " + ch.toUpperCase(); });
    return s.replace(/\s*;\s*/g, ". ");
  }

  // xkcd / "Thing Explainer" writes big numbers the "ten hundred" way, because
  // thousand/million/. Are not simple words. "thousands of X" -> "lots of X".
  var BIG_NUMS = {
    thousand: "ten hundred",
    million: "ten hundred hundred",
    billion: "ten hundred hundred hundred",
    trillion: "ten hundred hundred hundred hundred"
  };
  function xkcdNumbers(s) {
    s = s.replace(/\b(thousand|million|billion|trillion)s\b/gi, function (m) {
      return /^[A-Z]/.test(m) ? "Lots" : "lots";
    });
    return s.replace(/\b(thousand|million|billion|trillion)\b/gi, function (m) {
      var r = BIG_NUMS[m.toLowerCase()];
      return /^[A-Z]/.test(m) ? r.charAt(0).toUpperCase() + r.slice(1) : r;
    });
  }

  // Contractions -> long forms, so "do not" reads as "do not" (both simple
  // words). Only tokens with an apostrophe are touched, so plain words
  // ("were", "well") and possessives are left alone.
  var CONTRACTIONS = {
    aint: "is not", arent: "are not", cant: "cannot", cantve: "cannot have",
    couldve: "could have", couldnt: "could not", couldntve: "could not have",
    didnt: "did not", doesnt: "does not", dont: "do not", hadnt: "had not",
    hasnt: "has not", havent: "have not", hed: "he would", hell: "he will",
    hes: "he is", heres: "here is", howd: "how did", howll: "how will",
    hows: "how is", id: "I would", ill: "I will", im: "I am", ive: "I have",
    isnt: "is not", itd: "it would", itll: "it will", its: "it is",
    lets: "let us", mightve: "might have", mustve: "must have", mustnt: "must not",
    neednt: "need not", shant: "shall not", shed: "she would", shell: "she will",
    shes: "she is", shouldve: "should have", shouldnt: "should not",
    thatd: "that would", thats: "that is", thered: "there would",
    therell: "there will", theres: "there is", theyd: "they would",
    theyll: "they will", theyre: "they are", theyve: "they have",
    wasnt: "was not", wed: "we would", well: "we will", were: "we are",
    weve: "we have", werent: "were not",
    whatll: "what will", whatre: "what are", whats: "what is",
    whatve: "what have", whens: "when is", whered: "where did",
    wheres: "where is", wholl: "who will", whos: "who is", whove: "who have",
    whyd: "why did", whys: "why is", wont: "will not", wouldve: "would have",
    wouldnt: "would not", youd: "you would", youll: "you will", youre: "you are",
    youve: "you have", yall: "you all"
  };
  function expandContractions(s) {
    return s.replace(/[A-Za-z]+(?:['’][A-Za-z]+)+/g, function (w) {
      var full = CONTRACTIONS[w.toLowerCase().replace(/['’]/g, "")];
      if (!full) { return w; }                    // unknown (e.g. a possessive) -> leave it
      return /^[A-Z]/.test(w) ? full.charAt(0).toUpperCase() + full.slice(1) : full;
    });
  }

  // Everyday slang -> plain words.
  var SLANG = {
    em: "them", ya: "you", yer: "your", lemme: "let me", gimme: "give me",
    kinda: "kind of", sorta: "sort of", outta: "out of", dunno: "do not know",
    cuz: "because", betcha: "bet you", gotcha: "got you", whatcha: "what are you",
    gotta: "got to", gonna: "going to", wanna: "want to"
  };
  function expandSlang(s) {
    return s.replace(/['’]?\b([A-Za-z]+)\b/g, function (m, w) {
      var full = SLANG[w.toLowerCase()];
      if (!full) { return m; }
      return /^[A-Z]/.test(w) ? full.charAt(0).toUpperCase() + full.slice(1) : full;
    });
  }

  // A few phrase swaps for the plain, direct xkcd voice.
  function xkcdVoice(s) {
    function swap(re, repl) {
      s = s.replace(re, function (m) {
        return /^[A-Z]/.test(m) ? repl.charAt(0).toUpperCase() + repl.slice(1) : repl;
      });
    }
    swap(/\bfor (?:example|instance)\b/gi, "like this");
    swap(/\bsuch as\b/gi, "like");
    swap(/\bin other words\b/gi, "that means");
    swap(/\bet ?cetera\b|\betc\.?/gi, "and more");
    swap(/\be\.\s?g\.?/gi, "like");
    swap(/\bi\.\s?e\.?/gi, "that is");
    return s;
  }

  // Drop hedging openers ("Well,", "Maybe", "I think") and turn "is like"
  // into "is like", so the text states what a thing IS.
  function stripHedge(s) {
    // "So," / "Well," at the very start are hedges. But bare "So many." and
    // "Well done." are real content, so only strip so/well when a comma follows.
    // (The original only ran on short one-line blurbs. This tool sees any text.)
    var stripped = s
      .replace(/^\s*(?:so|well)\s*,\s*/i, "")
      .replace(/^\s*(?:maybe|perhaps|probably|honestly|basically|i think|i guess|i believe|it seems(?: like)?|it looks like)[,\s]+/i, "");
    var removedOpener = stripped !== s;
    stripped = stripped.replace(/\bsounds? like\b/gi, "is like");
    // Only re-capitalize when a leading hedge was actually removed, so we do not
    // clobber intentionally-lowercase openers like "iOS" or "eBay".
    return (removedOpener && stripped)
      ? stripped.charAt(0).toUpperCase() + stripped.slice(1)
      : stripped;
  }

  // Swap fancy words for the plain ones in the simplify table. skip is a set
  // of lowercased words to leave alone (e.g. the topic's own words).
  function applySimple(s, skip) {
    var table = simplifyTable();
    if (!_simplifyRe) { return s; }
    return s.replace(_simplifyRe, function (w) {
      var lw = w.toLowerCase();
      if (skip && skip.has(lw)) { return w; }
      var repl = table[lw];
      if (!repl) { return w; }
      return /^[A-Z]/.test(w) ? repl.charAt(0).toUpperCase() + repl.slice(1) : repl;
    });
  }

  // The shared "de-LLM" cleanup, used by BOTH modes: strip markdown, break
  // them-dashes / semicolons / ellipses into plain sentences, undo contractions
  // and slang, and drop hedging. It changes no vocabulary. That is the
  // kid-only xkcd layer. This IS regular mode's whole pipeline.
  function clean(s) {
    return stripHedge(deEllipsis(deSemicolon(expandSlang(
      expandContractions(deDash(deMarkdown((s || "").trim()), "."))))));
  }

  // Kid mode = the shared cleanup PLUS the xkcd "Thing Explainer" layer: the
  // eager "!" break, "ten hundred" numbers, and plain-voice phrase swaps. The
  // fancy->simple word swap (applySimple) is layered on top by process().
  // Unlike the original (which trimmed to a one-line blurb) this keeps ALL of
  // the text, so it works on answers of any length.
  function tidy(s) {
    return stripHedge(deEllipsis(deSemicolon(xkcdVoice(expandSlang(
      expandContractions(xkcdNumbers(deDash(deMarkdown((s || "").trim()), "!"))))))));
  }

  // ── public helpers ─────────────────────────────────────────────────────────

  function isSimple(word) {
    var lw = String(word).toLowerCase();
    return simpleWords().has(lw);
  }

  function toSkipSet(keep) {
    var set = new Set();
    if (!keep) { return set; }
    // Each item is kept both as a whole phrase (so a multi-word simplify key like
    // "computer program" is protected) and as its individual words.
    (Array.isArray(keep) ? keep : [keep]).forEach(function (item) {
      var phrase = String(item).toLowerCase().replace(/[^a-z' ]/g, " ").replace(/\s+/g, " ").trim();
      if (!phrase) { return; }
      set.add(phrase);
      phrase.split(" ").forEach(function (w) { if (w) { set.add(w); } });
    });
    return set;
  }

  // Words still outside the "ten hundred" list after processing (the ones a
  // strict xkcd reader would still underline). Single letters and the topic's
  // own keep words do not count.
  function fancyWords(text, keep) {
    var skip = toSkipSet(keep), simple = simpleWords();
    var out = [], seen = new Set(), m, re = /[A-Za-z][A-Za-z']*/g;
    while ((m = re.exec(text)) !== null) {
      var w = m[0], lw = w.toLowerCase();
      if (w.length < 2 || lw === "xkcd") { continue; }
      if (simple.has(lw) || skip.has(lw) || seen.has(lw)) { continue; }
      seen.add(lw);
      out.push(w);
    }
    return out;
  }

  // The one call the app uses: raw LLM text in, finished text out.
  //   mode: "regular" (de-LLM cleanup only, keeps every word) | "kid" (also do
  //         the xkcd "Thing Explainer" rewrite). Default "kid".
  //   keep: word(s) or phrase(s) to never simplify (string or array), e.g. the
  //         topic. Pass an array to protect several distinct phrases. (kid only)
  function process(text, opts) {
    opts = opts || {};
    var mode = opts.mode === "regular" ? "regular" : "kid";
    var raw = (text == null ? "" : String(text));
    if (mode === "regular") { return clean(raw); }
    return applySimple(tidy(raw), toSkipSet(opts.keep));
  }

  return {
    MODES: ["regular", "kid"],
    process: process,
    clean: clean,
    tidy: tidy,
    applySimple: applySimple,
    fancyWords: fancyWords,
    isSimple: isSimple,
    // individual transforms, exposed for testing / reuse
    transforms: {
      deMarkdown: deMarkdown, deDash: deDash, deEllipsis: deEllipsis,
      deSemicolon: deSemicolon, xkcdNumbers: xkcdNumbers,
      expandContractions: expandContractions, expandSlang: expandSlang,
      xkcdVoice: xkcdVoice, stripHedge: stripHedge
    }
  };
});
