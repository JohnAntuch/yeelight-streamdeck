import { action, DidReceiveSettingsEvent, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";

import { keyImage } from "../render";
import { cmd, hexToInt, runOnLamps } from "../yeelight";

type Settings = { ip?: string; color?: string };

@action({ UUID: "com.local.yeelight.color" })
export class ColorAction extends SingletonAction<Settings> {
	override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
		if (ev.action.isKey()) await this.draw(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): Promise<void> {
		if (ev.action.isKey()) await this.draw(ev.action, ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
		const { ip, color = "#ff0000" } = ev.payload.settings;
		if (!(await runOnLamps(ip, [cmd.power(true), cmd.rgb(hexToInt(color))]))) await ev.action.showAlert();
	}

	private async draw(key: KeyAction<Settings>, s: Settings): Promise<void> {
		const color = s.color ?? "#ff0000";
		await key.setImage(keyImage({ bg: color, line1: "Color", line2: color.toUpperCase() }));
	}
}
