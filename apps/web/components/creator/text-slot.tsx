import { LIMITS } from '@picklab/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

type Props = { index: number; value: string; onChange: (v: string) => void; onRemove: () => void };

/** One text option with a character counter. */
export const TextSlot = ({ index, value, onChange, onRemove }: Props) => (
  <div className="space-y-1">
    <Field
      multiline
      label={`Option ${index + 1}`}
      value={value}
      maxLength={LIMITS.textMax}
      onChange={(e) => onChange(e.target.value)}
      hint={`${value.length} / ${LIMITS.textMax}`}
    />
    <Button variant="ghost" onClick={onRemove} aria-label={`Remove option ${index + 1}`}>
      Remove
    </Button>
  </div>
);
