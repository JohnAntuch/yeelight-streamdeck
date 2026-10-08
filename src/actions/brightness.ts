import { action, DidReceiveSettingsEvent, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";

import { keyImage } from "../render";
import { cmd, runOnLamps } from "../yeelight";

type Settings = { ip?: string; mode?: "set" | "up" | "down"; level?: number; step?: number };

@action({ UUID: "com.local.yeelight.brightness" })
export class Brightness extends SingletonAction<Settings> {
	override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
		if (ev.action.isKey()) await this.draw(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): Promise<void> {
		if (ev.action.isKey()) await this.draw(ev.action, ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
		const { ip, mode = "set" } = ev.payload.settings;
		const level = Number(ev.payload.settings.level ?? 50);
		const step = Number(ev.payload.settings.step ?? 10);

		const commands =
			mode === "set"
				? [cmd.power(true), cmd.brightness(level)]
				: [cmd.adjustBrightness(mode === "up" ? step : -step)];

		if (!(await runOnLamps(ip, commands))) await ev.action.showAlert();
	}

	private async draw(key: KeyAction<Settings>, s: Settings): Promise<void> {
		const mode = s.mode ?? "set";
		const line1 = mode === "set" ? `${Number(s.level ?? 50)}%` : `${mode === "up" ? "+" : "-"}${Number(s.step ?? 10)}%`;
		await key.setImage(keyImage({ bg: "#2b2b2b", line1, line2: "Brightness" }));
	}
}
