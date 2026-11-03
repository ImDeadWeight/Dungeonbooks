/**
 * @file Small dialog asking how many copies of an NPC to add (1–100).
 */
import { useState } from 'react';
import { Modal } from '../common/Modal';

/** Props for QuantityPrompt. */
interface Props {
  name: string;
  onConfirm(quantity: number): void;
  onCancel(): void;
}

/** Number box with Add / Cancel; Enter adds. */
export function QuantityPrompt({ name, onConfirm, onCancel }: Props) {
  const [text, setText] = useState('1');
  const n = Number.parseInt(text, 10);
  const valid = Number.isFinite(n) && n >= 1 && n <= 100;
  // Confirm when the number is valid.
  const submit = () => valid && onConfirm(n);
  return (
    <Modal
      title={`How many ${name}?`}
      size="small"
      onClose={onCancel}
      footer={
        <>
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" disabled={!valid} onClick={submit}>Add</button>
        </>
      }
    >
      <input
        type="number"
        min={1}
        max={100}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
    </Modal>
  );
}
