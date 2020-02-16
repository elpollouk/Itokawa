export abstract class Page {
    readonly abstract path: string;
    readonly abstract content: HTMLElement;

    onEnter(previousState: any): void {}
    onLeave(): any {}
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
    create(): Page;
}

const _pages = new Map<string, IPageConstructor>();
let _currentPage: Page = null;
let _currentPageDepth = 0;

window.onpopstate = (ev: PopStateEvent) => {
    _currentPage.onLeave();
    const state = ev.state || {};
    _openPage(state.path, state.state, state.depth);
}

function _openPage(path: string, state: any, depth: number) {
    const newPage = _pages.get(path || "index").create();
    const content = newPage.content;
    content.classList.add("page");
    document.getElementById("contentArea").appendChild(content);
    newPage.onEnter(state);

    const oldPage = _currentPage;
    if (oldPage) {
        let startLeft = depth < _currentPageDepth ? "-100vw" : "100vw";
        let endLeft = depth < _currentPageDepth ? "100vw" : "-100vw";

        content.style.left = startLeft;
        window.requestAnimationFrame(() => {
            content.style.left = "0";
            oldPage.content.style.left = endLeft;
            // We have to wait on the transition on the new content as for some
            // reason, it doesn't fire for the old page.
            content.ontransitionend = () => oldPage.destroy();
        });
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

    static open(path: string): Page {
        if (path[0] === "#") path = path.substr(1);
        if (_currentPage) {
            if (path === _currentPage.path) return;

            const state = _currentPage.onLeave();
            history.replaceState({
                path: _currentPage.path,
                state: state,
                depth: _currentPageDepth
            }, document.title, "#" + _currentPage.path);
            _currentPageDepth++;
            history.pushState({
                path: path,
                state: null,
                depth: _currentPageDepth
            }, document.title, "#" + path);
        }

        _openPage(path, null, _currentPageDepth);
        return _currentPage;
    }

    static back() {
        history.back();
    }

    static get currentPage(): Page {
        return _currentPage;
    }
}