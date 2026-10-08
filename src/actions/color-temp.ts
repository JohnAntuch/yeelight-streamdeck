import { action, DidReceiveSettingsEvent, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";

import { keyImage, kelvinToHex } from "../render";
import { cmd, runOnLamps } from "../yeelight";

type Settings = { ip?: string; mode?: "set" | "warmer" | "cooler"; kelvin?: number; step?: number };

@action({ UUID: "com.local.yeelight.colortemp" })
export class ColorTemp extends SingletonAction<Settings> {
	override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
		if (ev.action.isKey()) await this.draw(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): Promise<void> {
		if (ev.action.isKey()) await this.draw(ev.action, ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
		const { ip, mode = "set" } = ev.payload.settings;
		const kelvin = Number(ev.payload.settings.kelvin ?? 4000);
		const step = Number(ev.payload.settings.step ?? 10);

		const commands =
			mode === "set"
				? [cmd.power(true), cmd.colorTemp(kelvin)]
				: [cmd.adjustColorTemp(mode === "cooler" ? step : -step)];

		if (!(await runOnLamps(ip, commands))) await ev.action.showAlert();
	}

	private async draw(key: KeyAction<Settings>, s: Settings): Promise<void> {
		const mode = s.mode ?? "set";
		if (mode === "set") {
			const kelvin = Number(s.kelvin ?? 4000);
			await key.setImage(keyImage({ bg: kelvinToHex(kelvin), line1: `${kelvin}K`, line2: "White" }));
		} else {
			await key.setImage(
				keyImage(mode === "warmer" ? { bg: "#ff9a3c", line1: "Warmer" } : { bg: "#9ec5ff", line1: "Cooler" })
			);
		}
	}
}
