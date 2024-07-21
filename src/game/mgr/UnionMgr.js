import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import UserMgr from "#game/mgr/UserMgr.js";

export default class UnionMgr {
    constructor() {
        this.unionId = null;              // 妖盟ID
        this.memberNum = null;            // 妖盟成员数量
        this.memberList = null;           // 妖盟成员列表
        this.lastCheckTime = 0;           // 上次检查时间
        this.CHECK_CD = 1000 * 60 * 10;   // 每次间隔时间

        this.isProcessing = false;

        LoopMgr.inst.add(this);
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new UnionMgr();
        }
        return this._instance;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    collectPlayerData(data) {
        return data.map(member => ({
            userId: member.playerData.playerId,
            nickName: member.playerData.nickName
        }));
    }

    // 推送妖盟数据
    pushMyUnionDataBroadcast(t) {
        this.unionId = t.unionId || null;
        this.memberNum = t.memberNum || null;
        this.memberList = this.collectPlayerData(t.memberList) || [];

        logger.info("[妖盟管理] 妖盟广告");
        GameNetMgr.inst.sendPbMsg(Protocol.S_WATCH_AD_TASK, { activityId: 0, conditionId: 120006, isUseADTime: false }, null);
        GameNetMgr.inst.sendPbMsg(Protocol.S_TASK_GET_REWARD, { taskId: [120006] }, null);
        logger.info("[妖盟管理] 妖盟买桃免费");
        GameNetMgr.inst.sendPbMsg(Protocol.S_MALL_BUY_GOODS, { mallId: 230000011, count: 1, activityId: 0 }, null);
        logger.info("[妖盟管理] 妖盟买桃1");
        GameNetMgr.inst.sendPbMsg(Protocol.S_MALL_BUY_GOODS, { mallId: 230000001, count: 1, activityId: 0 }, null);
        logger.info("[妖盟管理] 妖盟买桃2");
        GameNetMgr.inst.sendPbMsg(Protocol.S_MALL_BUY_GOODS, { mallId: 230000002, count: 1, activityId: 0 }, null);
        logger.info("[妖盟管理] 妖盟买腾蛇信物");
        GameNetMgr.inst.sendPbMsg(Protocol.S_MALL_BUY_GOODS, { mallId: 230000012, count: 3, activityId: 0 }, null);
        logger.info("[妖盟管理] 妖盟买腾蛇信物");
        GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_GETDAILYTASK, { actIndex: 4 }, null);
    }

    // 砍价
    cutPriceSyncData(t) {
        if (t) {
            if (!t.records.find(record => record.userId === UserMgr.playerId)) {
                logger.info(`[妖盟管理] ${UserMgr.nickName} 开始砍价`);
                GameNetMgr.inst.sendPbMsg(Protocol.S_SPIRIT_DRAW, { bussinessId: t.bussinessId }, null);
            }
        }
        
    }

    fightBoss() {
        const now = Date.now();
        if (now - this.lastCheckTime >= this.CHECK_CD) {

            logger.info("[妖盟管理] 妖盟讨伐 妖盟布阵");
            GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOSS_ARRAYING, {}, null);
            // TODO
            logger.info("[妖盟管理] 妖盟讨伐 已满20人开始战斗");
            GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOSS_BATTLE, {}, null);

            logger.debug("[妖盟管理] 妖盟讨伐 妖盟领奖");
            GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOSS_RECEIVE_REWARD, {}, null);

            this.lastCheckTime = now;
        }
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            // 获取当前时间
            const now = new Date();
            const isWeekend = now.getDay() === 6 || now.getDay() === 0;
            if (!this.unionId || isWeekend) {
                logger.info("[妖盟管理] 未加入妖盟 或者 今天是周末");
                this.clear();
                return;
            }

            this.fightBoss();
        } catch (error) {
            logger.error(`[妖盟管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
