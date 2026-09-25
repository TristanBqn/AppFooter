// @app/ui : design tokens + composants React Native partagés (consommateur : apps/mobile).
// Les modules purs (tokens, color, format, tailwind-preset) sont aussi importables seuls via
// "@app/ui/tokens", "@app/ui/format", "@app/ui/tailwind-preset" (sans React Native).
export * from "./tokens";
export * from "./color";
export * from "./format";
export { useReducedMotion, useReducedTransparency, useMotionDuration, announce, nativeDriver } from "./a11y";

export { AppText, textStyle, type AppTextProps } from "./components/AppText";
export { SkyBackground, type SkyBackgroundProps } from "./components/SkyBackground";
export { GlassCard, type GlassCardProps } from "./components/GlassCard";
export { Button, type ButtonProps, type ButtonVariant } from "./components/Button";
export { TextField, type TextFieldProps } from "./components/TextField";
export { StepRing, LARGE_TEXT_SCALE, type StepRingProps } from "./components/StepRing";
export { ProgressBar, type ProgressBarProps } from "./components/ProgressBar";
export { RankRow, type RankRowProps } from "./components/RankRow";
export { Monogram, type MonogramProps } from "./components/Monogram";
export { SegmentedControl, type SegmentedControlProps, type SegmentOption } from "./components/SegmentedControl";
export { ListRow, SwitchRow, SunBadge, type ListRowProps, type SwitchRowProps } from "./components/ListRow";
export { Chip, StatTile, type ChipProps, type StatTileProps } from "./components/Chip";
export {
  Skeleton,
  LoadingState,
  EmptyState,
  ErrorState,
  type SkeletonProps,
  type LoadingStateProps,
  type EmptyStateProps,
  type ErrorStateProps,
} from "./components/States";
export { ConfirmSheet, type ConfirmSheetProps } from "./components/ConfirmSheet";
export { Toast, type ToastProps } from "./components/Toast";
export { Illustration, Foot, LogoMarkShapes, LOGO_CLOUD, type IllustrationKind, type IllustrationProps } from "./components/Illustration";
export { Logo, type LogoProps } from "./components/Logo";
