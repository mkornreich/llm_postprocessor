# LLM Postprocessor

A tiny JavaScript tool that takes the text an LLM produced and rewrites it. Text in, text out.

Two modes:

- Regular. The "de-LLM" clean-up: strips markdown, breaks up them-dashes, semicolons and ellipses into plain sentences, undoes contractions and slang, and drops hedging. But keeps every word as it is. The normal, grown-up version.
- Kid mode (xkcd). Everything Regular does, plus the child-friendly [xkcd Thing Explainer](https://xkcd.com/thing-explainer/) layer: it swaps fancy words for plain ones, writes big numbers the "ten hundred" way, and uses the eager plain voice. Only words a small child would know.

The "ten hundred" simple-word list comes from xkcd's [Simple Writer](https://xkcd.com/simplewriter/).

## Try it

Open `index.html` in any browser. No build step, no server, no dependencies. Everything runs locally. No text ever leaves the page.

```
# or serve it, if your browser blocks file:// scripts
python3 -m http.server 8000    # then open http://localhost:8000
```

Paste some LLM output, flip between Regular and Kid mode, and copy the result.

### Example

> **In:** Photosynthesis is the **process** by which plants convert sunlight into energy. It's fundamentally a mechanism that generates roughly a thousand molecules of glucose.

> **Regular out:** Photosynthesis is the process by which plants convert sunlight into energy. It is fundamentally a mechanism that generates roughly a thousand molecules of glucose.

> **Kid mode out:** Photosynthesis is the steps by which plants change sunlight into power. It is at heart a how it works that makes about a ten hundred tiny bits of glucose.

## On the command line

```sh
echo "It's fundamentally a thousand tiny mechanisms." | node cli.js
node cli.js --regular "It's basically a thousand tiny mechanisms."   # de-LLM clean-up, keeps the words
node cli.js --fancy "utilize the algorithm"     # also lists words still not simple
```

## Use it in your own code

The core is one dependency-free function.

Browser. Load the three scripts, then call `PostProcessor`:

```html
<script src="words.js"></script>
<script src="simplify.js"></script>
<script src="postprocess.js"></script>
<script>
  PostProcessor.process("It utilizes a thousand components.", { mode: "kid" });
  // → "It uses a ten hundred parts."
</script>
```

Node:

```js
require("./words.js");
require("./simplify.js");
const PostProcessor = require("./postprocess.js");

PostProcessor.process(text, { mode: "kid" });      // "regular" | "kid"
PostProcessor.fancyWords(text);                    // words still outside the simple list
```

### API

| Call | Does |
| --- | --- |
| `process(text, { mode, keep })` | Main entry. `mode` is `"kid"` (default: de-LLM clean-up plus the xkcd rewrite) or `"regular"` (just the de-LLM clean-up, keeps every word). `keep` is a word/phrase (or array) to never simplify. E.g. the topic (kid mode only). |
| `fancyWords(text, keep)` | Array of words in `text` not in the "ten hundred" simple list. |
| `isSimple(word)` | Is this word one of the simple words? |
| `tidy(text)` | Just the kid-mode voice cleanup (no word swaps). |
| `transforms.*` | The individual steps (`deMarkdown`, `xkcdNumbers`, `expandContractions`,.) for reuse/testing. |

## Files

| File | What |
| --- | --- |
| `index.html` / `app.js` / `style.css` | The web app. |
| `postprocess.js` | The postprocessor. The whole pipeline, browser + Node. |
| `cli.js` | Command-line wrapper. |
| `words.js` | The xkcd Simple Writer "ten hundred" word list. |
| `simplify.js` | The fancy → simple swap table (903 entries). |

## Credits

- Simple-word list: [xkcd Simple Writer](https://xkcd.com/simplewriter/) (CC BY-NC 2.5, xkcd).
