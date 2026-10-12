import streamDeck from "@elgato/streamdeck";
import dgram from "node:dgram";
import net from "node:net";
import os from "node:os";

const PORT = 55443;
/** Transition time (ms) for smooth changes. */
const DURATION = 400;

export interface Command {
	method: string;
	params?: unknown[];
}

let counter = 0;

/** The lamp could not be reached (offline, wrong IP, timeout). Not used when the lamp itself rejects a command. */
export class LampUnreachable extends Error {}

/**
 * Opens a connection to one lamp, sends all commands, waits for every reply, then closes.
 * (Yeelight lamps only allow ~4 simultaneous connections, so we don't keep sockets open.)
 */
export function sendCommands(ip: string, commands: Command[], timeoutMs = 3000): Promise<unknown[][]> {
	return new Promise((resolve, reject) => {
		const ids = commands.map(() => ++counter);
		const waiting = new Set(ids);
		const results: unknown[][] = new Array(commands.length);
		let buffer = "";
		let finished = false;

		const socket = net.createConnection({ host: ip, port: PORT });

		const finish = (error?: Error): void => {
			if (finished) return;
			finished = true;
			socket.destroy();
			if (error) reject(error);
			else resolve(results);
		};

		socket.setTimeout(timeoutMs, () => finish(new LampUnreachable(`Timed out talking to ${ip}`)));
		socket.on("error", (err) => finish(new LampUnreachable(`${ip}: ${err.message}`)));
		socket.on("close", () => finish(new LampUnreachable(`Connection to ${ip} closed early`)));

		socket.on("connect", () => {
			const payload = commands
				.map((c, i) => JSON.stringify({ id: ids[i], method: c.method, params: c.params ?? [] }) + "\r\n")
				.join("");
			socket.write(payload);
		});

		socket.on("data", (chunk) => {
			buffer += chunk.toString("utf8");
			let end: number;
			while ((end = buffer.indexOf("\r\n")) !== -1) {
				const line = buffer.slice(0, end).trim();
				buffer = buffer.slice(end + 2);
				if (!line) continue;

				let msg: { id?: number; result?: unknown[]; error?: { message?: string } };
				try {
					msg = JSON.parse(line);
				} catch {
					continue;
				}

				// Ignore async "props" notifications; we only care about replies to our ids.
				if (msg.id === undefined || !waiting.has(msg.id)) continue;
				if (msg.error) {
					finish(new Error(msg.error.message ?? "Lamp returned an error"));
					return;
				}
				results[ids.indexOf(msg.id)] = msg.result ?? [];
				waiting.delete(msg.id);
				if (waiting.size === 0) finish();
			}
		});
	});
}

/** "192.168.1.50, 192.168.1.51" -> ["192.168.1.50", "192.168.1.51"] */
export function parseIps(raw?: string): string[] {
	return (raw ?? "").split(/[\s,;]+/).filter(Boolean);
}

/** Sends the same commands to every lamp in the list. Returns true only if all succeeded. */
export async function runOnLamps(raw: string | undefined, commands: Command[]): Promise<boolean> {
	const ips = parseIps(raw);
	if (ips.length === 0) return false;

	const results = await Promise.allSettled(ips.map((ip) => sendToLamp(ip, commands)));
	results.forEach((r, i) => {
		if (r.status === "rejected") streamDeck.logger.error(`Lamp ${ips[i]}: ${r.reason}`);
	});
	return results.every((r) => r.status === "fulfilled");
}

export async function isOn(ip: string, background = false): Promise<boolean> {
	const [reply] = await sendToLamp(ip, [{ method: "get_prop", params: ["power"] }], background);
	return reply[0] === "on";
}

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Math.round(n)));
export const hexToInt = (hex: string): number => parseInt(hex.replace("#", ""), 16) || 0;

/** Command builders for the Yeelight LAN protocol. */
export const cmd = {
	power: (on: boolean): Command => ({ method: "set_power", params: [on ? "on" : "off", "smooth", DURATION] }),
	brightness: (percent: number): Command => ({ method: "set_bright", params: [clamp(percent, 1, 100), "smooth", DURATION] }),
	adjustBrightness: (delta: number): Command => ({ method: "adjust_bright", params: [clamp(delta, -100, 100), DURATION] }),
	colorTemp: (kelvin: number): Command => ({ method: "set_ct_abx", params: [clamp(kelvin, 1700, 6500), "smooth", DURATION] }),
	adjustColorTemp: (delta: number): Command => ({ method: "adjust_ct", params: [clamp(delta, -100, 100), DURATION] }),
	rgb: (value: number): Command => ({ method: "set_rgb", params: [value, "smooth", DURATION] }),
	sceneColor: (value: number, brightness: number): Command => ({ method: "set_scene", params: ["color", value, clamp(brightness, 1, 100)] }),
	sceneTemp: (kelvin: number, brightness: number): Command => ({ method: "set_scene", params: ["ct", clamp(kelvin, 1700, 6500), clamp(brightness, 1, 100)] })
};

/* ------------------------------------------------------------------------------------------------
 * Following lamps that change IP address
 *
 * Every lamp has a permanent id. The plugin remembers which id belongs to each IP it has seen and
 * where that lamp currently is. If a lamp can't be reached, the plugin searches the network, finds it
 * under its new IP and redirects the old (typed) IP there. The settings of your keys never change.
 * ---------------------------------------------------------------------------------------------- */

type Known = {
	/** every IP ever seen for a lamp -> its permanent id */
	ids: Record<string, string>;
	/** permanent id -> the lamp's current IP */
	current: Record<string, string>;
};

let known: Known = { ids: {}, current: {} };
let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** Loads what was learned in earlier sessions. Call once after streamDeck.connect(). */
export async function loadKnownLamps(): Promise<void> {
	try {
		const saved = await streamDeck.settings.getGlobalSettings<Known>();
		if (saved?.ids && saved?.current) known = { ids: { ...saved.ids }, current: { ...saved.current } };
	} catch (err) {
		streamDeck.logger.warn(`Could not load known lamps: ${err}`);
	}
}

function persist(): void {
	clearTimeout(saveTimer);
	saveTimer = setTimeout(() => {
		streamDeck.settings.setGlobalSettings<Known>(known).catch((err) => streamDeck.logger.warn(`Could not save known lamps: ${err}`));
	}, 500);
}

/** The IP a lamp is at right now, given an IP that was typed into a key. */
export function resolveIp(ip: string): string {
	const id = known.ids[ip];
	return (id && known.current[id]) || ip;
}

interface Found {
	ip: string;
	id: string;
}

function parseResponse(text: string): Found | null {
	const headers: Record<string, string> = {};
	for (const line of text.split("\r\n")) {
		const i = line.indexOf(":");
		if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
	}
	const m = /yeelight:\/\/([\d.]+):(\d+)/.exec(headers["location"] ?? "");
	const id = (headers["id"] ?? "").toLowerCase();
	return m && id ? { ip: m[1], id } : null;
}

/** SSDP search, sent from every local IPv4 interface (PCs often have several). */
function discover(timeoutMs = 2000): Promise<Found[]> {
	const message = Buffer.from('M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1982\r\nMAN: "ssdp:discover"\r\nST: wifi_bulb\r\n\r\n');
	const addresses = Object.values(os.networkInterfaces())
		.flat()
		.filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === "IPv4" && !i.internal)
		.map((i) => i.address);

	return new Promise((resolve) => {
		const found = new Map<string, Found>();
		const sockets = addresses.map((address) => {
			const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
			socket.on("error", () => {});
			socket.on("message", (buf) => {
				const lamp = parseResponse(buf.toString("utf8"));
				if (lamp) found.set(lamp.id, lamp);
			});
			socket.bind(0, address, () => {
				try {
					socket.setMulticastInterface(address);
					socket.send(message, 1982, "239.255.255.250");
				} catch {
					// ignore this interface
				}
			});
			return socket;
		});

		setTimeout(() => {
			for (const s of sockets) {
				try {
					s.close();
				} catch {
					// already closed
				}
			}
			resolve([...found.values()]);
		}, timeoutMs);
	});
}

function learn(found: Found[]): void {
	let changed = false;
	for (const { ip, id } of found) {
		if (known.ids[ip] !== id) {
			known.ids[ip] = id;
			changed = true;
		}
		if (known.current[id] !== ip) {
			if (known.current[id]) streamDeck.logger.info(`Lamp ${id} moved from ${known.current[id]} to ${ip}`);
			known.current[id] = ip;
			changed = true;
		}
	}
	if (changed) persist();
}

let inflight: Promise<void> | null = null;
let lastSearch = 0;

/** Searches the network and updates what is known. Searches at most once per `minGapMs`; concurrent calls share one search. */
export function refreshLamps(minGapMs = 0): Promise<void> {
	if (inflight) return inflight;
	if (Date.now() - lastSearch < minGapMs) return Promise.resolve();
	lastSearch = Date.now();
	inflight = discover()
		.then(learn)
		.catch(() => {})
		.finally(() => {
			inflight = null;
		});
	return inflight;
}

/**
 * Like sendCommands, but if the lamp can't be reached it looks for it under a new IP and retries once.
 * `background` calls (periodic status checks) search less often than calls caused by a key press.
 */
export async function sendToLamp(ip: string, commands: Command[], background = false): Promise<unknown[][]> {
	const first = resolveIp(ip);
	try {
		const reply = await sendCommands(first, commands);
		// Learn this lamp's id in the background if we haven't yet, so it can be found later.
		if (!known.ids[first]) void refreshLamps(60_000);
		return reply;
	} catch (err) {
		if (!(err instanceof LampUnreachable)) throw err;
		await refreshLamps(background ? 30_000 : 3_000);
		const second = resolveIp(ip);
		if (second === first) throw err;
		return sendCommands(second, commands);
	}
}
