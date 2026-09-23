// Galerie de tous les composants : rendue par les tests web et capturable pour la revue visuelle.
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  AppText,
  Button,
  Chip,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  GlassCard,
  Illustration,
  Logo,
  ListRow,
  LoadingState,
  Monogram,
  ProgressBar,
  RankRow,
  SegmentedControl,
  SkyBackground,
  StatTile,
  StepRing,
  SwitchRow,
  TextField,
  Toast,
  formatSteps,
  markTies,
  space,
} from "../index";

const ranking = markTies([
  { rank: 1, name: "lea", steps: 9650 },
  { rank: 2, name: "tom", steps: 8450, isMe: true },
  { rank: 2, name: "sam.b", steps: 8450 },
  { rank: 4, name: "marc_d", steps: 6120 },
]);

export function Gallery({ withSheet = false }: { withSheet?: boolean }) {
  const [period, setPeriod] = useState<"day" | "week">("day");
  return (
    <SkyBackground>
      <ScrollView testID="gallery-scroll" contentContainerStyle={styles.content}>
        <AppText variant="largeTitle">Galerie</AppText>
        <GlassCard>
          <Logo />
          <View style={styles.chips}>
            {(["sunrise", "together", "privacy", "calm", "offline", "farewell"] as const).map((k) => (
              <Illustration key={k} kind={k} width={140} />
            ))}
          </View>
        </GlassCard>
        <GlassCard>
          <StepRing progress={0.69} accessibilityLabel="Progression vers 10 000 pas" accessibilityValueText="8 450 pas sur 10 000">
            <AppText variant="hero">8 450</AppText>
            <AppText color="textSecondary">pas aujourd'hui</AppText>
          </StepRing>
        </GlassCard>
        <GlassCard>
          <View style={styles.row}>
            <StatTile label="Calories actives" value="312 kcal" />
            <StatTile label="Rang du jour" value="2e" />
          </View>
        </GlassCard>
        <SegmentedControl
          accessibilityLabel="Période du classement"
          options={[
            { value: "day", label: "Aujourd'hui" },
            { value: "week", label: "Cette semaine" },
          ]}
          value={period}
          onChange={setPeriod}
        />
        <GlassCard padded={false}>
          {ranking.map((e) => (
            <RankRow key={e.name} {...e} onPress={e.isMe ? undefined : () => undefined} />
          ))}
        </GlassCard>
        <GlassCard>
          <Button label="Ajouter" onPress={() => undefined} />
          <View style={styles.gap} />
          <Button label="Réessayer" variant="secondary" onPress={() => undefined} />
          <View style={styles.gap} />
          <Button label="Chargement" loading onPress={() => undefined} />
          <View style={styles.gap} />
          <Button label="Désactivé" disabled onPress={() => undefined} />
          <View style={styles.gap} />
          <Button label="Bloquer lea" variant="destructive" onPress={() => undefined} />
          <View style={styles.gap} />
          <Button label="Annuler" variant="ghost" onPress={() => undefined} />
        </GlassCard>
        <GlassCard>
          <TextField label="Pseudo de ton ami" helper="Tape son pseudo exact." />
          <View style={styles.gap} />
          <TextField label="Pseudo" error="Ce pseudo est déjà pris. Essaie une variante." defaultValue="tom" />
        </GlassCard>
        <GlassCard>
          <ListRow title="lea" subtitle="9 650 pas aujourd'hui" leading={<Monogram name="lea" />} onPress={() => undefined} />
          <ListRow
            title="nina"
            subtitle="Demande reçue"
            leading={<Monogram name="nina" />}
            trailing={<Button label="Accepter" size="compact" variant="secondary" onPress={() => undefined} />}
          />
          <SwitchRow title="Afficher mes calories à mes amis" subtitle="Sinon, seuls tes pas sont visibles." value onValueChange={() => undefined} />
          <ListRow title="Heures silencieuses" value="22 h – 8 h" onPress={() => undefined} />
        </GlassCard>
        <GlassCard>
          <View style={styles.chips}>
            <Chip label="Bravo pour ta marche !" onPress={() => undefined} selected />
            <Chip label="Tu m'inspires !" onPress={() => undefined} disabled />
            <Chip label="Quelle régularité !" onPress={() => undefined} />
          </View>
          <View style={styles.gap} />
          <ProgressBar progress={0.62} accessibilityLabel="Mardi" accessibilityValueText={formatSteps(8450)} />
        </GlassCard>
        <GlassCard>
          <LoadingState accessibilityLabel="Chargement du classement" />
        </GlassCard>
        <GlassCard>
          <EmptyState
            title="Le classement se remplit avec tes amis"
            message="Ajoute un proche avec son pseudo pour marcher ensemble."
            action={{ label: "Ajouter un ami", onPress: () => undefined }}
          />
        </GlassCard>
        <GlassCard>
          <ErrorState message="Vérifie ta connexion puis réessaie." onRetry={() => undefined} />
        </GlassCard>
      </ScrollView>
      <Toast visible message="Encouragement envoyé à marc_d" onHide={() => undefined} />
      <ConfirmSheet
        visible={withSheet}
        title="Bloquer lea ?"
        message="lea ne pourra plus te trouver, t'envoyer de demande ni voir ton activité."
        confirmLabel="Bloquer"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[5], gap: space[4] },
  row: { flexDirection: "row", gap: space[4] },
  gap: { height: space[3] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
});
