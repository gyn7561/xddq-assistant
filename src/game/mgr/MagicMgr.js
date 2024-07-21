import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";

export default class MagicMgr {
    constructor() {
        this.AD_REWARD_DAILY_MAX_NUM = 2;   // 每日最大领取次数
        this.AD_REWARD_CD = 1000;           // 每次间隔时间
        this.FREE_NUM = 1;                  // 免费抽奖次数
        this.isProcessing = false;

        LoopMgr.inst.add(this);
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new MagicMgr();
        }
        return this._instance;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    checkReward(t) {
        this.isProcessing = true;
        this.getAdRewardTimes = t.magicFreeAd.freeTimes  || 0;
        this.lastAdRewardTime = t.magicFreeAd.lastAdTime || 0;
        this.freeDrawTimes = t.freeDrawTimes || 0;
        this.isProcessing = false;
    }

    processReward() {
        const now = Date.now();
        if (this.getAdRewardTimes < this.AD_REWARD_DAILY_MAX_NUM && now - this.lastAdRewardTime >= this.AD_REWARD_CD) {
            logger.info(`[神通管理] 还剩 ${this.AD_REWARD_DAILY_MAX_NUM - this.getAdRewardTimes} 次广告激励`);
            GameNetMgr.inst.sendPbMsg(Protocol.S_MAGIC_DERIVATION, { times: 1, isAd: true, isUseADTime: false }, null);
            this.getAdRewardTimes++;
            this.lastAdRewardTime = now;
        }

        if (this.freeDrawTimes < this.FREE_NUM) {
            logger.info(`[神通管理] 还剩 ${this.FREE_NUM - this.freeDrawTimes} 次免费次数`);
            GameNetMgr.inst.sendPbMsg(Protocol.S_MAGIC_DERIVATION, { times: 1 }, null);
            this.freeDrawTimes++;
        }
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            if (this.getAdRewardTimes >= this.AD_REWARD_DAILY_MAX_NUM && this.freeDrawTimes >= this.FREE_NUM) {
                this.clear();
                logger.info("[神通管理] 达到每日最大领取次数，停止奖励领取");
            } else {
                this.processReward();
            }
        } catch (error) {
            logger.error(`[神通管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
