import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import { DBMgr } from "#game/common/DBMgr.js";
import BagMgr from "#game/mgr/BagMgr.js";
import account from "../../../account.js";

class Attribute {
    static Chop(times = 1) {
        logger.debug(`[砍树] 砍树 ${times} 次`);
        return GameNetMgr.inst.sendPbMsg(Protocol.S_ATTRIBUTE_DREAM_MSG, { auto: false, times: times }, null);
    }

    static CheckUnfinishedEquipment() {
        logger.debug(`查看掉落装备`);
        return GameNetMgr.inst.sendPbMsg(Protocol.S_ATTRIBUTE_GET_UNDEAL_EQUIPMENT_MSG, {}, null);
    }

    static FetchSeparation() {
        logger.debug(`获取分身数据`);
        return GameNetMgr.inst.sendPbMsg(Protocol.S_ATTRIBUTE_GET_SEPARATION_DATAA_MSG_LIST_REQ, {}, null);
    }

    static SwitchSeparation(idx) {
        logger.debug(`切换分身 ${idx}`);
        return GameNetMgr.inst.sendPbMsg(Protocol.S_ATTRIBUTE_SWITCH_SEPARATION_REQ, { separationIdx: idx }, null);
    }

    static DealEquipmentEnum_Resolve(id) {
        logger.debug(`粉碎装备`);
        return GameNetMgr.inst.sendPbMsg(Protocol.S_ATTRIBUTE_EQUIPMENT_DEAL_MSG, { type: 1, idList: [id] }, null);
    }

    static DealEquipmentEnum_EquipAndResolveOld(id) {
        logger.debug(`佩戴装备 & 分解旧装备`);
        return GameNetMgr.inst.sendPbMsg(Protocol.S_ATTRIBUTE_EQUIPMENT_DEAL_MSG, { type: 2, idList: [id] }, null);
    }
}

export default class PlayerAttributeMgr {
    constructor() {
        this.AD_REWARD_DAILY_MAX_NUM = 8;                           // 每日最大领取次数
        this.AD_REWARD_CD = 30 * 60 * 1000;                         // 每次间隔时间 (30分钟)
        this.separation = false;                                    // 是否有分身
        this.equipmentData = { 0: [], 1: [], 2: [] };
        this.fightValueData = { 0: [], 1: [], 2: [] };
        this.treeLevel = 1;                                         // 树等级
        this.chopTimes = 1;                                         // 根据树等级计算砍树次数

        this.chopEnabled = account.switch.chopTree || false;        // 用于存储 chopTree 的定时任务
        this.previousPeachNum = 0;                                  // 用于存储上一次的桃子数量

        // 🔒储存状态防止同时砍树和灵脉时候出现问题
        this.isProcessing = false;

        LoopMgr.inst.add(this);
    }

    static isMonthCardVip = false;  // 月卡
    static isYearCardVip = false;   // 终身卡
    static realmsId = 0;            // 等级
    static fightValue = 0;          // 妖力

    static get inst() {
        if (!this._instance) {
            this._instance = new PlayerAttributeMgr();
        }
        return this._instance;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    // 201 玩家属性信息同步
    SyncAttribute(t) {
        PlayerAttributeMgr.realmsId = t.realmsId;
        PlayerAttributeMgr.fightValue = t.fightValue;
        logger.info(`[属性管理] 等级: ${PlayerAttributeMgr.realmsId} 妖力: ${PlayerAttributeMgr.fightValue}`);
    }

    // 215 同步分身数据
    checkSeparation(t) {
        if (t.ret === 0 && Array.isArray(t.useSeparationDataMsg) && t.useSeparationDataMsg.length === 3) {
            logger.debug("[属性管理] 有分身数据");
            this.separation = true;

            logger.debug("[属性管理] 更新分身数据");
            t.useSeparationDataMsg.forEach((data) => {
                if (data.hasOwnProperty("index")) {
                    this.equipmentData[data.index] = data.equipmentList || [];
                    this.fightValueData[data.index] = data.fightValue || [];
                    if (!this.fightValueData[data.index]) {
                        throw new Error("获取妖力失败");
                    }
                }
            });
        }
    }

    // 209 处理装备
    async handlerEquipment(t) {
        if (t.ret === 0) {
            if (this.isProcessing) {
                logger.debug(`[砍树] 忙碌中，跳过处理`);
                return;
            }

            this.isProcessing = true;
            const items = t.undDealEquipmentDataMsg;

            for (let i = 0; i < items.length; i++) {
                const equipment = items[i];
                const fightValue = equipment.fightValue; // 该装备的妖力
                const u = equipment.unDealEquipmentData; // 该装备的未处理数据
                const id = u.id; // 该装备的id
                const quality = u.quality; // 该装备的品质
                const attributeList = this.processAttributes(u.attributeList); // 使用转换后的属性列表
                const equipmentId = u.equipmentId; // 该装备的装备id
                const equipmentData = DBMgr.inst.getEquipment(equipmentId);
                const equipmentName = equipmentData.name;
                const equipmentType = equipmentData.type - 1;

                let processed = await this.processEquipment(quality, fightValue, attributeList, equipmentType, id, equipmentId);

                if (!processed) {
                    logger.debug(`[装备] 分解 ${id} ${DBMgr.inst.getEquipmentQuality(quality)} ${equipmentName}`);
                    Attribute.DealEquipmentEnum_Resolve(id);
                }
            }
            this.isProcessing = false;
        }
    }

    async processEquipment(quality, fightValue, attributeList, equipmentType, id, equipmentId) {
        if (this.separation) {
            const rule = account.chopTree.separation;
            const attackType = attributeList.attack.type;
            const defenseType = attributeList.defense.type;

            const { result, index } = this.checkMultipleConditions(attackType, [attackType, defenseType], rule.condition);

            if (account.chopTree.showResult) {
                if (quality >= rule.quality) {
                    logger.info(
                        `[装备] 新装备 ${DBMgr.inst.getEquipmentQuality(quality)} ${DBMgr.inst.getEquipmentName(
                            equipmentId
                        )} ${DBMgr.inst.getAttribute(attackType)}:${attributeList.attack.value / 10} ${DBMgr.inst.getAttribute(
                            defenseType
                        )}:${attributeList.defense.value / 10}`
                    );
                } else {
                    logger.info("[装备] 新装备品质过差");
                }
            }

            if (result) {
                let betterAttributes = false;
                let existingAttributeList = null;
                let existingExist = true;
                if (!this.equipmentData[index][equipmentType]) {
                    betterAttributes = true;
                    existingExist = false;
                    logger.warn(`[装备] 分身${index} 无原装备`);
                    logger.warn(`${JSON.stringify(this.equipmentData[index])}`);
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
                            `[装备] 分身${index} 原装备 ${DBMgr.inst.getEquipmentQuality(
                                this.equipmentData[index][equipmentType].quality
                            )} ${DBMgr.inst.getEquipmentName(this.equipmentData[index][equipmentType].equipmentId)} ${DBMgr.inst.getAttribute(
                                existingAttributeList.attack.type
                            )}:${existingAttributeList.attack.value / 10} ${DBMgr.inst.getAttribute(existingAttributeList.defense.type)}:${existingAttributeList.defense.value / 10
                            }`
                        );
                    }
                    logger.warn(
                        `[装备] 分身${index} 新装备 ${DBMgr.inst.getEquipmentQuality(quality)} ${DBMgr.inst.getEquipmentName(
                            equipmentId
                        )} ${DBMgr.inst.getAttribute(attributeList.attack.type)}:${attributeList.attack.value / 10} ${DBMgr.inst.getAttribute(
                            attributeList.defense.type
                        )}:${attributeList.defense.value / 10}`
                    );
                    Attribute.SwitchSeparation(index);
                    Attribute.DealEquipmentEnum_EquipAndResolveOld(id);
                    Attribute.FetchSeparation();
                    return true;
                }
            }
        }
        return false;
    }

    doChopTree() {
        const item = BagMgr.inst.findItemById(100004);
        if (item.num < account.chopTree.stop.num || this.playerLevel == account.chopTree.stop.level) {
            logger.warn(`[砍树] 停止任务`);
            this.chopEnabled = false;
            return;
        } else {
            if (item.num !== this.previousPeachNum) {
                logger.info(`[砍树] 还剩 ${item.num} 桃子`);
                this.previousPeachNum = item.num; // 更新上一次数量
            }
            Attribute.Chop(this.chopTimes);
            Attribute.CheckUnfinishedEquipment();
        }
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

    // 207 仙树初始化以及自动升级
    SyncTree(t) {
        this.getAdRewardTimes = t.freeSpeedUpTimes || 0;
        this.dreamLvUpEndTime = parseInt(t.dreamLvUpEndTime, 10) || 0;
        this.lastAdRewardTime = parseInt(t.freeSpeedUpCdEndTime, 10) || 0;
        this.treeLevel = t.dreamLv;
        this.calculateMultiplier(this.treeLevel);
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

    processReward() {
        const now = Date.now();
        if (this.getAdRewardTimes < this.AD_REWARD_DAILY_MAX_NUM && now - this.lastAdRewardTime >= this.AD_REWARD_CD && this.dreamLvUpEndTime !== 0) {
            logger.info(`[仙树管理] 还剩 ${this.AD_REWARD_DAILY_MAX_NUM - this.getAdRewardTimes} 次广告激励`);

            GameNetMgr.inst.sendPbMsg(Protocol.S_ATTRIBUTE_DREAM_LV_UP_SPEED_UP, { speedUpType: 1, useTimes: 1, isUseADTime: false }, null);
            this.getAdRewardTimes++;
            this.lastAdRewardTime = now;
        }
    }

    // 104 判断是否VIP
    SyncVip(t) {
        const monthlyCardExpired = this.isExpired(t.monthlyCardEndTime);
        const getMonthlyCardRewardToday = this.isToday(t.getMonthlyCardRewardTime);
        const yearCardExpired = this.isYearCardEndTimeNegativeOne(t.yearCardEndTime);
        const getYearCardRewardToday = this.isToday(t.getYearCardRewardTime);

        if (!monthlyCardExpired) {
            logger.info(`[玩家管理] 检测到月卡`);
            PlayerAttributeMgr.isMonthCardVip = true;
            if (!getMonthlyCardRewardToday) {
                logger.info(`[玩家管理] 月卡领取奖励`);
                GameNetMgr.inst.sendPbMsg(Protocol.S_PRIVILEGE_CARD_RECEIVE_REWARD, { type: 1 }, null);
            }
        }

        if (!yearCardExpired) {
            logger.info(`[玩家管理] 检测到年卡`);
            PlayerAttributeMgr.isYearCardVip = true;
            if (!getYearCardRewardToday) {
                logger.info(`[玩家管理] 年卡领取奖励`);
                GameNetMgr.inst.sendPbMsg(Protocol.S_PRIVILEGE_CARD_RECEIVE_REWARD, { type: 2 }, null);
            }
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

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            // 自动升级仙树
            this.processReward();

            // 自动砍树
            if (this.chopEnabled && this.separation) {
                this.doChopTree();
            }
        } catch (error) {
            logger.error(`[PlayerAttributeMgr] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
