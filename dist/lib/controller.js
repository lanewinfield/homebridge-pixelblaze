"use strict";
// Most of this code is directly from https://github.com/simap/Firestorm
// Which is unlicensed.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const WebSocket = require("ws");
const _ = __importStar(require("lodash"));
const PacketType = {
    SAVEPROGRAMSOURCEFILE: 1,
    CODEDATA: 3,
    THUMBNAILJPG: 4,
    PREVIEWFRAME: 5,
    SOURCESDATA: 6,
    PROGRAMLIST: 7,
    PIXELMAP: 8,
};
const PacketFrameFlags = {
    START: 1,
    CONTINUE: 2,
    END: 4,
};
const PROPFIELDS = [
    'ver',
    'fps',
    'exp',
    'vmerr',
    'mem',
    'pixelCount',
    'ledType',
    'dataSpeed',
    'colorOrder',
    'buferType',
    'sequenceTimer',
    'sequencerEnable',
    'brightness',
    'name',
    'vars',
];
class PixelBlazeController {
    constructor(props, log) {
        this.partialList = [];
        this.lastSeen = 0;
        this.log = log;
        this.props = props || {};
        this.command = {};
    }
    start() {
        this.connect();
    }
    stop() {
        try {
            if (this.client) {
                this.client.terminate();
            }
        }
        catch (err) {
            // pass
        }
        clearTimeout(this.reconnectTimeout);
    }
    connect() {
        if (this.client && this.client.readyState === WebSocket.CONNECTING) {
            return;
        }
        this.stop();
        this.log.debug(`Connecting to Pixelblaze at ${this.props.address}:81...`);
        try {
            this.client = new WebSocket(`ws://${this.props.address}:81`);
            this.client.binaryType = 'arraybuffer';
            this.client.on('open', this.handleConnect.bind(this));
            this.client.on('close', this.handleClose.bind(this));
            this.client.on('message', this.handleMessage.bind(this));
            this.client.on('pong', this.handlePong.bind(this));
            this.client.on('error', (err) => {
                this.log.warn('WebSocket error:', err.message || err);
                this.scheduleReconnect();
            });
        }
        catch (err) {
            this.log.error('Failed to create WebSocket:', err);
            this.scheduleReconnect();
        }
    }
    scheduleReconnect() {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
    }
    handleConnect() {
        this.log.info(`Connected to Pixelblaze at ${this.props.address}`);
        this.lastSeen = new Date().getTime();
        clearTimeout(this.reconnectTimeout);
        // console.log(`In handleConnect: ${this.constructor['name']}`);
        // console.log(`In handleConnect: ${this.sendFrame}`);
        this.sendFrame({
            getConfig: true,
            listPrograms: true,
            sendUpdates: false,
            ...this.command,
        });
    }
    handleClose() {
        this.log.warn(`Disconnected from Pixelblaze at ${this.props.address}, reconnecting...`);
        this.scheduleReconnect();
    }
    handleMessage(msg) {
        this.lastSeen = new Date().getTime();
        const props = this.props;
        if (typeof msg === 'string') {
            // this.log.debug(`data from ${this.props.id} at ${this.props.address}`, typeof msg, msg);
            try {
                _.assign(this.props, _.pick(JSON.parse(msg), PROPFIELDS));
            }
            catch (err) {
                this.log.error('Problem parsing packet', err);
            }
        }
        else {
            const buf = new Uint8Array(msg);
            if (buf.length < 1) {
                return;
            }
            const type = buf[0];
            switch (type) {
                case PacketType.PREVIEWFRAME: {
                    break;
                }
                case PacketType.THUMBNAILJPG: {
                    break;
                }
                case PacketType.SOURCESDATA: {
                    break;
                }
                case PacketType.PROGRAMLIST: {
                    const data = buf.slice(2);
                    const flags = buf[1];
                    if (flags & PacketFrameFlags.START) {
                        this.partialList = [];
                    }
                    const text = Buffer.from(data).toString('utf8');
                    const lines = text.split('\n');
                    const programs = _.map(_.filter(lines), (line) => {
                        const bits = line.split('\t');
                        return { id: bits[0], name: bits[1] };
                    });
                    this.partialList = this.partialList.concat(programs);
                    if (flags & PacketFrameFlags.END) {
                        props.programList = this.partialList;
                        // this.log.debug("received programs", props.id, props.programList);
                    }
                    break;
                }
            }
        }
    }
    ping() {
        const isDisconnected = this.client && this.client.readyState !== WebSocket.OPEN;
        if (!isDisconnected && this.client) {
            this.client.ping();
        }
    }
    isAlive() {
        const now = new Date().getTime();
        return now - this.lastSeen < 5000 && this.client && this.client.readyState !== WebSocket.CLOSED;
    }
    handlePong() {
        this.lastSeen = new Date().getTime();
    }
    setCommand(command) {
        // eslint-disable-next-line prefer-const
        let { programName, ...rest } = command;
        if (programName) {
            rest = rest || {};
            const program = _.find(this.props.programList, { name: programName });
            if (program) {
                rest.activeProgramId = program.id;
            }
            command = rest; //replace command with fixed version
        }
        // See if those keys values are different.
        const keys = _.keys(command);
        if (_.isEqual(_.pick(command, keys), _.pick(this.command, keys))) {
            return;
        }
        _.assign(this.command, command);
        this.sendFrame(command);
    }
    reload() {
        this.sendFrame({ getConfig: true, getVars: true, listPrograms: true });
    }
    sendFrame(o) {
        const frame = JSON.stringify(o);
        const isDisconnected = this.client && this.client.readyState !== this.client.OPEN;
        this.log.debug(isDisconnected
            ? 'wanted to send'
            : `sending to ${this.props.id} at ${this.props.address}`, frame);
        if (isDisconnected || !this.client) {
            return;
        }
        this.client.send(frame);
    }
}
exports.default = PixelBlazeController;
//# sourceMappingURL=controller.js.map