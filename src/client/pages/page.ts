export abstract class Page {
    readonly abstract path: string;
    readonly abstract content: HTMLElement;

    onEnter(): void {}
    onLeave(): void {}
    close(): void {
        Navigator.back();
    }
    destroy(): void {
        if (this.content.parentElement)
            this.content.parentElement.removeChild(this.content);
    }
};

export interface IPageConstructor {
    readonly path: string;
    create(params?: any): Page;
}

const ROOT_PAGE = "index";
const _pages = new Map<string, IPageConstructor>();
let _currentPage: Page = null;
let _currentPageDepth = 0;

window.onpopstate = (ev: PopStateEvent) => {
    _currentPage.onLeave();
    const state = ev.state || {};
    _openPage(state.path, state.params, state.depth);
}

function _openPage(path: string, params: any, depth: number) {
    depth = depth || 0;
    const newPage = _pages.get(path || ROOT_PAGE).create(params);
    const content = newPage.content;
    content.classList.add("page");
    document.getElementById("contentArea").appendChild(content);
    newPage.onEnter();

    const oldPage = _currentPage;
    if (oldPage) {
        let startLeft = depth < _currentPageDepth ? "-120vw" : "120vw";
        let endLeft = depth < _currentPageDepth ? "120vw" : "-120vw";

        content.style.left = startLeft;
        oldPage.content.style.left = "0";
        // I've tried using requestAnimation frame for this, but it seems like we need at least two
        // frames in order for the transitions to take effect. 34ms is just over this time at 60fps.
        setTimeout(() => {
            content.style.left = "0";
            oldPage.content.style.left = endLeft;
            // We have to wait on the transition on the new content as for some
            // reason, it doesn't fire for the old page.
            content.ontransitionend = () => {
                oldPage.destroy();
                content.ontransitionend = null;
            }
        }, 34);
    }

    if (depth == 0)
        document.body.classList.add("rootPage");
    else
        document.body.classList.remove("rootPage");

    _currentPageDepth = depth;
    _currentPage = newPage;        
}

export class Navigator {
    static registerPage(pageConstructor: IPageConstructor) {
        _pages.set(pageConstructor.path, pageConstructor);
    }

    static open(path: string, params?: any): Page {
        if (path[0] === "#") path = path.substr(1);
        if (_currentPage) {
            if (path === _currentPage.path) return;

            _currentPage.onLeave();
            _currentPageDepth++;
            history.pushState({
                path: path,
                params: params,
                depth: _currentPageDepth
            }, document.title/*, "#" + path*/);
        }

        _openPage(path, params, _currentPageDepth);
        return _currentPage;
    }

    static replaceParams(params: any) {
        history.replaceState({
            path: _currentPage.path,
            params: params,
            depth: _currentPageDepth
        }, document.title/*, "#" + _currentPage.path*/);
    }

    static initalOpen() {
        const state = history.state;
        if (!state) {
            // There's no state held in the history, so open the root page as if it's a fresh boot
            //const path = location.hash || ROOT_PAGE;
            this.open(ROOT_PAGE);
            return;
        }
        // We found some state, so assume it's from a previous boot
        _openPage(state.path, state.params, state.depth);
    }

    static back() {
        history.back();
    }

    static get currentPage(): Page {
        return _currentPage;
    }
}