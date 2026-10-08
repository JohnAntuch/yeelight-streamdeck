import { action, DidReceiveSettingsEvent, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";

import { keyImage, kelvinToHex } from "../render";
import { cmd, hexToInt, runOnLamps } from "../yeelight";

type Settings = {
	ip?: string;
	name?: string;
	type?: "ct" | "color";
	kelvin?: number;
	color?: string;
	brightness?: number;
};

@action({ UUID: "com.local.yeelight.scene" })
export class SceneAction extends SingletonAction<Settings> {
	override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
		if (ev.action.isKey()) await this.draw(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): Promise<void> {
		if (ev.action.isKey()) await this.draw(ev.action, ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
		const { ip, type = "ct", color = "#ff0000" } = ev.payload.settings;
		const kelvin = Number(ev.payload.settings.kelvin ?? 4000);
		const brightness = Number(ev.payload.settings.brightness ?? 100);

		// set_scene also switches the lamp on if it is off.
		const command = type === "color" ? cmd.sceneColor(hexToInt(color), brightness) : cmd.sceneTemp(kelvin, brightness);
		if (!(await runOnLamps(ip, [command]))) await ev.action.showAlert();
	}

	private async draw(key: KeyAction<Settings>, s: Settings): Promise<void> {
		const bg = s.type === "color" ? (s.color ?? "#ff0000") : kelvinToHex(Number(s.kelvin ?? 4000));
		await key.setImage(keyImage({ bg, line1: s.name?.trim() || "Scene", line2: `${Number(s.brightness ?? 100)}%` }));
	}
}
