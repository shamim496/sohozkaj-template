import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLOR, GREY } from '../constants/theme';
import { useT } from '../i18n';
import { Field, Input, Pill } from './ui';

/**
 * The form, built from the template rather than written for it.
 *
 * Every control here comes from `template.fields`, which an admin defines in the
 * browser. Adding a `{player_name}` token to a template's prompt makes a "Player
 * name" box appear in this app with no code change at all — which is the whole
 * point of the AI-template system, and the reason none of these fields are
 * hard-coded.
 *
 * Types the backend can send: text | textarea | number | dropdown | options |
 * colorpicker. Anything unrecognised falls back to a plain text box rather than
 * rendering nothing, so a template using a newer type is still usable.
 *
 * Field *labels* come from the admin's own wording and are shown verbatim — they
 * are content, not interface chrome, so they are not translated here.
 */

/** Choices are stored as `[{ label, value }]`, but either half can be missing. */
const choiceValue = (choice) => choice?.value ?? choice?.label ?? '';
const choiceLabel = (choice) => choice?.label ?? choice?.value ?? '';

/**
 * The defaults the backend substitutes when a field is left empty.
 *
 * Seeding them here means the first generate reproduces the template as its
 * author designed it, instead of leaving a literal `{key}` in the prompt.
 */
export function defaultFieldValues(fields = []) {
  const values = {};
  for (const field of fields) {
    if (field.type === 'colorpicker') {
      const color = field.defaultColor || choiceValue(field.choices?.[0]);
      if (color) values[field.key] = color;
    } else if (field.type === 'dropdown' || field.type === 'options') {
      const first = (field.choices || [])[0];
      if (first) values[field.key] = choiceValue(first);
    }
  }
  return values;
}

/** Mirrors the checks the generate button is gated on. */
export function validateFields(fields = [], values = {}) {
  for (const field of fields) {
    const value = (values[field.key] ?? '').toString().trim();
    if (field.required && !value) return false;
    if (!value) continue;
    if ((field.type === 'text' || field.type === 'textarea') && field.minLength) {
      if (value.length < field.minLength) return false;
    }
    if (field.type === 'number') {
      const num = Number(value);
      if (Number.isNaN(num)) return false;
      if (field.minValue != null && num < field.minValue) return false;
      if (field.maxValue != null && num > field.maxValue) return false;
    }
  }
  return true;
}

/**
 * Parses `template.fields`, which arrives either as an array or as a JSON
 * string depending on how old the row is.
 */
export function parseFields(raw) {
  if (!raw) return [];
  try {
    const parsed = Array.isArray(raw) ? raw : JSON.parse(raw);
    return (parsed || []).filter((field) => field?.key);
  } catch {
    return [];
  }
}

function ColorField({ field, value, onChange }) {
  const choices = (field.choices || []).map((choice) => ({
    id: choiceValue(choice),
    label: choiceLabel(choice),
  }));
  // A colorpicker with no choices still has a default — show that one swatch
  // rather than an empty row, so the user can see what will be used.
  const swatches = choices.length
    ? choices
    : field.defaultColor
      ? [{ id: field.defaultColor, label: field.defaultColor }]
      : [];

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {swatches.map((swatch) => {
        const selected = swatch.id === value;
        const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(swatch.id) ? swatch.id : GREY.border;
        return (
          <Pressable
            key={swatch.id}
            onPress={() => onChange(swatch.id)}
            accessibilityLabel={swatch.label}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              borderWidth: 2,
              borderColor: selected ? COLOR.violet500 : GREY.border,
              backgroundColor: hex,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {selected ? (
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="m5 13 4 4L19 7"
                  stroke={COLOR.white}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function FieldInputs({ fields = [], values, onChange }) {
  const { t } = useT();
  if (!fields.length) return null;

  return (
    <View style={{ gap: 14 }}>
      {fields.map((field) => {
        const value = values[field.key] ?? '';
        const set = (next) => onChange(field.key, next);
        const label = field.label || field.key;
        const placeholder = field.placeholder || label;

        if (field.type === 'colorpicker') {
          return (
            <Field key={field.key} label={label} required={field.required}>
              <ColorField field={field} value={value} onChange={set} />
            </Field>
          );
        }

        if (field.type === 'dropdown' || field.type === 'options') {
          const choices = (field.choices || []).map((choice) => ({
            id: choiceValue(choice),
            label: choiceLabel(choice),
          }));
          return (
            <Field key={field.key} label={label} required={field.required}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingRight: 8 }}
              >
                {choices.map((choice) => (
                  <Pill
                    key={choice.id}
                    label={choice.label}
                    active={choice.id === value}
                    onPress={() => set(choice.id)}
                  />
                ))}
              </ScrollView>
            </Field>
          );
        }

        if (field.type === 'number') {
          const num = Number(value);
          const outOfRange =
            value !== '' &&
            ((field.minValue != null && num < field.minValue) ||
              (field.maxValue != null && num > field.maxValue));
          const range =
            field.minValue != null && field.maxValue != null
              ? `${field.minValue} – ${field.maxValue}`
              : field.minValue != null
                ? `≥ ${field.minValue}`
                : field.maxValue != null
                  ? `≤ ${field.maxValue}`
                  : undefined;

          return (
            <Field
              key={field.key}
              label={label}
              required={field.required}
              hint={range}
              error={outOfRange ? t.fillRequired : undefined}
            >
              <Input
                value={String(value)}
                onChangeText={set}
                placeholder={placeholder}
                keyboardType="number-pad"
                invalid={outOfRange}
              />
            </Field>
          );
        }

        const multiline = field.type === 'textarea';
        const tooShort =
          value !== '' && field.minLength != null && String(value).length < field.minLength;

        return (
          <Field
            key={field.key}
            label={label}
            required={field.required}
            hint={
              field.charLimit ? `${String(value).length} / ${field.charLimit}` : undefined
            }
            error={tooShort ? t.fillRequired : undefined}
          >
            <Input
              value={String(value)}
              onChangeText={set}
              placeholder={placeholder}
              multiline={multiline}
              invalid={tooShort}
              maxLength={field.charLimit || undefined}
            />
          </Field>
        );
      })}
    </View>
  );
}
