export const toHexString = (bytes) => {
    let hex = [];
    for (let i = 0; i < bytes.length; i++) {
        let current = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
        hex.push((current >>> 4).toString(16));
        hex.push((current & 0xf).toString(16));
    }
    return hex.join("");
};

// Function to convert hex string to bytes
export const toBytes = (hexString) => {
    const cleanHex = hexString.replace(/-/g, ""); // Remove all hyphens
    const bytes = [];
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes.push(parseInt(cleanHex.substr(i, 2), 16));
    }
    return new Uint8Array(bytes);
};

export const deepCopy = (obj) => {
    return JSON.parse(JSON.stringify(obj));
};

export const toInt = (x) => {
    return Number(x.toString());
};
