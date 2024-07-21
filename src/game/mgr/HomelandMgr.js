import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import account from "../../../account.js";
import UserMgr from "#game/mgr/UserMgr.js";

class Homeland {
    static ExploreReq() {
        logger.debug("[福地管理] 福地探寻");
        return GameNetMgr.inst.sendPbMsg(Protocol.S_HOMELAND_EXPLORE, {}, null);
    }

    static Manage() {
        logger.debug("[福地管理] 福地管理");
        return GameNetMgr.inst.sendPbMsg(Protocol.S_HOMELAND_MANAGE, {}, null);
    }
    
    static ExploreEnter(playerId) {
        logger.debug(`[福地管理] 进入${playerId}的福地`);
        return GameNetMgr.inst.sendPbMsg(Protocol.S_HOMELAND_ENTER, { playerId: playerId }, null);
    }

    static Steal(playerId, pos, workerNum = 1) {
        logger.debug(`[福地管理] 偷取${playerId}的${pos}位置`);
        return GameNetMgr.inst.sendPbMsg(Protocol.S_HOMELAND_DISPATCH_WORKER, {
            playerId: playerId,
            pos: pos,
            workerNum: workerNum,
        }, null);
    }

    static Reset(playerId, pos) {
        logger.debug(`[福地管理] 从${playerId}的${pos}位置撤回老鼠`);
        return GameNetMgr.inst.sendPbMsg(Protocol.S_HOMELAND_DISPATCH_WORKER, {
            playerId: playerId,
            pos: pos,
            workerNum: 0,
        }, null);
    }

    static RefreshNear() {
        logger.debug("[福地管理] 刷新附近玩家");
        return GameNetMgr.inst.sendPbMsg(Protocol.S_HOMELAND_EXPLORE_REFRESH, {}, null);
    }

    static ADReward() {
        logger.debug("[福地管理] 广告奖励");
        return GameNetMgr.inst.sendPbMsg(Protocol.S_HOMELAND_REFRESH_RESOURCE, { type: 1, position: -1, itemId: 0, isUseADTime: false }, null);
    }
}

export default class HomelandMgr {
    constructor() {
        this.worker = {
            free: 0,
            total: 0,
            energy: 0,
            ready: false,
        };
        this.lastLoop = {
            manage: 0,
            check: 0,
        };
        this.player = {
            total: 0,            // 临时数据 总人数
            count: 0,            // 临时数据 已探寻人数
            ongoing: [],         // 临时数据 正在偷的人
            near: [],            // 临时数据 附近玩家
            enemy: [],           // 临时数据 敌人玩家
        };
        this.playerRecord = {};  // 记录玩家
        this.template = null;    // 渲染规则, 固定不变, 用于deepCopy  
        this.items = {
            all: [],             // 临时数据 存储所有玩家的福地数据
            myself: [],          // 临时数据 存储自己的福地数据
            match: [],           // 临时数据 存储符合规则的玩家的福地数据
        }
        this.canRefresh = false; // 刷新标志
        this.counter = {
            failure: 0,          // 记录探寻失败次数
            maxFailure: 6,       // 连续 6 x 5 分钟未发现合适的福地, 且不在高产时间区间, 停止刷新福地
        };
        
        this.isProcessing = false;

        LoopMgr.inst.add(this);
    }

    static TRANSLATE = {
        10022: "100003=1", // 1级灵石
        10023: "100003=2", // 2级灵石
        10024: "100003=3", // 3级灵石
        10025: "100003=4", // 4级灵石
        10026: "100003=5", // 5级灵石
        10029: "100004=1", // 1级仙桃
        10030: "100004=2", // 2级仙桃
        10031: "100004=3", // 3级仙桃
        10032: "100004=4", // 4级仙桃
        10033: "100004=5", // 5级仙桃
        10008: "100025=1", // 1级净瓶水
        10009: "100025=2", // 2级净瓶水
        10010: "100025=3", // 3级净瓶水
        10011: "100025=4", // 4级净瓶水
        10012: "100025=5", // 5级净瓶水
        10036: "100044=1", // 1级天衍令
        10037: "100044=2", // 2级天衍令
        10038: "100044=3", // 3级天衍令
        10039: "100044=4", // 4级天衍令
        10040: "100044=5", // 5级天衍令
        10001: "100000=1", // 1级仙玉
        10002: "100000=2", // 2级仙玉
        10003: "100000=3", // 3级仙玉
        10004: "100000=4", // 4级仙玉
        10005: "100000=5", // 5级仙玉
        10015: "100029=1", // 1级琉璃珠
        10016: "100029=2", // 2级琉璃珠
        10017: "100029=3", // 3级琉璃珠
        10018: "100029=4", // 4级琉璃珠
        10019: "100029=5", // 5级琉璃珠
        10043: "100047=1", // 1级昆仑铁
        10044: "100047=2", // 2级昆仑铁
        10045: "100047=3", // 3级昆仑铁
        10046: "100047=4", // 4级昆仑铁
        10047: "100047=5", // 5级昆仑铁
    }

    static DEAFULT_RULES = [
        { ItemId: 100004, minItemLv: 3, isCheck: true, description: "仙桃" },
        { ItemId: 100025, minItemLv: 5, isCheck: false, description: "净瓶水" },
        { ItemId: 100000, minItemLv: 5, isCheck: false, description: "仙玉" },
        { ItemId: 100003, minItemLv: 5, isCheck: false, description: "灵石" },
        { ItemId: 100029, minItemLv: 5, isCheck: false, description: "琉璃珠" },
        { ItemId: 100044, minItemLv: 5, isCheck: false, description: "天衍令" },
        { ItemId: 100047, minItemLv: 5, isCheck: false, description: "昆仑铁" },
    ]

    static get inst() {
        if (!this._instance) {
            this._instance = new HomelandMgr();
        }
        return this._instance;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    deepCopy(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
        
    doInit(t) {
        this.worker.free = t.freeWorkerNum || 0;
        this.worker.total = t.totalWorkerNum || 0;
        this.worker.energy = t.energy || 0;
        // 如果account.js中没有定义rules, 则使用默认规则, 默认只偷取3级以上的仙桃
        this.rules = account.rules || HomelandMgr.DEAFULT_RULES;

        if (t.freeWorkerNum > 0 && t.energy > 0) {
            logger.info(`[福地管理] 有${t.freeWorkerNum}只空闲老鼠, 还剩${t.energy}体力`);
            this.worker.ready = true;
        } else {
            logger.info("[福地管理] 没有空闲老鼠或体力不足");
            this.worker.ready = false;
        }
    }

    doManage(t) {
        const playerId = UserMgr.playerId.toString();
        const ongoing = [];
    
        const now = new Date();
    
        t.reward.forEach((i) => {
            const finishTime = new Date(parseInt(i.finishTime));
            const isOverTwoHours = (finishTime - now) > 2 * 60 * 60 * 1000;
            if ((this.worker.energy > 50) && isOverTwoHours) { // 体力超过50且 & 任务完成超过2小时, 撤回并重新派遣
                logger.info(`[福地管理] ${i.playerId.toString()}位置${i.pos}的任务已完成或超过2小时, 撤回并重新派遣!`);
                Homeland.Reset(i.playerId, i.pos);
                Homeland.Steal(i.playerId, i.pos, 1);
            } else if (i.enemy && i.enemy.playerId.toString() == playerId) {
                if (!i.enemy.isWinner) {
                    logger.info(`[福地管理] ${i.playerId.toString()}位置${i.pos}的老鼠必赢, 撤走自己的老鼠!`);
                    Homeland.Reset(i.playerId, i.pos);
                } else {
                    ongoing.push(i.playerId.toString());
                }
            } else if (i.owner && i.owner.playerId.toString() == playerId) {
                if (!i.owner.isWinner) {
                    logger.info(`[福地管理] ${i.playerId.toString()}位置${i.pos}的老鼠必赢, 撤走自己的老鼠!`);
                    Homeland.Reset(i.playerId, i.pos);
                } else {
                    ongoing.push(i.playerId.toString());
                }
            }
        });
    
        this.player.ongoing = ongoing;
    }

    async doCheckAndSteal(myself = false) {
        if (this.worker.ready) {
            const items = myself ? this.items.myself : this.items.match;

            while (items.length > 0 && this.worker.free > 0) {
                const i = items.shift();
                const playerId = i.id;
                const playerName = i.name;
                const pos = i.pos;

                if (!myself && this.player.ongoing.includes(playerId.toString())) {
                    logger.debug(`[福地管理] ${playerName} 正在被偷, 跳过!`);
                    continue;
                }

                logger.info(`[福地管理] 偷取 ${playerName} ${pos + 1}位置的${i.itemLevel}级${i.item}!`);
                Homeland.Steal(playerId, pos, 1);
                this.worker.free -= 1;
            }
        }
    }

    doEnter(t) {
        // Check isValid and convert format
        const enter = this.convertEnterData(t);

        // Analyze oneself individually
        if (enter.id == UserMgr.playerId.toString()) {
            logger.debug(`[福地管理] 探查自己的福地!`);
            const result = this.checkItems([enter], "自己", true);
            if (result.length > 0) {
                this.items.myself = result;
                this.doCheckAndSteal(true);
            } else {
                const freeRefreshCount = t.homeland.freeRefreshCount;
                if (freeRefreshCount < 2) {
                    logger.info(`[福地管理] [自己] 可以刷新 ${2 - freeRefreshCount} 次`);
                    if (this.worker.energy >= 50 && this.worker.free > 0) {
                        logger.info(`[福地管理] [自己] 广告刷新福地!`);
                        Homeland.ADReward();
                    }
                }
            }
        } else {
            if (this.player.near.includes(enter.id.toString())) {
                // Check if nearby player is valid
                const result = this.checkItems([enter], "周围", true);
                if (result.length == 0) {
                    logger.debug(`[福地管理] [周围] 探查 ${enter.id} ${enter.name} 的福地毫无收获!`);
                    // Remove invalid nearby player from data.player.near list
                    this.player.near = this.player.near.filter((i) => i !== enter.id);
                }
            }

            this.items.all.push(enter);
            this.player.count += 1;

            if (this.player.count == this.player.total) {
                logger.debug(`[福地管理] 数据采集完毕, 开始分析!\n${JSON.stringify(this.items.all, null, 2)}`);
                const result = this.checkItems(this.items.all, "全部", true);
                if (result.length > 0) {
                    this.items.match = result;
                    this.doCheckAndSteal();
                }
                if (this.player.near.length == 0) {
                    logger.debug(`[福地管理] [周围] 标记可以刷新`);
                    this.canRefresh = true;
                } else {
                    logger.debug(`[福地管理] [周围] ${this.player.near}`);
                }
                this.resetHomeland();
            }
        }
    }

    doExplore(t) {
        this.resetHomeland();

        const { near, enemy } = this.convertExploreData(t);

        const nearPlayers = this.checkItems(near, "周围", false, true);
        const enemyPlayers = this.checkItems(enemy, "敌人", false, true);

        this.player.near = nearPlayers;
        this.player.enemy = enemyPlayers;

        const allPlayers = nearPlayers.concat(enemyPlayers);

        if (allPlayers.length > 0) {
            this.player.total = allPlayers.length;

            allPlayers.forEach((player) => {
                logger.debug(`[福地管理] 探查 ${player} 的福地!`);
                Homeland.ExploreEnter(player);
            });
        }

        if (nearPlayers.length > 0) {
            this.counter.failure = 0; // 重置次数
        }

        const timeSinceLastRefresh = (Date.now() - t.exploreData.lastRefreshTime) / 1000;
        logger.debug(`[福地管理] ${timeSinceLastRefresh}秒自上次刷新`);

        // 检查当前时间是否在允许刷新时间段
        const now = new Date();
        const hours = now.getHours();
        
        const isRefreshAllowed = 
            (hours >= 10 && hours < 12) || 
            (hours >= 18 && hours < 20) || 
            (hours >= 22 && hours < 24);
    
        if (isRefreshAllowed) {
            this.counter.failure = 0;
        }

        if ((nearPlayers.length == 0 || this.canRefresh) && timeSinceLastRefresh >= 5 * 60) {
            this.counter.failure++;

            if (this.counter.failure >= this.counter.maxFailure) {
                if (this.counter.failure == this.counter.maxFailure) {
                    logger.info(`[福地管理] 已连续 ${this.counter.failure}/${this.counter.maxFailure} 次未发现合适的福地，禁止刷新`);
                }
                return
            }
            logger.info("[福地管理] 刷新附近福地!");
            Homeland.RefreshNear();
            this.canRefresh = false;
        }
    }

    convertExploreData(data) {
        const near = [];
        const enemy = [];

        ["nearHomeland", "enemy"].forEach((category) => {
            data.exploreData[category].forEach((i) => {
                const items = i.rewardId.map((item) => HomelandMgr.TRANSLATE[item] || null);
                const resultObj = {
                    id: i.playerInfo.playerId.toString(),
                    name: i.playerInfo.nickName,
                    items: items,
                };

                this.playerRecord[i.playerInfo.playerId.toString()] = i.playerInfo.nickName;

                if (category == "nearHomeland") {
                    near.push(resultObj);
                } else if (category == "enemy") {
                    enemy.push(resultObj);
                }
            });
        });

        return { near, enemy };
    }

    isIllegal(reward, playerId) {
        if (playerId === UserMgr.playerId.toString()) {
            return reward.reward.indexOf("=") == -1 || reward.reward == -1 || reward.owner || reward.enemy;
        } else {
            return reward.reward.indexOf("=") == -1 || reward.reward == -1 || reward.owner || reward.enemy || reward.isOnlyOwnerPull;
        }
    }
    
    convertEnterData(data) {
        const playerId = data.homeland.owner.playerId.toString();
        const nickName = data.homeland.owner.nickName;
        const rewards = data.homeland.reward;
        const result = { id: playerId, name: nickName, items: [] };
        rewards.forEach((reward) => {
            if (this.isIllegal(reward, playerId)) {
                result.items.push(null);
            } else {
                const id = reward.reward.split("=")[0];
                result.items.push(`${id}=${reward.rewardLv}`);
            }
        });
        return result;
    }

    initializeResult(priority) {
        const result = {};

        priority.forEach((itemId) => {
            const rule = this.rules.find((rule) => rule.ItemId == itemId);
            if (rule && rule.isCheck) {
                for (let lv = 5; lv >= rule.minItemLv; lv--) {
                    result[`${itemId}=${lv}`] = [];
                }
            }
        });
        // Generate rules description
        const description = this.generateRulesDescription(this.rules);
        logger.info(`[福地管理] 将采集${description}`);
        return result;
    }

    generateRulesDescription(rules) {
        const descriptions = rules.filter((rule) => rule.isCheck).map((rule) => `大于${rule.minItemLv}级的${rule.description}`);

        return descriptions.join(" | ");
    }

    findDescription(id) {
        return this.rules.find((rule) => rule.ItemId == id).description;
    }

    checkItems(itemData, prefix, isEnter = false, idOnly = false) {
        // Initialize the template
        if (!this.template) {
            logger.info("[福地管理] 初始化规则模板");
            const priority = [100029, 100044, 100000, 100003, 100047, 100004, 100025];
            this.template = this.initializeResult(priority);
        }

        // Deep copy the initialized result
        const result = this.deepCopy(this.template);

        itemData.forEach((i) => {
            const playerId = i.id.toString();
            const playerName = i.name;
            const items = i.items;

            items.forEach((item, index) => {
                if (!item) return;
                const [itemId, itemLevel] = item.split("=").map(Number);
                const key = `${itemId}=${itemLevel}`;

                if (result.hasOwnProperty(key)) {
                    result[key].push({ id: playerId, name: playerName, pos: index, item: this.findDescription(itemId), itemLevel: itemLevel });
                    if (isEnter) {
                        logger.debug(`[福地管理] [${prefix}] ${playerId} ${playerName} ${index + 1}位置发现${itemLevel}级${this.findDescription(itemId)}`);
                    }
                }
            });
        });

        // Remove empty keys and merge value to array
        let mergedValues = [];
        for (let key in result) {
            if (result[key].length > 0) {
                mergedValues = mergedValues.concat(result[key]);
            }
        }

        if (idOnly) {
            return [...new Set(mergedValues.map((i) => i.id))];
        }
        return mergedValues;
    }

    resetHomeland() {
        this.player.count = 0;
        this.player.total = 0;
        this.player.enemy = [];
        this.player.near = [];
        this.items.all = [];
        this.items.match = [];
    }

    loopCheck() {
        const now = Date.now();
        const manageInterval = 5 * 1000; // 管理间隔
        const checkInterval = 30 * 1000; // 检查间隔

        if (now - this.lastLoop.manage >= manageInterval) {
            Homeland.Manage();
            this.lastLoop.manage = now;
        }

        if (now - this.lastLoop.check >= checkInterval && this.worker.ready) {
            Homeland.ExploreReq();
            Homeland.ExploreEnter(UserMgr.playerId)
            this.lastLoop.check = now;
        }
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            if (account.switch.homeland === false) {
                logger.info("[福地管理] 未开启福地偷桃");
                this.clear();
                this.isProcessing = false;
                return;
            }

            this.loopCheck()

        } catch (error) {
            logger.error(`[福地管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
