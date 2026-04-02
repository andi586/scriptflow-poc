import Link from "next/link";

export const metadata = {
  title: "Terms of Service — ScriptFlow",
  description: "ScriptFlow Terms of Service",
};

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="mb-12 text-sm text-white/40">Last updated: April 2, 2025</p>

        <div className="space-y-10 text-sm leading-relaxed text-white/70">

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">1. Acceptance of Terms</h2>
            <p>
              By accessing or using ScriptFlow (&quot;the Service&quot;), you agree to be bound by
              these Terms of Service. If you do not agree to these terms, do not use the Service.
              These terms apply to all users, including free and paid subscribers.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">2. AI Disclaimer</h2>
            <p className="mb-3">
              ScriptFlow uses artificial intelligence to generate scripts, video, voice, music, and
              other creative content. By using the Service, you acknowledge and agree that:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                AI-generated content may be imperfect, inaccurate, or unexpected. ScriptFlow makes
                no warranty that generated content will meet your specific requirements.
              </li>
              <li>
                AI models may occasionally produce content that is repetitive, inconsistent, or
                does not match your intent. You are responsible for reviewing and editing generated
                content before publication.
              </li>
              <li>
                ScriptFlow is not liable for any damages arising from the use of AI-generated
                content, including but not limited to reputational harm, copyright disputes, or
                platform policy violations.
              </li>
              <li>
                You are solely responsible for ensuring that your use of AI-generated content
                complies with applicable laws and platform policies where you publish.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">3. Intellectual Property — You Own 100% of Your IP</h2>
            <p className="mb-3">
              All creative content generated through ScriptFlow using your inputs — including
              scripts, characters, storylines, videos, audio, and visual assets — is your
              intellectual property. ScriptFlow claims no ownership, co-authorship, or license
              over your generated content.
            </p>
            <p>
              You may publish, monetize, license, sell, or otherwise exploit your generated content
              on any platform without restriction from ScriptFlow. You retain 100% of your IP
              rights in perpetuity, regardless of your subscription status.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">4. Watermark Policy</h2>
            <p className="mb-3">
              ScriptFlow applies watermarks to exported videos based on your subscription plan:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-white">Basic Plan:</strong> All exported videos include a
                mandatory ScriptFlow watermark. The watermark cannot be removed on the Basic plan.
              </li>
              <li>
                <strong className="text-white">Professional Plan:</strong> Watermark-free exports
                are available. You may publish content without any ScriptFlow branding.
              </li>
              <li>
                <strong className="text-white">Studio Plan:</strong> Watermark-free exports with
                white-label options. Full control over branding.
              </li>
            </ul>
            <p className="mt-3">
              Attempting to remove, obscure, or circumvent watermarks on the Basic plan is a
              violation of these Terms and may result in account suspension.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">5. Acceptable Use</h2>
            <p className="mb-3">You agree not to use ScriptFlow to generate content that:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Infringes on the intellectual property rights of any third party</li>
              <li>Is defamatory, harassing, threatening, or abusive</li>
              <li>Depicts or promotes illegal activities</li>
              <li>Contains explicit sexual content involving minors</li>
              <li>Is designed to deceive, defraud, or manipulate others</li>
              <li>Violates any applicable local, state, national, or international law</li>
            </ul>
            <p className="mt-3">
              ScriptFlow reserves the right to suspend or terminate accounts that violate these
              acceptable use policies.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">6. Revenue Share</h2>
            <p>
              ScriptFlow offers a revenue sharing program where creators earn 65% of revenue
              generated through ScriptFlow&apos;s distribution network. Revenue share terms,
              payment schedules, and eligibility requirements are detailed in your subscription
              agreement and may be updated with 30 days&apos; notice.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">7. Subscription and Billing</h2>
            <p className="mb-3">
              ScriptFlow offers monthly subscription plans. By subscribing, you authorize
              ScriptFlow to charge your payment method on a recurring basis. You may cancel your
              subscription at any time; cancellation takes effect at the end of the current billing
              period. No refunds are provided for partial months.
            </p>
            <p>
              ScriptFlow reserves the right to modify pricing with 30 days&apos; advance notice to
              existing subscribers.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, ScriptFlow shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, including but not
              limited to loss of profits, data, or goodwill, arising from your use of the Service.
              ScriptFlow&apos;s total liability to you for any claims arising from these Terms shall
              not exceed the amount you paid to ScriptFlow in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">9. Disclaimer of Warranties</h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available&quot; without
              warranties of any kind, either express or implied, including but not limited to
              implied warranties of merchantability, fitness for a particular purpose, or
              non-infringement. ScriptFlow does not warrant that the Service will be uninterrupted,
              error-free, or free of viruses or other harmful components.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">10. Governing Law &amp; Dispute Resolution</h2>
            <p>
              These Terms of Service are governed by the laws of the State of Wyoming, United
              States, without regard to its conflict of law provisions. Any disputes arising from
              these Terms shall be resolved through binding arbitration in Wyoming, except that
              either party may seek injunctive relief in a court of competent jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">11. Changes to Terms</h2>
            <p>
              ScriptFlow reserves the right to modify these Terms at any time. We will notify you
              of material changes via email or in-app notification at least 14 days before the
              changes take effect. Continued use of the Service after changes take effect
              constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">12. Contact</h2>
            <p>
              For questions about these Terms, contact us at:{" "}
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
