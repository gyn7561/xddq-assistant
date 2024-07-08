import axios from 'axios';
import CryptoJS from "crypto-js";
import qs from "qs";
import { v4 as uuidv4 } from "uuid";

function getRandomNum(count) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let result = "";
    for (let i = 0; i < count; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function encryptPwd(pwd) {
    if (!pwd) {
        return null;
    }
    const str = getRandomNum(8) + pwd.substring(0, 3) + getRandomNum(5) + pwd.substring(3) + getRandomNum(2);
    return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(str)).trim();
}

function createRequestBody(token, uid, uname) {
    const dataObj = {
        clientId: uuidv4(),
        token: token,
        uid: uid,
        uname: uname
    };

    return encodeURIComponent(JSON.stringify(dataObj));
}

async function firstRequest(username, password) {
    const data = qs.stringify({
        'login_account': username,
        'password': encryptPwd(password)
    });

    const config = {
        method: 'post',
        url: 'https://mysdk.37.com/index.php?c=api-login&a=act_login',
        headers: { 
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: data
    };

    try {
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function secondRequest(username, ptoken) {
    const data = qs.stringify({
        'is_self': '1',
        'pid': '37h5',
        'ptoken': ptoken,
        'puid': username
    });

    const config = {
        method: 'post',
        url: 'https://apimyh5.37.com/index.php?c=sdk-login&a=act_login',
        headers: { 
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: data
    };

    try {
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function thirdRequest(serverId, token, uid, username) {
    const requestBody = createRequestBody(token, uid, username);

    const data = JSON.stringify({
        "data": requestBody,
        "loginType": 0,
        "channelId": 31,
        "appid": "37h5",
        "gameId": 223
    });

    const config = {
        method: 'post',
        url: `https://proxy-xddq.hdnd01.com/s${serverId}_http/player/login`,
        headers: { 
            'Content-Type': 'application/json'
        },
        data: data
    };

    try {
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function Bind(username, password) {
    try {
        const response = await firstRequest(username, password);
        const firstResponse = response.data;
        if (response.code === 1) {
            const uid = firstResponse.userinfo.uid || null;
            return firstResponse;
        } else {
            throw new Error("登陆失败");
        }
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function login(username, password, serverId) {
    try {
        const firstResponse = await Bind(username, password);
        const ptoken = firstResponse.app_pst;
        const uid = firstResponse.userinfo.uid;

        const secondResponse = await secondRequest(username, ptoken);
        if (secondResponse.code === 1) {
            const token = secondResponse.data.app_pst;

            const thirdResponse = await thirdRequest(serverId, token, uid, username);

            if (thirdResponse.ret !== 0) {
                throw new Error("登陆失败");
            }

            return thirdResponse;
        } else {
            throw new Error("登陆失败");
        }
    } catch (error) {
        throw new Error(error.message || "登陆失败");
    }
};

export { login };