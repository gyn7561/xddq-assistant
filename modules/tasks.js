import logger from "../utils/logger.js";
import { toBytes } from "../utils/convert.js";
import { create } from "./messages.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resolvePath = (...segments) => path.resolve(__dirname, ...segments);

class Task {
    constructor(name, protocol, body = {}, interval = 0, repeat = false, count = 0, atTimes = []) {
        this.name = name;
        this.protocol = protocol;
        this.body = body;
        this.interval = interval;
        this.repeat = repeat;
        this.count = count;
        this.atTimes = atTimes;
    }
}

// 立即执行任务，执行完即销毁
class ImmediateTask extends Task {
    constructor(name, protocol, body = {}) {
        super(name, protocol, body, 0, false, 0);
    }
}

// 重复执行任务，无限次
class RepeatedTask extends Task {
    constructor(name, protocol, body = {}, interval) {
        super(name, protocol, body, interval, true);
    }
}

// 重复执行几次的任务
class CountedTask extends Task {
    constructor(name, protocol, body = {}, interval, count) {
        super(name, protocol, body, interval, false, count);
    }
}

// 在特定时间点执行的任务
class TimedTask extends Task {
    constructor(name, protocol, body = {}, atTimes) {
        super(name, protocol, body, 0, false, 0, atTimes);
    }
}

class TaskManager {
    constructor() {
        this.isConnect = false;
        this.ws = null;
        this.tasks = [];
        this.taskHandlers = {}; // Store handlers for tasks
    }

    static get instance() {
        if (!this._instance) {
            this._instance = new TaskManager();
        }
        return this._instance;
    }

    async add(task) {
        const existingTask = this.tasks.find((t) => t.name === task.name);
        if (existingTask) {
            return;
        }

        this.tasks.push(task);

        if (task.atTimes.length > 0) {
            for (const time of task.atTimes) {
                this.scheduleAtTime(task, time);
            }
        } else if (task.interval > 0) {
            if (task.repeat) {
                this.scheduleRepeated(task);
            } else if (task.count > 0) {
                this.scheduleRepeatedCount(task, task.count);
            }
        } else {
            await this.executeTask(task);
        }
    }

    async executeTask(task) {
        const hexString = await create(global.playerId, task.protocol, task.body);
        const messageBytes = toBytes(hexString);
        logger.debug(`[Client] ${task.name} ${task.protocol} ${JSON.stringify(task.body, null, 2)}`);
        this.ws.send(messageBytes);
        if (task.interval === 0 && !task.repeat) {
            this.remove(task.name);
        }
    }

    scheduleAtTime(task, time) {
        const now = new Date();
        const executeTime = new Date(now.toDateString() + ' ' + time);

        if (executeTime < now) {
            executeTime.setDate(executeTime.getDate() + 1);
        }

        const delay = executeTime - now;
        this.taskHandlers[task.name] = setTimeout(async () => {
            await this.executeTask(task);
            if (task.repeat) {
                this.scheduleAtTime(task, time);
            }
        }, delay);
    }

    scheduleRepeated(task) {
        const execute = async () => {
            await this.executeTask(task);
            this.taskHandlers[task.name] = setTimeout(execute, task.interval);
        };
        execute();
    }

    scheduleRepeatedCount(task, count) {
        const execute = async () => {
            if (count > 0) {
                await this.executeTask(task);
                count--;
                if (count > 0) {
                    this.taskHandlers[task.name] = setTimeout(execute, task.interval);
                } else {
                    this.remove(task.name);
                }
            }
        };
        execute();
    }

    remove(taskName) {
        const index = this.tasks.findIndex((task) => task.name === taskName);
        if (index !== -1) {
            this.tasks.splice(index, 1);
            clearTimeout(this.taskHandlers[taskName]);
            delete this.taskHandlers[taskName];
        }
    }

    restart() {
        for (const task of this.tasks) {
            clearTimeout(this.taskHandlers[task.name]);
            delete this.taskHandlers[task.name];
        }
        this.tasks = [];
    }

    async init(ws) {
        this.ws = ws;
        const initialTasks = [
            new ImmediateTask("Login", 20001, { token: global.token, language: "zh_cn" }), // 立即执行
            new RepeatedTask("Heartbeat", 20003, {}, 5000), // 每5秒发送一次心跳
            new RepeatedTask("TrainPupil", 211802, { isOneKey: 1 }, 600000), // 每10分钟重复执行
            new RepeatedTask("S_ENTER_PUPIL_SYSTEM", 211801, {}, 600000*3), // 每30分钟重复执行
            new ImmediateTask("Separation", 20215, {}),   // 立即执行
            new ImmediateTask("CheckEmail", 20555, {}),   // 立即执行
            new RepeatedTask("关卡挑战", 20402, {}, 1000 * 30), // 每10秒执行一次
            new RepeatedTask("真火秘境", 25602, { "type": 1 }, 1000 * 30), // 每10秒执行一次
            new RepeatedTask("镇妖塔挑战", 20762, {index: 0, isOneKey: true}, 1000 * 30), // 每10秒执行一次
        ];

        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
        const oneTimeFile = resolvePath(`../logs/${global.playerId}_${today}`);
        if (!fs.existsSync(oneTimeFile)) {
            fs.writeFileSync(oneTimeFile, 'pass');
            logger.info("添加额外的初始化任务!!!");
            const staticTasks = [
                new ImmediateTask("仙宫朝拜", 24802, {titleId: 0, isRandom: 1}),
                new ImmediateTask("升宝堂", 21005, { activityId: 9772959, mallId: 400000003, count: "1" }),
                new ImmediateTask("自选礼包", 21005, { activityId: 9712933, mallId: 400000003, count: "1" }),
                new ImmediateTask("超值礼包", 21005, { activityId: 9712935, mallId: 400000003, count: "1" }),
                new ImmediateTask("仙缘福泽签到", 210701, { activityId: 9712901, conditionId: 10006, type: 1 }),
                new ImmediateTask("仙缘免费礼包", 21005, { activityId: 9712913, mallId: 400000001, count: "1" }),
                new ImmediateTask("灵兽运势免费券", 21005, { activityId: 250008, mallId: 400000010, count: "1" }),
                new ImmediateTask("灵兽运势分享奖励", 21016, { activityId: 0, conditionId: 0 }),
                new ImmediateTask("灵兽运势游戏圈奖励", 21031, { activityId: 0, conditionId: 0 }),
                new ImmediateTask("镇妖塔选择偏好", 20767, {markPreference: [{priority: 1,skillType: 1017},{priority: 2,skillType: 1018},{priority: 3,skillType: 1023},{priority: 4,skillType: 1024},{priority: 5,skillType: 1022}]}),
                new ImmediateTask("镇妖塔快速挑战", 20763, {}),
                new ImmediateTask("镇妖塔一键选择", 20764, {index: 0, isOneKey: true}),
                new ImmediateTask("妖盟砍价", 22166, { bussinessId: 2178 }),
                new ImmediateTask("妖盟广告1", 20019, { activityId: 0, conditionId: 120006, isUseADTime: false }),
                new ImmediateTask("妖盟广告2", 20503, { taskId: [120006] }),
                new ImmediateTask("妖盟买桃免费", 20601, { mallId: 230000011, count: 1, activityId: 0 }),
                new ImmediateTask("妖盟买桃1", 20601, { mallId: 230000001, count: 1, activityId: 0 }),
                new ImmediateTask("妖盟买桃2", 20601, { mallId: 230000002, count: 1, activityId: 0 }),
                new ImmediateTask("妖盟买腾蛇信物", 20601, { mallId: 230000012, count: 3, activityId: 0 }),
                new ImmediateTask("妖盟领取每日任务奖励", 22118, { actIndex: 4 }),
                new ImmediateTask("群英榜商店买桃", 20601, {mallId: 250000001, count: 1, activityId: 0}),
            ];

            // 如果是周一到周五，添加额外的任务
            const day = new Date().getDay();
            if (day >= 1 && day <= 5) {
                staticTasks.push(
                    new ImmediateTask("妖盟布阵", 25802, {}),
                    new ImmediateTask("妖盟战斗", 25805, {}),
                    new ImmediateTask("妖盟领奖", 25804, {})
                );
            }

            initialTasks.push(...staticTasks);

            initialTasks.push(
                new CountedTask("广告精怪", 20822, { drawTimes: 1, isAd: true, isUseADTime: false }, 1000, 2),
                new CountedTask("广告神通", 24408, { times: 1, isAd: true, isUseADTime: false }, 1000, 2),
                new CountedTask("广告法宝", 26302, { drawTimes: 1, isAd: true, poolId: 1, isUseADTime: false }, 1000, 2),
                new CountedTask("广告宗门", 211814, { isUseADTime: false }, 1000, 2),
                new CountedTask("广告聚灵阵", 207019, { isUseADTime: false }, 1000, 3),
                new CountedTask("挑战妖王", 20733, {}, 1000, 8),
            );
            // initialTasks.push(new CountedTask("异兽入侵", 20215, {}, 1000, 5)); // 异兽入侵5次 - 需要切分身
        }

        for (const task of initialTasks) {
            try {
                await this.add(task);
            } catch (error) {
                logger.error(`Error adding task ${task.name}: ${error.message}`);
            }
        }

        this.isConnect = true;
    }
}

export { Task, ImmediateTask, RepeatedTask, CountedTask, TimedTask, TaskManager };
