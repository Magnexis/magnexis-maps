export default function SupportReceivedPage() {
  return (
    <main className="mx-auto min-h-[100dvh] max-w-2xl space-y-5 px-6 py-16 text-[var(--mx-text)]">
      <h1 className="font-display text-3xl font-semibold">
        Support request sent
      </h1>
      <p>
        Thank you. Your message has been submitted to Magnexis support. We
        cannot promise an immediate response.
      </p>
      <a href="/" className="text-[var(--mx-accent)] underline">
        Back to Maps
      </a>
    </main>
  );
}
