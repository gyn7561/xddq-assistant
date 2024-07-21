import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import account from "../../../account.js";

export default class HeroRankMgr {
    constructor() {
        this.isProcessing = false;
        this.enabled = account.switch.herorank || false;
        this.buyNumDaily = 0;
        this.buyNumMax = 10;
        LoopMgr.inst.add(this);
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new HeroRankMgr();
        }
        return this._instance;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    SyncData(t) {
        logger.debug("[群英镑管理] 初始化");
        this.energy = t.energy || 0;
        this.buyNumDaily = t.buyNumDaily || 0;
        if (this.enabled) {
            if (this.buyNumDaily < this.buyNumMax) {
                const num = this.buyNumMax - this.buyNumDaily;
                logger.info(`[群英镑管理] 购买体力 ${num}次`);
                GameNetMgr.inst.sendPbMsg(Protocol.S_HERORANK_BUY_ENERGY, { num: num }, null);
                this.buyNumDaily = this.buyNumMax;
            }
        }
        // 群英镑商店买桃
        GameNetMgr.inst.sendPbMsg(Protocol.S_MALL_BUY_GOODS, {mallId: 250000001, count: 1, activityId: 0}, null);    
    }

    findFirstHeroRankPlayer(body) {
        return (
            body.fightPlayerList.canFightPlayerInfoList.find((player) => player.showInfo.nickName.startsWith("HeroRank_Name")) ||
            body.fightPlayerList.canFightPlayerInfoList[0]
        );
    }

    getFightList(t) {
        this.isProcessing = true;
        logger.debug(`[群英镑管理] 收到群英镑列表${JSON.stringify(t, null, 2)}`);
        if (t.ret === 0) {
            this.rank = t.rank || null;
            if (t.rank === 1) {
                logger.info("[群英镑管理] 当前排名第一, 不需要再打了");
                return;
            }
            // 找到第一个玩家 打败他
            const player = this.findFirstHeroRankPlayer(t);
            if (player) logger.info(`[群英镑管理] 找到玩家 ${player.showInfo.nickName} 准备攻击...`);
            GameNetMgr.inst.sendPbMsg(Protocol.S_HERORANK_FIGHT, {
                targetId: "0",
                targetRank: player.rank,
                masterId: player.masterId,
                masterLv: player.masterLv,
                appearanceId: player.showInfo.appearanceId,
                cloudId: player.showInfo.equipCloudId,
            }, null);
        }
        this.isProcessing = false;
    }

    async doFight(t) {
        this.isProcessing = true;
        logger.debug(`[群英镑] 收到群英镑战斗结果${JSON.stringify(t, null, 2)}`);
        if (t.ret === 0) {
            this.energy = t.playerInfo.energy;
            if (t.allBattleRecord.isWin) {
                logger.info(`[群英镑] 当前排名: ${t.rank} 战斗胜利, 再次请求列表...`);
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }
        this.isProcessing = false;
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            // 获取当前时间
            const now = new Date();
            const isMonday = now.getDay() === 1;
            const isZeroFive = now.getHours() === 0 && now.getMinutes() === 5;

            if (!this.enabled || this.energy < 1 || this.rank === 1 || !isMonday) {
                logger.info("[群英镑管理] 停止循环。今天不是周一, 或者体力不足, 或者已经打到第一名, 或者未开启速通群英榜");
                this.clear();
                return;
            }

            if (this.enabled && this.energy > 0 && isZeroFive) {
                logger.info("[群英镑管理] 开始快速打群英镑");
                GameNetMgr.inst.sendPbMsg(Protocol.S_HERORANK_GET_FIGHT_LIST, { type: 0 }, null);
            }
        } catch (error) {
            logger.error(`[群英镑管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
