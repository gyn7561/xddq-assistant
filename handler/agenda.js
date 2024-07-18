import logger from "../utils/logger.js";
import { TaskManager } from "../modules/tasks.js";
import { Attribute, AttributeManager } from "./attribute.js";
import { Herorank } from "./herorank.js";
import account from "../account.js";

function agenda() {
    AttributeManager.instance.doChopTree();
    // AttributeManager.instance.doTalentReq();
    consumBag();

    if (account.switch.herorank) {
        // 光速抢镑任务在周一0:05分开始执行
        const delay = getMillisecondsUntilNextMonday();
        logger.info(`[群英镑] 距离周一还有 ${delay / 1000} 秒`);
        setTimeout(() => {
            logger.info("[群英镑] 光速抢榜一");
            TaskManager.instance.add(Herorank.S_HERORANK_BUY_ENERGY());
            TaskManager.instance.add(Herorank.S_HERORANK_GET_FIGHT_LIST());
        }, delay);
    }
}

function consumBag() {
    async function checkBag() {
        // 斗法券 > 2 的时候自动斗法  如果是在 23:45 ~ 00:00 之间，只要有券就斗 抢排名
        const fightTicket = AttributeManager.instance.findItemById(100026);
        let now = new Date();
        let miniutesInThisDay = now.getHours() * 60 + now.getMinutes();
        let isInTime = miniutesInThisDay >= 0 && miniutesInThisDay <= 60 * 23 + 45;// 23:45 ~ 00:00
        if ((fightTicket.num > 0 && !isInTime) || fightTicket.num > 2) {
            logger.info(`还剩 ${fightTicket.num} 张券`);
            await TaskManager.instance.add(Attribute.FetchBattle());
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await TaskManager.instance.add(Attribute.Battle());
        }

        // 万年灵芝 > 0 的时候自动激活
        const books = AttributeManager.instance.findItemById(100008);
        if (books.num > 0) {
            logger.info(`还剩 ${books.num} 万年灵芝`);
            await TaskManager.instance.add(Attribute.ReadBooks(books.num));
        }
        setTimeout(checkBag, 30000);
    }
    checkBag();
}

function getMillisecondsUntilNextMonday() {
    const now = new Date(); // 当前时间
    const currentDay = now.getDay(); // 当前是星期几（0 表示星期日，1 表示星期一，依此类推）
    const nowHours = now.getHours();
    const nowMinutes = now.getMinutes();

    // 计算距离下一个周一的天数
    let daysUntilNextMonday = (8 - currentDay) % 7;

    // 如果今天是周一且时间早于00:05，则设置daysUntilNextMonday为0
    if (currentDay === 1 && (nowHours < 0 || (nowHours === 0 && nowMinutes < 5))) {
        daysUntilNextMonday = 0;
    } else if (daysUntilNextMonday === 0) {
        daysUntilNextMonday = 7; // 如果今天是周一且已经过了00:05，则下一个周一是7天后
    }

    // 计算当前时间到下一个周一 00:05:00 的毫秒数
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilNextMonday);
    nextMonday.setHours(0, 5, 0, 0); // 设置为下一个周一的 00:05:00

    const millisecondsUntilNextMonday = nextMonday - now;
    return millisecondsUntilNextMonday;
}

export default agenda;
