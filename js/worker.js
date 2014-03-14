
onmessage = function(event){
    postMessage(getResults(event.data));
};
function getResults(data){
    //check if the pattern is valid - try compile the pattern
    var compiledPattern = null;
    try {
        compiledPattern = new RegExp('(' + data.regexp + ')', data.modifiers);
    } catch (e) {
        return null;
    }
    var result = {
        'highlight': '',
        'replace': '',
        'search_found': 0
    };
    //rest is relevant if there is test search text
    if (!data.search.trim()) {
        return result;
    }
    var body = data.search;
    
    result.search_found = countMatch(data, compiledPattern);
    result.highlight = highlight({
        pattern: compiledPattern,
        body: body
    });
    result.replace = replace({
        pattern: compiledPattern,
        replace: data.replace,
        body: body
    });
    return result;
}
function countMatch(data, compiledPattern){
    if(data.search.trim() === '') return 0;
    var match = data.search.match(compiledPattern);
    if (match !== null) {
        var cnt = 0;
        for(var i=0,len=match.length;i<len;i++){
            if(!isNaN(match[i].charCodeAt(0))){
                cnt++;
            }
        }
        return cnt; //match.length;
    }
    return 0;
}

function highlight(opt) {
    var highlight = opt.body.replace(opt.pattern, "[rexp-highlight]$1[/rexp-highlight]");
    highlight = highlight.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;').replace(/\n/g, '<br/>');
    highlight = highlight.replace(/\[rexp-highlight\](.*?)\[\/rexp-highlight\]/g, '<span class="highlight">$1</span>');
    return highlight;
}
function replace(opt) {
    if (!opt.replace.trim()) {
        return '';
    }
    var match = opt.body.match(opt.pattern);
    var replace = opt.replace;
    replace = replace.replace(/\$0/, match);
    //
    // because in this app the expression is wrapped in () any use of $ + number must be increased here.
    //
    var r = /\$(\d)/gim;
    function replacer(match, p1, offset, string) {
        return '$' + (parseInt(p1)+1);
    }
    replace = replace.replace(r,replacer);
    var replacedMatch = opt.body.replace(opt.pattern, '[rexp-highlight]' + replace + '[/rexp-highlight]');
    replacedMatch = replacedMatch.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;').replace(/\n/g, '<br/>');
    replacedMatch = replacedMatch.replace(/\[rexp-highlight\](.*?)\[\/rexp-highlight]/g, '<span class="replaceHighlight">$1</span>');
    return replacedMatch;
}
