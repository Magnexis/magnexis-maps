export default function PrivacyPage() {
  return (
    <main
      className="mx-auto min-h-[100dvh] max-w-2xl space-y-8 px-6 py-12 text-[var(--mx-text)]"
      style={{
        paddingTop: "max(3rem, env(safe-area-inset-top))",
        paddingBottom: "max(3rem, env(safe-area-inset-bottom))",
      }}
    >
      <a className="text-[var(--mx-accent)] underline" href="/">
        Back to Maps
      </a>
      <header>
        <p className="text-sm tracking-widest text-[var(--mx-text-muted)]">
          MAGNEXIS MAPS
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Privacy policy
        </h1>
        <p className="mt-3">Magnexis Maps · Effective October 29, 2026</p>
      </header>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Who operates Maps</h2>
        <p>
          Magnexis operates this map, search, and navigation service. This
          policy covers the website and iPhone app that shares its interface.
          For questions and privacy requests, use{" "}
          <a href="/support/" className="underline">
            Maps support
          </a>
          .
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Location and searches</h2>
        <p>
          You can browse without an account or location permission. Locate and
          foreground navigation use device location for positioning and
          guidance. The iPhone app does not enable background location tracking.
          Change permission in your browser or iPhone Settings.
        </p>
        <p>
          Search text, selected coordinates, route origins, destinations, stops,
          and options are sent to the Magnexis API and its configured search or
          routing provider to answer requests. Map and imagery services receive
          the requests and network information needed to respond. The API does
          not add search, route, or location requests to an account history.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Device storage</h2>
        <p>
          Local favorites, recent searches and places, home/work locations,
          units, and appearance settings use browser or app storage. A session
          token is stored when you sign in. Local saves are separate from
          account saves. You can clear history in Settings, remove saves, sign
          out, or clear browser/app storage. Removing the iPhone app removes its
          local data.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Accounts and contributions</h2>
        <p>
          Account creation stores your email, display name, a password hash,
          preferences, roles, and active sessions. Account saves, reports,
          evidence references, votes, business claims, moderation and audit
          records are stored when you use those features. Place corrections may
          become public map data. Do not submit confidential information in
          public contributions.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Service providers and logs</h2>
        <p>
          Netlify hosts the website and API. Neon PostgreSQL stores account and
          contribution records. Netlify Forms processes support submissions.
          Feature providers may include TomTom, Google Maps Platform, MapTiler,
          OpenFreeMap, OpenStreetMap-based routing, and Mapillary; active
          providers and attribution depend on the feature. These services
          process network addresses and request information under their own
          policies. Third-party links open their own services.
        </p>
        <p>
          Hosting and security systems may retain access, error, rate-limit, and
          operational records. The API does not intentionally log request
          bodies, passwords, or full request URLs. Platform access logs and
          provider retention are controlled by those services. We add no
          advertising or analytics SDK and do not sell account information or
          use location for targeted advertising.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          Retention and account deletion
        </h2>
        <p>
          Account and contribution records remain until removed through the
          service. To permanently delete your account, open Account, sign in,
          choose Delete account, enter your password, and type DELETE. This
          removes the account, sessions, account saves, preferences, reports and
          associated records, votes, incident reports, and business submissions
          from the active database.
        </p>
        <p>
          Published place information and revision history can remain with
          account attribution removed. Audit and moderation records can remain
          with the deleted account reference and related identifying details
          removed. You can choose to clear local favorites, home/work, and
          recent history on the device used for deletion. Other devices and
          appearance settings are unaffected. Platform logs and recovery copies
          follow provider retention; active-database deletion does not instantly
          erase those copies.
        </p>
        <p>
          Support messages and email addresses remain in the support dashboard
          until removed by Magnexis. Request removal through support. Do not
          send credentials or sensitive location information. We do not promise
          a fixed deletion deadline for platform backups or logs the application
          cannot directly erase.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Your choices and requests</h2>
        <p>
          You can browse account-free, decline location, manage local data, sign
          out, or delete your account. To request access, correction, an export,
          or removal of information you cannot manage in the app, contact{" "}
          <a href="/support/" className="underline">
            Maps support
          </a>
          . We may need to verify ownership. Applicable rights depend on your
          location. The service is not directed to children under 13; contact
          support if a child has provided account information.
        </p>
        <p>
          Data may be processed in countries where hosting and feature providers
          operate, including the United States. Production transport uses HTTPS
          and passwords are hashed, but we cannot guarantee absolute security.
          We will update this page when our practices change.
        </p>
      </section>
    </main>
  );
}
