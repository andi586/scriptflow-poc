import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — ScriptFlow",
  description: "ScriptFlow Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div
      className="min-h-screen text-white"
      style={{ backgroundColor: "#0A0A0B", fontFamily: "'Inter', sans-serif" }}
    >
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#0A0A0B]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-xl font-extrabold tracking-tight text-[#D4A017]"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            ScriptFlow
          </Link>
          <Link href="/" className="text-sm text-white/60 hover:text-white transition-colors">
            ← Back to Home
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1
          className="mb-2 text-4xl font-extrabold text-white"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          Privacy Policy
        </h1>
        <p className="mb-12 text-sm text-white/40">Last updated: April 2, 2025</p>

        <div className="space-y-10 text-sm leading-relaxed text-white/70">

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">1. You Own Your Content — 100%</h2>
            <p>
              All scripts, characters, videos, audio, and any other creative content generated
              through ScriptFlow using your inputs belong exclusively to you. ScriptFlow claims no
              ownership, license, or rights over your generated content. You retain 100% of the
              intellectual property in everything you create on our platform.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">2. We Do Not Sell Your Data</h2>
            <p>
              ScriptFlow does not sell, rent, trade, or otherwise transfer your personal information
              or usage data to third parties for commercial purposes. Your data is used solely to
              operate and improve the ScriptFlow service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">3. We Do Not Train AI Models on Your Content</h2>
            <p>
              Your private content — including your story ideas, scripts, uploaded images, and
              generated videos — is never used to train, fine-tune, or improve any AI or machine
              learning model, whether operated by ScriptFlow or any third party. Your creative work
              stays yours and is never repurposed for model training.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">4. Data We Collect</h2>
            <p className="mb-3">We collect the following categories of data to operate the service:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Account information (email address, authentication credentials)</li>
              <li>Content you create or upload (story ideas, scripts, reference images)</li>
              <li>Usage data (feature interactions, session duration, error logs)</li>
              <li>Payment information (processed securely by Stripe; we do not store card numbers)</li>
              <li>Device and browser information for security and compatibility purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">5. Your Rights — CCPA &amp; GDPR</h2>
            <p className="mb-3">
              Depending on your jurisdiction, you may have the following rights regarding your
              personal data:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li><strong className="text-white">Right to Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong className="text-white">Right to Deletion:</strong> Request that we delete your personal data and generated content from our systems.</li>
              <li><strong className="text-white">Right to Portability:</strong> Request your data in a portable, machine-readable format.</li>
              <li><strong className="text-white">Right to Opt-Out:</strong> Opt out of any data sharing (note: we do not sell data, but you may still exercise this right).</li>
              <li><strong className="text-white">Right to Correction:</strong> Request correction of inaccurate personal data.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:legal@getscriptflow.com" className="text-[#D4A017] hover:underline">
                legal@getscriptflow.com
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">6. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. Generated content
              is stored to enable you to access and download your projects. Upon account deletion,
              we will delete your personal data and generated content within 30 days, except where
              retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">7. Third-Party Services</h2>
            <p className="mb-3">
              ScriptFlow uses the following third-party services to operate the platform. Each has
              its own privacy policy:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Supabase (database and authentication)</li>
              <li>Anthropic Claude (AI script generation)</li>
              <li>ElevenLabs (AI voice synthesis)</li>
              <li>Kling / PiAPI (AI video generation)</li>
              <li>Stripe (payment processing)</li>
              <li>Vercel (hosting and deployment)</li>
            </ul>
            <p className="mt-3">
              We share only the minimum data necessary with these providers to deliver the service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">8. Security</h2>
            <p>
              We implement industry-standard security measures including encryption in transit
              (TLS), encrypted storage, and access controls. However, no system is 100% secure.
              We encourage you to use a strong, unique password and enable two-factor authentication
              where available.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">9. Governing Law</h2>
            <p>
              This Privacy Policy is governed by the laws of the State of Wyoming, United States,
              without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">10. Contact Us</h2>
            <p>
              For privacy-related questions, data requests, or to exercise your rights, contact us
              at:{" "}
              <a href="mailto:legal@getscriptflow.com" className="text-[#D4A017] hover:underline">
                legal@getscriptflow.com
              </a>
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="text-xs text-white/30">
            © 2025 ScriptFlow. All rights reserved.{" "}
            <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
            {" · "}
            <Link href="/terms" className="hover:text-white/60 transition-colors">Terms of Service</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
