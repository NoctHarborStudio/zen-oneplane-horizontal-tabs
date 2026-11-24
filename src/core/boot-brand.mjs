// Chrome-only brand mark shared by Boot and Center Disassembly.
export function createNocturneBrandMark(document){
  const html=tag=>document.createElementNS("http://www.w3.org/1999/xhtml",tag);
  const bootMark=html("div");
  Object.assign(bootMark.style,{display:"grid",justifyItems:"center",gap:"20px",willChange:"transform, opacity"});
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("viewBox","0 0 72 72");svg.setAttribute("width","72");svg.setAttribute("height","72");
  const moon=document.createElementNS(svg.namespaceURI,"path");
  moon.setAttribute("d","M43 8 A29 29 0 1 0 62 53 A26 26 0 0 1 43 8Z");moon.setAttribute("fill","#c4c8e5");
  const star=document.createElementNS(svg.namespaceURI,"path");
  star.setAttribute("d","M55 12 L57 19 L64 21 L57 23 L55 30 L53 23 L46 21 L53 19Z");star.setAttribute("fill","#e4e5ef");svg.append(moon,star);
  const label=html("div");label.textContent="NOCTURNE";
  Object.assign(label.style,{font:"300 24px system-ui, sans-serif",letterSpacing:"7px",paddingInlineStart:"7px"});
  bootMark.append(svg,label);
  return bootMark;
}
