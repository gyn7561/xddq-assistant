import { spawn } from "child_process";
import account from "./account.js";

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
    async function runCmd() {
        return new Promise((resolve, reject) => {
            const childProcess = spawn("node", ["app.js"], {
                cwd: process.cwd(),
                shell: true,
                stdio: "inherit",
                env: {
                    ...process.env,
                    "XDDQ-ASSISTANT-USE-FOREVER": "true",
                },
            });

            childProcess.on("exit", (code, signal) => {
                console.log(`子进程以code ${code} 和 signal ${signal} 退出`);
                resolve(code);
            });

            childProcess.on("error", (err) => {
                console.error("子进程出错", err);
                reject(err);
            });
        });
    }

    let childProcess;
    let restartTimeout;

    async function startProcess() {
        try {
            await runCmd();
        } catch (error) {
            console.error("运行子进程出错，准备重新启动", error);
        }
        await sleep(account.reconnectInterval); // 确保子进程重启前有足够的时间间隔
        startProcess();
    }

    function scheduleDailyRestart() {
        clearTimeout(restartTimeout); // 清除之前的定时器

        const delay = getNextRestartDelay();
        restartTimeout = setTimeout(() => {
            console.log("执行每日重启");
            childProcess.kill(); // 杀死当前子进程
            startProcess(); // 重启子进程
            scheduleDailyRestart(); // 重新设置下一次重启
        }, delay);
    }

    // 开始运行子进程和设置每日重启定时器
    startProcess();
    scheduleDailyRestart();
})();
