import schedule from "node-schedule";
import logger from "../utils/logger.js";
import account from "../account.js";
import { TaskManager, ImmediateTask } from "../modules/tasks.js";
import { DBMgr } from "../modules/dbMgr.js";

class Attribute {
    static Chop(i, times = 1) {
        return new ImmediateTask(`Chop${i}`, 20203, { auto: false, times: times });
    }

    static CheckUnfinishedEquipment() {
        return new ImmediateTask("CheckUnfinishedEquipment", 20209, {});
    }

    static FetchSeparation() {
        return new ImmediateTask("FetchSeparation", 20215, {});
    }

    static SwitchSeparation(idx) {
        return new ImmediateTask(`SwitchSeparation${idx}`, 20214, { separationIdx: idx });
    }

    static MonthCardAward() {
        return new ImmediateTask("MonthCardAward", 20105, { type: 1 });
    }

    static YearCardAward() {
        return new ImmediateTask("YearCardAward", 20105, { type: 2 });
    }

    static FetchBattle() {
        const timestamp = new Date().getTime();
        return new ImmediateTask(`FetchBattle${timestamp}`, 20410, {});
    }

    static Battle() {
        const timestamp = new Date().getTime();
        return new ImmediateTask(`Battle${timestamp}`, 20412, { index: 0 });
    }

    static SpeedUpTreeUpgradeReq(i) {
        return new ImmediateTask(`SpeedUpTreeUpgradeReq${i}`, 20206, { speedUpType: 1, useTimes: 1, isUseADTime: false });
    }

    static ReadBooks(times) {
        return new ImmediateTask("ReadBooks", 20624, { readTimes: times });
    }

    // 粉碎装备
    static DealEquipmentEnum_Resolve(id) {
        return new ImmediateTask("DealEquipmentEnum_Resolve", 20202, { type: 1, idList: [id] });
    }

    // 佩戴装备 & 分解旧装备
    static DealEquipmentEnum_EquipAndResolveOld(id) {
        return new ImmediateTask("DealEquipmentEnum_EquipAndResolveOld", 20202, { type: 2, idList: [id] });
    }
}

class AttributeManager {
    constructor() {
        this.separation = false; // Done
        this.equipmentData = { 0: [], 1: [], 2: [] };
        this.talentData = { 0: [], 1: [], 2: [] };
        this.fightValueData = { 0: [], 1: [], 2: [] };
        this.bagData = []; // Done
        this.treeLevel = 0; // Done
        this.chopTimes = 0; // Done
        this.isMonthCardVip = false; // Done
        this.isYearCardVip = false; // Done
        this.chopTreeJob = null; // 用于存储 chopTree 的定时任务
        this.previousPeachNum = 0; // 用于存储上一次的桃子数量
        // 🔒储存状态防止同时砍树和灵脉时候出现问题
        this.status = "idle"; // idle | busy
        this.dbMgr = DBMgr.instance;
        // 桃 100004
        // 仙玉 100000
        // 灵脉花 100007
        // 万年灵芝 100008
        // 净瓶水 100025
        // 斗法券 100026
    }

    static get instance() {
        if (!this._instance) {
            this._instance = new AttributeManager();
        }
        return this._instance;
    }

    handlerPlayerAttribute(body) {
        this.playerLevel = Number(body.realmsId); // 等级
        this.playerFightValue = Number(body.fightValue); // 妖力
    }

    handlerSeparation(body) {
        if (body.ret === 0 && Array.isArray(body.useSeparationDataMsg) && body.useSeparationDataMsg.length === 3) {
            logger.debug("[Server] [分身] 有分身数据");
            this.separation = true;

            logger.debug("[Server] [分身] 更新分身数据");
            body.useSeparationDataMsg.forEach((data) => {
                if (data.hasOwnProperty("index")) {
                    this.equipmentData[data.index] = data.equipmentList || [];
                    this.talentData[data.index] = data.talentData || [];
                    this.fightValueData[data.index] = data.fightValueData || [];
                }
            });
        }
    }

    handlerBag(body) {
        if (Array.isArray(body.bagData)) {
            body.bagData.forEach((newItem) => {
                const existingItem = this.bagData.find((item) => item.propId === newItem.propId);
                if (existingItem) {
                    existingItem.num = newItem.num;
                } else {
                    this.bagData.push(newItem);
                }
            });
            logger.debug("[Server] [背包] 更新背包数据");
        }
    }

    findItemById(id) {
        return this.bagData.find((item) => item.propId === id) || { num: 0 };
    }

    async handlerEquipment(body) {
        if (body.ret === 0) {
            if (this.status === "busy") {
                logger.debug(`[Server] [处理装备] 忙碌中，跳过处理`);
                return;
            }

            this.status = "busy"; // 锁定状态
            const items = body.undDealEquipmentDataMsg;
            let processed = false;

            for (let i = 0; i < items.length; i++) {
                const equipment = items[i];
                const fightValue = equipment.fightValue; // 该装备的妖力
                const u = equipment.unDealEquipmentData; // 该装备的未处理数据
                const id = u.id; // 该装备的id
                const quality = u.quality; // 该装备的品质
                const attributeList = u.attributeList; // 详细属性
                const equipmentId = u.equipmentId; // 该装备的装备id
                // 根据equipmentId找到装备的类型
                const equipmentType = this.dbMgr.getEquipment(equipmentId).type - 1;

                if (this.separation) {
                    // 规则为分身规则
                    const rule = account.chopTree.separation;
                    // 分别比较三个分身的装备
                    for (let index = 0; index < 3; index++) {
                        // 质量 和 妖力*偏移量 均满足条件
                        if (quality >= rule.quality && fightValue >= this.fightValueData[index] * (1 - rule.fightValueOffset)) {
                            const conditions = rule.condition[index];

                            // 是否满足必要条件
                            const requiredMet = conditions.some((condition) => {
                                // 如果是数组，表示需要同时满足
                                if (Array.isArray(condition)) {
                                    return condition.every((subCondition) => attributeList.some((attr) => attr.type === subCondition));
                                }
                                // 否则只需要满足其中一个
                                return attributeList.some((attr) => attr.type === condition);
                            });

                            if (requiredMet) {
                                const betterAttributes = attributeList.filter(attr => {
                                    const existingAttr = this.equipmentData[index][equipmentType].attributeList.find(existing => existing.type === attr.type);
                                    if (!existingAttr) {
                                        return true; // 如果现有装备不包含该属性，直接认为满足条件
                                    }
                                    return parseFloat(attr.value) >= parseFloat(existingAttr.value) * (1 - rule.probOffset);
                                });

                                if (betterAttributes) {
                                    logger.info(`[装备] 分身${index} 符合条件 ${this.dbMgr.getEquipmentQuality(quality)} ${this.dbMgr.getEquipmentName(equipmentId)}`);
                                    TaskManager.instance.add(Attribute.SwitchSeparation(index));
                                    TaskManager.instance.add(Attribute.DealEquipmentEnum_EquipAndResolveOld(id));
                                    TaskManager.instance.add(Attribute.FetchSeparation());
                                    processed = true;
                                    break;
                                }
                            }
                        }
                    }
                }

                if (!processed) {
                    logger.debug(`[装备] 分解 ${id} ${this.dbMgr.getEquipmentQuality(quality)} ${this.dbMgr.getEquipmentName(equipmentId)}`);
                    TaskManager.instance.add(Attribute.DealEquipmentEnum_Resolve(id));
                }
            }
            this.status = "idle"; // 解锁状态
        }
    }

    handlerVip(body) {
        const monthlyCardExpired = this.isExpired(body.monthlyCardEndTime);
        const getMonthlyCardRewardToday = this.isToday(body.getMonthlyCardRewardTime);
        const yearCardExpired = this.isYearCardEndTimeNegativeOne(body.yearCardEndTime);
        const getYearCardRewardToday = this.isToday(body.getYearCardRewardTime);

        if (!monthlyCardExpired) {
            logger.info(`[Vip] 检测到月卡`);
            this.isMonthCardVip = true;
            if (!getMonthlyCardRewardToday) {
                logger.info(`[Vip] 月卡领取奖励`);
                TaskManager.instance.add(Attribute.MonthCardAward());
            }
        }

        if (!yearCardExpired) {
            logger.info(`[Vip] 检测到年卡`);
            this.isYearCardVip = true;
            if (!getYearCardRewardToday) {
                logger.info(`[Vip] 年卡领取奖励`);
                TaskManager.instance.add(Attribute.YearCardAward());
            }
        }
    }

    handlerTree(body) {
        // 保存树等级
        this.treeLevel = body.dreamLv;
        // 根据树等级计算砍树倍率
        this.calculateMultiplier(this.treeLevel);

        const now = Date.now();
        const freeSpeedUpCdEndTime = parseInt(body.freeSpeedUpCdEndTime, 10);
        const intervalInMinutes = 30 * 60 * 1000;
        let freeSpeedUpTimes = body.freeSpeedUpTimes;

        // 计算剩余次数并设置自动加速任务
        const remainingTimes = 8 - freeSpeedUpTimes;

        if (remainingTimes > 0) {
            logger.debug(`[Server] [树自动加速] [剩余次数: ${remainingTimes}]`);
            for (let i = 0; i < remainingTimes; i++) {
                let jobTime;

                // 如果是第一次加速，且距离上次加速时间超过30分钟，则立即加速
                if (i === 0 && now - freeSpeedUpCdEndTime >= intervalInMinutes) {
                    jobTime = new Date();
                    freeSpeedUpTimes--;
                } else {
                    jobTime = new Date(freeSpeedUpCdEndTime + (i + 1 - freeSpeedUpTimes) * intervalInMinutes);
                }

                schedule.scheduleJob(jobTime, () => {
                    logger.debug(`[Server] [树自动加速] [剩余次数: ${8 - 1 - i}] 一键加速`);
                    TaskManager.instance.add(Attribute.SpeedUpTreeUpgradeReq(i));
                });
            }
        }
    }

    doChopTree() {
        if (account.switch.chopTree) {
            if (this.chopTreeJob) {
                this.chopTreeJob.cancel(); // 如果已经有定时任务，先取消
            }
            this.chopTreeJob = schedule.scheduleJob("*/1 * * * * *", async () => {
                if (this.status === "idle") {
                    const peach = this.findItemById(100004);
                    if (peach.num < account.chopTree.stop.peach || this.playerLevel == account.chopTree.stop.level) {
                        logger.warn(`[砍树] 停止任务`);
                        this.chopTreeJob.cancel();
                        this.chopTreeJob = null;
                    } else {
                        if (peach.num !== this.previousPeachNum) {
                            logger.info(`[砍树] 执行砍树任务 还剩 ${peach.num} 桃子`);
                            this.previousPeachNum = peach.num; // 更新上一次桃子数量
                        }
                        await TaskManager.instance.add(Attribute.Chop(peach.num, this.chopTimes));
                        await TaskManager.instance.add(Attribute.CheckUnfinishedEquipment());
                    }
                } else {
                    logger.warn(`[砍树] 正在忙碌，跳过此次砍树`);
                }
            });
        } else if (this.chopTreeJob) {
            this.chopTreeJob.cancel(); // 如果开关关闭且任务存在，取消任务
            this.chopTreeJob = null;
        }
    }

    calculateMultiplier(treeLevel) {
        if (treeLevel >= 22) {
            this.chopTimes = 6;
        } else if (treeLevel >= 19) {
            this.chopTimes = 5;
        } else if (treeLevel >= 17) {
            this.chopTimes = 4;
        } else if (treeLevel >= 12) {
            this.chopTimes = 3;
        } else if (treeLevel >= 9) {
            this.chopTimes = 2;
        } else {
            this.chopTimes = 1;
        }
    }

    isExpired(timestamp) {
        const now = Date.now();
        return parseInt(timestamp, 10) < now;
    }

    isToday(timestamp) {
        const date = new Date(parseInt(timestamp, 10));
        const today = new Date();
        return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    }

    isYearCardEndTimeNegativeOne(timestamp) {
        return !(Number(timestamp) !== 0);
    }
}

export { Attribute, AttributeManager };
