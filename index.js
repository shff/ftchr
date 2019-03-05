const { JSDOM, ResourceLoader } = require("jsdom");

const REGEX = /[:>+~@].*$/;
const hidden = [
  ["display", "none"],
  ["visibility", "hidden"],
  ["opacity", "0"],
  ["width", "0px"],
  ["height", "0px"]
];

async function extract(url) {
  const { window } = await JSDOM.fromURL(url, { resources: "usable" });
  const { document, getComputedStyle: gcs } = window;
  const { body, title, styleSheets } = document;

  const nodes = flatten([body], a => [...a.children]);
  const els = nodes.filter(a => hidden.every(([k, v]) => gcs(a)[k] != v));

  const sheets = [...styleSheets];
  const topRules = sheets.map(a => a.cssRules && [...a.cssRules]).flat();
  const allRules = topRules.map(a => a.cssRules || [a]).flat();
  const validRules = allRules.filter(a => a.selectorText);
  const usedRules = validRules.filter(
    style =>
      (style.selectorText = style.selectorText
        .split(",")
        .filter(a => els.some(b => b.closest("body " + a.replace(REGEX, ""))))
        .join(",")).length
  );
  const groups = groupBy(usedRules, getMediaText);
  const styles = Object.keys(groups).map(query => {
    const rules = [...new Set(groups[query].map(a => a.cssText))].join("\n");
    return query == "null" ? rules : `@media ${query} {\n${rules}\n}`;
  });
  const css = styles.join("");

  const html = reduceTree([body], (el, cb) => {
    if (el.constructor.name === "Text") return el.textContent.trim();
    if (!els.includes(el)) return "";
    const tag = el.tagName.toLowerCase();
    const attrs = [...el.attributes].map(a => ` ${a.name}="${a.value.trim()}"`);
    return `<${tag}${attrs}>${cb(el.childNodes).join("")}</${tag}>`;
  });

  return `<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>${title}</title><style type=\"text/css\">${css}</style></head>${html}</html>`;
}

// Utility functions
const flatten = (root, cb) =>
  [...root].reduce((acc, el) => [...acc, el, ...flatten(cb(el), cb)], []);
const groupBy = (items, cb) =>
  items.reduce((acc, x) => (acc[cb(x)] = acc[cb(x)] || []).push(x) && acc, {});
const reduceTree = (root, cb) =>
  [...root].map(a => cb(a, b => reduceTree(b, cb)));
const getMediaText = a =>
  a.parentRule && a.parentRule.media && a.parentRule.media.mediaText;

// Run it
extract(process.argv[2]).then(console.log);
