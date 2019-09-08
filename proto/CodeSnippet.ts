import permissableGlobals from './PermissableGlobals';
import { HandlePromise } from './PromiseHandler';

export interface CodeSnippetCallInstance {
  retryAfterPromise(name: string, promise: Promise<void>): void;
}

export interface CodeSnippetArg {
  value: (callInstance: CodeSnippetCallInstance) => any;
}

export class CodeSnippet {
  codeString: string;
  handlePromise: HandlePromise;
  maskGlobals: string[];
  func: Function;

  constructor(codeString: string, handlePromise: HandlePromise) {
    this.codeString = codeString;
    this.handlePromise = handlePromise;
    this.maskGlobals = Array.from(CodeSnippet.potentialGlobalsFromCodeString(codeString));
    this.func = new Function(...this.maskGlobals, this.codeString);
  }

  call(locals: { [key: string]: CodeSnippetArg } = {}): { result?: any; retryingAfterPromises?: string[] } {
    let needsRetry;
    const retryAfterPromises: { [name: string]: Promise<void> } = {},
      callInstance: CodeSnippetCallInstance = {
        retryAfterPromise(name, promise) {
          retryAfterPromises[name] = promise;
          needsRetry = true;
        },
      },
      result = this.func(this.maskGlobals.map(key => locals[key] && locals[key].value(callInstance)));

    if (!needsRetry) return { result };

    this.handlePromise(Promise.all(Object.values(retryAfterPromises)).then(() => this.call(locals)));
    return { retryingAfterPromises: Object.keys(retryAfterPromises) };
  }

  static potentialGlobalsFromCodeString(codeString: string) {
    const words = new Set<string>(),
      regex = /(?<!\.)\b\w+\b/g;
    for (let match: RegExpExecArray | null; (match = regex.exec(codeString)); ) {
      const [word] = match;
      if (!permissableGlobals.has(word)) words.add(word);
    }
    return words;
  }
}
