import { createStubInstance, SinonStubbedInstance, StubbableType, SinonStubbedMember, stub } from "sinon"

export type StubbedClass<T> = SinonStubbedInstance<T> & T;

export function createSinonStubInstance<T>(
    constructor: StubbableType<T>,
    overrides?: { [K in keyof T]?: SinonStubbedMember<T[K]> },
): StubbedClass<T> {
    const stub = createStubInstance<T>(constructor, overrides);
    return stub as unknown as StubbedClass<T>;
}

export function createStubCommandStation() {
    const commandBatch = {
        setLocomotiveSpeed: stub(),
        commit: stub().returns(Promise.resolve())
    };

    return {
        lastCommandBatch: commandBatch,
        beginCommandBatch: stub().returns(Promise.resolve(commandBatch))
    }
}