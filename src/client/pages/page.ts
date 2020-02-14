export abstract class Page {
    readonly abstract path: string;
    readonly abstract content: HTMLElement;

    onenter(previousState: any): void {}
    onleave(): any {}
    close(): void {
        Navigator.back();
    }
    destroy(): void {}
};

export interface IPageConstructor {
    readonly path: string;
    create(): Page;
}

const _pages = new Map<string, IPageConstructor>();
const _history: Page[] = [];

window.onpopstate = (ev: PopStateEvent) => {
    if (_history.length <= 1) throw new Error("Already at root page");
    const oldPage = _history.pop();
    const newPage = _history[_history.length - 1];
    oldPage.onleave();

    oldPage.content.parentNode.removeChild(oldPage.content);
    document.getElementById("contentArea").appendChild(newPage.content);
    
    newPage.onenter(ev.state);
    oldPage.destroy();
}

export class Navigator {
    static registerPage(pageConstructor: IPageConstructor) {
        _pages.set(pageConstructor.path, pageConstructor);
    }

    static open(path: string): Page {
        const constructor = _pages.get(path);
        const page = constructor.create();
        if (!page) return null;

        if (_history.length !== 0) {
            const oldPage = _history[_history.length - 1];
            const state = oldPage.onleave();
            history.pushState(state, document.title);
            oldPage.content.parentNode.removeChild(oldPage.content);
        }
        _history.push(page);

        page.content.classList.add("page");
        document.getElementById("contentArea").appendChild(page.content);
        page.onenter(null);

        return page;
    }

    static back() {
        history.back();
    }

    static get currentPage(): Page {
        return _history[_history.length - 1];
    }
}