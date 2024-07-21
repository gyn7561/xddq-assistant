import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import account from "../../../account.js";

export default class SecretTowerMgr {
    constructor() {
        this.isProcessing = false;
        this.challenge = account.switch.challenge || 0;
        this.showResult = account.switch.showResult || false;
        LoopMgr.inst.add(this);
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new SecretTowerMgr();
        }
        return this._instance;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    SyncData(t) {
        logger.debug("[真火秘境管理] 初始化");
    }

    challengeResult(t) {
        if (this.showResult) {
            if (t.ret === 0) {
                logger.info(`[真火秘境管理] ${t.allBattleRecord.isWin} 当前层数:${t.info.floor}`);
            }
        }
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            if (this.challenge == 0) {
                this.clear();
                logger.info("[真火秘境管理] 任务完成停止循环");
            } else {
                GameNetMgr.inst.sendPbMsg(Protocol.S_SECRETTOWER_FIGHT, {type: 1 }, null);
                this.challenge--;
                await new Promise((resolve) => setTimeout(resolve, 1000 * 10));
            }

        } catch (error) {
            logger.error(`[真火秘境管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
