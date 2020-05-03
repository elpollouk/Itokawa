import { createStubInstance, SinonStubbedInstance, StubbableType, SinonStubbedMember, stub } from "sinon"
import { ICommandBatch, ICommandStation } from "../devices/commandStations/commandStation";

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
        setLocomotiveFunction: stub(),
        writeRaw: stub(),
        commit: stub().returns(Promise.resolve())
    } as ICommandBatch;

    return {
        lastCommandBatch: commandBatch,
        beginCommandBatch: stub().returns(Promise.resolve(commandBatch))
    };
}