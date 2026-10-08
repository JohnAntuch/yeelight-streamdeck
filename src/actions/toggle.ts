import streamDeck, {
	action,
	DidReceiveSettingsEvent,
	KeyAction,
	KeyDownEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent
} from "@elgato/streamdeck";

import { cmd, isOn, parseIps, runOnLamps } from "../yeelight";

type Settings = { ip?: string };

const POLL_MS = 10_000;

@action({ UUID: "com.local.yeelight.toggle" })
export class ToggleLamp extends SingletonAction<Settings> {
	private timers = new Map<string, ReturnType<typeof setInterval>>();

	override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
		if (!ev.action.isKey()) return;
		const key = ev.action;

		await this.refresh(key, ev.payload.settings);
		// Keep the key in sync if the lamp is changed from the app / wall switch.
		this.timers.set(key.id, setInterval(async () => this.refresh(key, await key.getSettings()), POLL_MS));
	}

	override onWillDisappear(ev: WillDisappearEvent<Settings>): void {
		const timer = this.timers.get(ev.action.id);
		if (timer) clearInterval(timer);
		this.timers.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): Promise<void> {
		if (ev.action.isKey()) await this.refresh(ev.action, ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
		const ips = parseIps(ev.payload.settings.ip);
		if (ips.length === 0) {
			await ev.action.showAlert();
			return;
		}

		try {
			// Decide from the first lamp, then drive all lamps to the same state so they never drift apart.
			const turnOn = !(await isOn(ips[0]));
			if (!(await runOnLamps(ev.payload.settings.ip, [cmd.power(turnOn)]))) throw new Error("A lamp did not respond");
			await ev.action.setState(turnOn ? 1 : 0);
		} catch (err) {
			streamDeck.logger.error(`Toggle failed: ${err}`);
			await ev.action.showAlert();
		}
	}

	private async refresh(key: KeyAction<Settings>, settings: Settings): Promise<void> {
		const ip = parseIps(settings.ip)[0];
		if (!ip) return;
		try {
			await key.setState((await isOn(ip)) ? 1 : 0);
		} catch {
			// Lamp unreachable: leave the key as it is.
		}
	}
}
