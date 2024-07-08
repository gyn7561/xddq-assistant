import { HomelandManager } from "./homeland.js";
import { handlerFrog } from "./frog.js";
import { handlerGift } from "./gift.js";
import { handlerDestiny } from "./destiny.js";
import { AttributeManager } from "./attribute.js";
import logger from "../utils/logger.js";
import account from "../account.js";

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
        case 651:
            logger.debug(`[Server] [游历]`);
            handlerDestiny(body);
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
        case 4808: // 自动收获礼物
            handlerGift(body);
            return;
        default:
            return;
    }
}

export { handleServerMessage };
