import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";

export default class CustomMgr {
    constructor() {
        this.CUSTOM_INTERVAL = 1000 * 60 * 10; // 每次间隔时间(10分钟)
        this.lastExecuteTime = 0;
        this.initialized = false;
        
        this.isProcessing = false;

        LoopMgr.inst.add(this);
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new CustomMgr();
        }
        return this._instance;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    init() { 
        if (!this.initialized) {
            logger.info("[自定义管理] 初始化");
            
            // 聚灵阵状态 TODO 判断是否开启聚灵阵
            GameNetMgr.inst.sendPbMsg(Protocol.S_GATHER_ENERGY_ENTER_NEW, {}, null);
            // 运势
            GameNetMgr.inst.sendPbMsg(Protocol.S_ACTIVITY_SHARE, { activityId: 0, conditionId: 0 }, null);
            GameNetMgr.inst.sendPbMsg(Protocol.S_ACTIVITY_BBS, { activityId: 0, conditionId: 0 }, null);
            GameNetMgr.inst.sendPbMsg(Protocol.S_ACTIVITY_GAME_CIRCLE, { activityId: 0, conditionId: 0 }, null);
            // 检查是否有分身
            GameNetMgr.inst.sendPbMsg(Protocol.S_ATTRIBUTE_GET_SEPARATION_DATAA_MSG_LIST_REQ, {}, null);
            this.initialized = true;
        }
    }

    customLoop() {
        const now = Date.now();
        if (now - this.lastExecuteTime >= this.CUSTOM_INTERVAL) {
            this.lastExecuteTime = now;
            // 进入宗门系统 TODO 判断是否开启宗门系统
            GameNetMgr.inst.sendPbMsg(Protocol.S_PUPIL_ENTER, {}, null);
            GameNetMgr.inst.sendPbMsg(Protocol.S_PUPIL_TRAIN, { isOneKey: 1 }, null);
            // 仙宫外部数据请求 TODO 判断是否开启仙宫
            GameNetMgr.inst.sendPbMsg(Protocol.S_PALACE_ENTER_OUTER, {}, null);
        }    
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            this.customLoop();
        } catch (error) {
            logger.error(`[自定义管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
