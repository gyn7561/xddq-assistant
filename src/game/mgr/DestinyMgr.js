import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import PlayerAttributeMgr from "#game/mgr/PlayerAttributeMgr.js";

export default class DestinyMgr {
    constructor() {
        this.isProcessing = false;

        LoopMgr.inst.add(this);
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new DestinyMgr();
        }
        return this._instance;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    SyncData(t) {
        this.power = t.playerDestinyDataMsg.power || 0;
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            if (this.power > 0) {
                logger.info(`[仙友管理] 进行游历`);
                // 一键游历 等级达到练虚 156级开启 
                GameNetMgr.inst.sendPbMsg(Protocol.S_DESTINY_TRAVEL, { isOneKey: PlayerAttributeMgr.realmsId >= 156 }, null);
            }
        } catch (error) {
            logger.error(`[仙友管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
