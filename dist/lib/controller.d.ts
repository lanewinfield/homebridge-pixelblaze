import type { Logger } from 'homebridge';
export default class PixelBlazeController {
    private log;
    private command;
    private partialList;
    private lastSeen;
    private reconnectTimeout;
    private client;
    readonly props: any;
    constructor(props: any, log: Logger);
    start(): void;
    stop(): void;
    connect(): void;
    handleConnect(): void;
    handleClose(): void;
    handleMessage(msg: ArrayBufferLike): void;
    ping(): void;
    isAlive(): boolean | undefined;
    handlePong(): void;
    setCommand(command: any): void;
    reload(): void;
    sendFrame(o: any): void;
}
//# sourceMappingURL=controller.d.ts.map