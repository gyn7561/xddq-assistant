import logger from "../utils/logger.js";
import account from "../account.js";
import { TaskManager, ImmediateTask, CountedTask } from "../modules/tasks.js";
import { DBMgr } from "../modules/dbMgr.js";

class Attribute {
    static Chop(times = 1) {
        return new ImmediateTask("Chop", 20203, { auto: false, times: times });
    }

    static CheckUnfinishedEquipment() {
        return new ImmediateTask("CheckUnfinishedEquipment", 20209, {});
    }

    static CheckUnfinishedTalent() {
        return new ImmediateTask("CheckUnfinishedTalent", 20625, {});
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

    static SpeedUpTreeUpgradeReq(interval, count) {
        return new CountedTask("SpeedUpTreeUpgradeReq", 20206, { speedUpType: 1, useTimes: 1, isUseADTime: false }, interval, count);
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

    // 灵脉!!!!!!!!!!
    static RandomTalentReq(times) {
        return new ImmediateTask("RandomTalentReq", 20622, { randomTimes: times });
    }

    // 装备
    static DealTalentEnum_Equip() {
        return new ImmediateTask("DealTalentEnum_Equip", 20623, { dealData: [{ index: 0, type: 0 }] });
    }

    // 粉碎神通
    static DealTalentEnum_Resolve() {
        return new ImmediateTask("DealTalentEnum_Resolve", 20623, { dealData: [{ index: 0, type: 1 }] });
    }

    // 装备并分解老的
    static DealTalentEnum_EquipAndResolveOld() {
        return new ImmediateTask("DealTalentEnum_EquipAndResolveOld", 20623, { dealData: [{ index: 0, type: 2 }] });
    }
}

class AttributeManager {
    constructor() {
        this.separation = false; // Done
        this.equipmentData = { 0: [], 1: [], 2: [] };
        this.talentData = { 0: [], 1: [], 2: [] };
        this.fightValueData = { 0: [], 1: [], 2: [] };
        this.bagData = []; // Done
        this.treeLevel = 1; // Done
        this.chopTimes = 1; // Done
        this.talentCreateLevel = 1; // 灵脉等级
        this.talentCreateTimes = 1; // Done
        this.isMonthCardVip = false; // Done
        this.isYearCardVip = false; // Done
        this.talentReqJob = null; // 用于存储 talentReq 的定时任务
        this.previousFlowerNum = 0; // 用于存储上一次的灵脉花数量
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
        logger.info("[Server] [玩家数据] 等级: " + this.playerLevel + " 妖力: " + this.playerFightValue);
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

    handlerTalentInit(body) {
        logger.debug("[Server] [灵脉] 初始化灵脉数据");
        this.talentCreateLevel = body.talentCreateLevel || 1;
        this.calculateTalentMultiplier(this.talentCreateLevel);
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

    processAttributes(attributeList) {
        const attributes = {
            basic: {
                1: null,
                2: null,
                3: null,
                4: null,
            },
            attack: null,
            defense: null,
        };

        for (const attr of attributeList) {
            if (attr.type >= 1 && attr.type <= 4) {
                attributes.basic[attr.type] = parseFloat(attr.value);
            } else if (attr.type >= 5 && attr.type <= 10) {
                attributes.attack = { type: attr.type, value: parseFloat(attr.value) };
            } else if (attr.type >= 11 && attr.type <= 16) {
                attributes.defense = { type: attr.type, value: parseFloat(attr.value) };
            }
        }

        return attributes;
    }

    checkCondition(input, condition) {
        for (let i = 0; i < condition.length; i++) {
            for (let j = 0; j < condition[i].length; j++) {
                const element = condition[i][j];
                if (Array.isArray(element) && Array.isArray(input) && input.length === element.length && input.every((val, index) => val === element[index])) {
                    return { result: true, index: i };
                } else if (element === input) {
                    return { result: true, index: i };
                }
            }
        }
        return { result: false, index: -1 };
    }

    checkMultipleConditions(input1, input2, condition) {
        let result1 = this.checkCondition(input1, condition);
        if (result1.result) {
            return result1;
        }

        let result2 = this.checkCondition(input2, condition);
        if (result2.result) {
            return result2;
        }

        return { result: false, index: -1 };
    }

    async handlerEquipment(body) {
        if (body.ret === 0) {
            if (this.status === "busy") {
                logger.debug(`[Server] 忙碌中，跳过处理`);
                return;
            }

            this.status = "busy"; // 锁定状态
            const items = body.undDealEquipmentDataMsg;

            for (let i = 0; i < items.length; i++) {
                const equipment = items[i];
                const fightValue = equipment.fightValue; // 该装备的妖力
                const u = equipment.unDealEquipmentData; // 该装备的未处理数据
                const id = u.id; // 该装备的id
                const quality = u.quality; // 该装备的品质
                const attributeList = this.processAttributes(u.attributeList); // 使用转换后的属性列表
                const equipmentId = u.equipmentId; // 该装备的装备id
                const equipmentData = this.dbMgr.getEquipment(equipmentId);
                const equipmentName = equipmentData.name;
                const equipmentType = equipmentData.type - 1;

                let processed = await this.processEquipment(quality, fightValue, attributeList, equipmentType, id, equipmentId);

                if (!processed) {
                    logger.debug(`[装备] 分解 ${id} ${this.dbMgr.getEquipmentQuality(quality)} ${equipmentName}`);
                    TaskManager.instance.add(Attribute.DealEquipmentEnum_Resolve(id));
                }
            }
            this.status = "idle"; // 解锁状态
        }
    }

    async processEquipment(quality, fightValue, attributeList, equipmentType, id, equipmentId) {
        if (this.separation) {
            const rule = account.chopTree.separation;
            const attackType = attributeList.attack.type;
            const defenseType = attributeList.defense.type;

            const { result, index } = this.checkMultipleConditions(attackType, [attackType, defenseType], rule.condition);

            if (result) {
                let betterAttributes = false;
                let existingAttributeList = null;
                let existingExist = true;
                if (!this.equipmentData[index][equipmentType]) {
                    betterAttributes = true;
                    existingExist = false;
                } else {
                    existingAttributeList = this.processAttributes(this.equipmentData[index][equipmentType].attributeList);
                }

                if (
                    !betterAttributes &&
                    quality >= rule.quality &&
                    (fightValue >= this.fightValueData[index] * (1 - rule.fightValueOffset) ||
                        !rule.condition[index].includes(existingAttributeList.attack.type) ||
                        parseFloat(attributeList.attack.value) >= parseFloat(existingAttributeList.attack.value) * (1 + rule.probOffset))
                ) {
                    betterAttributes = true;
                }

                if (betterAttributes) {
                    if (existingExist) {
                        logger.info(
                            `[装备] 分身${index} 原装备 ${this.dbMgr.getEquipmentQuality(
                                this.equipmentData[index][equipmentType].quality
                            )} ${this.dbMgr.getEquipmentName(this.equipmentData[index][equipmentType].equipmentId)} ${this.dbMgr.getAttribute(
                                existingAttributeList.attack.type
                            )}:${existingAttributeList.attack.value / 10} ${this.dbMgr.getAttribute(existingAttributeList.defense.type)}:${
                                existingAttributeList.defense.value / 10
                            }`
                        );
                    }
                    logger.info(
                        `[装备] 分身${index} 新装备 ${this.dbMgr.getEquipmentQuality(quality)} ${this.dbMgr.getEquipmentName(
                            equipmentId
                        )} ${this.dbMgr.getAttribute(attributeList.attack.type)}:${attributeList.attack.value / 10} ${this.dbMgr.getAttribute(
                            attributeList.defense.type
                        )}:${attributeList.defense.value / 10}`
                    );
                    TaskManager.instance.add(Attribute.SwitchSeparation(index));
                    TaskManager.instance.add(Attribute.DealEquipmentEnum_EquipAndResolveOld(id));
                    TaskManager.instance.add(Attribute.FetchSeparation());
                    return true;
                }
            }
        }
        return false;
    }

    async handlerTalent(body) {
        if (body.ret === 0) {
            if (this.status === "busy") {
                logger.debug(`[Server] 忙碌中，跳过处理`);
                return;
            }

            this.status = "busy"; // 锁定状态
            const items = body.unDealTalentDataMsg;

            for (let i = 0; i < items.length; i++) {
                const talent = items[i];

                const fightValue = talent.fightValue; // 该装备的妖力
                const quality = talent.quality; // 该装备的品质
                const level = talent.level; // 该装备的等级
                const talentId = talent.id; // 该装备的talentId 没啥用 用于日志
                const talentType = talent.type - 1; // 灵脉的孔位
                const attributeList = this.processTalentAttributes(talent.attributeData); // 使用转换后的属性列表

                // let processed = await this.processEquipment(quality, fightValue, attributeList, equipmentType, id, equipmentId);

                if (!processed) {
                    logger.debug(`[装备] 分解 ${this.dbMgr.getEquipmentQuality(quality)} ${this.dbMgr.getEquipmentName(`Talent_Name-${talentId}`)}`);
                    TaskManager.instance.add(Attribute.DealTalentEnum_Resolve());
                }
            }
            this.status = "idle";
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
        const totalTimes = 8;
        const remainingTimes = totalTimes - freeSpeedUpTimes;

        if (remainingTimes > 0) {
            logger.debug(`[Server] [树自动加速] [剩余次数: ${remainingTimes}]`);

            let jobTime;

            // 如果距离上次加速时间超过30分钟，则立即加速 或者 为当天第一次加速
            if (now - freeSpeedUpCdEndTime >= intervalInMinutes || freeSpeedUpTimes === 0) {
                jobTime = 0; // 立即执行
            } else {
                jobTime = freeSpeedUpCdEndTime + intervalInMinutes - now;
            }

            setTimeout(async () => {
                logger.debug(`[Server] [树自动加速] [启动自动加速任务，剩余次数: ${remainingTimes}]`);
                await TaskManager.instance.add(Attribute.SpeedUpTreeUpgradeReq(intervalInMinutes, remainingTimes));
            }, jobTime);
        }
    }

    doChopTree() {
        const chopTreeTask = async () => {
            if (this.status === "idle") {
                const item = this.findItemById(100004);
                if (item.num < account.chopTree.stop.num || this.playerLevel == account.chopTree.stop.level) {
                    logger.warn(`[砍树] 停止任务`);
                    this.chopTreeJob = null;
                } else {
                    if (item.num !== this.previousPeachNum) {
                        logger.info(`[砍树] 还剩 ${item.num} 桃子`);
                        this.previousPeachNum = item.num; // 更新上一次数量
                    }
                    await TaskManager.instance.add(Attribute.Chop(this.chopTimes));
                    await TaskManager.instance.add(Attribute.CheckUnfinishedEquipment());
                }
            } else {
                logger.warn(`[砍树] 正在忙碌，跳过`);
            }

            if (this.chopTreeJob) {
                setTimeout(chopTreeTask, 1000); // 每秒钟执行一次
            }
        };

        if (account.switch.chopTree) {
            if (this.chopTreeJob) {
                clearTimeout(this.chopTreeJob);
            }
            this.chopTreeJob = setTimeout(chopTreeTask, 1000);
        } else if (this.chopTreeJob) {
            clearTimeout(this.chopTreeJob);
            this.chopTreeJob = null;
        }
    }

    doTalentReq() {
        const talentReqTask = async () => {
            if (this.status === "idle") {
                const item = this.findItemById(100007);
                if (item.num < account.talent.stop.num) {
                    logger.warn(`[灵脉] 停止任务`);
                    this.talentReqJob = null;
                } else {
                    if (item.num !== this.previousPeachNum) {
                        logger.info(`[灵脉] 还剩 ${item.num} 灵脉花`);
                        this.previousFlowerNum = item.num; // 更新上一次数量
                    }
                    await TaskManager.instance.add(Attribute.RandomTalentReq(this.talentCreateTimes));
                    await TaskManager.instance.add(Attribute.CheckUnfinishedTalent());
                }
            } else {
                logger.warn(`[灵脉] 正在忙碌，跳过`);
            }

            if (this.talentReqJob) {
                setTimeout(talentReqTask, 1000); // 每秒钟执行一次
            }
        };

        if (account.switch.talent) {
            if (this.talentReqJob) {
                clearTimeout(this.talentReqJob);
            }
            this.talentReqJob = setTimeout(talentReqTask, 1000);
        } else if (this.talentReqJob) {
            clearTimeout(this.talentReqJob);
            this.talentReqJob = null;
        }
    }

    calculateTalentMultiplier(level) {
        // level 大于40 为3次 20-39为2次 0-19为1次
        if (level >= 40) {
            this.talentCreateTimes = 3;
        } else if (level >= 20) {
            this.talentCreateTimes = 2;
        } else {
            this.talentCreateTimes = 1;
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
