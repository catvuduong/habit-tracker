'use client';

import { FormEvent, MouseEvent, useEffect, useRef, useState } from 'react';
import type { HabitFormValues, HabitOverview } from '@/lib/types';

const EMOJI_PRESETS = ['🏃', '📚', '💧', '🧘', '✅', '🥗', '😴', '🚴', '✍️', '🎹', '🧹', '💪', '🌱', '🎯', '🍎', '🎨'];
// Reference palette categorical slots (light values).
const COLOR_PRESETS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

interface HabitDialogProps {
  habit: HabitOverview | null;
  onClose: () => void;
  onSave: (values: HabitFormValues) => Promise<void>;
  onArchive: () => Promise<void>;
}

export function HabitDialog({ habit, onClose, onSave, onArchive }: HabitDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(habit?.name ?? '');
  const [emoji, setEmoji] = useState(habit?.emoji ?? EMOJI_PRESETS[0]);
  const [color, setColor] = useState(habit?.color ?? COLOR_PRESETS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) onClose();
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Give the habit a name.');
      return;
    }
    void run(() => onSave({ name: name.trim(), emoji: emoji.trim(), color }));
  }

  return (
    <dialog
      ref={dialogRef}
      className="habit-dialog"
      aria-labelledby="habit-dialog-title"
      onClick={handleBackdropClick}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form onSubmit={handleSubmit} className="dialog-form">
        <h2 id="habit-dialog-title">{habit ? 'Edit habit' : 'New habit'}</h2>

        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            placeholder="e.g. Stretch for 5 minutes"
            autoFocus
          />
        </label>

        <fieldset className="field">
          <legend>Icon</legend>
          <div className="emoji-grid">
            {EMOJI_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="emoji-option"
                aria-pressed={emoji === preset}
                onClick={() => setEmoji(preset)}
              >
                <span aria-hidden>{preset}</span>
                <span className="sr-only">{preset}</span>
              </button>
            ))}
          </div>
          <input
            className="emoji-input"
            value={emoji}
            onChange={(event) => setEmoji(event.target.value)}
            maxLength={16}
            aria-label="Custom emoji"
          />
        </fieldset>

        <fieldset className="field">
          <legend>Colour</legend>
          <div className="color-row">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="color-swatch"
                style={{ background: preset }}
                aria-label={preset}
                aria-pressed={color === preset}
                onClick={() => setColor(preset)}
              />
            ))}
            <label className="color-custom">
              <input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Custom colour" />
            </label>
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        <footer className="dialog-actions">
          {habit && (
            <button
              type="button"
              className="ghost-button danger"
              disabled={busy}
              onClick={() => void run(onArchive)}
            >
              Archive
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="ghost-button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? 'Saving…' : habit ? 'Save' : 'Add habit'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
