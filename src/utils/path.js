import { fileURLToPath } from "url";
import path from "path";

export default function createPath(metaUrl) {
    const __dirname = path.dirname(fileURLToPath(metaUrl));
    const resolvePath = (...segments) => path.resolve(__dirname, ...segments);
    return resolvePath;
}