export {};
declare global {
  interface Window {
    hubshield: {
      getState(): Promise<{tabs:Array<{id:string;title:string;url:string;loading:boolean;canGoBack:boolean;canGoForward:boolean;private:boolean}>;activeId:string|null}>;
      control(action: 'minimize'|'maximize'|'close'): Promise<void>; newTab(isPrivate?: boolean): Promise<string>;
      activateTab(id: string): Promise<void>; closeTab(id: string): Promise<void>; navigate(id: string, input: string): Promise<void>;
      go(direction: 'back'|'forward'|'reload'): Promise<void>; setBounds(bounds: {x:number;y:number;width:number;height:number}, visible: boolean): Promise<void>;
      getBookmarks(): Promise<Array<{url:string;title:string}>>; addBookmark(url:string,title:string): Promise<boolean>; getHistory(): Promise<Array<{url:string;title:string;visitedAt:number}>>;
      getPreferences(): Promise<{searchEngine:'google'|'duckduckgo'|'bing'}>; setSearchEngine(value:'google'|'duckduckgo'|'bing'): Promise<boolean>;
      inspect(): Promise<string>; devtools(): Promise<void>; openExternal(url:string): Promise<void>;
      onTabs(callback:(tabs: Array<{id:string;title:string;url:string;loading:boolean;canGoBack:boolean;canGoForward:boolean;private:boolean}>,activeId:string|null)=>void):()=>void;
      onDownload(callback:(item:{filename:string;url:string;received:number;total:number;state:string})=>void):()=>void;
      onFocusAddress(callback:()=>void):()=>void;
    }
  }
}
