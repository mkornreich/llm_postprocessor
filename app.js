/* Glue between the page and the postprocessor. Reads the textarea, runs
   PostProcessor.process() in the chosen mode, writes the result out. Live:
   re-runs on every keystroke and whenever the mode changes. */
(function () {
  "use strict";

  var input = document.getElementById("input");
  var output = document.getElementById("output");
  var meta = document.getElementById("meta");
  var copyBtn = document.getElementById("copy");
  var sampleBtn = document.getElementById("sample");
  var modeInputs = Array.prototype.slice.call(
    document.querySelectorAll('input[name="mode"]'));

  var SAMPLE =
    "Photosynthesis is the **process** by which plants convert sunlight into " +
    "energy. It's fundamentally a mechanism that generates roughly a thousand " +
    "molecules of glucose — essentially the plant's food. In other words, plants " +
    "utilize light to manufacture their own nourishment.";

  function currentMode() {
    for (var i = 0; i < modeInputs.length; i++) {
      if (modeInputs[i].checked) { return modeInputs[i].value; }
    }
    return "kid";
  }

  function render() {
    var mode = currentMode();
    document.body.classList.toggle("is-kid", mode === "kid");
    var text = input.value;
    var out = "";
    try {
      out = window.PostProcessor.process(text, { mode: mode });
    } catch (e) {
      out = text;
      console.error("postprocess failed:", e);
    }
    output.value = out;

    if (!text.trim()) { meta.textContent = ""; return; }
    if (mode === "kid") {
      var fancy = window.PostProcessor.fancyWords(out);
      meta.textContent = fancy.length
        ? fancy.length + (fancy.length === 1 ? " word is" : " words are") +
          " still not in the simple list: " + fancy.slice(0, 12).join(", ") +
          (fancy.length > 12 ? "…" : "")
        : "Every word is a simple, everyday word. ✔";
    } else {
      meta.textContent = "";
    }
  }

  // Debounce keystrokes so a long paste doesn't re-run the big swap on every
  // single character.
  var timer = null;
  function scheduleRender() {
    if (timer) { clearTimeout(timer); }
    timer = setTimeout(render, 110);
  }

  input.addEventListener("input", scheduleRender);
  modeInputs.forEach(function (m) { m.addEventListener("change", render); });

  sampleBtn.addEventListener("click", function () {
    input.value = SAMPLE;
    input.focus();
    render();
  });

  copyBtn.addEventListener("click", function () {
    if (!output.value) { return; }
    var done = function () {
      var old = copyBtn.textContent;
      copyBtn.textContent = "copied ✔";
      setTimeout(function () { copyBtn.textContent = old; }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(output.value).then(done, function () {
        output.select(); document.execCommand("copy"); done();
      });
    } else {
      output.select(); document.execCommand("copy"); done();
    }
  });

  // Start with the example loaded so the two modes are obvious right away.
  input.value = SAMPLE;
  render();
})();
