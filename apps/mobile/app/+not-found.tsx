import { Link, Stack } from "expo-router";
import { View } from "react-native";
import { AppText, SkyBackground } from "@app/ui";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Introuvable" }} />
      <SkyBackground variant="dawn">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 20 }}>
          <AppText variant="title1">Cet écran n'existe pas.</AppText>
          <Link href="/" accessibilityRole="link">
            <AppText variant="body" color="accentText">
              Retourner à l'accueil
            </AppText>
          </Link>
        </View>
      </SkyBackground>
    </>
  );
}
