/**
 * onboarding-flow.tsx — the stepped questionnaire (white paper §11.2).
 *
 * One question per screen with a progress bar, Back/Next, and a live target
 * preview on the final step (the "aha" moment lands before the user even
 * finishes). On completion it hands a fully-formed ProfileInput to the caller,
 * which persists it. No storage logic lives here — this component is just UI.
 */

import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DotMatrix } from '@/components/ui/primitives';
import {
  maxContentWidth,
  palette,
  radius,
  shadow,
  type as typo,
} from '@/constants/palette';
import {
  ACTIVITY_FACTORS,
  computeTargets,
  type ActivityLevel,
  type ProfileInput,
} from '@/lib/targets';

type Draft = Partial<ProfileInput>;

const ACTIVITY_OPTIONS: {
  value: ActivityLevel;
  title: string;
  hint: string;
}[] = [
  { value: 'sedentary', title: 'Sedentary', hint: 'Desk job, little exercise' },
  { value: 'light', title: 'Light', hint: 'Light exercise 1 to 3 days a week' },
  { value: 'moderate', title: 'Moderate', hint: 'Exercise 3 to 5 days a week' },
  { value: 'active', title: 'Active', hint: 'Hard exercise 6 to 7 days a week' },
  {
    value: 'very_active',
    title: 'Very active',
    hint: 'Physical job or training twice a day',
  },
];

const RATE_OPTIONS: { value: number; title: string; hint: string }[] = [
  { value: 0.25, title: 'Gentle', hint: '0.25 kg / week' },
  { value: 0.5, title: 'Steady', hint: '0.5 kg / week' },
  { value: 0.75, title: 'Brisk', hint: '0.75 kg / week' },
  { value: 1.0, title: 'Aggressive', hint: '1.0 kg / week' },
];

type StepId =
  | 'welcome'
  | 'sex'
  | 'age'
  | 'height'
  | 'weight'
  | 'activity'
  | 'rate'
  | 'review';
const QUESTION_STEPS: StepId[] = [
  'sex',
  'age',
  'height',
  'weight',
  'activity',
  'rate',
  'review',
];

export function OnboardingFlow({
  initial,
  onComplete,
  onCancel,
}: {
  initial?: ProfileInput;
  onComplete: (profile: ProfileInput) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial ?? {});
  const [index, setIndex] = useState(0);
  // Fresh users get a branded welcome first; editing jumps straight in.
  const steps = useMemo<StepId[]>(
    () => (initial ? QUESTION_STEPS : ['welcome', ...QUESTION_STEPS]),
    [initial],
  );
  const step = steps[index];
  const isLast = index === steps.length - 1;
  // Question numbering excludes the welcome step.
  const stepLabel = `Step ${initial ? index + 1 : index} of ${QUESTION_STEPS.length}`;
  const nextLabel =
    step === 'welcome'
      ? 'Get started'
      : isLast
        ? initial
          ? 'Save'
          : 'Start tracking'
        : 'Next';

  const set = (patch: Draft) => setDraft((d) => ({ ...d, ...patch }));

  const canAdvance = useMemo(() => stepIsValid(step, draft), [step, draft]);

  const back = () => {
    if (index === 0) onCancel?.();
    else setIndex((i) => i - 1);
  };
  const next = () => {
    if (!canAdvance) return;
    if (isLast) onComplete(draft as ProfileInput);
    else setIndex((i) => i + 1);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        {/* Progress */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${((index + 1) / steps.length) * 100}%` },
            ]}
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'welcome' && (
            <View style={styles.welcomeWrap}>
              <Text style={styles.welcomeBrand}>DEFICIT</Text>
              <Text style={styles.title}>Let’s build your plan</Text>
              <Text style={styles.hint}>
                A daily calorie target built from your numbers, grounded in
                real food data. It takes about a minute.
              </Text>
            </View>
          )}

          {step === 'sex' && (
            <Question
              eyebrow={stepLabel}
              title="What's your biological sex?"
              hint="Used by the Mifflin-St Jeor formula. It changes the calorie math."
            >
              <OptionRow>
                <OptionCard
                  label="Male"
                  selected={draft.sex === 'male'}
                  onPress={() => set({ sex: 'male' })}
                />
                <OptionCard
                  label="Female"
                  selected={draft.sex === 'female'}
                  onPress={() => set({ sex: 'female' })}
                />
              </OptionRow>
            </Question>
          )}

          {step === 'age' && (
            <Question
              eyebrow={stepLabel}
              title="How old are you?"
              hint="Years."
            >
              <NumberField
                value={draft.age}
                onChange={(n) => set({ age: n })}
                suffix="years"
                placeholder="30"
              />
            </Question>
          )}

          {step === 'height' && (
            <Question
              eyebrow={stepLabel}
              title="How tall are you?"
              hint="Centimetres."
            >
              <NumberField
                value={draft.heightCm}
                onChange={(n) => set({ heightCm: n })}
                suffix="cm"
                placeholder="180"
              />
            </Question>
          )}

          {step === 'weight' && (
            <Question
              eyebrow={stepLabel}
              title="What's your current weight?"
              hint="Kilograms. You can update this any time."
            >
              <NumberField
                value={draft.weightKg}
                onChange={(n) => set({ weightKg: n })}
                suffix="kg"
                placeholder="85"
              />
            </Question>
          )}

          {step === 'activity' && (
            <Question
              eyebrow={stepLabel}
              title="How active are you?"
              hint="Be honest. Overestimating is the most common mistake."
            >
              <View style={styles.stack}>
                {ACTIVITY_OPTIONS.map((o) => (
                  <ListOption
                    key={o.value}
                    title={o.title}
                    hint={o.hint}
                    trailing={`×${ACTIVITY_FACTORS[o.value]}`}
                    selected={draft.activityLevel === o.value}
                    onPress={() => set({ activityLevel: o.value })}
                  />
                ))}
              </View>
            </Question>
          )}

          {step === 'rate' && (
            <Question
              eyebrow={stepLabel}
              title="How fast do you want to lose?"
              hint="We cap the pace for safety. Faster is not better, and it costs muscle."
            >
              <View style={styles.stack}>
                {RATE_OPTIONS.map((o) => (
                  <ListOption
                    key={o.value}
                    title={o.title}
                    hint={o.hint}
                    selected={draft.goalRateKgWeek === o.value}
                    onPress={() => set({ goalRateKgWeek: o.value })}
                  />
                ))}
              </View>
            </Question>
          )}

          {step === 'review' && <ReviewStep draft={draft} />}
        </ScrollView>

        {/* Nav */}
        <View style={styles.nav}>
          <Pressable style={styles.backBtn} onPress={back}>
            <Text style={styles.backText}>
              {index === 0 ? (onCancel ? 'Cancel' : '') : 'Back'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.nextBtn, !canAdvance && styles.nextBtnDisabled]}
            disabled={!canAdvance}
            onPress={next}
          >
            <Text style={styles.nextText}>{nextLabel}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function ReviewStep({ draft }: { draft: Draft }) {
  const complete = stepIsValid('review', draft);
  const t = complete ? computeTargets(draft as ProfileInput) : null;
  return (
    <Question
      eyebrow="Last step"
      title="Here's your daily target"
      hint="You can fine-tune anything later."
    >
      {t ? (
        <View style={styles.previewCard}>
          <DotMatrix style={styles.previewNumber}>
            {t.targetKcal.toLocaleString()}
          </DotMatrix>
          <Text style={styles.previewUnit}>kcal / day</Text>
          <View style={styles.previewMacros}>
            <Text style={styles.previewMacro}>P {t.proteinG}g</Text>
            <Text style={styles.previewDot}>·</Text>
            <Text style={styles.previewMacro}>C {t.carbsG}g</Text>
            <Text style={styles.previewDot}>·</Text>
            <Text style={styles.previewMacro}>F {t.fatG}g</Text>
          </View>
          {t.safetyNote ? (
            <Text style={styles.previewSafety}>{t.safetyNote}</Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.hint}>Go back and finish the earlier steps.</Text>
      )}
    </Question>
  );
}

/* ---------- validation ---------- */

function stepIsValid(step: StepId, d: Draft): boolean {
  switch (step) {
    case 'welcome':
      return true;
    case 'sex':
      return d.sex === 'male' || d.sex === 'female';
    case 'age':
      return isNum(d.age) && d.age >= 13 && d.age <= 100;
    case 'height':
      return isNum(d.heightCm) && d.heightCm >= 120 && d.heightCm <= 230;
    case 'weight':
      return isNum(d.weightKg) && d.weightKg >= 30 && d.weightKg <= 300;
    case 'activity':
      return d.activityLevel != null;
    case 'rate':
      return isNum(d.goalRateKgWeek);
    case 'review':
      return (
        (d.sex === 'male' || d.sex === 'female') &&
        isNum(d.age) &&
        isNum(d.heightCm) &&
        isNum(d.weightKg) &&
        d.activityLevel != null &&
        isNum(d.goalRateKgWeek)
      );
  }
}

const isNum = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

/* ---------- small presentational pieces ---------- */

function Question({
  eyebrow,
  title,
  hint,
  children,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.questionBody}>{children}</View>
    </View>
  );
}

function OptionRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.optionRow}>{children}</View>;
}

function OptionCard({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.optionCard, selected && styles.optionCardSelected]}
      onPress={onPress}
    >
      <Text
        style={[styles.optionLabel, selected && styles.optionLabelSelected]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ListOption({
  title,
  hint,
  trailing,
  selected,
  onPress,
}: {
  title: string;
  hint?: string;
  trailing?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.listOption, selected && styles.listOptionSelected]}
      onPress={onPress}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.listTitle, selected && styles.optionLabelSelected]}
        >
          {title}
        </Text>
        {hint ? <Text style={styles.listHint}>{hint}</Text> : null}
      </View>
      {trailing ? <Text style={styles.listTrailing}>{trailing}</Text> : null}
    </Pressable>
  );
}

function NumberField({
  value,
  onChange,
  suffix,
  placeholder,
}: {
  value?: number;
  onChange: (n: number) => void;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <View style={styles.numberField}>
      <TextInput
        style={styles.numberInput}
        keyboardType="number-pad"
        inputMode="numeric"
        value={value != null && !Number.isNaN(value) ? String(value) : ''}
        onChangeText={(txt) => {
          const cleaned = txt.replace(/[^0-9.]/g, '');
          onChange(cleaned === '' ? NaN : Number(cleaned));
        }}
        placeholder={placeholder}
        placeholderTextColor={palette.textDim}
        autoFocus
      />
      {suffix ? <Text style={styles.numberSuffix}>{suffix}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  safe: { flex: 1 },
  progressTrack: {
    height: 3,
    backgroundColor: palette.surface2,
    marginHorizontal: 24,
    marginTop: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: { height: 3, backgroundColor: palette.accent },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    maxWidth: maxContentWidth,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
  },
  eyebrow: { ...typo.eyebrow, color: palette.textFaint },
  welcomeWrap: { flex: 1, justifyContent: 'center' },
  welcomeBrand: { ...typo.eyebrow, color: palette.accent, marginBottom: 16 },
  title: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 10,
    lineHeight: 34,
  },
  hint: {
    color: palette.textMuted,
    fontSize: 15,
    marginTop: 10,
    lineHeight: 21,
  },
  questionBody: { marginTop: 28 },
  stack: { gap: 12 },
  optionRow: { flexDirection: 'row', gap: 12 },
  optionCard: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingVertical: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.hairline,
  },
  optionCardSelected: {
    borderColor: palette.accentBorder,
    backgroundColor: palette.accentSoft,
  },
  optionLabel: { color: palette.textMuted, fontSize: 18, fontWeight: '700' },
  optionLabelSelected: { color: palette.text },
  listOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: palette.hairline,
  },
  listOptionSelected: {
    borderColor: palette.accentBorder,
    backgroundColor: palette.accentSoft,
  },
  listTitle: { color: palette.textMuted, fontSize: 17, fontWeight: '700' },
  listHint: { color: palette.textFaint, fontSize: 13, marginTop: 3 },
  listTrailing: { color: palette.textFaint, fontSize: 14, fontWeight: '600' },
  numberField: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderBottomWidth: 2,
    borderBottomColor: palette.accentBorder,
    paddingBottom: 8,
  },
  numberInput: {
    color: palette.text,
    fontSize: 48,
    fontWeight: '800',
    flex: 1,
    padding: 0,
  },
  numberSuffix: { color: palette.textFaint, fontSize: 18, marginLeft: 8 },
  previewCard: {
    alignItems: 'center',
    paddingVertical: 32,
    borderRadius: 24,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    ...shadow.card,
  },
  previewNumber: { ...typo.hero, fontSize: 56, color: palette.text },
  previewUnit: { color: palette.textFaint, fontSize: 16, marginTop: 4 },
  previewMacros: { flexDirection: 'row', gap: 8, marginTop: 16 },
  previewMacro: { color: palette.text, fontSize: 15, fontWeight: '600' },
  previewDot: { color: palette.textDim, fontSize: 15 },
  previewSafety: {
    color: palette.warn,
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 19,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
    maxWidth: maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  backBtn: { paddingVertical: 14, paddingHorizontal: 8, minWidth: 64 },
  backText: { color: palette.textMuted, fontSize: 16, fontWeight: '600' },
  nextBtn: {
    flex: 1,
    backgroundColor: palette.accent,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: palette.surface2, opacity: 0.6 },
  nextText: { color: palette.accentText, fontSize: 17, fontWeight: '700' },
});
