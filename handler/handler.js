import { HomelandManager } from "./homeland.js";
import { handlerFrog } from "./frog.js";
import { handlerGift } from "./gift.js";
import { handlerDestiny } from "./destiny.js";
import { AttributeManager } from "./attribute.js";
import { HerorankManager } from "./herorank.js";
import { RewardManager } from "./reward.js";
import { handlerPupil } from "./pupil.js";
import logger from "../utils/logger.js";
import account from "../account.js";
import { TaskManager, ImmediateTask } from "../modules/tasks.js";

function handleServerMessage(msgId, body) {
    switch (msgId) {
        case 1:
            logger.info(`[Server] [登录成功]`);
            return;
        case 104:
            logger.debug(`[Server] [VIP检测]`);
            AttributeManager.instance.handlerVip(body);
            return;
        case 201:
            logger.debug(`[Server] [玩家数据]`);
            AttributeManager.instance.handlerPlayerAttribute(body);
            return;
        case 207:
            logger.debug(`[Server] [树状态]`);
            AttributeManager.instance.handlerTree(body);
            return;
        case 209:
            logger.debug(`[Server] [处理装备]`);
            AttributeManager.instance.handlerEquipment(body);
            return;
        case 210: // 青蛙
            handlerFrog(body);
            return;
        case 215: // 分身数据获取
            logger.debug(`[Server] [分身数据]`);
            AttributeManager.instance.handlerSeparation(body);
            return;
        case 301: // 背包数据
            logger.debug(`[Server] [背包数据]`);
            AttributeManager.instance.handlerBag(body);
            return;
        case 621:
            logger.debug(`[Server] [灵脉]`);
            AttributeManager.instance.handlerTalentInit(body);
        case 625:
            logger.debug(`[Server] [灵脉]`);
            AttributeManager.instance.handlerTalent(body);
            return;
        case 651:
            logger.debug(`[Server] [游历]`);
            handlerDestiny(body);
            return;
        case 762: // 镇妖塔战斗结果
            if (body.ret === 0) {
                const currentStage = body.towerDataSync.curPassId % 10 === 0 ? 10 : body.towerDataSync.curPassId % 10;
                logger.info(`[Server] [镇妖塔挑战结果] ${body.allBattleRecord.isWin} ${Math.ceil(body.towerDataSync.curPassId / 10)}层${currentStage}关`);
            } else {
                TaskManager.instance.add(new ImmediateTask("镇妖塔一键选择", 20764, {index: 0, isOneKey: true}));
            }
            return;
        case 1003: // 处理通用活动数据
            logger.info(`[Server] [通用活动]`);
            RewardManager.instance.handlerReward(body);
            return;
        case 1051: // 福地 有空闲老鼠 服务器会主动推送
            if (account.switch.homeland) {
                HomelandManager.instance.doInit(body);
            }
            return;
        case 1052:
            HomelandManager.instance.doEnter(body);
            return;
        case 1053:
            HomelandManager.instance.doManage(body);
            return;
        case 1058: // 福地 福地探寻
            HomelandManager.instance.doExplore(body);
            return;
        case 3702: // 获得群英镑列表
            HerorankManager.instance.handlerFightList(body);
            return;
        case 3703: // 攻击敌人
            HerorankManager.instance.handlerFight(body);
            return;
        case 4808: // 自动收获礼物
            handlerGift(body);
            return;
        case 402:
            logger.info(`[Server] [关卡挑战结果] ${body.challengeSuccess} 当前层数:${account.passStageId}`);
            return;
        case 403:
            account.passStageId = body.passStageId;
            return;
        case 5602:
            logger.info(`[Server] [真火挑战结果] ${body.allBattleRecord.isWin} ${body.info.floor}层`);
            return;
        case 11801:
            logger.debug(`[Server] [宗门信息]`);
            handlerPupil(body);
            return;
        case 2165:
            logger.debug(`[Server] [妖盟砍价]`);
            TaskManager.instance.add(new ImmediateTask("妖盟砍价", 22166, { bussinessId: body.bussinessId }));
            return;
        default:
            return;
    }
}

export { handleServerMessage };
