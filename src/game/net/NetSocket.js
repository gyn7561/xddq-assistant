import WebSocket from "ws";
import logger from "#utils/logger.js";

const NetState = {
    NET_CONNECT: 1,
    NET_CLOSE: 2,
    NET_ERROR: 3
};

const WSState = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
};

class NetSocket {
    constructor() {
        this.sioIndex = 0;
        this.url = "";
        // Sio and state
        this.sio = null;
        this.connected = false;
        this.isConnecting = false;
        this.isReConnecting = false;
        this.clearSio = false;
        this.isOnClose = false;
        this.netCallback = null;
        // Msg
        this.msgQueue = [];
        this.isReadingMsgData = false;
        // Heartbeat
        this.heartbeatFlag = false;
        this.heartbeatTimeId = null;
        this.heartbeatInterval = 5000;
    }

    initWithUrl(url) {
        this.url = url;
    }

    addHandler(ping, parseArrayBuffMsg) {
        this.ping = ping;
        this.parseArrayBuffMsg = parseArrayBuffMsg;
    }

    getIsReConnecting() {
        return this.isReConnecting;
    }

    connect(callback) {
        if (this.isConnecting) {
            logger.info("[WebSocket] 正在连接中请稍候!!!!!");
            return;
        }

        if (!this.url) return;

        if (this.sio && this.sio.readyState === WSState.OPEN) {
            this.sio.close();
        }

        // 更新状态
        this.connected = false;
        this.isConnecting = true;
        this.isOnClose = false;

        if (callback) {
            this.netCallback = callback;
        }

        this.sio = new WebSocket(this.url);

        this.sio.onopen = (event) => {
            // 更新状态
            this.connected = true;
            this.isConnecting = false;
            if (this.netCallback) {
                this.netCallback(NetState.NET_CONNECT, event);
            }
            this.msgQueue = [];
        };

        this.sio.onmessage = (event) => {
            const data = event.data;
            this.sizeOfResv += data.size;
            if (data && data !== "null") {
                this.msgQueue.push(data);
                this.readNextMsgData();
            } else {
                const arrayBuffer = new Uint8Array(event.data);
                if (this.parseArrayBuffMsg) this.parseArrayBuffMsg(arrayBuffer);
            }
        };        

        this.sio.onclose = (event) => {
            setTimeout(() => {
                logger.debug("[WebSocket] 连接关闭");
                this.connected = false;
                this.isConnecting = false;
                if (this.sio) {
                    if (this.clearSio) {
                        this.sio.onopen = null;
                        this.sio.onmessage = null;
                        this.sio.onclose = null;
                        this.sio.onerror = null;
                        this.sio = null;
                        this.clearSio = false;
                    }
                    if (this.netCallback) {
                        this.netCallback(NetState.NET_CLOSE, event);
                    }
                }
            }, 100);
            this.isOnClose = true;
        };

        this.sio.onerror = (event) => {
            logger.debug("[WebSocket] 连接出错");
            this.connected = false;
            this.isConnecting = false;
            if (this.netCallback) {
                this.netCallback(NetState.NET_ERROR, event);
            }
        };
        logger.info("[WebSocket] 开始连接");
    }

    reConnect() {
        this.isReConnecting = true;
        this.connect();
    }

    close() {
        if (this.connected) {
            if (this.sio) {
                this.clearSio = true;
                this.sio.close();
            }
            this.connected = false;
            return;
        }
    }

    sendMsg(msg) {
        const buffer = new ArrayBuffer(msg.streamsize);
        new Uint8Array(buffer).set(new Uint8Array(msg.buff).subarray(0, msg.streamsize), 0);
        this.send(buffer);
    }

    isConnected() {
        return this.connected;
    }

    heartbeatStart() {
        if (!this.heartbeatFlag) {
            this.heartbeatFlag = true;
            if (this.heartbeatTimeId !== null) {
                clearInterval(this.heartbeatTimeId);
                this.heartbeatTimeId = null;
            }
            this.heartbeatTimeId = setInterval(() => {
                if (this.sio && this.connected) {
                    if (this.ping) this.ping();
                }
            }, this.heartbeatInterval);
        }
    }

    send(buffer) {
        try {
            if (this.sio && this.sio.readyState === WSState.OPEN) {
                this.sio.send(buffer);
            }
        } catch (err) {
            logger.debug(`[Message] errMsg:[${err.message}],msgData=[${JSON.stringify(buffer)}]`);
        }
    }

    readNextMsgData() {
        if (!this.isReadingMsgData && this.msgQueue && this.msgQueue.length > 0) {
            this.isReadingMsgData = true;
            const msgData = this.msgQueue.shift();  // 使用 shift 而不是 splice
            const parseMessage = (data) => {
                try {
                    const arrayBuffer = new Uint8Array(data);
                    if (this.parseArrayBuffMsg) this.parseArrayBuffMsg(arrayBuffer);
                    this.isReadingMsgData = false;
                    this.readNextMsgData();
                } catch (err) {
                    this.isReadingMsgData = false;
                    logger.error(`[Message] Error parsing message: ${err.message}`);
                }
            };
            parseMessage(msgData);
        }
    }    
}

NetSocket.BYTES_OF_MSG_HEADER = 18;
NetSocket.MSG_DATA_LENGTH = 256;
NetSocket.HEADER = 29099;

export { NetSocket, WSState, NetState };
