export abstract class Page {
    readonly abstract path: string;
    readonly abstract content: HTMLElement;

    onEnter(previousState: any): void {}
    onLeave(): any {}
    close(): void {
        Navigator.back();
    }
};

export interface IPageConstructor {
    readonly path: string;
    create(): Page;
}

const _pages = new Map<string, IPageConstructor>();
let _currentPage: Page = null;

window.onpopstate = (ev: PopStateEvent) => {
    _currentPage.onLeave();
    _currentPage.content.parentNode.removeChild(_currentPage.content);
    const state = ev.state || {};
    _openPage(state.path, state.state);
}

function _openPage(path: string, state: any) {
    _currentPage = _pages.get(path || "index").create();
    document.getElementById("contentArea").appendChild(_currentPage.content);
    _currentPage.onEnter(state);
}

export class Navigator {
    static registerPage(pageConstructor: IPageConstructor) {
        _pages.set(pageConstructor.path, pageConstructor);
    }

    static open(path: string): Page {
        if (_currentPage) {
            if (path === _currentPage.path) return;

            const state = _currentPage.onLeave();
            history.replaceState({
                path: _currentPage.path,
                state: state
            }, document.title);
            history.pushState({
                path: path,
                state: null
            }, document.title);
            _currentPage.content.parentNode.removeChild(_currentPage.content);
        }

        _openPage(path, null);
        return _currentPage;
    }

    static back() {
        history.back();
    }

    static get currentPage(): Page {
        return _currentPage;
    }
}