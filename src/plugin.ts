import streamDeck from "@elgato/streamdeck";

import { Brightness } from "./actions/brightness";
import { ColorAction } from "./actions/color";
import { ColorTemp } from "./actions/color-temp";
import { SceneAction } from "./actions/scene";
import { ToggleLamp } from "./actions/toggle";

streamDeck.actions.registerAction(new ToggleLamp());
streamDeck.actions.registerAction(new Brightness());
streamDeck.actions.registerAction(new ColorTemp());
streamDeck.actions.registerAction(new ColorAction());
streamDeck.actions.registerAction(new SceneAction());

streamDeck.connect();
