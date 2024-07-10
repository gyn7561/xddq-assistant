import WebSocket from "ws";
import schedule from "node-schedule";
import logger from "../utils/logger.js";
import { toHexString } from "../utils/convert.js";
import { parse } from "./messages.js";
import { handleServerMessage } from "../handler/handler.js";
import { TaskManager } from "./tasks.js";
import { ProtobufMgr } from './protobufMgr.js';
import { DBMgr } from './dbMgr.js';
import agenda from "../handler/agenda.js";

class WebSocketManager {
    constructor() {
        this.filteredMsgIds = [
            1, // 玩家登录
            101, // 玩家信息
            104, // VIP信息
            201, // 当前玩家Attribute
            205, // 树升级
            206, // 树升级加速
            207, // 树升级信息
            203, // 处理装备
            209, // 处理装备
            210, // 小青蛙
            215, // 分身数据获取
            301, // 背包数据
            651, // 仙友自动游历
            1051, // 福地数据同步
            1052, // 别人福地数据
            1053, // 福地管理
            1058, // 福地探寻
            1059, // 福地探寻刷新
            1060, // 福地派遣鼠宝
            1061, // 福地派遣鼠宝预览
            1062, // 同步有奖励消息
            1064, // 同步福地数据
            1065, // 福地获取奖励
            4808, // 自动收获礼物
            402, // 关卡挑战结果
            403, // 关卡挑战初始信息
            5602,//真火
        ];
        this.headers = {
            Connection: "Upgrade",
            Upgrade: "websocket",
            Origin: "https://proxy-xddq.hdnd01.com",
        };
        // this.reconnectInterval = 60 * 1000; // 默认重连时间为60秒
        // this.maxReconnectAttempts = 3;      // 最大重连次数
        // this.reconnectAttempts = 0;         // 当前重连次数
        this.uri = null;
    }

    static get instance() {
        if (!this._instance) {
            this._instance = new WebSocketManager();
        }
        return this._instance;
    }

    async initialize(uri) {
        this.uri = uri;
        const protobufMgr = ProtobufMgr.instance;
        await protobufMgr.initAllMsgData();

        const dbMgr = DBMgr.instance;
        await dbMgr.initialize();

        this.connect();

        // // Restart the WebSocket connection at 00:00:30 every day
        // schedule.scheduleJob('30 0 0 * * *', this.restartConnection.bind(this));
    }

    connect() {
        // if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        //     logger.error(`Reached maximum reconnect attempts (${this.maxReconnectAttempts}). No longer attempting to reconnect.`);
        //     return;
        // }

        this.ws = new WebSocket(this.uri, { headers: this.headers });
        this.ws.on("open", this.handleOpen.bind(this));
        this.ws.on("message", this.handleMessage.bind(this));
        this.ws.on("close", this.handleClose.bind(this));
        this.ws.on("error", this.handleError.bind(this));
    }

    async handleOpen() {
        logger.info("WebSocket connection opened");

        try {
            await TaskManager.instance.init(this.ws);
            agenda(); // Some tasks need to be scheduled
        } catch (error) {
            logger.error(`Error processing task: ${error.message}`);
        }
    }

    async handleMessage(data) {
        try {
            const { msgId, _, body } = await parse(toHexString(data), false);
            if (this.filteredMsgIds.includes(msgId)) {
                logger.debug(`[Server] ${msgId} ${JSON.stringify(body, null, 2)}`);
                handleServerMessage(msgId, body);
            }
        } catch (error) {
            logger.error(`Error parsing message: ${error.message} ${toHexString(data)}`);
        }
    }

    handleClose() {
        logger.info("WebSocket connection closed");
        // this.reconnectAttempts++;
        // setTimeout(() => {
        //     logger.info(`Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        //     this.connect();
        // }, this.reconnectInterval);
    }

    handleError(err) {
        logger.error(`WebSocket error: ${err}`);
    }

    // async restartConnection() {
    //     logger.info("Restarting WebSocket connection as scheduled...");
    //     if (this.ws) {
    //         this.ws.close(); // 关闭现有连接
    //     }
    //     this.connect();      // 重新连接
    // }
}

export default WebSocketManager;
