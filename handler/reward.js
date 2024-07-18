import logger from "../utils/logger.js";
import { TaskManager, ImmediateTask, CountedTask } from "../modules/tasks.js";

class Reward {
    static Get(activityId, conditionId, count = 1) {
        return new CountedTask(`ActivityReward${activityId}${conditionId}`, 210701, { activityId: activityId, conditionId: conditionId, type: 1 }, 1000, count);
    }

    static BuyFree(activityId, mallId) {
        return new ImmediateTask(`BuyFreeGift${activityId}${mallId}`, 21005, { activityId: activityId, mallId: mallId, count: "1" });
    }
}

class RewardManager {
    static get instance() {
        if (!this._instance) {
            this._instance = new HerorankManager();
        }
        return this._instance;
    }

    handlerReward(body) {
        logger.debug(`[通用活动] 数据${JSON.stringify(body, null, 2)}`);

        const activity = body.activity;
        const activityId = activity.activityId;
        const mallConfig = activity.detailConfig.commonConfig.mallConfig || null;

        if (activity == 9712901) {
            logger.info(`[通用活动] [仙缘福泽签到]`);
            // 找到首个 isGetReward = false 的 conditionId
            const firstUnrewardedCondition = activity.conditionDataList.find((condition) => !condition.isGetReward);
            const conditionId = firstUnrewardedCondition ? firstUnrewardedCondition.conditionId : null;
            TaskManager.instance.add(Reward.Get(activityId, conditionId));
        }

        // 100000=0 表示免费领取 有就领
        mallConfig.filter((item) => item.mallTempMsg.price === "100000=0").map((item) => {
            const id = item.mallTempMsg.id;
            const buyLimit = item.mallTempMsg.buyLimit;
            const name = item.mallTempMsg.name;
            logger.info(`[通用活动] [免费领取] ${name} ${buyLimit}次`);
            for (let i = 0; i < buyLimit; i++) {
                new Promise((resolve) => setTimeout(resolve, 1000)).then(() => {
                    TaskManager.instance.add(Reward.BuyFree(activityId, id));
                });
            }
        });
    }
}

export { RewardManager };


