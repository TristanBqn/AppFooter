/// <reference lib="dom" />
// Point d'entrée navigateur de la galerie (react-native-web), utilisé par scripts/gallery.mjs.
import { AppRegistry } from "react-native";
import { Gallery } from "./Gallery";

const params = new URLSearchParams(window.location.search);
AppRegistry.registerComponent("Gallery", () => () => <Gallery withSheet={params.get("sheet") === "1"} />);
AppRegistry.runApplication("Gallery", { rootTag: document.getElementById("root") });
