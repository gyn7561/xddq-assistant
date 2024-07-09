import logger from "../utils/logger.js";
import { TaskManager, Task } from "../modules/tasks.js";
import { deepCopy } from '../utils/convert.js';
import account from "../account.js";

class Homeland {
    static ExploreReq(interval) {
        return new Task("HomelandExploreReq", 21058, {}, interval); // 福地探寻
    }

    static ExploreEnter(playerId = env.playerId, interval = 0) {
        return new Task(`HomelandExploreEnter${playerId}`, 21052, { playerId: playerId }, interval);
    }

    static Steal(playerId = env.playerId, pos, workerNum = 1) {
        return new Task(`HomelandSteal${playerId}`, 21060, {
            playerId: playerId,
            pos: pos,
            workerNum: workerNum,
        });
    }

    static Reset(playerId = env.playerId, pos) {
        return new Task(`HomelandReset${playerId}`, 21060, {
            playerId: playerId,
            pos: pos,
            workerNum: 0,
        });
    }

    static RefreshNear() {
        return new Task("HomelandRefreshNear", 21059);
    }

    static Manage(interval) {
        return new Task("HomelandManage", 21053, {}, interval);
    }
}

class HomelandManager {
    constructor() {
        this.tempData = {
            worker: {
                free: 0,
                total: 0,
                energy: 0,
                ready: false,
                manager: false,
            },
            player: {
                total: 0,           // 临时数据 总人数
                count: 0,           // 临时数据 已探寻人数
                ongoing: [],        // 临时数据 正在偷的人
                near: [],           // 临时数据 附近玩家
                enemy: [],          // 临时数据 敌人玩家
            },
            template: null,         // 渲染规则, 固定不变, 用于deepCopy
            itemsAll: [],           // 临时数据 存储所有玩家的福地数据
            itemsMyself: [],        // 临时数据 存储自己的福地数据
            items: [],              // 临时数据 存储符合规则的玩家的福地数据
            canRefresh: false,
            stealCounter: 0,        // 记录探寻失败次数
            maxStealMisses: 5,      // 最大允许探寻失败次数
        };
        this.translate = {
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
        };
        this.defaultRules = [
            { ItemId: 100004, minItemLv: 3, isCheck: true, description: "仙桃" },
            { ItemId: 100025, minItemLv: 5, isCheck: false, description: "净瓶水" },
            { ItemId: 100000, minItemLv: 5, isCheck: false, description: "仙玉" },
            { ItemId: 100003, minItemLv: 5, isCheck: false, description: "灵石" },
            { ItemId: 100029, minItemLv: 5, isCheck: false, description: "琉璃珠" },
            { ItemId: 100044, minItemLv: 5, isCheck: false, description: "天衍令" },
            { ItemId: 100047, minItemLv: 5, isCheck: false, description: "昆仑铁" },
        ];
        // 如果account.js中没有定义rules, 则使用默认规则, 默认只偷取3级以上的仙桃
        this.rules = account.rules || this.defaultRules;
    }

    static get instance() {
        if (!this._instance) {
            this._instance = new HomelandManager();
        }
        return this._instance;
    }

    doInit(body) {
        this.tempData.worker.free = body.freeWorkerNum || 0;
        this.tempData.worker.total = body.totalWorkerNum || 0;
        this.tempData.worker.energy = body.energy || 0;

        if (!this.tempData.worker.manager) {
            TaskManager.instance.add(Homeland.Manage(5000));
            this.tempData.worker.manager = true;
        }

        if (body.freeWorkerNum > 0 && body.energy > 0) {
            logger.info(`[福地] 有${body.freeWorkerNum}只空闲老鼠, 还剩${body.energy}体力`);
            this.tempData.worker.ready = true;
            TaskManager.instance.add(Homeland.ExploreReq(30000));
            TaskManager.instance.add(Homeland.ExploreEnter(global.playerId, 30000));
        } else {
            logger.info(`[福地] 没有空闲老鼠或体力不足`);
            this.tempData.worker.ready = false;
            TaskManager.instance.remove("HomelandExploreReq");
            TaskManager.instance.remove(`HomelandExploreEnter${global.playerId}`);
        }
    }

    doManage(body) {
        const playerId = global.playerId.toString();
        const ongoing = [];
    
        // 在22:00-22:01之间 & 任务完成超过2小时, 撤回并重新派遣
        const currentTime = new Date();
        const startWindow = new Date(currentTime);
        startWindow.setHours(22, 0, 0, 0);
        const endWindow = new Date(currentTime);
        endWindow.setHours(22, 1, 0, 0);
    
        body.reward.forEach((i) => {
            const finishTime = new Date(parseInt(i.finishTime));
    
            const isInTimeWindow = currentTime >= startWindow && currentTime <= endWindow;
            const isOverTwoHours = (currentTime - finishTime) > 2 * 60 * 60 * 1000;
    
            if (isInTimeWindow && isOverTwoHours) {
                logger.info(`[福地] ${i.playerId.toString()}位置${i.pos}的任务已完成或超过2小时, 撤回并重新派遣!`);
                TaskManager.instance.add(Homeland.Reset(i.playerId, i.pos));
                TaskManager.instance.add(Homeland.Steal(i.playerId, i.pos, 1));
            } else if (i.enemy && i.enemy.playerId.toString() == playerId) {
                if (!i.enemy.isWinner) {
                    logger.info(`[福地] ${i.playerId.toString()}位置${i.pos}的老鼠必赢, 撤走自己的老鼠!`);
                    TaskManager.instance.add(Homeland.Reset(i.playerId, i.pos));
                } else {
                    ongoing.push(i.playerId.toString());
                }
            } else if (i.owner && i.owner.playerId.toString() == playerId) {
                if (!i.owner.isWinner) {
                    logger.info(`[福地] ${i.playerId.toString()}位置${i.pos}的老鼠必赢, 撤走自己的老鼠!`);
                    TaskManager.instance.add(Homeland.Reset(i.playerId, i.pos));
                } else {
                    ongoing.push(i.playerId.toString());
                }
            }
        });
    
        this.tempData.player.ongoing = ongoing;
    }

    async doCheckAndSteal(myself = false) {
        if (this.tempData.worker.ready) {
            const items = myself ? this.tempData.itemsMyself : this.tempData.items;

            while (items.length > 0 && this.tempData.worker.free > 0) {
                const i = items.shift();
                const playerId = i.id;
                const playerName = i.name;
                const pos = i.pos;

                if (!myself && this.tempData.player.ongoing.includes(playerId.toString())) {
                    logger.debug(`[福地] ${playerName} 正在被偷, 跳过!`);
                    continue;
                }

                logger.info(`[福地] 偷取 ${playerName} ${pos + 1}位置的${i.itemLevel}级${i.item}!`);
                await TaskManager.instance.add(Homeland.Steal(playerId, pos, 1));
                this.tempData.worker.free -= 1;
            }
        }
    }

    doEnter(body) {
        // Check isValid and convert format
        const enter = this.convertEnterData(body);

        // Analyze oneself individually
        if (enter.id == global.playerId.toString()) {
            logger.debug(`[福地] 探查自己的福地!`);
            const result = this.checkItems([enter], "自己", true);
            if (result.length > 0) {
                this.tempData.itemsMyself = result;
                this.doCheckAndSteal(true);
            }
        } else {
            if (this.tempData.player.near.includes(enter.id.toString())) {
                // Check if nearby player is valid
                const result = this.checkItems([enter], "周围", true);
                if (result.length == 0) {
                    logger.debug(`[福地] [周围] 探查 ${enter.id} ${enter.name} 的福地毫无收获!`);
                    // Remove invalid nearby player from data.player.near list
                    this.tempData.player.near = this.tempData.player.near.filter((i) => i !== enter.id);
                }
            }

            this.tempData.itemsAll.push(enter);
            this.tempData.player.count += 1;

            if (this.tempData.player.count == this.tempData.player.total) {
                logger.debug(`[福地] 数据采集完毕, 开始分析!\n${JSON.stringify(this.tempData.itemsAll, null, 2)}`);
                const result = this.checkItems(this.tempData.itemsAll, "全部", true);
                if (result.length > 0) {
                    this.tempData.items = result;
                    this.doCheckAndSteal();
                }
                if (this.tempData.player.near.length == 0) {
                    logger.info(`[福地] [周围] 标记可以刷新`);
                    this.tempData.canRefresh = true;
                } else {
                    logger.debug(`[福地] [周围] ${this.tempData.player.near}`);
                }
                this.resetHomeland();
            }
        }
    }

    doExplore(body) {
        this.resetHomeland();

        const { near, enemy } = this.convertExploreData(body);

        const nearPlayers = this.checkItems(near, "周围", false, true);
        const enemyPlayers = this.checkItems(enemy, "敌人", false, true);

        this.tempData.player.near = nearPlayers;
        this.tempData.player.enemy = enemyPlayers;

        const allPlayers = nearPlayers.concat(enemyPlayers);

        if (allPlayers.length > 0) {
            this.tempData.player.total = allPlayers.length;

            allPlayers.forEach((player) => {
                logger.debug(`[福地] 探查 ${player} 的福地!`);
                TaskManager.instance.add(Homeland.ExploreEnter(player));
            });
        }

        if (nearPlayers.length > 0) {
            this.tempData.stealCounter = 0; // 重置次数
        }

        const timeSinceLastRefresh = (Date.now() - body.exploreData.lastRefreshTime) / 1000;
        logger.debug(`[福地] ${timeSinceLastRefresh}秒自上次刷新`);
        if ((nearPlayers.length == 0 || this.tempData.canRefresh) && timeSinceLastRefresh >= 300) {
            this.tempData.stealCounter++;
            logger.info(`[福地] 未发现合适的福地, ${this.tempData.stealCounter}/${this.tempData.maxStealMisses}`);
            if (this.tempData.stealCounter >= this.tempData.maxStealMisses) {
                logger.info(`[福地] 已连续${this.tempData.stealCounter}次未发现合适的福地，停止流程`);
                this.stopAllTasks();
                return
            }
            logger.info("[福地] 刷新附近福地!");
            TaskManager.instance.add(Homeland.RefreshNear());
            this.tempData.canRefresh = false;
        }
    }

    convertExploreData(data) {
        const near = [];
        const enemy = [];

        ["nearHomeland", "enemy"].forEach((category) => {
            data.exploreData[category].forEach((i) => {
                const items = i.rewardId.map((item) => this.translate[item] || null);
                const resultObj = {
                    id: i.playerInfo.playerId.toString(),
                    name: i.playerInfo.nickName,
                    items: items,
                };

                if (category == "nearHomeland") {
                    near.push(resultObj);
                } else if (category == "enemy") {
                    enemy.push(resultObj);
                }
            });
        });

        return { near, enemy };
    }

    isIllegal(reward) {
        return reward.reward.indexOf("=") == -1 || reward.reward == -1 || reward.owner || reward.enemy || reward.isOnlyOwnerPull;
    }

    convertEnterData(data) {
        const playerId = data.homeland.owner.playerId.toString();
        const nickName = data.homeland.owner.nickName;
        const rewards = data.homeland.reward;
        const result = { id: playerId, name: nickName, items: [] };
        rewards.forEach((reward) => {
            if (this.isIllegal(reward)) {
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
        logger.info(`[福地] 将采集${description}`);
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
        if (!this.tempData.template) {
            logger.info("[福地] 初始化规则模板");
            const priority = [100029, 100044, 100000, 100003, 100047, 100004, 100025];
            this.tempData.template = this.initializeResult(priority);
        }

        // Deep copy the initialized result
        const result = deepCopy(this.tempData.template);

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
                        logger.debug(`[福地] [${prefix}] ${playerId} ${playerName} ${index + 1}位置发现${itemLevel}级${this.findDescription(itemId)}`);
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
        this.tempData.player.count = 0;
        this.tempData.player.total = 0;
        this.tempData.player.enemy = [];
        this.tempData.player.near = [];
        this.tempData.itemsAll = [];
        this.tempData.items = [];
    }

    stopAllTasks() {
        logger.info("[福地] 停止所有福地相关任务");
        
        // 停止所有与福地相关的任务
        const homelandTasks = TaskManager.instance.tasks.filter(task => task.name.startsWith("Homeland"));
        homelandTasks.forEach(task => TaskManager.instance.remove(task.name));
        
        // 停止额外的定时任务
        if (TaskManager.instance.taskIntervals["HomelandManage"]) {
            clearInterval(TaskManager.instance.taskIntervals["HomelandManage"]);
            delete TaskManager.instance.taskIntervals["HomelandManage"];
        }
        if (TaskManager.instance.taskIntervals["HomelandExploreReq"]) {
            clearInterval(TaskManager.instance.taskIntervals["HomelandExploreReq"]);
            delete TaskManager.instance.taskIntervals["HomelandExploreReq"];
        }
        if (TaskManager.instance.taskIntervals[`HomelandExploreEnter${global.playerId}`]) {
            clearInterval(TaskManager.instance.taskIntervals[`HomelandExploreEnter${global.playerId}`]);
            delete TaskManager.instance.taskIntervals[`HomelandExploreEnter${global.playerId}`];
        }
    }
}

export { Homeland, HomelandManager };