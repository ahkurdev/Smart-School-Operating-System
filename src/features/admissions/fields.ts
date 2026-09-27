/**
 * Admissions form field catalogue (Phase 33).
 *
 * The closed set of field types staff can add to an application form, mirroring
 * the `ApplicationFieldType` enum. `defaultField` seeds a valid starter row.
 */

export type EditorField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder: string;
  helpText: string;
  options: string[];
  section: string;
};

export const FIELD_TYPES: { type: string; label: string }[] = [
  { type: "SHORT_TEXT", label: "Short text" },
  { type: "LONG_TEXT", label: "Long text" },
  { type: "NUMBER", label: "Number" },
  { type: "EMAIL", label: "Email" },
  { type: "PHONE", label: "Phone" },
  { type: "DATE", label: "Date" },
  { type: "SELECT", label: "Dropdown" },
  { type: "RADIO", label: "Single choice" },
  { type: "MULTI_SELECT", label: "Multiple choice" },
  { type: "CHECKBOX", label: "Checkbox" },
  { type: "ADDRESS", label: "Address" },
  { type: "GUARDIAN", label: "Guardian" },
  { type: "PREVIOUS_SCHOOL", label: "Previous school" },
  { type: "FILE", label: "File upload" },
  { type: "IMAGE", label: "Image upload" },
];

let counter = 0;

export function defaultField(type: string, index: number): EditorField {
  counter += 1;
  const label = FIELD_TYPES.find((t) => t.type === type)?.label ?? "Field";
  const key = `${type.toLowerCase()}_${index + 1}_${counter}`;
  return {
    key,
    label,
    type,
    required: false,
    placeholder: "",
    helpText: "",
    options: type === "SELECT" || type === "RADIO" || type === "MULTI_SELECT" ? ["Option 1", "Option 2"] : [],
    section: "",
  };
}
