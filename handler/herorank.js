import logger from "../utils/logger.js";
import { TaskManager, ImmediateTask } from "../modules/tasks.js";

// 群英镑
class Herorank {
    // 买体力
    static S_HERORANK_BUY_ENERGY() {
        return new ImmediateTask("S_HERORANK_BUY_ENERGY", 23707, { num: 10 });
    }

    // 获得群英镑列表
    static S_HERORANK_GET_FIGHT_LIST() {
        return new ImmediateTask("S_HERORANK_GET_FIGHT_LIST", 23702, { type: 0 });
    }

    // 攻击敌人
    static S_HERORANK_FIGHT(targetRank, masterId, masterLv, appearanceId, cloudId) {
        return new ImmediateTask("S_HERORANK_FIGHT_ENEMY", 23703, {
            targetId: "0",
            targetRank: targetRank,
            masterId: masterId,
            masterLv: masterLv,
            appearanceId: appearanceId,
            cloudId: cloudId,
        });
    }
}

class HerorankManager {
    constructor() {
        this.energy = 0; // 体力
    }

    static get instance() {
        if (!this._instance) {
            this._instance = new HerorankManager();
        }
        return this._instance;
    }

    findFirstHeroRankPlayer(body) {
        return (
            body.fightPlayerList.canFightPlayerInfoList.find((player) => player.showInfo.nickName.startsWith("HeroRank_Name")) ||
            body.fightPlayerList.canFightPlayerInfoList[0]
        );
    }

    handlerFightList(body) {
        logger.debug(`[群英镑] 收到群英镑列表${JSON.stringify(body, null, 2)}`);
        if (body.ret === 0) {
            if (body.rank === 1) {
                logger.info("[群英镑] 当前排名第一, 不需要再打了");
                return;
            }
            // 找到第一个玩家 打败他
            const player = this.findFirstHeroRankPlayer(body);
            if (player) logger.info(`[群英镑] 找到玩家 ${player.showInfo.nickName} 准备攻击...`);
            TaskManager.instance.add(Herorank.S_HERORANK_FIGHT(player.rank, player.masterId, player.masterLv, player.showInfo.appearanceId, player.showInfo.equipCloudId));
        }
    }

    // 处理群英镑战斗 赢了就接着打
    handlerFight(body) {
        logger.info(`[群英镑] 收到群英镑战斗结果${JSON.stringify(body, null, 2)}`);
        if (body.ret === 0) {
            this.energy = body.playerInfo.energy;
            if (body.allBattleRecord.isWin) {
                logger.info("[群英镑] 战斗胜利, 再次请求列表...");
                new Promise((resolve) => setTimeout(resolve, 2000)).then(() => {
                    TaskManager.instance.add(Herorank.S_HERORANK_GET_FIGHT_LIST());
                });
            }
        }
    }
}

export { Herorank, HerorankManager };
