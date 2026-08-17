'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { signIn } from './actions';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await signIn(formData);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.replace('/');
    router.refresh();
  };

  return (
    <main className="flex flex-1 items-center justify-center bg-brand-mist px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-hairline bg-white p-8 shadow-[0_20px_50px_-20px_rgba(32,94,131,0.25)]">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 shadow-[0_10px_25px_-8px_rgba(53,184,252,0.6)]">
          <span className="text-2xl font-extrabold text-white">F</span>
        </div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">FlyBaze Admin</h1>
        <p className="mt-1 text-sm text-slate">Connexion réservée à l’équipe.</p>

        <div className="mt-6 flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate">E-mail</label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-xl border border-hairline bg-brand-mist/60 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate">Mot de passe</label>
            <input
              name="password"
              type="password"
              required
              className="w-full rounded-xl border border-hairline bg-brand-mist/60 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-200"
            />
          </div>

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-full bg-brand-500 px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_25px_-8px_rgba(53,184,252,0.6)] transition hover:bg-brand-600 disabled:opacity-50"
          >
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </div>
      </form>
    </main>
  );
}
