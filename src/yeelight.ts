import streamDeck from "@elgato/streamdeck";
import net from "node:net";

const PORT = 55443;
/** Transition time (ms) for smooth changes. */
const DURATION = 400;

export interface Command {
	method: string;
	params?: unknown[];
}

let counter = 0;

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

		socket.setTimeout(timeoutMs, () => finish(new Error(`Timed out talking to ${ip}`)));
		socket.on("error", (err) => finish(err));
		socket.on("close", () => finish(new Error(`Connection to ${ip} closed early`)));

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

	const results = await Promise.allSettled(ips.map((ip) => sendCommands(ip, commands)));
	results.forEach((r, i) => {
		if (r.status === "rejected") streamDeck.logger.error(`Lamp ${ips[i]}: ${r.reason}`);
	});
	return results.every((r) => r.status === "fulfilled");
}

export async function isOn(ip: string): Promise<boolean> {
	const [reply] = await sendCommands(ip, [{ method: "get_prop", params: ["power"] }]);
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
