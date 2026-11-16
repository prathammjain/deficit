/**
 * editor.tsx: exercise cards and set rows, the part of the logger touched
 * hundreds of times a session. The rules it is built on:
 *
 *   last time's numbers sit in the empty boxes, so an unchanged set is one
 *   tap on the tick; tapping PREVIOUS copies that set in; a set's label
 *   opens its type (warmup, drop, failure); a record shows the moment the
 *   set is ticked.
 */

import { useEffect, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';

import {
  CheckIcon,
  DotsIcon,
  MinusIcon,
  PlusIcon,
} from '@/components/ui/icons';
import { Card } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import {
  EQUIPMENT_LABEL,
  MUSCLE_LABEL,
  type Exercise,
} from '@/lib/train/exercises';
import { repsText } from '@/lib/train/program';
import {
  REST_CHOICES,
  RPE_CHOICES,
  SET_TYPES,
  addSet,
  canTick,
  filled,
  moveBlock,
  patchBlock,
  patchSet,
  placeholderFor,
  previousFor,
  prSets,
  removeBlock,
  removeSet,
  restText,
  setLabel,
  setText,
  valuesOf,
  type Bests,
  type ValueKey,
  type WorkSet,
  type WorkoutExercise,
} from '@/lib/train/workout';
import {
  fromShown,
  loadNum,
  loadStep,
  loadUnit,
  toShown,
} from '@/lib/train/units';

import { Chip, NumField } from './bits';
import { COL, tr } from './styles';

export interface BlockListProps {
  blocks: WorkoutExercise[];
  exById: Map<string, Exercise>;
  /** Last time's sets per exercise. */
  previous: Map<string, WorkSet[]>;
  /** Best ever per exercise, before this workout. */
  bests: Map<string, Bests>;
  bodyKg: number;
  editable: boolean;
  /** Live logging only: the rest each exercise gets. */
  restFor?: (b: WorkoutExercise) => number;
  /** `ticked` is the exercise whose set was just ticked, to start its rest. */
  onChange: (next: WorkoutExercise[], ticked?: WorkoutExercise) => void;
  onRest?: (b: WorkoutExercise, sec: number) => void;
  onReplace: (blockId: string) => void;
  onHistory: (exerciseId: string) => void;
}

export function BlockList(p: BlockListProps) {
  const [menu, setMenu] = useState<string | null>(null);
  const [typeFor, setTypeFor] = useState<string | null>(null);
  const [nudge, setNudge] = useState<string | null>(null);
  // The set being worked on: last focused, or next after a tick.
  const [active, setActive] = useState<string | null>(null);

  return (
    <View>
      {p.blocks.map((b, i) => {
        const ex = p.exById.get(b.exerciseId);
        const prev = p.previous.get(b.exerciseId);
        const tick = (index: number) => {
          const s = b.sets[index];
          if (s.done) {
            p.onChange(patchSet(p.blocks, b.id, s.id, { done: false }));
            return;
          }
          const v = filled(s, placeholderFor(b.sets, index, prev));
          if (!ex || !canTick(v, ex)) {
            setNudge(s.id);
            setTimeout(() => setNudge((n) => (n === s.id ? null : n)), 1600);
            return;
          }
          const next = patchSet(p.blocks, b.id, s.id, { ...v, done: true });
          setActive(b.sets.find((x, j) => j > index && !x.done)?.id ?? null);
          p.onChange(
            next,
            next.find((x) => x.id === b.id),
          );
        };
        return (
          <ExerciseCard
            key={b.id}
            block={b}
            ex={ex}
            previous={prev}
            prs={
              ex ? prSets(b.sets, ex, p.bodyKg, p.bests.get(ex.id)) : new Set()
            }
            editable={p.editable}
            first={i === 0}
            last={i === p.blocks.length - 1}
            rest={p.restFor?.(b)}
            menuOpen={menu === b.id}
            typeFor={typeFor}
            nudge={nudge}
            active={active}
            onActive={setActive}
            onMenu={() => setMenu(menu === b.id ? null : b.id)}
            onTypeFor={(id) => setTypeFor(typeFor === id ? null : id)}
            onSet={(setId, patch) =>
              p.onChange(patchSet(p.blocks, b.id, setId, patch))
            }
            onTick={tick}
            onAddSet={() => p.onChange(addSet(p.blocks, b.id))}
            onRemoveSet={(setId) => {
              setTypeFor(null);
              p.onChange(removeSet(p.blocks, b.id, setId));
            }}
            onPatch={(patch) => p.onChange(patchBlock(p.blocks, b.id, patch))}
            onRemove={() => {
              setMenu(null);
              p.onChange(removeBlock(p.blocks, b.id));
            }}
            onMove={(by) => p.onChange(moveBlock(p.blocks, b.id, by))}
            onRest={p.onRest ? (sec) => p.onRest?.(b, sec) : undefined}
            onReplace={() => {
              setMenu(null);
              p.onReplace(b.id);
            }}
            onHistory={() => p.onHistory(b.exerciseId)}
          />
        );
      })}
    </View>
  );
}

function ExerciseCard({
  block,
  ex,
  previous,
  prs,
  editable,
  first,
  last,
  rest,
  menuOpen,
  typeFor,
  nudge,
  active,
  onActive,
  onMenu,
  onTypeFor,
  onSet,
  onTick,
  onAddSet,
  onRemoveSet,
  onPatch,
  onRemove,
  onMove,
  onRest,
  onReplace,
  onHistory,
}: {
  block: WorkoutExercise;
  ex: Exercise | undefined;
  previous: WorkSet[] | undefined;
  prs: Set<string>;
  editable: boolean;
  first: boolean;
  last: boolean;
  rest?: number;
  menuOpen: boolean;
  typeFor: string | null;
  nudge: string | null;
  active: string | null;
  onActive: (setId: string) => void;
  onMenu: () => void;
  onTypeFor: (setId: string) => void;
  onSet: (setId: string, patch: Partial<WorkSet>) => void;
  onTick: (index: number) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onPatch: (patch: Partial<WorkoutExercise>) => void;
  onRemove: () => void;
  onMove: (by: -1 | 1) => void;
  onRest?: (sec: number) => void;
  onReplace: () => void;
  onHistory: () => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const kind = ex?.kind ?? 'weighted';
  const meta = ex
    ? [
        MUSCLE_LABEL[ex.muscle],
        EQUIPMENT_LABEL[ex.equipment],
        ex.perSide ? 'each side' : null,
        rest != null ? `rest ${restText(rest)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'This exercise is no longer in your list';
  const anyDone = block.sets.some((s) => s.done);

  return (
    <Card padded={false} style={tr.card}>
      <View style={tr.cardHead}>
        <Pressable
          style={tr.flex1}
          onPress={onHistory}
          accessibilityRole="link"
          accessibilityLabel={`${ex?.name ?? 'Exercise'} history`}
        >
          <Text style={tr.exName}>{ex?.name ?? 'Unknown exercise'}</Text>
          <Text style={tr.exMeta}>{meta}</Text>
          {block.target ? (
            <Text style={[tr.exMeta, tr.accentText]}>
              Aim for {repsText(block.target)}
            </Text>
          ) : null}
        </Pressable>
        {editable ? (
          <Pressable
            onPress={onMenu}
            hitSlop={6}
            accessibilityLabel={`${ex?.name ?? 'Exercise'} options`}
            style={({ pressed }) => [
              tr.iconBtn,
              menuOpen && { backgroundColor: palette.surface2 },
              pressed && tr.pressed,
            ]}
          >
            <DotsIcon />
          </Pressable>
        ) : null}
      </View>

      {block.note && !menuOpen ? (
        <Text style={tr.note}>{block.note}</Text>
      ) : null}

      {menuOpen ? (
        <View style={tr.menu}>
          {onRest ? (
            <View style={{ gap: 8 }}>
              <Text style={tr.menuLabel}>REST AFTER EACH SET</Text>
              <View style={tr.chips}>
                {REST_CHOICES.map((sec) => (
                  <Chip
                    key={sec}
                    label={restText(sec)}
                    on={sec === rest}
                    onPress={() => onRest(sec)}
                  />
                ))}
              </View>
            </View>
          ) : null}
          <TextInput
            style={tr.noteInput}
            placeholder="Note: seat 4, grip, cue"
            placeholderTextColor={palette.textDim}
            value={block.note ?? ''}
            onChangeText={(t) => onPatch({ note: t ? t : undefined })}
          />
          <View style={tr.chips}>
            <Chip label="Replace" onPress={onReplace} />
            <Chip label="Move up" disabled={first} onPress={() => onMove(-1)} />
            <Chip label="Move down" disabled={last} onPress={() => onMove(1)} />
            <Chip
              label={confirmRemove ? 'Tap again to remove' : 'Remove'}
              danger
              onPress={() => {
                if (anyDone && !confirmRemove) setConfirmRemove(true);
                else onRemove();
              }}
            />
          </View>
        </View>
      ) : null}

      <View style={tr.colHead}>
        <Text style={[tr.colText, { width: COL.set }]}>SET</Text>
        <Text style={[tr.colText, tr.flex1]}>PREVIOUS</Text>
        <Text style={[tr.colText, { width: COL.kg }]}>
          {fieldsFor(kind)[0].label}
        </Text>
        <Text style={[tr.colText, { width: COL.reps }]}>
          {fieldsFor(kind)[1].label}
        </Text>
        <View style={{ width: COL.tick }} />
      </View>

      {block.sets.map((s, i) => (
        <SetRow
          key={s.id}
          sets={block.sets}
          index={i}
          kind={kind}
          previous={previous}
          pr={prs.has(s.id)}
          editable={editable}
          typeOpen={typeFor === s.id}
          nudge={nudge === s.id}
          active={
            active === s.id ||
            (active == null &&
              !s.done &&
              block.sets.findIndex((x) => !x.done) === i &&
              anyDone)
          }
          onFocus={() => onActive(s.id)}
          onType={() => onTypeFor(s.id)}
          onSet={(patch) => onSet(s.id, patch)}
          onTick={() => onTick(i)}
          onRemove={() => onRemoveSet(s.id)}
        />
      ))}

      {editable ? (
        <Pressable
          onPress={onAddSet}
          style={({ pressed }) => [tr.addSet, pressed && tr.pressed]}
          accessibilityLabel={`Add a set of ${ex?.name ?? 'this exercise'}`}
        >
          <PlusIcon size={12} color={palette.textMuted} />
          <Text style={tr.addSetText}>Add set</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

/** What a set's two boxes hold, by exercise kind. */
interface Field {
  key: ValueKey;
  label: string;
  /** A load, shown and typed in the chosen unit. */
  load: boolean;
  /** What a tap on plus or minus adds, in stored units. */
  step: number;
}

function fieldsFor(kind: Exercise['kind']): [Field, Field] {
  const u = loadUnit().toUpperCase();
  const load = (key: ValueKey, label: string): Field => ({
    key,
    label,
    load: true,
    step: loadStep(),
  });
  const plain = (key: ValueKey, label: string, step: number): Field => ({
    key,
    label,
    load: false,
    step,
  });
  switch (kind) {
    case 'bodyweight':
      return [load('kg', `+${u}`), plain('reps', 'REPS', 1)];
    case 'assisted':
      return [load('assist', 'HELP'), plain('reps', 'REPS', 1)];
    case 'timed':
      return [load('kg', `+${u}`), plain('secs', 'SEC', 5)];
    case 'distance':
      return [load('kg', u), plain('m', 'M', 10)];
    default:
      return [load('kg', u), plain('reps', 'REPS', 1)];
  }
}

/** The field a kind can't be ticked without, besides the second box. */
const needsFirst = (kind: Exercise['kind']) => kind === 'weighted';

const shownValue = (f: Field, v: number | null | undefined) =>
  v == null ? '' : f.load ? loadNum(v) : String(v);

const POP: ViewStyle | null =
  Platform.OS === 'web'
    ? ({
        animationKeyframes: [
          {
            '0%': { transform: [{ scale: 0.7 }] },
            '55%': { transform: [{ scale: 1.18 }] },
            '100%': { transform: [{ scale: 1 }] },
          },
        ],
        animationDuration: '320ms',
        animationTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      } as unknown as ViewStyle)
    : null;

const FADE: ViewStyle | null =
  Platform.OS === 'web'
    ? ({
        transitionProperty: 'background-color',
        transitionDuration: '220ms',
      } as unknown as ViewStyle)
    : null;

/** How far a set must be dragged left to delete it. */
const SWIPE_DELETE = 96;

function SetRow({
  sets,
  index,
  kind,
  previous,
  pr,
  editable,
  typeOpen,
  nudge,
  active,
  onType,
  onSet,
  onTick,
  onRemove,
  onFocus,
}: {
  sets: WorkSet[];
  index: number;
  kind: Exercise['kind'];
  previous: WorkSet[] | undefined;
  pr: boolean;
  editable: boolean;
  typeOpen: boolean;
  nudge: boolean;
  /** The set being worked on: it shows the plus and minus buttons. */
  active: boolean;
  onType: () => void;
  onSet: (patch: Partial<WorkSet>) => void;
  onTick: () => void;
  onRemove: () => void;
  onFocus: () => void;
}) {
  const s = sets[index];
  const ex = { kind };
  const prev = previousFor(sets, index, previous);
  const ph = placeholderFor(sets, index, previous);
  const label = setLabel(sets, index);
  const [a, b] = fieldsFor(kind);
  const aHint =
    ph[a.key] != null
      ? shownValue(a, ph[a.key])
      : kind === 'bodyweight' || kind === 'assisted' || kind === 'timed'
        ? 'BW'
        : '';
  const needsA =
    nudge && needsFirst(kind) && s[a.key] == null && ph[a.key] == null;
  const needsB = nudge && s[b.key] == null && ph[b.key] == null;

  // Swipe left to delete. Only a clearly sideways drag starts it, so
  // scrolling and typing are untouched.
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (gone) onRemove();
  }, [gone, onRemove]);
  const [x] = useState(() => new Animated.Value(0));
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderMove: (_, g) => x.setValue(Math.min(0, g.dx)),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -SWIPE_DELETE) {
          Animated.timing(x, {
            toValue: -480,
            duration: 160,
            useNativeDriver: false,
          }).start(() => setGone(true));
        } else {
          Animated.spring(x, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 6,
          }).start();
        }
      },
      onPanResponderTerminate: () =>
        Animated.spring(x, { toValue: 0, useNativeDriver: false }).start(),
    }),
  );

  const step = (f: Field, dir: 1 | -1) => {
    const base = s[f.key] ?? ph[f.key] ?? 0;
    const next = Math.max(0, Math.round((base + dir * f.step) * 1000) / 1000);
    onSet({ [f.key]: next });
  };

  const box = (f: Field, hint: string, needs: boolean, width: number) => (
    <NumField
      value={
        f.load && s[f.key] != null
          ? toShown(s[f.key] as number)
          : (s[f.key] ?? null)
      }
      placeholder={hint}
      decimal={f.load}
      maxLength={f.key === 'm' ? 5 : f.load ? 6 : 3}
      label={`Set ${label} ${f.label.toLowerCase()}`}
      onFocus={onFocus}
      onChange={(n) =>
        onSet({ [f.key]: n == null ? null : f.load ? fromShown(n) : n })
      }
      style={[tr.cell, { width }, s.done && tr.cellDone, needs && tr.cellNudge]}
    />
  );

  const row = (
    <View style={[tr.setRow, FADE, editable && s.done && tr.setRowDone]}>
      <Pressable
        onPress={onType}
        disabled={!editable}
        hitSlop={4}
        accessibilityLabel={`Set ${label} type`}
        style={({ pressed }) => [
          tr.setLabelBtn,
          typeOpen && { backgroundColor: palette.surface2 },
          pressed && tr.pressed,
        ]}
      >
        <Text
          style={[
            tr.setLabel,
            (s.type === 'drop' || s.type === 'failure') && tr.setLabelSpecial,
            s.type === 'warmup' && tr.setLabelWarm,
          ]}
        >
          {label}
        </Text>
        {s.rpe ? <Text style={tr.rpeTag}>@{s.rpe}</Text> : null}
      </Pressable>

      <Pressable
        style={tr.prevCell}
        disabled={!editable || !prev || s.done}
        onPress={() => prev && onSet(valuesOf(prev))}
        accessibilityLabel={
          prev ? `Use last time: ${setText(prev, ex)}` : undefined
        }
      >
        <Text style={tr.prevText} numberOfLines={1}>
          {prev ? setText(prev, ex) : ' '}
        </Text>
      </Pressable>

      {editable ? (
        <>
          {box(a, aHint, needsA, COL.kg)}
          {box(b, ph[b.key] != null ? String(ph[b.key]) : '', needsB, COL.reps)}
        </>
      ) : (
        <>
          <Text style={[tr.cellText, { width: COL.kg }]}>
            {s[a.key]
              ? `${a.label.startsWith('+') ? '+' : ''}${shownValue(a, s[a.key])}`
              : a.label.startsWith('+') || a.key === 'assist'
                ? 'BW'
                : '0'}
          </Text>
          <Text style={[tr.cellText, { width: COL.reps }]}>
            {s[b.key] ?? 0}
          </Text>
        </>
      )}

      <View style={tr.tick}>
        {editable ? (
          <Pressable
            onPress={onTick}
            hitSlop={6}
            accessibilityRole="checkbox"
            aria-checked={s.done}
            accessibilityLabel={`Set ${label} done`}
            style={({ pressed }) => [
              tr.tickCircle,
              s.done && tr.tickCircleDone,
              s.done && POP,
              pressed && tr.pressed,
            ]}
          >
            <CheckIcon
              size={14}
              color={s.done ? palette.surface : palette.textDim}
            />
          </Pressable>
        ) : null}
        {pr ? <Text style={tr.pr}>PR</Text> : null}
      </View>
    </View>
  );

  return (
    <View>
      {editable ? (
        <View style={es.swipeWrap}>
          <Animated.View
            style={[
              es.swipeUnder,
              {
                opacity: x.interpolate({
                  inputRange: [-40, -4, 0],
                  outputRange: [1, 0, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}
            pointerEvents="none"
          >
            <Text style={es.swipeText}>Delete</Text>
          </Animated.View>
          <Animated.View
            style={[es.swipeTop, { transform: [{ translateX: x }] }]}
            {...pan.panHandlers}
          >
            {row}
          </Animated.View>
        </View>
      ) : (
        row
      )}

      {editable && active && !s.done && !typeOpen ? (
        <View style={es.steps}>
          <Stepper field={a} onStep={(d) => step(a, d)} />
          <Stepper field={b} onStep={(d) => step(b, d)} />
        </View>
      ) : null}

      {typeOpen ? (
        <>
          <View style={tr.typeStrip}>
            {SET_TYPES.map((t) => (
              <Chip
                key={t.id}
                label={t.label}
                on={s.type === t.id}
                onPress={() => onSet({ type: t.id })}
              />
            ))}
            <Chip label="Remove set" danger onPress={onRemove} />
          </View>
          <View style={[tr.typeStrip, tr.row, { paddingTop: 0 }]}>
            <Text style={tr.menuLabel}>RPE</Text>
            {RPE_CHOICES.map((r) => (
              <Chip
                key={r}
                label={String(r)}
                on={s.rpe === r}
                onPress={() => onSet({ rpe: s.rpe === r ? undefined : r })}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** Minus and plus for one box: 2.5 kg or 5 lb, 1 rep, 5 s, 10 m. */
function Stepper({
  field,
  onStep,
}: {
  field: Field;
  onStep: (dir: 1 | -1) => void;
}) {
  const amount = field.load
    ? `${loadNum(field.step)}`
    : field.key === 'secs'
      ? '5s'
      : field.key === 'm'
        ? '10 m'
        : '1';
  const name = field.load ? loadUnit() : field.label.toLowerCase();
  return (
    <View style={es.stepper}>
      <Pressable
        onPress={() => onStep(-1)}
        hitSlop={4}
        accessibilityLabel={`${amount} ${name} less`}
        style={({ pressed }) => [es.stepBtn, pressed && tr.pressed]}
      >
        <MinusIcon size={11} />
        <Text style={es.stepText}>{amount}</Text>
      </Pressable>
      <Text style={es.stepName}>{field.label}</Text>
      <Pressable
        onPress={() => onStep(1)}
        hitSlop={4}
        accessibilityLabel={`${amount} ${name} more`}
        style={({ pressed }) => [es.stepBtn, pressed && tr.pressed]}
      >
        <PlusIcon size={11} />
        <Text style={es.stepText}>{amount}</Text>
      </Pressable>
    </View>
  );
}

const es = StyleSheet.create({
  swipeWrap: { position: 'relative', overflow: 'hidden', borderRadius: 10 },
  swipeUnder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.danger,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 16,
    borderRadius: 10,
  },
  swipeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  swipeTop: { backgroundColor: palette.surface },
  steps: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 8,
  },
  stepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface2,
    borderRadius: 10,
    padding: 3,
  },
  stepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 8,
    backgroundColor: palette.surface,
  },
  stepText: { fontSize: 12.5, fontWeight: '700', color: palette.text },
  stepName: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: palette.textMuted,
  },
});
