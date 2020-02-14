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

    const constructor = _pages.get(ev.state ? ev.state.path : "/index.ts");
    _currentPage = constructor.create();
    document.getElementById("contentArea").appendChild(_currentPage.content);
    _currentPage.onEnter(ev.state ? ev.state.state : null);
}

export class Navigator {
    static registerPage(pageConstructor: IPageConstructor) {
        _pages.set(pageConstructor.path, pageConstructor);
    }

    static open(path: string): Page {
        const constructor = _pages.get(path);

        if (_currentPage) {
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
        _currentPage = constructor.create();

        _currentPage.content.classList.add("page");
        document.getElementById("contentArea").appendChild(_currentPage.content);
        _currentPage.onEnter(null);

        return _currentPage;
    }

    static back() {
        history.back();
    }

    static get currentPage(): Page {
        return _currentPage;
    }
}