// Browser client coordinates, never physical screen pixels.
export function libraryClientRect(rect,width,height){
  if(!rect||![rect.left,rect.top,rect.right,rect.bottom,width,height].every(Number.isFinite))return null;
  const left=Math.max(0,Math.ceil(rect.left)),top=Math.max(0,Math.ceil(rect.top));
  const right=Math.min(Math.floor(width),Math.floor(rect.right)),bottom=Math.min(Math.floor(height),Math.floor(rect.bottom));
  return right-left<220||bottom-top<200?null:{left,top,width:right-left,height:bottom-top};
}
export function libraryDuration(reduced,enabled,normal){return reduced||!enabled?0:normal;}
