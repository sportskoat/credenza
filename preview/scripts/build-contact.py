import re, os

ROOT = "/Users/kylewensel/credenza/preview/public"
SRC = open(os.path.join(ROOT, "support/index.html"), encoding="utf8").read()

STYLE = re.search(r"<style>.*?</style>", SRC, re.S).group(0)
BRAND = re.search(r'<p class="brand">.*?</p>', SRC, re.S).group(0)
NAV = re.search(r'<nav class="nav".*?</nav>', SRC, re.S).group(0)
FOOTER = re.search(r"<footer>.*?</footer>", SRC, re.S).group(0)

# Mark this page as current in both the nav and the footer, and clear the
# marker the source page carried for itself.
NAV = NAV.replace(' aria-current="page"', "")
NAV = NAV.replace(
    '<a href="/contact/">Contact</a>',
    '<a href="/contact/" aria-current="page">Contact</a>',
)
FOOTER = FOOTER.replace(' aria-current="page"', "")
FOOTER = FOOTER.replace(
    '<a href="/contact/">Contact</a>',
    '<a href="/contact/" aria-current="page">Contact</a>',
)

TITLE = "Contact Credenza — who reads it and how fast"
DESC = ("Reach Credenza Fashion: one address, one person reading it. What to send, "
        "how long a reply takes, and which questions a page already answers.")
OG_DESC = "One address, one person reading it. What to send, and how long a reply takes."

HTML = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{TITLE}</title>
    <meta
      name="description"
      content="{DESC}"
    />
    <meta name="theme-color" content="#f4f4f0" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#050506" media="(prefers-color-scheme: dark)" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
    <link rel="canonical" href="https://credenzafashion.com/contact/" />
    <meta property="og:title" content="Contact Credenza" />
    <meta
      property="og:description"
      content="{OG_DESC}"
    />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://credenzafashion.com/contact/" />
    <meta property="og:site_name" content="Credenza Fashion" />
    <meta property="og:image" content="https://credenzafashion.com/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Credenza Fashion — the agent haul planner" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Contact Credenza" />
    <meta
      name="twitter:description"
      content="{OG_DESC}"
    />
    <meta name="twitter:image" content="https://credenzafashion.com/og.png" />
    {STYLE}
    <script type="application/ld+json">
      {{
        "@context": "https://schema.org",
        "@type": "ContactPage",
        "@id": "https://credenzafashion.com/contact/#page",
        "url": "https://credenzafashion.com/contact/",
        "name": "Contact Credenza",
        "description": "{OG_DESC}",
        "isPartOf": {{
          "@type": "WebSite",
          "name": "Credenza Fashion",
          "url": "https://credenzafashion.com/"
        }},
        "mainEntity": {{
          "@type": "Organization",
          "name": "Credenza Fashion",
          "url": "https://credenzafashion.com/",
          "email": "support@credenzafashion.com",
          "contactPoint": [
            {{
              "@type": "ContactPoint",
              "contactType": "customer support",
              "email": "support@credenzafashion.com",
              "availableLanguage": "English",
              "areaServed": "Worldwide"
            }},
            {{
              "@type": "ContactPoint",
              "contactType": "billing support",
              "email": "support@credenzafashion.com",
              "availableLanguage": "English"
            }},
            {{
              "@type": "ContactPoint",
              "contactType": "technical support",
              "email": "support@credenzafashion.com",
              "availableLanguage": "English"
            }}
          ]
        }}
      }}
    </script>
    <script type="application/ld+json">
      {{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          {{
            "@type": "ListItem",
            "position": 1,
            "name": "Credenza Fashion",
            "item": "https://credenzafashion.com/"
          }},
          {{
            "@type": "ListItem",
            "position": 2,
            "name": "Contact",
            "item": "https://credenzafashion.com/contact/"
          }}
        ]
      }}
    </script>
  </head>
  <body>
    <header>
      {BRAND}
      <h1>Contact</h1>
      <p class="lede">
        One address. One person reads it. This page tells you what to put in the
        message, and how long you wait for a reply.
      </p>
      {NAV}
    </header>

    <main>
      <p class="mail"><a href="mailto:support@credenzafashion.com">support@credenzafashion.com</a></p>

      <p>
        Credenza is a personal project. There is no support desk, no ticket
        number, and no chat widget that routes you to a queue. One person reads
        this address and answers within a few days. Most weeks it is faster.
      </p>

      <h2>Put these three things in the message</h2>
      <p>
        A reply that fixes your problem on the first try needs the same three
        facts almost every time. Send them together and you skip a round trip.
      </p>
      <ol>
        <li>
          <strong>The email address on your Credenza account.</strong> That is
          how we find your plan, your charge, and your synced shelf. An account
          is optional, so say so if you do not have one.
        </li>
        <li>
          <strong>What you expected, and what happened instead.</strong> Two
          sentences beat a paragraph. "I pasted a Weidian link and got a card
          with no photos" is a fixable report.
        </li>
        <li>
          <strong>The link, if a link started it.</strong> Paste the exact URL.
          A seller page that fails to parse is almost always a page nobody has
          tested yet, and we cannot test one we cannot open.
        </li>
      </ol>
      <p>
        Never send a password. Nobody at Credenza will ever ask for one, and
        there is nothing we can do with it that you cannot do yourself.
      </p>

      <h2>How long a reply takes</h2>
      <p>
        A few days is the honest answer. Billing questions move first, because a
        charge you did not want is worse than a bug you can work around. Bug
        reports come next. Feature requests get read, and they get a short
        answer that says yes, no, or not before launch.
      </p>
      <p>
        No reply after a week means the message did not arrive. Spam filters eat
        a small number of them. Send it again rather than assume it was ignored.
      </p>

      <h2>Questions a page already answers</h2>
      <p>
        Four things get asked far more than the rest, and each one has a page
        that answers it in full. Reading the page is faster than waiting for a
        reply that links you to it.
      </p>
      <ul>
        <li>
          <strong>Cancel Pro, or ask for a refund.</strong> You cancel it
          yourself in the Stripe customer portal, at any time. Refunds run in
          full for 14 days after a charge, for any reason.
          <a href="/support/">Support</a> states the whole rule.
        </li>
        <li>
          <strong>Get your shelf out of Credenza.</strong> Download it as a
          .json file, or as a .csv for a spreadsheet.
          <a href="/guides/back-up-your-shelf/">Back up your shelf</a> covers
          what is in each file and what a restore does with duplicates.
        </li>
        <li>
          <strong>What the free plan includes.</strong> Unlimited cards and
          unlimited Buy, with daily limits on the AI features.
          <a href="/pricing/">Pricing</a> lists both plans, and
          <a href="/guides/free-agent-haul-planner/">the free plan guide</a>
          gives the real daily numbers.
        </li>
        <li>
          <strong>What Credenza stores about you.</strong> The shelf lives in
          your browser by default. <a href="/privacy/">Privacy</a> names every
          server record and how long each one stays.
        </li>
      </ul>

      <h2>A size recommendation was wrong</h2>
      <p>
        Send the seller's size chart and your measurements. This is the most
        useful mail we get. Charts disagree with each other, some list hip only
        under 臀围 with no chest row, and a few are simply wrong. A chart that
        breaks the parser usually breaks it for every reader who meets that
        seller, so one report fixes it for everybody.
        <a href="/guides/weidian-size-chart/">Read a Weidian size chart</a>
        explains what the app does with a chart before you send it.
      </p>

      <h2>Report a page that will not parse</h2>
      <p>
        Weidian, Taobao, 1688 and Yupoo all change their markup without notice.
        When a paste produces a card with no title, no price, or no photos, the
        page shape moved. Send the URL and say which field is missing. Do not
        edit the link first — the raw one you pasted is the one that failed.
      </p>
      <p>
        <a href="/guides/yupoo-album-to-shopping-list/">Yupoo album to list</a>
        shows what a working paste produces, which makes it easy to say what
        yours did instead.
      </p>

      <h2>Press, partnerships, and agent programs</h2>
      <p>
        Write to
        <a href="mailto:hello@credenzafashion.com">hello@credenzafashion.com</a>.
        Say which one in the subject line. Credenza is agent agnostic on purpose:
        the preferred agent is a user setting, and stored links stay canonical
        marketplace URLs until the moment somebody opens Buy. We do not rank
        agents for payment, and we do not accept placement in the app.
        <a href="/guides/choose-an-agent/">Choose an agent</a> explains the
        comparison the app actually makes.
      </p>

      <h2>What this address cannot do</h2>
      <p>
        Credenza is not a marketplace and does not sell goods. We hold no
        inventory, take no orders, and have no access to your shopping agent's
        account. Three things follow from that, and no message changes them.
      </p>
      <ul>
        <li>
          <strong>An order problem is your agent's problem.</strong> A parcel
          that is late, a QC photo that shows the wrong item, a refund on a
          purchase — those live with the agent who took your money.
        </li>
        <li>
          <strong>We do not rank sellers or batches.</strong> Credenza organizes
          the links you already found. It does not tell you which seller to buy
          from. <a href="/landing/">About</a> explains where the line sits.
        </li>
        <li>
          <strong>We do not give customs or shipping advice.</strong> Parcel
          weight is arithmetic, and
          <a href="/guides/plan-a-parcel/">Plan a parcel</a> does that part.
          Everything past the border is between you and the carrier.
        </li>
      </ul>

      <h2>Nothing wrong — you just got here first</h2>
      <p>
        Credenza is new, and the roadmap is still short enough that one message
        can move it. If a step in your haul takes longer than it should, say
        which step. That is more useful than a feature name, because the fix is
        often not the feature you would have asked for.
        <a href="/how/">How it works</a> lays out the five steps, which makes it
        easy to point at one.
      </p>
      <p>
        You do not need an account, an email address, or a card to try it.
        <a href="/">Open the app</a>, paste one link, and see what the card
        gives you back. Then write and tell us what it got wrong.
      </p>
    </main>

    {FOOTER}
  </body>
</html>
"""

os.makedirs(os.path.join(ROOT, "contact"), exist_ok=True)
out = os.path.join(ROOT, "contact/index.html")
open(out, "w", encoding="utf8").write(HTML)
print("wrote", out, len(HTML), "bytes")
print("title len:", len(TITLE))
print("desc len:", len(DESC))
