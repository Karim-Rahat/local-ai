// Preserve code verbatim, including incomplete fences while a response streams.
export function splitCodeBlocks(text) {
  const parts=[];
  const opening=/^ {0,3}(`{3,}|~{3,})([^\r\n]*)\r?\n/gm;
  let cursor=0,match;
  while((match=opening.exec(text))){
    if(match.index>cursor)parts.push({type:'text',content:text.slice(cursor,match.index)});
    const fence=match[1], start=opening.lastIndex;
    const closing=new RegExp('^ {0,3}'+fence[0]+'{'+fence.length+',}[ \\t]*(?:\\r?\\n|$)','gm');
    closing.lastIndex=start;
    const end=closing.exec(text);
    parts.push({type:'code',language:match[2].trim().split(/\s+/)[0].toLowerCase(),content:text.slice(start,end?end.index:text.length),complete:!!end});
    cursor=end?closing.lastIndex:text.length;
    opening.lastIndex=cursor;
    if(!end)break;
  }
  if(cursor<text.length)parts.push({type:'text',content:text.slice(cursor)});
  return parts;
}
