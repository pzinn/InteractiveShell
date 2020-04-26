const webAppTagCodes = {
    "End":        17,      // end of section script
    "Html":       18,      // indicates what follows is HTML
    "Output":     19,      // it's html but it's output
    "Input":      20,      // it's text but it's input
    "InputContd": 28,      // text, continuation of input
    "Script":     29,      // script
    "Text":       30,      // indicates what follows is pure text; default mode. not used at the moment
    "Tex":        31       // TeX
}
/*
const webAppTags = Object.fromEntries(Object.entries(webAppTagCodes).map(
    ([key,val]) => [key,String.fromCharCode(val)])); // node.js 12 accepts that
*/
// returns a new object with the values at each key mapped using mapFn(value)
function objectMap(object, mapFn) {
  return Object.keys(object).reduce(function(result, key) {
    result[key] = mapFn(object[key])
    return result
  }, {})
}
const webAppTags = objectMap(webAppTagCodes, String.fromCharCode);

module.exports = webAppTags;
