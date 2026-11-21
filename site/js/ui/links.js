// Where the page points outside itself.
import { el } from "./dom.js";

export const SURVEY = "https://flashpointopinions.com/0a4c06d5-1ea1-43dd-89d7-2458c955b58a";
export const REPO = "https://github.com/institutor/priced-out";
export const SOURCES = `${REPO}#sources`;
export const inRepo = (path) => `${REPO}/blob/main/${path}`;
export const folder = (path) => `${REPO}/tree/main/${path}`;

// A link that leaves the page opens in a new tab, so a price that has been
// typed in, or a file that has been loaded, is still there afterwards.
export const outside = (href, text) => el("a", { href, target: "_blank", rel: "noopener", text });
