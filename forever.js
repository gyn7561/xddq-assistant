import { spawn } from "child_process";
import account from "./account.js";
import logger from "./utils/logger.js";

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getNextRestartDelay() {
    const now = new Date();
    const nextRestart = new Date();
    nextRestart.setHours(0, 30, 0, 0); // 设置时间为 0:30

    if (now > nextRestart) {
        nextRestart.setDate(now.getDate() + 1); // 如果当前时间已过 0:30，则设定为下一天的 0:30
    }

    return nextRestart - now; // 返回到下次重启的时间间隔（毫秒）
}

(async () => {
    let childProcess;
    let restartTimeout;
    let isRestarting = false; // 标志变量

    async function runCmd() {
        return new Promise((resolve, reject) => {
            childProcess = spawn("node", ["app.js"], {
                cwd: process.cwd(),
                shell: true,
                stdio: "inherit",
                env: {
                    ...process.env,
                },
            });

            childProcess.on("exit", async (code, signal) => {
                logger.warn(`[守护] 子进程以code ${code} 和 signal ${signal} 退出`);
                if (!isRestarting) { // 确保在非计划重启时重新启动
                    await sleep(account.reconnectInterval); // 确保子进程重启前有足够的时间间隔
                    restartProcess();
                }
                resolve(code);
            });

            childProcess.on("error", (err) => {
                logger.error("[守护] 子进程出错", err);
                reject(err);
            });
        });
    }

    async function restartProcess() {
        isRestarting = true;
        if (childProcess) {
            childProcess.kill(); // 杀死当前子进程
        }
        await sleep(1000); // 等待子进程完全退出
        await runCmd();
        isRestarting = false;
    }

    function scheduleDailyRestart() {
        clearTimeout(restartTimeout); // 清除之前的定时器

        const delay = getNextRestartDelay();
        restartTimeout = setTimeout(() => {
            logger.info("[守护] 执行每日重启");
            restartProcess().then(scheduleDailyRestart); // 重启子进程后重新设置下一次重启
        }, delay);
    }

    // 开始运行子进程和设置每日重启定时器
    runCmd();
    scheduleDailyRestart();
})();