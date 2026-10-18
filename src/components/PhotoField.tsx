'use client';
import { useEffect, useState } from 'react';
import { shrinkImage } from '@/lib/image-client';

/**
 * One file input with a preview.
 *
 * The parent form reads the prepared file out of the FormData it already has,
 * so this component's only job is to put the right File there under the right
 * name. It replaces the raw browser file with the downsized one from
 * `shrinkImage` — the browser still posts `formData.get(name)` as a File, which
 * is exactly what the server action expects.
 */
export default function PhotoField({
  name,
  label,
  hint,
  disabled,
}: {
  name: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Revoke the object URL on change and unmount. Without this a page that is
  // opened and closed repeatedly in a session leaks one blob per photo.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const input = event.currentTarget;
    const original = input.files?.[0];
    if (!original) { setPreview(null); return; }

    const prepared = await shrinkImage(original);

    // Write the prepared file back into the input so the enclosing <form>
    // submits it. `DataTransfer` is the only way to set `input.files`.
    if (prepared !== original) {
      const transfer = new DataTransfer();
      transfer.items.add(prepared);
      input.files = transfer.files;
    }

    if (prepared.size > 5 * 1024 * 1024) {
      setError('That photo is still larger than 5 MB. Choose a smaller one.');
      input.value = '';
      setPreview(null);
      return;
    }

    setPreview(URL.createObjectURL(prepared));
  }

  return (
    <div className="rounded-2xl border border-dashed p-4 dark:border-white/15">
      <label className="block text-sm font-bold dark:text-slate-200">
        {label}
        {hint && <span className="mt-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{hint}</span>}
        <input
          type="file"
          name={name}
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          disabled={disabled}
          onChange={onChange}
          className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white disabled:opacity-50 dark:text-slate-200 dark:file:bg-white dark:file:text-slate-900"
        />
      </label>
      {preview && (
        <div className="mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Selected photo preview" className="max-h-56 rounded-xl border object-contain dark:border-white/10" />
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
}
