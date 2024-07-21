import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import account from "../../../account.js";

export default class ChapterMgr {
    constructor() {
        this.isProcessing = false;
        this.passStageId = 0;
        this.challenge = account.switch.challenge || 0;
        this.showResult = account.switch.showResult || false;
        LoopMgr.inst.add(this);
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new ChapterMgr();
        }
        return this._instance;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    SyncData(t) {
        this.isProcessing = true;
        this.passStageId = t.passStageId || 0;
        this.isProcessing = false;
    }

    challengeResult(t) {
        if (this.showResult) {
            if (t.ret === 0) {
                logger.info(`[冒险管理] ${t.challengeSuccess} 当前层数:${this.passStageId}`);
            }
        }
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            if (this.challenge == 0) {
                this.clear();
                logger.info("[冒险管理] 任务完成停止循环");
            } else {
                GameNetMgr.inst.sendPbMsg(Protocol.S_STAGE_CHALLENGE, {}, null);
                this.challenge--;
                await new Promise((resolve) => setTimeout(resolve, 1000 * 10));
            }

        } catch (error) {
            logger.error(`[冒险管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
