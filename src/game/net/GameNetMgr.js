
import async from 'async';

import Protocol from '#game/net/Protocol.js';
import { Stream } from '#game/net/Stream.js';
import { ProtobufMgr } from '#game/net/ProtobufMgr.js';
import { NetSocket, NetState } from '#game/net/NetSocket.js';

import logger from "#utils/logger.js";
import MsgRecvMgr from '#game/common/MsgRecvMgr.js';
import LoopMgr from '#game/common/LoopMgr.js';

class GameNetMgr {
    constructor() {
        this.token = null;
        this.playerId = null;
        // Server
        this.net = new NetSocket();
        this.isLogined = false;
        this._closed = false;
        // Restart
        this.maxReconnectNum = 2;
        this.reConnectTimes = 0;
        this.isReconnectNum = 0;
        // handlers
        this.handlers = {};
        // Msg
        this.sendMsgLength = 0;
    }

    static get inst() {
        if (this._instance == null) {
            this._instance = new GameNetMgr();
        }
        return this._instance;
    }

    connectGameServer(url, playerId, token) {
        this.playerId = playerId;
        this.token = token;

        this._closed = false;
        this.net.initWithUrl(url);
        this.net.addHandler(this.ping.bind(this), this.parseArrayBuffMsg.bind(this));

        this.net.connect(this.netStateChangeHandler.bind(this));
        this.isLogined = true;

        // 开始心跳
        GameNetMgr.inst.net.heartbeatStart();
        // 开始循环任务
        LoopMgr.inst.start()
    }

    netStateChangeHandler(state) {
        this.netConnState = state;

        switch (this.netConnState) {
            case NetState.NET_CONNECT:
                this.netConnectHandler();
                break;
            case NetState.NET_CLOSE:
                this.netCloseHandler();
                break;
            case NetState.NET_ERROR:
                this.netErrorHandler();
                break;
        }
    }

    netConnectHandler() {
        this._closed = false;
        this.reConnectTimes = 0;
        this.isReconnectNum = 0;
        this.login();
        logger.info("[WebSocket] 连接成功");
    }

    netCloseHandler() {
        logger.error("[WebSocket] 已断开连接");
        if (!this._closed) {
            this.reConnectTimes += 1;
            if (this.reConnectTimes <= 100) this.reConnect();
        }
    }

    netErrorHandler() {
        logger.error("[WebSocket] 连接错误");
        this.reConnect();
    }

    reConnect() {
        if (!this._closed) {

            async.waterfall([
                (callback) => {
                    if (this.isReconnectNum < this.maxReconnectNum) {
                        const delay = 1000 * this.isReconnectNum;
                        this.isReconnectNum++;
                        setTimeout(() => {
                            logger.warn("[WebSocket] 开始重连");
                            GameNetMgr.inst.net.reConnect();
                            GameNetMgr.inst.handlers = {};
                            callback(null, true);
                        }, delay);
                    } else {
                        callback(null, false);
                    }
                },
                (isReconnected, callback) => {
                    if (isReconnected) {
                        callback(null, isReconnected, false);
                    } else {
                        logger.error("[WebSocket] 重连超过次数");
                    }
                },
                (isReconnected, callback) => {
                    if (!isReconnected) {
                        this.isReconnectNum = 0;
                        this.close();
                    }
                    callback();
                }
            ], (err) => {
                if (err) console.error(err);
            });
        }
    }

    login() {
        const loginData = {
            token: this.token,
            language: "zh_cn"
        };
        this.sendPbMsg(Protocol.S_PLAYER_LOGIN, loginData, null);
    }

    ping() {
        this.sendPbMsg(Protocol.S_PLAYER_PING, null, null);
    }

    addHandler(msgId, handler) {
        this.handlers[msgId] = (data) => {
            if (msgId !== "disconnect" && typeof data === "string") {
                data = JSON.parse(data);
            }
            handler(data);
        };
    }

    sendPbMsg(msgId, msgData, callback, extraCmd) {
        if (!this.net.isConnected()) {
            return;
        }

        // Create a new message stream
        const stream = new Stream();
        stream.init(msgId, +this.playerId, NetSocket.BYTES_OF_MSG_HEADER + NetSocket.MSG_DATA_LENGTH, true);
        stream.writeShort(NetSocket.HEADER);
        stream.writeInt(50);
        stream.writeInt(msgId);
        stream.writeLong(this.playerId);

        if (stream.pbMsg) {
            const body = stream.pbMsg.encode(msgData).finish();
            stream.writeBytes(body, 18);
        }

        stream.writeInt(stream.offset, 2);
        // parseSendData
        const t = new Uint8Array(stream.offset);
        t.set(stream.buff.subarray(0, stream.offset));
        stream.buff = t;
        stream.streamsize = stream.offset;

        // Add handler
        const protoCmd = ProtobufMgr.inst.cmdList[msgId];
        if (callback && this.net.isConnected()) {
            this.addHandler(protoCmd.smMsgId, callback);
        }

        if (extraCmd && ProtobufMgr.inst.cmdList[extraCmd]) {
            this.addHandler(extraCmd, callback);
        }

        this.net.sendMsg(stream);
    }

    parseArrayBuffMsg(arrayBuffer) {
        try {
            const stream = new Stream();
            stream.initByBuff(arrayBuffer, NetSocket.BYTES_OF_MSG_HEADER);
            stream.readShort();
            const length = stream.readInt();
            const msgId = stream.readInt();

            const protoMsg = ProtobufMgr.inst.getMsg(msgId, false, true);
            const msgBody = new Uint8Array(arrayBuffer.subarray(NetSocket.BYTES_OF_MSG_HEADER, length));

            if (protoMsg) {
                const parsedMsg = protoMsg.decode(msgBody);
                // logger.info(`msgId: ${msgId} ${JSON.stringify(parsedMsg)}`);
                this.resvHandler(msgId, parsedMsg);
            }
        } catch (error) {
            logger.debug(`[未知协议] ${this.toHexString(new Uint8Array(arrayBuffer))}`);
        }
    }

    toHexString = (bytes) => {
        let hex = [];
        for (let i = 0; i < bytes.length; i++) {
            let current = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
            hex.push((current >>> 4).toString(16));
            hex.push((current & 0xf).toString(16));
        }
        return hex.join("");
    };

    resvHandler(msgId, msgData) {
        if (msgData) {
            if (msgId && this.handlers[msgId]) {
                const handler = this.handlers[msgId];
                delete this.handlers[msgId];
                handler.call(this, msgData);
            } else {
                const protoCmd = ProtobufMgr.inst.resvCmdList[msgId].smMethod.split(".");
                const method = protoCmd[protoCmd.length - 1];

                if (MsgRecvMgr[method]) {
                    logger.debug(`[Handler] 找到处理函数: ${method} msgId: ${msgId} ${JSON.stringify(msgData)}`);
                    MsgRecvMgr[method](msgData, msgId);
                } else {
                    logger.debug(`[Handler] 未找到处理函数: ${method}`);
                }
            }
        }
    }

    close() {
        this._closed = true;
        if (this.net) {
            this.net.close(true);
        };
        this.isReconnectNum = 0;
    }
}


export default GameNetMgr;
