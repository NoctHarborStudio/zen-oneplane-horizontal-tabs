/* A pure diagnostic boundary for browser/extension exception names.
 * Native exception objects can embed URLs, file paths, titles and queries. */
const NOCTURNE_EXCEPTION_CLASSES=new Set([
  "Error","TypeError","RangeError","ReferenceError","SyntaxError","URIError","EvalError","AggregateError",
  "DOMException","AbortError","NotAllowedError","InvalidStateError","NotFoundError","NotSupportedError",
  "SecurityError","DataCloneError","NetworkError","TimeoutError","QuotaExceededError","WorkspaceCommandError",
  "NS_ERROR_FAILURE","NS_ERROR_ABORT","NS_ERROR_NOT_AVAILABLE","NS_ERROR_UNEXPECTED","NS_ERROR_NOT_INITIALIZED",
  "NS_ERROR_FILE_NOT_FOUND","NS_ERROR_XPC_BAD_CONVERT_JS"
]);
export function nocturneErrorClass(error){
  try{
    const name=error?.name;
    return typeof name==="string"&&NOCTURNE_EXCEPTION_CLASSES.has(name)?name:"Error";
  }catch{return "Error";}
}
