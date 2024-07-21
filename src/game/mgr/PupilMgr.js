import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";

export default class PupilMgr {
    constructor() {
        this.AD_REWARD_DAILY_MAX_NUM = 2;   // 每日最大领取次数
        this.AD_REWARD_CD = 1000;           // 每次间隔时间
        this.isProcessing = false;

        LoopMgr.inst.add(this);
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new PupilMgr();
        }
        return this._instance;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    checkReward(t) {
        this.isProcessing = true;
        this.getAdRewardTimes = t.getTimes  || 0;
        this.lastAdRewardTime = 0;
        this.isProcessing = false;
    }

    countElementsWithoutPupilData(siteList) {
        return siteList.filter((site) => !site.hasOwnProperty("pupilData")).length;
    }
    
    getGraduationIndices(siteList) {
        return siteList
            .filter((site) => site.pupilData && site.trainTimeInfo && site.pupilData.level * 20 <= site.trainTimeInfo.trainTimes)
            .map((site) => site.index);
    }

    async checkGraduatation(t) {
        if (t.ret === 0) {
            // 判断是否可以招人
            const invitationCount = this.countElementsWithoutPupilData(t.siteList);
            if (invitationCount > 0) {
                logger.info(`[宗门管理] 招 ${invitationCount} 人`);
                for (let i = 0; i < invitationCount; i++) {
                    GameNetMgr.inst.sendPbMsg(Protocol.S_PUPIL_RECRUIT, {}, null);
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
            }
    
            // 判断是否可以出师
            const graduationIndices = this.getGraduationIndices(t.siteList);
            if (graduationIndices.length > 0) {
                logger.info(`[宗门管理] 出师 ${graduationIndices.length} 人`);
                for (let i = 0; i < graduationIndices.length; i++) {
                    GameNetMgr.inst.sendPbMsg(Protocol.S_PUPIL_GRADUATE, { siteIndex: graduationIndices[i] }, null);
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    GameNetMgr.inst.sendPbMsg(Protocol.S_PUPIL_RECRUIT, {}, null);
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
            }
        }
    }

    processReward() {
        const now = Date.now();
        if (this.getAdRewardTimes < this.AD_REWARD_DAILY_MAX_NUM && now - this.lastAdRewardTime >= this.AD_REWARD_CD) {
            logger.info(`[宗门管理] 还剩 ${this.AD_REWARD_DAILY_MAX_NUM - this.getAdRewardTimes} 次广告激励`);
            GameNetMgr.inst.sendPbMsg(Protocol.S_PUPIL_GET_AD_REWARD, { isUseADTime: false }, null);
            this.getAdRewardTimes++;
            this.lastAdRewardTime = now;
        }
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            if (this.getAdRewardTimes >= this.AD_REWARD_DAILY_MAX_NUM) {
                this.clear();
                logger.info("[宗门管理] 达到每日最大领取次数，停止奖励领取");
            } else {
                this.processReward();
            }
            // TODO: 自动检查能量 毕业弟子
        } catch (error) {
            logger.error(`[宗门管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
