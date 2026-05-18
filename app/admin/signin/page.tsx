export default function SigninPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form
        method="post"
        action="/api/admin/signin"
        className="max-w-sm w-full rounded-2xl p-8"
        style={{ background: 'var(--card)', color: 'var(--card-ink)' }}
      >
        <div className="label mb-2" style={{ color: 'var(--card-muted)' }}>
          Admin
        </div>
        <h1 className="text-2xl font-bold mb-6">Sign in</h1>
        <label htmlFor="token" className="field-label">
          Admin token
        </label>
        <input
          id="token"
          name="token"
          type="password"
          required
          autoFocus
          className="field-input mb-4"
        />
        <button
          type="submit"
          className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold w-full justify-center"
          style={{ background: 'var(--card-ink)', color: 'var(--card)' }}
        >
          Continue
        </button>
      </form>
    </main>
  );
}
