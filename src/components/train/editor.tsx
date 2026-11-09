/**
 * editor.tsx: exercise cards and set rows, the part of the logger touched
 * hundreds of times a session. The rules it is built on:
 *
 *   last time's numbers sit in the empty boxes, so an unchanged set is one
 *   tap on the tick; tapping PREVIOUS copies that set in; a set's label
 *   opens its type (warmup, drop, failure); a record shows the moment the
 *   set is ticked.
 */

import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { CheckIcon, DotsIcon, PlusIcon } from '@/components/ui/icons';
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
  formatKg,
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
  type Bests,
  type WorkSet,
  type WorkoutExercise,
} from '@/lib/train/workout';

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
          {kind === 'bodyweight' ? '+KG' : 'KG'}
        </Text>
        <Text style={[tr.colText, { width: COL.reps }]}>REPS</Text>
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

function SetRow({
  sets,
  index,
  kind,
  previous,
  pr,
  editable,
  typeOpen,
  nudge,
  onType,
  onSet,
  onTick,
  onRemove,
}: {
  sets: WorkSet[];
  index: number;
  kind: Exercise['kind'];
  previous: WorkSet[] | undefined;
  pr: boolean;
  editable: boolean;
  typeOpen: boolean;
  nudge: boolean;
  onType: () => void;
  onSet: (patch: Partial<WorkSet>) => void;
  onTick: () => void;
  onRemove: () => void;
}) {
  const s = sets[index];
  const ex = { kind };
  const prev = previousFor(sets, index, previous);
  const ph = placeholderFor(sets, index, previous);
  const label = setLabel(sets, index);
  const bw = kind === 'bodyweight';
  const kgPlaceholder = ph.kg != null ? formatKg(ph.kg) : bw ? 'BW' : '';
  const needsKg = nudge && !bw && s.kg == null && ph.kg == null;
  const needsReps = nudge && s.reps == null && ph.reps == null;

  return (
    <View>
      <View style={[tr.setRow, editable && s.done && tr.setRowDone]}>
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
          onPress={() => prev && onSet({ kg: prev.kg, reps: prev.reps })}
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
            <NumField
              value={s.kg}
              placeholder={kgPlaceholder}
              decimal
              label={`Set ${label} ${bw ? 'added weight' : 'weight'}`}
              onChange={(kg) => onSet({ kg })}
              style={[
                tr.cell,
                { width: COL.kg },
                s.done && tr.cellDone,
                needsKg && tr.cellNudge,
              ]}
            />
            <NumField
              value={s.reps}
              placeholder={ph.reps != null ? String(ph.reps) : ''}
              label={`Set ${label} reps`}
              onChange={(reps) => onSet({ reps })}
              style={[
                tr.cell,
                { width: COL.reps },
                s.done && tr.cellDone,
                needsReps && tr.cellNudge,
              ]}
            />
          </>
        ) : (
          <>
            <Text style={[tr.cellText, { width: COL.kg }]}>
              {bw ? (s.kg ? `+${formatKg(s.kg)}` : 'BW') : formatKg(s.kg ?? 0)}
            </Text>
            <Text style={[tr.cellText, { width: COL.reps }]}>
              {s.reps ?? 0}
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
