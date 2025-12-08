"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const controller_1 = __importDefault(require("./controller"));
const udp = __importStar(require("dgram"));
const discoveries = {};
const PacketTypes = {
    BEACONPACKET: 42,
    TIMESYNC: 43,
};
/**
 * Try to find a Pixelblaze controller on the network.
 * @param log
 * @param foundControllerCallback
 */
function discover(log, foundControllerCallback) {
    const discoveryFunction = () => {
        const host = '0.0.0.0';
        const port = 1889;
        const server = udp.createSocket({ type: 'udp4', reuseAddr: true });
        server.on('listening', () => {
            const address = server.address();
            log.debug('Pixelblaze Discovery Server listening on ' + address.address + ': ' + address.port);
        });
        // From the Firestorm source: app/discovery.js
        server.on('message', (message, remote) => {
            if (message.length < 12) {
                return;
            }
            const header = {
                packetType: message.readUInt32LE(0),
                senderId: message.readUInt32LE(4),
                senderTime: message.readUInt32LE(8),
            };
            const now = new Date().getTime();
            const now32 = now % 0xffffffff; // 32 bits of milliseconds
            switch (header.packetType) {
                case PacketTypes.BEACONPACKET: {
                    // log.debug(
                    //   'BEACONPACKET from ' + remote.address + ':' + remote.port + ' id: ' + header.senderId +
                    //  ' senderTime: ' + header.senderTime + ' delta: ' + (now32 - header.senderTime),
                    // );
                    // Record this device and fire up a controller.
                    const record = (discoveries[header.senderId] =
                        discoveries[header.senderId] || {});
                    record.lastSeen = now;
                    record.address = remote.address;
                    record.port = remote.port;
                    if (!record.controller) {
                        record.controller = new controller_1.default({
                            id: header.senderId,
                            address: remote.address,
                        }, log);
                        // Start the WebSocket connection, which will fetch the current state/config.
                        record.controller.start();
                        clearInterval(broadcastIntervalId);
                        foundControllerCallback(record.controller);
                    }
                    // Reply with a timesync packet.
                    const sync = Buffer.alloc(20);
                    sync.writeUInt32LE(PacketTypes.TIMESYNC, 0);
                    sync.writeUInt32LE(889, 4); //sender ID,
                    sync.writeUInt32LE(now32, 8);
                    sync.writeUInt32LE(header.senderId, 12);
                    sync.writeUInt32LE(header.senderTime, 16);
                    server.send(sync, 0, sync.length, remote.port, remote.address, (err, res) => {
                        if (err) {
                            log.error(`${err}, ${res}`);
                        }
                    });
                    break;
                }
                case PacketTypes.TIMESYNC: {
                    break;
                }
                default: {
                    log.warn('Unknown packet type ' + header.packetType);
                }
            }
        });
        server.bind(port, host);
    };
    // Try every 15 seconds to discover.
    const broadcastIntervalId = setInterval(discoveryFunction, 15 * 1000);
    // But start immediately.
    log.info('Searching for Pixelblaze controllers...');
    discoveryFunction();
}
exports.default = discover;
//# sourceMappingURL=discovery.js.map